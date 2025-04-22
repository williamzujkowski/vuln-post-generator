// LangSmith API integration for dashboard
import { Client } from "langsmith";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import metricsLogger from '../utils/metrics-logger.js';

// Directory setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * LangSmith API client for dashboard data
 */
class LangSmithAPI {
  constructor() {
    this.client = null;
    this.isEnabled = false;
    this.projectName = null;
    this.cacheDir = path.join(__dirname, '../../../../src/_data/core/langsmith-data.json');
    this.initialize();
  }

  /**
   * Initialize LangSmith client
   */
  initialize() {
    try {
      // Check for API key
      const apiKey = process.env.LANGSMITH_API_KEY;
      this.projectName = process.env.LANGSMITH_PROJECT || "vuln-post-generator";
      
      if (!apiKey) {
        console.log("LangSmith API disabled: No LANGSMITH_API_KEY found");
        this.isEnabled = false;
        return;
      }
      
      // Create LangSmith client
      this.client = new Client({
        apiKey: apiKey,
        projectName: this.projectName
      });
      
      this.isEnabled = true;
      console.log(`LangSmith API enabled for project: ${this.projectName}`);
    } catch (error) {
      console.error("Failed to initialize LangSmith API:", error);
      this.isEnabled = false;
    }
  }

  /**
   * Get dashboard data for the website
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData() {
    // Check if LangSmith API is enabled
    if (!this.isEnabled || !this.client) {
      console.log("LangSmith API not available, using local metrics data");
      return this.getLocalMetricsData();
    }
    
    try {
      // Fetch runs from LangSmith
      const runs = await this.client.listRuns({
        projectName: this.projectName,
        executionOrder: "desc",
        limit: 100
      });
      
      // Process runs data
      const processingTimes = [];
      const tokenUsage = [];
      const runsByDate = {};
      const runsByModel = {};
      let totalCost = 0;
      
      runs.forEach(run => {
        // Calculate processing time
        if (run.startTime && run.endTime) {
          const startTime = new Date(run.startTime);
          const endTime = new Date(run.endTime);
          const processingTime = (endTime - startTime) / 1000; // in seconds
          processingTimes.push(processingTime);
        }
        
        // Get token usage
        if (run.metrics && run.metrics.tokenUsage) {
          const inputTokens = run.metrics.tokenUsage.promptTokens || 0;
          const outputTokens = run.metrics.tokenUsage.completionTokens || 0;
          
          tokenUsage.push({
            input: inputTokens,
            output: outputTokens,
            total: run.metrics.tokenUsage.totalTokens || (inputTokens + outputTokens),
            runId: run.id
          });
          
          // Estimate cost if possible
          if (run.extra && run.extra.model) {
            // Simple cost estimation function
            const estimateCost = (model, inputTokens, outputTokens) => {
              // Cost rates per 1000 tokens in USD
              const costRates = {
                // OpenAI models
                'gpt-4': { input: 0.03, output: 0.06 },
                'gpt-4-turbo': { input: 0.01, output: 0.03 },
                'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
                
                // Claude models
                'claude-3-opus': { input: 0.015, output: 0.075 },
                'claude-3-sonnet': { input: 0.003, output: 0.015 },
                'claude-3-haiku': { input: 0.00025, output: 0.00125 },
                
                // Gemini models
                'gemini-pro': { input: 0.00025, output: 0.0005 },
                'gemini-ultra': { input: 0.00125, output: 0.00375 },
                
                // Default rates
                'default': { input: 0.001, output: 0.002 }
              };
              
              // Get rates for the model or use default
              const rates = costRates[model] || costRates.default;
              
              // Calculate cost
              return ((inputTokens / 1000) * rates.input) + ((outputTokens / 1000) * rates.output);
            };
            
            const cost = estimateCost(run.extra.model, inputTokens, outputTokens);
            totalCost += cost;
          }
        }
        
        // Group by date
        if (run.startTime) {
          const dateKey = new Date(run.startTime).toISOString().split('T')[0];
          runsByDate[dateKey] = (runsByDate[dateKey] || 0) + 1;
        }
        
        // Group by model
        if (run.extra && run.extra.model) {
          const model = run.extra.model;
          runsByModel[model] = (runsByModel[model] || 0) + 1;
        }
      });
      
      // Calculate stats
      const avgProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0;
      
      const avgTokens = tokenUsage.length > 0
        ? tokenUsage.reduce((a, b) => a + b.total, 0) / tokenUsage.length
        : 0;
      
      // Prepare dashboard data
      const dashboardData = {
        totalRuns: runs.length,
        avgProcessingTime,
        avgTokenUsage: avgTokens,
        totalCost: totalCost,
        runsByDate: Object.entries(runsByDate)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        runsByModel: Object.entries(runsByModel)
          .map(([model, count]) => ({ model, count }))
          .sort((a, b) => b.count - a.count),
        recentRuns: runs.slice(0, 10).map(run => ({
          id: run.id,
          name: run.name,
          startTime: run.startTime,
          endTime: run.endTime,
          status: run.status,
          model: run.extra?.model || 'unknown',
          inputTokens: run.metrics?.tokenUsage?.promptTokens || 0,
          outputTokens: run.metrics?.tokenUsage?.completionTokens || 0
        })),
        lastUpdated: new Date().toISOString(),
        dataSource: 'langsmith'
      };
      
      // Save to cache
      this.saveDashboardData(dashboardData);
      
      return dashboardData;
    } catch (error) {
      console.error("Failed to fetch LangSmith dashboard data:", error);
      return this.getLocalMetricsData();
    }
  }
  
  /**
   * Save dashboard data to cache file
   * @param {Object} data - Dashboard data
   */
  saveDashboardData(data) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.cacheDir);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write data to file
      fs.writeFileSync(this.cacheDir, JSON.stringify(data, null, 2));
      console.log(`Saved LangSmith dashboard data to: ${this.cacheDir}`);
    } catch (error) {
      console.error("Failed to save LangSmith dashboard data:", error);
    }
  }
  
  /**
   * Get dashboard data from local metrics
   * @returns {Object} Local metrics dashboard data
   */
  getLocalMetricsData() {
    try {
      // Get data from metrics logger
      const localData = metricsLogger.getDashboardData();
      console.log(`Using local metrics data with ${localData.totalRuns} runs`);
      
      // Save to cache for redundancy
      this.saveDashboardData(localData);
      
      return localData;
    } catch (error) {
      console.error("Failed to get local metrics data:", error);
      return this.getFallbackCachedData();
    }
  }
  
  /**
   * Get fallback dashboard data from cache or empty
   * @returns {Object} Fallback dashboard data
   */
  getFallbackCachedData() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        // Use cached data if available
        const cachedData = JSON.parse(fs.readFileSync(this.cacheDir, 'utf8'));
        console.log("Using cached dashboard data");
        return {
          ...cachedData,
          isCached: true
        };
      }
    } catch (error) {
      console.error("Failed to read cached dashboard data:", error);
    }
    
    // Return empty data structure
    return {
      totalRuns: 0,
      avgProcessingTime: 0,
      avgTokenUsage: 0,
      totalCost: 0,
      runsByDate: [],
      runsByModel: [],
      recentRuns: [],
      lastUpdated: new Date().toISOString(),
      isCached: false
    };
  }
  
  /**
   * Get the LangSmith dashboard URL
   * @returns {string} Dashboard URL
   */
  getDashboardUrl() {
    return `https://smith.langchain.com/projects/${encodeURIComponent(this.projectName)}`;
  }
}

export default new LangSmithAPI();