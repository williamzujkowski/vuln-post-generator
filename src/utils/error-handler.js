// Centralized error handling for vulnerability post generator

/**
 * Centralized error handler for consistent error processing
 */
class ErrorHandler {
  /**
   * Handle an error with consistent formatting and logging
   * @param {Error} error - The error object
   * @param {string} context - Context where the error occurred
   * @param {boolean} isFatal - Whether this is a fatal error that should terminate the process
   * @returns {Object} - Formatted error information
   */
  static handleError(error, context, isFatal = false) {
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      context,
      message: error.message,
      stack: error.stack,
      fatal: isFatal
    };
    
    // Add API response details if available
    if (error.response) {
      errorInfo.statusCode = error.response.status;
      errorInfo.statusText = error.response.statusText;
      
      // Add safe response data
      try {
        if (typeof error.response.data === 'object') {
          errorInfo.responseData = JSON.stringify(error.response.data);
        } else if (typeof error.response.data === 'string') {
          // Truncate long response data
          errorInfo.responseData = error.response.data.substring(0, 500);
          if (error.response.data.length > 500) {
            errorInfo.responseData += '... [truncated]';
          }
        }
      } catch (e) {
        errorInfo.responseData = 'Could not extract response data';
      }
    }
    
    // Log the error with consistent formatting
    console.error(`[ERROR] ${timestamp} [${context}] ${error.message}`);
    
    // Log additional details for debugging
    if (errorInfo.statusCode) {
      console.error(`  Status: ${errorInfo.statusCode} ${errorInfo.statusText}`);
    }
    
    if (errorInfo.responseData) {
      console.error(`  Response: ${errorInfo.responseData}`);
    }
    
    // Log stack trace for debugging
    if (error.stack) {
      console.error('  Stack trace:');
      const stackLines = error.stack.split('\n');
      for (const line of stackLines.slice(0, 5)) {
        console.error(`    ${line}`);
      }
      if (stackLines.length > 5) {
        console.error('    ... (truncated)');
      }
    }
    
    // Terminate the process if this is a fatal error
    if (isFatal) {
      console.error('[FATAL] Terminating due to fatal error');
      process.exit(1);
    }
    
    return errorInfo;
  }
  
  /**
   * Create a standardized error object
   * @param {string} message - Error message
   * @param {string} context - Error context
   * @param {number} statusCode - Optional HTTP status code
   * @returns {Error} - Enhanced error object
   */
  static createError(message, context, statusCode = null) {
    const error = new Error(message);
    error.context = context;
    
    if (statusCode) {
      error.statusCode = statusCode;
    }
    
    return error;
  }
}

export default ErrorHandler;