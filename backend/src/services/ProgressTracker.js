/**
 * Progress Tracker Service
 * Manages in-memory progress state and broadcasts updates for SSE
 */
class ProgressTracker {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.state = this.getInitialState();
    this.subscribers = [];
    this.updateThrottle = 1000; // Minimum 1 second between broadcasts
    this.lastBroadcast = 0;
  }

  /**
   * Get initial progress state
   * @returns {object} Initial state
   */
  getInitialState() {
    return {
      sessionId: this.sessionId,
      phase: 'idle', // idle, auth, discover, download, upload, complete, error
      discovered: 0,
      downloaded: 0,
      uploaded: 0,
      errors: 0,
      currentOperation: '',
      startTime: null,
      endTime: null,
      estimatedCompletion: null,
    };
  }

  /**
   * Reset progress state
   */
  reset() {
    this.state = this.getInitialState();
    this.broadcast('reset', { message: 'Progress tracker reset' });
  }

  /**
   * Set current phase
   * @param {string} phase - Phase name
   * @param {string} message - Optional message
   */
  setPhase(phase, message = '') {
    this.state.phase = phase;
    this.state.currentOperation = message;

    if (phase !== 'idle' && !this.state.startTime) {
      this.state.startTime = new Date().toISOString();
    }

    if (phase === 'complete' || phase === 'error') {
      this.state.endTime = new Date().toISOString();
    }

    this.broadcast('phase', {
      phase,
      message: message || `Entering ${phase} phase`,
    });
  }

  /**
   * Update discovered count
   * @param {number} count - Number of assets discovered
   */
  setDiscovered(count) {
    this.state.discovered = count;
    this.throttledBroadcast('progress', this.getProgressData());
  }

  /**
   * Increment discovered count
   * @param {number} increment - Amount to increment (default: 1)
   */
  incrementDiscovered(increment = 1) {
    this.state.discovered += increment;
    this.throttledBroadcast('progress', this.getProgressData());
  }

  /**
   * Update downloaded count
   * @param {number} count - Number of assets downloaded
   */
  setDownloaded(count) {
    this.state.downloaded = count;
    this.updateEstimatedCompletion();
    this.throttledBroadcast('progress', this.getProgressData());
  }

  /**
   * Increment downloaded count
   * @param {number} increment - Amount to increment (default: 1)
   */
  incrementDownloaded(increment = 1) {
    this.state.downloaded += increment;
    this.updateEstimatedCompletion();
    this.throttledBroadcast('progress', this.getProgressData());
  }

  /**
   * Update uploaded count
   * @param {number} count - Number of assets uploaded
   */
  setUploaded(count) {
    this.state.uploaded = count;
    this.updateEstimatedCompletion();
    this.throttledBroadcast('progress', this.getProgressData());
  }

  /**
   * Increment uploaded count
   * @param {number} increment - Amount to increment (default: 1)
   */
  incrementUploaded(increment = 1) {
    this.state.uploaded += increment;
    this.updateEstimatedCompletion();
    this.throttledBroadcast('progress', this.getProgressData());
  }

  /**
   * Update error count
   * @param {number} count - Number of errors
   */
  setErrors(count) {
    this.state.errors = count;
    this.throttledBroadcast('progress', this.getProgressData());
  }

  /**
   * Increment error count
   * @param {number} increment - Amount to increment (default: 1)
   */
  incrementErrors(increment = 1) {
    this.state.errors += increment;
    this.throttledBroadcast('progress', this.getProgressData());
  }

  /**
   * Set current operation message
   * @param {string} operation - Operation description
   */
  setCurrentOperation(operation) {
    this.state.currentOperation = operation;
    this.throttledBroadcast('operation', {
      message: operation,
    });
  }

  /**
   * Update estimated completion time
   */
  updateEstimatedCompletion() {
    if (!this.state.startTime || this.state.discovered === 0) {
      return;
    }

    const startTime = new Date(this.state.startTime).getTime();
    const now = Date.now();
    const elapsed = now - startTime;

    // Calculate based on current phase
    let completed = 0;
    let total = this.state.discovered;

    if (this.state.phase === 'download') {
      completed = this.state.downloaded;
    } else if (this.state.phase === 'upload') {
      completed = this.state.uploaded;
    }

    if (completed > 0) {
      const timePerAsset = elapsed / completed;
      const remaining = total - completed;
      const estimatedMs = remaining * timePerAsset;

      this.state.estimatedCompletion = new Date(now + estimatedMs).toISOString();
    }
  }

  /**
   * Get current progress data
   * @returns {object} Progress data
   */
  getProgressData() {
    return {
      discovered: this.state.discovered,
      downloaded: this.state.downloaded,
      uploaded: this.state.uploaded,
      errors: this.state.errors,
      percentDownloaded: this.state.discovered > 0
        ? Math.round((this.state.downloaded / this.state.discovered) * 100)
        : 0,
      percentUploaded: this.state.discovered > 0
        ? Math.round((this.state.uploaded / this.state.discovered) * 100)
        : 0,
    };
  }

  /**
   * Get complete state
   * @returns {object} Complete progress state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get progress summary
   * @returns {object} Progress summary
   */
  getSummary() {
    const duration = this.calculateDuration();

    return {
      sessionId: this.sessionId,
      phase: this.state.phase,
      discovered: this.state.discovered,
      downloaded: this.state.downloaded,
      uploaded: this.state.uploaded,
      errors: this.state.errors,
      successRate: this.calculateSuccessRate(),
      duration: duration,
      durationFormatted: this.formatDuration(duration),
    };
  }

  /**
   * Calculate success rate
   * @returns {number} Success rate percentage
   */
  calculateSuccessRate() {
    if (this.state.discovered === 0) {
      return 0;
    }

    const successful = this.state.uploaded;
    const total = this.state.discovered;

    return Math.round((successful / total) * 10000) / 100; // Two decimal places
  }

  /**
   * Calculate duration in milliseconds
   * @returns {number} Duration in ms
   */
  calculateDuration() {
    if (!this.state.startTime) {
      return 0;
    }

    const startTime = new Date(this.state.startTime).getTime();
    const endTime = this.state.endTime
      ? new Date(this.state.endTime).getTime()
      : Date.now();

    return endTime - startTime;
  }

  /**
   * Format duration for display
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Subscribe to progress updates
   * @param {Function} callback - Callback function (eventType, data)
   * @returns {number} Subscription ID
   */
  subscribe(callback) {
    const id = Date.now() + Math.random();
    this.subscribers.push({ id, callback });
    return id;
  }

  /**
   * Unsubscribe from progress updates
   * @param {number} id - Subscription ID
   */
  unsubscribe(id) {
    this.subscribers = this.subscribers.filter(sub => sub.id !== id);
  }

  /**
   * Broadcast update to all subscribers
   * @param {string} eventType - Event type
   * @param {object} data - Event data
   */
  broadcast(eventType, data) {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const subscriber of this.subscribers) {
      try {
        subscriber.callback(event);
      } catch (error) {
        console.error('Error broadcasting to subscriber:', error);
      }
    }

    this.lastBroadcast = Date.now();
  }

  /**
   * Throttled broadcast (respects minimum interval)
   * @param {string} eventType - Event type
   * @param {object} data - Event data
   */
  throttledBroadcast(eventType, data) {
    const now = Date.now();
    if (now - this.lastBroadcast >= this.updateThrottle) {
      this.broadcast(eventType, data);
    }
  }

  /**
   * Force broadcast (ignores throttle)
   * @param {string} eventType - Event type
   * @param {object} data - Event data
   */
  forceBroadcast(eventType, data) {
    this.broadcast(eventType, data);
  }

  /**
   * Set throttle interval
   * @param {number} ms - Milliseconds between broadcasts
   */
  setThrottleInterval(ms) {
    this.updateThrottle = ms;
  }

  /**
   * Mark migration as complete
   * @param {boolean} success - Whether migration was successful
   */
  complete(success = true) {
    this.setPhase(success ? 'complete' : 'error');
    this.state.endTime = new Date().toISOString();

    const summary = this.getSummary();

    this.forceBroadcast('complete', {
      success,
      summary,
      message: success ? 'Migration completed successfully' : 'Migration completed with errors',
    });
  }

  /**
   * Report error to progress tracker
   * @param {string} message - Error message
   * @param {object} details - Error details
   */
  reportError(message, details = {}) {
    this.incrementErrors();

    this.broadcast('error', {
      message,
      details,
    });
  }

  /**
   * Broadcast completion with full summary
   * @param {object} summary - Migration summary data
   */
  broadcastCompletion(summary) {
    this.forceBroadcast('complete', {
      success: summary.success,
      totalAssets: summary.totalAssets,
      successful: summary.successful,
      failed: summary.failed,
      successRate: summary.successRate,
      sessionId: summary.sessionId,
      bucketName: summary.bucketName,
      errorLogPath: summary.errorLogPath,
      message: summary.success
        ? 'Migration completed successfully'
        : 'Migration completed with errors',
    });
  }
}

export default ProgressTracker;
