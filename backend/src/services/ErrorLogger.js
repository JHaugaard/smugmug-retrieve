/**
 * Error Logger Service
 * Handles structured error logging for migration operations
 */
class ErrorLogger {
  constructor(fileSystemManager, sessionId) {
    this.fsManager = fileSystemManager;
    this.sessionId = sessionId;
    this.errors = [];
    this.logFileName = 'error-log.json';
  }

  /**
   * Log an error
   * @param {object} errorData - Error information
   * @param {string} errorData.phase - Migration phase (download, upload, metadata, auth, discovery)
   * @param {string} errorData.message - Error message
   * @param {string} errorData.filename - Associated filename (optional)
   * @param {string} errorData.assetId - Associated asset ID (optional)
   * @param {string} errorData.errorCode - Error code (optional)
   * @param {boolean} errorData.retryable - Whether error is retryable (optional)
   * @param {object} errorData.additionalData - Additional error context (optional)
   */
  logError(errorData) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      phase: errorData.phase || 'unknown',
      errorMessage: errorData.message || errorData.errorMessage || 'Unknown error',
      filename: errorData.filename || null,
      assetId: errorData.assetId || null,
      errorCode: errorData.errorCode || null,
      retryable: errorData.retryable !== undefined ? errorData.retryable : false,
      additionalData: errorData.additionalData || null,
    };

    this.errors.push(errorEntry);

    // Console log for immediate feedback
    console.error(`[${errorEntry.phase}] Error: ${errorEntry.errorMessage}`, {
      filename: errorEntry.filename,
      assetId: errorEntry.assetId,
    });
  }

  /**
   * Log download error
   * @param {string} filename - Filename
   * @param {string} assetId - Asset ID
   * @param {string} errorMessage - Error message
   * @param {boolean} retryable - Whether error is retryable
   */
  logDownloadError(filename, assetId, errorMessage, retryable = false) {
    this.logError({
      phase: 'download',
      filename,
      assetId,
      message: errorMessage,
      retryable,
    });
  }

  /**
   * Log upload error
   * @param {string} filename - Filename
   * @param {string} errorMessage - Error message
   * @param {boolean} retryable - Whether error is retryable
   */
  logUploadError(filename, errorMessage, retryable = false) {
    this.logError({
      phase: 'upload',
      filename,
      message: errorMessage,
      retryable,
    });
  }

  /**
   * Log metadata extraction error
   * @param {string} filename - Filename
   * @param {string} assetId - Asset ID
   * @param {string} errorMessage - Error message
   */
  logMetadataError(filename, assetId, errorMessage) {
    this.logError({
      phase: 'metadata',
      filename,
      assetId,
      message: errorMessage,
      retryable: false,
    });
  }

  /**
   * Log authentication error
   * @param {string} service - Service name (smugmug, b2)
   * @param {string} errorMessage - Error message
   */
  logAuthError(service, errorMessage) {
    this.logError({
      phase: 'auth',
      message: `${service}: ${errorMessage}`,
      retryable: false,
    });
  }

  /**
   * Log discovery error
   * @param {string} errorMessage - Error message
   * @param {object} additionalData - Additional context
   */
  logDiscoveryError(errorMessage, additionalData = null) {
    this.logError({
      phase: 'discovery',
      message: errorMessage,
      additionalData,
      retryable: false,
    });
  }

  /**
   * Get all errors
   * @returns {Array} List of errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Get errors by phase
   * @param {string} phase - Phase name
   * @returns {Array} Filtered errors
   */
  getErrorsByPhase(phase) {
    return this.errors.filter(error => error.phase === phase);
  }

  /**
   * Get retryable errors
   * @returns {Array} Retryable errors
   */
  getRetryableErrors() {
    return this.errors.filter(error => error.retryable);
  }

  /**
   * Get error count
   * @returns {number} Total error count
   */
  getErrorCount() {
    return this.errors.length;
  }

  /**
   * Get error count by phase
   * @returns {object} Error counts grouped by phase
   */
  getErrorCountByPhase() {
    const counts = {};

    for (const error of this.errors) {
      counts[error.phase] = (counts[error.phase] || 0) + 1;
    }

    return counts;
  }

  /**
   * Check if there are any errors
   * @returns {boolean} True if errors exist
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Clear all errors
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Generate error log structure
   * @returns {object} Complete error log
   */
  generateErrorLog() {
    return {
      migrationId: this.sessionId,
      generatedAt: new Date().toISOString(),
      totalErrors: this.errors.length,
      errorsByPhase: this.getErrorCountByPhase(),
      retryableErrors: this.getRetryableErrors().length,
      errors: this.errors,
    };
  }

  /**
   * Save error log to file system
   * @returns {Promise<string>} Path to error log file
   */
  async saveErrorLog() {
    try {
      const errorLog = this.generateErrorLog();
      const filePath = await this.fsManager.writeLog(this.logFileName, errorLog);

      console.log(`Error log saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Failed to save error log:', error);
      throw new Error(`Error log save failed: ${error.message}`);
    }
  }

  /**
   * Generate error summary for display
   * @returns {object} Error summary
   */
  getErrorSummary() {
    return {
      total: this.errors.length,
      byPhase: this.getErrorCountByPhase(),
      retryable: this.getRetryableErrors().length,
      recent: this.errors.slice(-10), // Last 10 errors
    };
  }

  /**
   * Export errors as CSV string
   * @returns {string} CSV formatted error log
   */
  exportAsCSV() {
    const headers = [
      'Timestamp',
      'Phase',
      'Filename',
      'Asset ID',
      'Error Message',
      'Error Code',
      'Retryable',
    ];

    const rows = this.errors.map(error => [
      error.timestamp,
      error.phase,
      error.filename || '',
      error.assetId || '',
      `"${error.errorMessage.replace(/"/g, '""')}"`, // Escape quotes
      error.errorCode || '',
      error.retryable ? 'Yes' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Save error log as CSV
   * @returns {Promise<string>} Path to CSV file
   */
  async saveErrorLogAsCSV() {
    try {
      const csvContent = this.exportAsCSV();
      const fileName = 'error-log.csv';
      const filePath = await this.fsManager.writeLog(fileName, csvContent);

      console.log(`Error log CSV saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Failed to save CSV error log:', error);
      throw new Error(`CSV error log save failed: ${error.message}`);
    }
  }

  /**
   * Sanitize sensitive data from error messages
   * @param {string} message - Error message
   * @returns {string} Sanitized message
   */
  sanitizeErrorMessage(message) {
    // Remove potential OAuth tokens
    let sanitized = message.replace(/oauth_token=[^&\s]+/gi, 'oauth_token=***');
    sanitized = sanitized.replace(/oauth_token_secret=[^&\s]+/gi, 'oauth_token_secret=***');

    // Remove potential API keys
    sanitized = sanitized.replace(/[A-Za-z0-9]{32,}/g, '***');

    return sanitized;
  }

  /**
   * Log critical error (console + file)
   * @param {string} message - Error message
   * @param {object} context - Error context
   */
  async logCriticalError(message, context = {}) {
    const sanitizedMessage = this.sanitizeErrorMessage(message);

    this.logError({
      phase: 'critical',
      message: sanitizedMessage,
      additionalData: context,
      retryable: false,
    });

    // Immediately save critical errors
    await this.saveErrorLog();
  }
}

export default ErrorLogger;
