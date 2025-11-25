import B2 from 'backblaze-b2';
import pLimit from 'p-limit';

/**
 * BackBlaze B2 Storage Service
 * Handles B2 authentication, bucket operations, and file uploads with concurrency control
 */
class BackBlazeB2Service {
  constructor(accountId, applicationKey) {
    this.accountId = accountId;
    this.applicationKey = applicationKey;
    this.b2 = new B2({
      applicationKeyId: accountId,
      applicationKey: applicationKey,
    });

    // Session state
    this.authorized = false;
    this.authData = null;
    this.bucket = null;
    this.bucketId = null;
    this.uploadUrl = null;
    this.uploadAuthToken = null;

    // Upload configuration
    this.concurrencyLimit = 8;
    this.retryAttempts = 3;
    this.retryDelay = 2000;

    // Upload statistics
    this.uploadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];

    // Progress callback
    this.progressCallback = null;

    // Rate limiting
    this.limiter = pLimit(this.concurrencyLimit);
  }

  /**
   * Authorize with BackBlaze B2
   * @returns {Promise<object>} Authorization data
   */
  async authorize() {
    try {
      const response = await this.b2.authorize();
      this.authorized = true;
      this.authData = response.data;

      return {
        success: true,
        apiUrl: this.authData.apiUrl,
        downloadUrl: this.authData.downloadUrl,
      };
    } catch (error) {
      console.error('B2 authorization error:', error);
      throw new Error(`B2 authorization failed: ${error.message}`);
    }
  }

  /**
   * Validate that a bucket exists and is accessible
   * @param {string} bucketName - Name of the bucket to validate
   * @returns {Promise<object>} Bucket information
   */
  async validateBucket(bucketName) {
    try {
      if (!this.authorized) {
        await this.authorize();
      }

      // For restricted keys, the bucket info is in the auth response
      const allowed = this.authData.allowed;
      if (allowed && allowed.bucketId && allowed.bucketName === bucketName) {
        this.bucketId = allowed.bucketId;
        this.bucket = {
          bucketId: allowed.bucketId,
          bucketName: allowed.bucketName,
          bucketType: 'allPrivate', // Assume private for restricted keys
        };

        return {
          success: true,
          bucket: {
            id: this.bucketId,
            bucketName: allowed.bucketName,
            bucketType: this.bucket.bucketType,
          },
        };
      }

      // Fall back to listBuckets for unrestricted keys
      const response = await this.b2.listBuckets({
        bucketName: bucketName,
      });

      if (!response.data.buckets || response.data.buckets.length === 0) {
        throw new Error(`Bucket "${bucketName}" not found`);
      }

      this.bucket = response.data.buckets[0];
      this.bucketId = this.bucket.bucketId;

      return {
        success: true,
        bucket: {
          id: this.bucket.bucketId,
          bucketName: this.bucket.bucketName,
          bucketType: this.bucket.bucketType,
        },
      };
    } catch (error) {
      console.error('Bucket validation error:', error);
      throw new Error(`Bucket validation failed: ${error.message}`);
    }
  }

  /**
   * Test B2 connection by authorizing and validating bucket
   * @param {string} bucketName - Bucket to validate
   * @returns {Promise<object>} Connection test results
   */
  async testConnection(bucketName) {
    try {
      await this.authorize();
      const bucketInfo = await this.validateBucket(bucketName);

      return {
        success: true,
        message: 'B2 connection successful',
        bucket: bucketInfo.bucket,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get upload URL for a bucket
   * @returns {Promise<object>} Upload URL and authorization token
   */
  async getUploadUrl() {
    try {
      if (!this.bucketId) {
        throw new Error('Bucket not validated. Call validateBucket() first.');
      }

      const response = await this.b2.getUploadUrl({
        bucketId: this.bucketId,
      });

      this.uploadUrl = response.data.uploadUrl;
      this.uploadAuthToken = response.data.authorizationToken;

      return {
        uploadUrl: this.uploadUrl,
        authorizationToken: this.uploadAuthToken,
      };
    } catch (error) {
      console.error('Get upload URL error:', error);
      throw new Error(`Failed to get upload URL: ${error.message}`);
    }
  }

  /**
   * Upload file to B2
   * @param {Buffer} fileData - File data as buffer
   * @param {string} fileName - Name for the file in B2
   * @param {string} contentType - MIME type
   * @returns {Promise<object>} Upload result
   */
  async uploadFile(fileData, fileName, contentType = 'application/octet-stream') {
    try {
      if (!this.bucketId) {
        throw new Error('Bucket not validated. Call validateBucket() first.');
      }

      // Get fresh upload URL (B2 best practice: get new URL for each upload)
      const { uploadUrl, authorizationToken } = await this.getUploadUrl();

      const response = await this.b2.uploadFile({
        uploadUrl: uploadUrl,
        uploadAuthToken: authorizationToken,
        fileName: fileName,
        data: fileData,
        mime: contentType,
      });

      return {
        success: true,
        fileId: response.data.fileId,
        fileName: response.data.fileName,
        contentLength: response.data.contentLength,
      };
    } catch (error) {
      console.error('Upload file error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload multiple files with progress callback
   * @param {Array<{data: Buffer, fileName: string, contentType: string}>} files
   * @param {Function} progressCallback - Called with (current, total, fileName)
   * @returns {Promise<Array>} Upload results
   */
  async uploadMultipleFiles(files, progressCallback = null) {
    const results = [];
    let current = 0;

    for (const file of files) {
      try {
        current++;
        if (progressCallback) {
          progressCallback(current, files.length, file.fileName);
        }

        const result = await this.uploadFile(
          file.data,
          file.fileName,
          file.contentType
        );

        results.push({
          ...result,
          originalFileName: file.fileName,
        });
      } catch (error) {
        results.push({
          success: false,
          fileName: file.fileName,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Handle filename conflicts by appending a suffix
   * @param {string} fileName - Original filename
   * @param {number} attempt - Attempt number
   * @returns {string} New filename with suffix
   */
  generateUniqueFileName(fileName, attempt = 0) {
    if (attempt === 0) {
      return fileName;
    }

    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) {
      return `${fileName}_${attempt.toString().padStart(3, '0')}`;
    }

    const name = fileName.substring(0, lastDot);
    const ext = fileName.substring(lastDot);
    return `${name}_${attempt.toString().padStart(3, '0')}${ext}`;
  }

  /**
   * List files in bucket (for verification)
   * @param {number} maxFileCount - Maximum files to retrieve
   * @returns {Promise<Array>} List of files
   */
  async listFiles(maxFileCount = 100) {
    try {
      if (!this.bucketId) {
        throw new Error('Bucket not validated. Call validateBucket() first.');
      }

      const response = await this.b2.listFileNames({
        bucketId: this.bucketId,
        maxFileCount: maxFileCount,
      });

      return response.data.files || [];
    } catch (error) {
      console.error('List files error:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Delete file from B2
   * @param {string} fileName - Name of file to delete
   * @param {string} fileId - B2 file ID
   * @returns {Promise<object>} Deletion result
   */
  async deleteFile(fileName, fileId) {
    try {
      const response = await this.b2.deleteFileVersion({
        fileId: fileId,
        fileName: fileName,
      });

      return {
        success: true,
        fileId: response.data.fileId,
        fileName: response.data.fileName,
      };
    } catch (error) {
      console.error('Delete file error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Set concurrency limit for uploads
   * @param {number} limit - Number of parallel uploads
   */
  setConcurrencyLimit(limit) {
    this.concurrencyLimit = limit;
    this.limiter = pLimit(limit);
  }

  /**
   * Set progress callback
   * @param {Function} callback - Callback function (current, total, filename)
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Upload single file with retry logic
   * @param {Buffer} fileData - File data
   * @param {string} fileName - File name
   * @param {string} contentType - Content type
   * @returns {Promise<object>} Upload result
   */
  async uploadFileWithRetry(fileData, fileName, contentType = 'application/octet-stream') {
    let lastError = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await this.uploadFile(fileData, fileName, contentType);

        this.uploadedCount++;
        this.totalSize += fileData.length;

        if (this.progressCallback) {
          this.progressCallback(this.uploadedCount, null, fileName);
        }

        return result;
      } catch (error) {
        lastError = error;
        console.error(`Upload attempt ${attempt} failed for ${fileName}:`, error.message);

        // Don't retry on auth errors
        if (error.message.includes('authorization') || error.message.includes('unauthorized')) {
          break;
        }

        // Wait before retry
        if (attempt < this.retryAttempts) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    // All attempts failed
    this.failedCount++;
    const errorMessage = lastError?.message || 'Unknown error';

    this.errors.push({
      fileName,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    if (this.progressCallback) {
      this.progressCallback(this.uploadedCount, null, fileName, errorMessage);
    }

    return {
      success: false,
      fileName,
      error: errorMessage,
    };
  }

  /**
   * Upload multiple files with concurrency control
   * @param {Array<{data: Buffer, fileName: string, contentType: string}>} files
   * @returns {Promise<Array>} Upload results
   */
  async uploadMultipleFilesWithConcurrency(files) {
    // Reset counters
    this.uploadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];

    console.log(`Starting upload of ${files.length} files with concurrency limit ${this.concurrencyLimit}`);

    // Create upload promises with rate limiting
    const uploadPromises = files.map(file =>
      this.limiter(() => this.uploadFileWithRetry(file.data, file.fileName, file.contentType))
    );

    // Execute all uploads
    const results = await Promise.all(uploadPromises);

    console.log(`Upload complete: ${this.uploadedCount} succeeded, ${this.failedCount} failed`);

    return results;
  }

  /**
   * Upload files in batches
   * @param {Array<{data: Buffer, fileName: string, contentType: string}>} files
   * @param {number} batchSize - Number of files per batch
   * @returns {Promise<Array>} Upload results
   */
  async uploadFilesInBatches(files, batchSize = 50) {
    // Reset counters
    this.uploadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];

    const results = [];
    const batches = this.createBatches(files, batchSize);

    console.log(`Uploading ${files.length} files in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} files)`);

      const batchResults = await this.uploadMultipleFilesWithConcurrency(batch);
      results.push(...batchResults);

      // Small delay between batches
      if (i < batches.length - 1) {
        await this.sleep(1000);
      }
    }

    return results;
  }

  /**
   * Create batches from array
   * @param {Array} array - Input array
   * @param {number} batchSize - Size of each batch
   * @returns {Array<Array>} Array of batches
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get upload statistics
   * @returns {object} Statistics
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
   * Get error list
   * @returns {Array} List of errors
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

export default BackBlazeB2Service;
