import fs from 'fs/promises';
import path from 'path';

/**
 * Local Storage Service
 * Saves files to a local folder instead of uploading to cloud storage.
 * Implements the same interface as BackBlazeB2Service for compatibility with AssetUploadService.
 */
class LocalStorageService {
  constructor(destinationPath) {
    this.destinationPath = destinationPath;
    this.validated = false;

    // Upload statistics (matching B2 interface)
    this.uploadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];

    // Progress callback
    this.progressCallback = null;
    this.concurrencyLimit = 8; // Interface compatibility (not used for local)
  }

  /**
   * Validate that the destination path exists and is writable
   * @returns {Promise<object>} Validation result
   */
  async testConnection() {
    try {
      // Check if path exists
      const stats = await fs.stat(this.destinationPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }

      // Check if writable by attempting to write a test file
      const testFile = path.join(this.destinationPath, '.write-test-' + Date.now());
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      this.validated = true;

      return {
        success: true,
        message: 'Local path validated successfully',
        path: this.destinationPath,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Path does not exist: ${this.destinationPath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${this.destinationPath}`);
      }
      throw new Error(`Path validation failed: ${error.message}`);
    }
  }

  /**
   * "Upload" file by writing to local folder
   * Matches BackBlazeB2Service.uploadFileWithRetry interface
   * @param {Buffer} fileData - File contents
   * @param {string} fileName - Destination filename
   * @param {string} contentType - MIME type (ignored for local storage)
   * @returns {Promise<object>} Upload result
   */
  async uploadFileWithRetry(fileData, fileName, contentType = 'application/octet-stream') {
    try {
      if (!this.validated) {
        await this.testConnection();
      }

      const filePath = path.join(this.destinationPath, fileName);

      // Handle filename conflicts by adding suffix
      let finalPath = filePath;
      let attempt = 0;
      while (await this.fileExists(finalPath)) {
        attempt++;
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        finalPath = path.join(this.destinationPath, `${base}_${attempt}${ext}`);
      }

      await fs.writeFile(finalPath, fileData, { mode: 0o644 });

      this.uploadedCount++;
      this.totalSize += fileData.length;

      if (this.progressCallback) {
        this.progressCallback(this.uploadedCount, null, fileName);
      }

      return {
        success: true,
        fileName: path.basename(finalPath),
        filePath: finalPath,
        contentLength: fileData.length,
      };
    } catch (error) {
      this.failedCount++;
      this.errors.push({
        fileName,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        fileName,
        error: error.message,
      };
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Full path to file
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set concurrency limit (interface compatibility - not used for local)
   * @param {number} limit - Concurrency limit
   */
  setConcurrencyLimit(limit) {
    this.concurrencyLimit = limit;
  }

  /**
   * Set progress callback
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Get upload statistics
   * @returns {object} Upload stats
   */
  getUploadStats() {
    return {
      uploaded: this.uploadedCount,
      failed: this.failedCount,
      totalSizeBytes: this.totalSize,
      totalSizeMB: Math.round((this.totalSize / (1024 * 1024)) * 100) / 100,
      errors: this.errors.length,
    };
  }

  /**
   * Get upload errors
   * @returns {Array} Error array
   */
  getUploadErrors() {
    return this.errors;
  }

  /**
   * Clear upload statistics
   */
  clearUploadStats() {
    this.uploadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];
  }
}

export default LocalStorageService;
