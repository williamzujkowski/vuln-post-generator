// LangSmith Tracing and Observability
import { Client } from "langsmith";
import config from "../config/index.js";

/**
 * LangSmith tracing utilities for observability
 */
class TracingUtil {
  constructor() {
    this.client = null;
    this.isEnabled = false;
    this.initialize();
  }

  /**
   * Initialize LangSmith client
   */
  initialize() {
    try {
      // Check if tracing is explicitly enabled
      const tracingEnabled = process.env.ENABLE_TRACING === 'true';
      
      // Check for required environment variables
      const apiKey = process.env.LANGSMITH_API_KEY;
      const projectName = process.env.LANGSMITH_PROJECT || "vuln-post-generator";
      
      if (!tracingEnabled) {
        console.log("LangSmith tracing disabled: Not enabled via command line or environment");
        this.isEnabled = false;
        return;
      }
      
      if (!apiKey) {
        console.log("LangSmith tracing disabled: No LANGSMITH_API_KEY found");
        this.isEnabled = false;
        return;
      }

      // Configure environment for LangSmith
      process.env.LANGCHAIN_TRACING_V2 = "true";
      process.env.LANGCHAIN_PROJECT = projectName;
      
      // Create LangSmith client
      this.client = new Client({
        apiKey: apiKey,
        projectName: projectName
      });
      
      this.isEnabled = true;
      console.log(`LangSmith tracing enabled for project: ${projectName}`);
    } catch (error) {
      console.error("Failed to initialize LangSmith tracing:", error);
      this.isEnabled = false;
    }
  }

  /**
   * Track an LLM run with LangSmith
   * @param {string} name - Name of the run
   * @param {Object} inputs - Input data
   * @param {Object} outputs - Output data
   * @param {Object} metadata - Additional metadata
   */
  async trackRun(name, inputs, outputs, metadata = {}) {
    if (!this.isEnabled || !this.client) {
      return;
    }
    
    try {
      await this.client.createRun({
        name,
        inputs,
        outputs,
        runtime: {
          ...metadata,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString()
        }
      });
    } catch (error) {
      console.warn("Failed to track run in LangSmith:", error.message);
    }
  }

  /**
   * Wrap a function with LangSmith tracing
   * @param {Function} fn - Function to wrap
   * @param {string} name - Name of the function
   * @param {Object} metadata - Additional metadata
   * @returns {Function} - Wrapped function
   */
  traceFunction(fn, name, metadata = {}) {
    if (!this.isEnabled) {
      return fn;
    }
    
    const self = this;
    return async function(...args) {
      const startTime = new Date();
      let result;
      let error = null;
      
      try {
        result = await fn.apply(this, args);
        return result;
      } catch (err) {
        error = err;
        throw err;
      } finally {
        if (self.isEnabled) {
          const endTime = new Date();
          
          try {
            await self.client.createRun({
              name,
              inputs: { args },
              outputs: error ? { error: error.message } : { result },
              runtime: {
                ...metadata,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration: endTime - startTime,
                success: !error
              }
            });
          } catch (trackingError) {
            console.warn("Failed to track function in LangSmith:", trackingError.message);
          }
        }
      }
    };
  }

  /**
   * Get LangSmith dashboard URL for the current project
   * @returns {string} - Dashboard URL
   */
  getDashboardUrl() {
    if (!this.isEnabled) {
      return null;
    }
    
    const projectName = process.env.LANGSMITH_PROJECT || "vuln-post-generator";
    return `https://smith.langchain.com/projects/${encodeURIComponent(projectName)}`;
  }
}

// Export singleton instance
export default new TracingUtil();