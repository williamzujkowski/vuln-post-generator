// Enhanced metrics logging system for LLM usage and API calls
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Directory setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logs directory for detailed metrics
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Log file paths
const API_LOG_PATH = path.join(LOGS_DIR, 'api-calls.jsonl');
const ERROR_LOG_PATH = path.join(LOGS_DIR, 'errors.jsonl');

/**
 * Metrics Logger for tracking LLM usage, API calls, and errors
 */
class MetricsLogger {
  constructor() {
    this.metricsFile = path.join(__dirname, '..', '..', '..', '..', 'src', '_data', 'core', 'llm-metrics.json');
    this.metrics = this.loadMetrics();
  }

  /**
   * Load metrics from file
   * @returns {Object} Metrics data
   */
  loadMetrics() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.metricsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Load existing metrics or initialize with defaults
      if (fs.existsSync(this.metricsFile)) {
        const data = fs.readFileSync(this.metricsFile, 'utf8');
        return JSON.parse(data);
      } else {
        return {
          runs: [],
          runsByDate: {},
          runsByModel: {},
          totalTokens: 0,
          totalCost: 0,
          avgProcessingTime: 0,
          totalRuns: 0,
          apiCalls: {
            total: 0,
            byEndpoint: {},
            byStatus: {},
            cacheHitRate: 0,
            retryRate: 0
          },
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
      return {
        runs: [],
        runsByDate: {},
        runsByModel: {},
        totalTokens: 0,
        totalCost: 0,
        avgProcessingTime: 0,
        totalRuns: 0,
        apiCalls: {
          total: 0,
          byEndpoint: {},
          byStatus: {},
          cacheHitRate: 0,
          retryRate: 0
        },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Save metrics to file
   */
  saveMetrics() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.metricsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Update last updated timestamp
      this.metrics.lastUpdated = new Date().toISOString();

      // Write metrics to file
      fs.writeFileSync(
        this.metricsFile,
        JSON.stringify(this.metrics, null, 2),
        'utf8'
      );
      console.log(`Metrics saved to: ${this.metricsFile}`);
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  /**
   * Log a completed LLM run
   * @param {Object} runData - Data about the run
   */
  logRun(runData) {
    try {
      const {
        id = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name = 'unnamed-run',
        model = 'unknown',
        startTime = new Date().toISOString(),
        endTime = new Date().toISOString(),
        inputTokens = 0,
        outputTokens = 0,
        status = 'success',
        metadata = {}
      } = runData;

      // Calculate duration
      const start = new Date(startTime);
      const end = new Date(endTime);
      const durationSeconds = (end - start) / 1000;

      // Create run record
      const run = {
        id,
        name,
        model,
        startTime,
        endTime,
        duration: durationSeconds,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        status,
        metadata,
        cost: this.calculateCost(model, inputTokens, outputTokens)
      };

      // Add to runs list, keeping most recent 30 runs for dashboard display
      this.metrics.runs.unshift(run);
      if (this.metrics.runs.length > 30) {
        this.metrics.runs = this.metrics.runs.slice(0, 30);
      }

      // Update run by date metrics
      const dateKey = start.toISOString().split('T')[0];
      this.metrics.runsByDate[dateKey] = (this.metrics.runsByDate[dateKey] || 0) + 1;

      // Update run by model metrics
      this.metrics.runsByModel[model] = (this.metrics.runsByModel[model] || 0) + 1;

      // Update aggregate metrics
      this.metrics.totalRuns += 1;
      this.metrics.totalTokens += run.totalTokens;
      this.metrics.totalCost += run.cost;

      // Recalculate average processing time
      const totalProcessingTime = this.metrics.avgProcessingTime * (this.metrics.totalRuns - 1) + durationSeconds;
      this.metrics.avgProcessingTime = totalProcessingTime / this.metrics.totalRuns;

      // Save updated metrics
      this.saveMetrics();

      console.log(`Logged run: ${id} (${model}, ${run.totalTokens} tokens, ${durationSeconds.toFixed(2)}s)`);
    } catch (error) {
      console.error('Error logging run:', error);
    }
  }

  /**
   * Log an API call
   * @param {Object} data - Data about the API call
   */
  logApiCall(data) {
    try {
      const timestamp = new Date().toISOString();
      const apiCall = {
        timestamp,
        ...data
      };

      // Append to detailed log file
      fs.appendFileSync(
        API_LOG_PATH,
        JSON.stringify(apiCall) + '\n',
        'utf8'
      );

      // Extract host from URL for endpoint tracking
      let endpoint = 'unknown';
      try {
        if (data.url) {
          const url = new URL(data.url);
          endpoint = url.hostname;
        }
      } catch (e) {
        // If URL parsing fails, use the raw URL string
        endpoint = String(data.url).split('/')[2] || 'unknown';
      }

      // Update summary metrics
      this.metrics.apiCalls = this.metrics.apiCalls || {
        total: 0,
        byEndpoint: {},
        byStatus: {},
        cacheHitRate: 0,
        retryRate: 0
      };

      // Increment call counters
      this.metrics.apiCalls.total += 1;
      
      // Update endpoint stats
      this.metrics.apiCalls.byEndpoint[endpoint] = 
        (this.metrics.apiCalls.byEndpoint[endpoint] || 0) + 1;
      
      // Update status stats
      const status = data.status || 'unknown';
      this.metrics.apiCalls.byStatus[status] = 
        (this.metrics.apiCalls.byStatus[status] || 0) + 1;
      
      // Update cache hit stats if applicable
      if (data.cached !== undefined) {
        // Calculate new cache hit rate
        const totalWithCacheInfo = Object.values(this.metrics.apiCalls.byStatus).reduce((a, b) => a + b, 0);
        const cacheHits = this.metrics.apiCalls.cacheHits || 0;
        const newCacheHits = data.cached ? cacheHits + 1 : cacheHits;
        
        this.metrics.apiCalls.cacheHits = newCacheHits;
        this.metrics.apiCalls.cacheHitRate = totalWithCacheInfo > 0 
          ? (newCacheHits / totalWithCacheInfo) * 100 
          : 0;
      }
      
      // Save updated metrics
      this.saveMetrics();
    } catch (error) {
      console.error('Error logging API call:', error);
    }
  }

  /**
   * Log an API retry event
   * @param {Object} data - Data about the API retry
   */
  logApiRetry(data) {
    try {
      const timestamp = new Date().toISOString();
      const retryEvent = {
        timestamp,
        type: 'retry',
        ...data
      };

      // Append to detailed log file
      fs.appendFileSync(
        API_LOG_PATH,
        JSON.stringify(retryEvent) + '\n',
        'utf8'
      );

      // Update retry metrics
      this.metrics.apiCalls = this.metrics.apiCalls || {
        total: 0,
        byEndpoint: {},
        byStatus: {},
        cacheHitRate: 0,
        retryRate: 0,
        retries: 0
      };

      // Increment retry counter
      this.metrics.apiCalls.retries = (this.metrics.apiCalls.retries || 0) + 1;
      
      // Update retry rate
      this.metrics.apiCalls.retryRate = this.metrics.apiCalls.total > 0 
        ? (this.metrics.apiCalls.retries / this.metrics.apiCalls.total) * 100 
        : 0;
      
      // Save updated metrics
      this.saveMetrics();
    } catch (error) {
      console.error('Error logging API retry:', error);
    }
  }

  /**
   * Log an error
   * @param {Object} data - Data about the error
   */
  logError(data) {
    try {
      const timestamp = new Date().toISOString();
      const errorEvent = {
        timestamp,
        ...data
      };

      // Append to detailed log file
      fs.appendFileSync(
        ERROR_LOG_PATH,
        JSON.stringify(errorEvent) + '\n',
        'utf8'
      );
    } catch (error) {
      console.error('Error logging error event:', error);
    }
  }

  /**
   * Calculate estimated cost for the run
   * @param {string} model - Model name
   * @param {number} inputTokens - Input token count
   * @param {number} outputTokens - Output token count
   * @returns {number} - Estimated cost in USD
   */
  calculateCost(model, inputTokens, outputTokens) {
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
    const inputCost = (inputTokens / 1000) * rates.input;
    const outputCost = (outputTokens / 1000) * rates.output;
    
    return inputCost + outputCost;
  }

  /**
   * Get formatted dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    try {
      // Format runs by date for charting
      const runsByDate = Object.entries(this.metrics.runsByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
        
      // Format runs by model for charting
      const runsByModel = Object.entries(this.metrics.runsByModel)
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count);
        
      // Prepare recent runs data
      const recentRuns = this.metrics.runs
        .map(run => ({
          id: run.id,
          name: run.name,
          startTime: run.startTime,
          endTime: run.endTime,
          status: run.status,
          model: run.model,
          inputTokens: run.inputTokens,
          outputTokens: run.outputTokens
        }));
      
      // Format API calls by endpoint for charting
      const apiCallsByEndpoint = this.metrics.apiCalls?.byEndpoint 
        ? Object.entries(this.metrics.apiCalls.byEndpoint)
            .map(([endpoint, count]) => ({ endpoint, count }))
            .sort((a, b) => b.count - a.count)
        : [];
            
      // Return formatted dashboard data
      return {
        totalRuns: this.metrics.totalRuns,
        avgProcessingTime: this.metrics.avgProcessingTime,
        avgTokenUsage: this.metrics.totalRuns > 0 
          ? this.metrics.totalTokens / this.metrics.totalRuns 
          : 0,
        totalCost: this.metrics.totalCost,
        runsByDate,
        runsByModel,
        recentRuns,
        apiStats: {
          totalCalls: this.metrics.apiCalls?.total || 0,
          cacheHitRate: this.metrics.apiCalls?.cacheHitRate || 0,
          retryRate: this.metrics.apiCalls?.retryRate || 0,
          callsByEndpoint: apiCallsByEndpoint,
          callsByStatus: this.metrics.apiCalls?.byStatus || {}
        },
        lastUpdated: this.metrics.lastUpdated,
        isLocalData: true
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return {
        totalRuns: 0,
        avgProcessingTime: 0,
        avgTokenUsage: 0,
        totalCost: 0,
        runsByDate: [],
        runsByModel: [],
        recentRuns: [],
        apiStats: {
          totalCalls: 0,
          cacheHitRate: 0,
          retryRate: 0,
          callsByEndpoint: [],
          callsByStatus: {}
        },
        lastUpdated: new Date().toISOString(),
        isLocalData: true,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new MetricsLogger();