/**
 * Enhanced error handler for the vulnerability post generator
 * - Structured error logging
 * - Detailed error messages
 * - Error categorization
 * - Recovery suggestions
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import metricsLogger from './metrics-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ERROR_LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const ERROR_LOG_FILE = path.join(ERROR_LOG_DIR, 'errors.log');

// Ensure error log directory exists
if (!fs.existsSync(ERROR_LOG_DIR)) {
  fs.mkdirSync(ERROR_LOG_DIR, { recursive: true });
}

/**
 * Error categories for classification
 */
const ERROR_CATEGORIES = {
  API: 'API_ERROR',
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTHENTICATION_ERROR',
  INPUT: 'INPUT_ERROR',
  CONFIG: 'CONFIGURATION_ERROR',
  LLM: 'LLM_ERROR',
  IO: 'FILE_IO_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Centralized error handler for consistent error processing
 */
class ErrorHandler {
  /**
   * Handle an error with consistent formatting and logging
   * @param {Error} error - The error object
   * @param {string} component - Context where the error occurred
   * @param {boolean} exitProcess - Whether this is a fatal error that should terminate the process
   * @returns {Object} - Formatted error information
   */
  static handleError(error, component = 'Unknown', exitProcess = false) {
    try {
      // Determine error category
      const category = this.categorizeError(error);
      
      // Create structured error object
      const structuredError = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        component,
        category,
        code: error.code || 'UNKNOWN',
        details: this.extractErrorDetails(error)
      };
      
      // Log to console
      console.error(`[${component}] ${category}: ${error.message}`);
      
      // Log to file
      this.appendToErrorLog(structuredError);
      
      // Track error in metrics
      metricsLogger.logError(structuredError);
      
      // Provide recovery suggestion
      const suggestion = this.getSuggestion(category, error);
      if (suggestion) {
        console.log(`SUGGESTION: ${suggestion}`);
      }
      
      // Exit process if requested
      if (exitProcess) {
        console.error('Exiting process due to unrecoverable error');
        process.exit(1);
      }
      
      return structuredError;
    } catch (handlerError) {
      // Fallback for errors in the error handler itself
      console.error('Error in error handler:', handlerError);
      console.error('Original error:', error);
      
      if (exitProcess) {
        process.exit(1);
      }
      
      return {
        timestamp: new Date().toISOString(),
        message: error.message || 'Unknown error',
        category: ERROR_CATEGORIES.UNKNOWN,
        component
      };
    }
  }

  /**
   * Categorize an error based on its properties and message
   * @param {Error} error - The error to categorize
   * @returns {string} - Error category
   */
  static categorizeError(error) {
    // Network errors (axios, fetch)
    if (error.isAxiosError || error.name === 'FetchError' || 
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('ENOTFOUND') ||
        error.message.includes('network')) {
      return ERROR_CATEGORIES.NETWORK;
    }
    
    // API errors
    if (error.response || error.statusCode || 
        error.message.includes('API') || 
        error.message.includes('status code')) {
      return ERROR_CATEGORIES.API;
    }
    
    // Authentication errors
    if (error.message.includes('authentication') || 
        error.message.includes('auth') || 
        error.message.includes('token') || 
        error.message.includes('credential') ||
        error.message.includes('API key') ||
        error.status === 401 || error.status === 403) {
      return ERROR_CATEGORIES.AUTH;
    }
    
    // LLM errors
    if (error.message.includes('LLM') || 
        error.message.includes('model') || 
        error.message.includes('OpenAI') || 
        error.message.includes('Claude') || 
        error.message.includes('Gemini') ||
        error.message.includes('token limit') ||
        error.message.includes('rate limit')) {
      return ERROR_CATEGORIES.LLM;
    }
    
    // File I/O errors
    if (error.code === 'ENOENT' || 
        error.code === 'EACCES' || 
        error.message.includes('file') || 
        error.message.includes('directory') || 
        error.message.includes('permission denied')) {
      return ERROR_CATEGORIES.IO;
    }
    
    // Configuration errors
    if (error.message.includes('config') || 
        error.message.includes('environment') || 
        error.message.includes('env') || 
        error.message.includes('missing')) {
      return ERROR_CATEGORIES.CONFIG;
    }
    
    // Input errors
    if (error.message.includes('input') || 
        error.message.includes('parameter') || 
        error.message.includes('invalid') || 
        error.message.includes('required')) {
      return ERROR_CATEGORIES.INPUT;
    }
    
    // Default to unknown
    return ERROR_CATEGORIES.UNKNOWN;
  }

  /**
   * Extract detailed information from an error object
   * @param {Error} error - The error object
   * @returns {Object} - Extracted error details
   */
  static extractErrorDetails(error) {
    const details = {};
    
    // Extract axios error details
    if (error.isAxiosError) {
      if (error.response) {
        details.status = error.response.status;
        details.statusText = error.response.statusText;
        details.url = error.config.url;
        details.method = error.config.method;
        
        // Include response data (limited size)
        if (error.response.data) {
          try {
            const dataStr = JSON.stringify(error.response.data);
            details.responseData = dataStr.substring(0, 1000);
          } catch (e) {
            details.responseData = 'Error serializing response data';
          }
        }
      } else if (error.request) {
        details.url = error.config.url;
        details.method = error.config.method;
        details.noResponse = true;
      }
    }
    
    // Extract standard Error properties
    if (error.code) details.code = error.code;
    if (error.errno) details.errno = error.errno;
    if (error.syscall) details.syscall = error.syscall;
    if (error.path) details.path = error.path;
    if (error.statusCode) details.statusCode = error.statusCode;
    
    return details;
  }

  /**
   * Get a suggestion for recovery based on error category
   * @param {string} category - The error category
   * @param {Error} error - The original error
   * @returns {string|null} - A suggestion for recovery
   */
  static getSuggestion(category, error) {
    switch (category) {
      case ERROR_CATEGORIES.API:
        if (error.response && error.response.status === 429) {
          return 'Rate limited by API. Wait a few minutes and try again.';
        }
        if (error.response && error.response.status >= 500) {
          return 'External API service is experiencing issues. Try again later.';
        }
        return 'Check API endpoints and request format. See logs for details.';
        
      case ERROR_CATEGORIES.NETWORK:
        return 'Check your internet connection. Ensure API services are accessible.';
        
      case ERROR_CATEGORIES.AUTH:
        return 'Verify your API keys in the environment variables or configuration files.';
        
      case ERROR_CATEGORIES.INPUT:
        return 'Check input parameters and data formats. Ensure CVE ID is valid.';
        
      case ERROR_CATEGORIES.CONFIG:
        return 'Check environment variables and configuration files. Missing or invalid settings.';
        
      case ERROR_CATEGORIES.LLM:
        if (error.message.includes('token limit')) {
          return 'Input too large for LLM token limit. Try reducing input size or using a different model.';
        }
        if (error.message.includes('rate limit') || error.message.includes('quota')) {
          return 'LLM provider rate limit exceeded. Wait or try a different provider with --provider flag.';
        }
        return 'Try using a different LLM provider with the --provider flag.';
        
      case ERROR_CATEGORIES.IO:
        if (error.code === 'ENOENT') {
          return 'File or directory not found. Check paths and create missing directories.';
        }
        if (error.code === 'EACCES') {
          return 'Permission denied when accessing file. Check file permissions.';
        }
        return 'Check file paths and permissions. Ensure output directory exists.';
        
      case ERROR_CATEGORIES.UNKNOWN:
      default:
        return 'Unexpected error. Check logs for details.';
    }
  }

  /**
   * Append an error to the log file
   * @param {Object} errorData - Structured error data
   */
  static appendToErrorLog(errorData) {
    try {
      const logEntry = `[${errorData.timestamp}] [${errorData.category}] [${errorData.component}] ${errorData.message}\n` +
                       `${JSON.stringify(errorData, null, 2)}\n` +
                       '------------------------------------------------------------------------------\n';
      
      fs.appendFileSync(ERROR_LOG_FILE, logEntry);
    } catch (error) {
      console.error('Failed to write to error log:', error);
    }
  }

  /**
   * Create a standardized error object
   * @param {string} message - Error message
   * @param {string} context - Error context
   * @param {string} category - Error category from ERROR_CATEGORIES
   * @returns {Error} - Enhanced error object
   */
  static createError(message, context, category = ERROR_CATEGORIES.UNKNOWN) {
    const error = new Error(message);
    error.context = context;
    error.category = category;
    error.timestamp = new Date().toISOString();
    
    return error;
  }
}

// Export both the class and the categories
export default {
  ...ErrorHandler,
  ERROR_CATEGORIES
};