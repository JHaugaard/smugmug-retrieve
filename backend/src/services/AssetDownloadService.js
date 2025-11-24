import axios from 'axios';
import pLimit from 'p-limit';

/**
 * Asset Download Service
 * Handles downloading images and videos from SmugMug with concurrency control
 */
class AssetDownloadService {
  constructor(smugmugService, fileSystemManager) {
    this.smugmugService = smugmugService;
    this.fsManager = fileSystemManager;

    // Configuration
    this.concurrencyLimit = 8; // Number of parallel downloads
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2 seconds

    // State
    this.downloadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];

    // Progress callback
    this.progressCallback = null;

    // Rate limiting
    this.limiter = pLimit(this.concurrencyLimit);
  }

  /**
   * Set concurrency limit for downloads
   * @param {number} limit - Number of parallel downloads
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
   * Download a single asset
   * @param {object} asset - Asset object from inventory
   * @returns {Promise<{success: boolean, filename: string, filePath?: string, size?: number, error?: string}>}
   */
  async downloadAsset(asset) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        // Get the download URL from asset
        const downloadUrl = this.getDownloadUrl(asset);

        if (!downloadUrl) {
          throw new Error('No download URL available for asset');
        }

        // Download the file
        const response = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 120000, // 2 minute timeout
          headers: {
            'User-Agent': 'SmugMug-Retrieval-Tool/1.0',
          },
        });

        const fileData = Buffer.from(response.data);
        const fileSize = fileData.length;

        // Determine filename
        const filename = asset.filename || this.extractFilenameFromUrl(downloadUrl);

        // Save to file system
        const filePath = await this.fsManager.writeFile(filename, fileData);

        this.downloadedCount++;
        this.totalSize += fileSize;

        // Call progress callback
        if (this.progressCallback) {
          this.progressCallback(this.downloadedCount, null, filename);
        }

        return {
          success: true,
          filename,
          filePath,
          size: fileSize,
        };
      } catch (error) {
        lastError = error;
        console.error(`Download attempt ${attempt} failed for ${asset.filename}:`, error.message);

        // Don't retry on 404 or other client errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
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
      filename: asset.filename,
      assetId: asset.assetId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    if (this.progressCallback) {
      this.progressCallback(this.downloadedCount, null, asset.filename, errorMessage);
    }

    return {
      success: false,
      filename: asset.filename,
      error: errorMessage,
    };
  }

  /**
   * Get download URL from asset
   * @param {object} asset - Asset object
   * @returns {string|null} Download URL
   */
  getDownloadUrl(asset) {
    // Priority order for download URLs:
    // 1. ArchivedUri (original quality)
    // 2. Direct download URL
    // 3. OriginalUrl
    // 4. LargestUrl

    if (asset.archivedUri) {
      return asset.archivedUri;
    }

    if (asset.downloadUrl) {
      return asset.downloadUrl;
    }

    if (asset.originalUrl) {
      return asset.originalUrl;
    }

    if (asset.largestUrl) {
      return asset.largestUrl;
    }

    return null;
  }

  /**
   * Extract filename from URL
   * @param {string} url - URL
   * @returns {string} Filename
   */
  extractFilenameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || `asset_${Date.now()}`;
    } catch {
      return `asset_${Date.now()}`;
    }
  }

  /**
   * Download multiple assets with concurrency control
   * @param {Array<object>} assets - Array of asset objects
   * @returns {Promise<Array>} Download results
   */
  async downloadAssets(assets) {
    // Reset counters
    this.downloadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];

    console.log(`Starting download of ${assets.length} assets with concurrency limit ${this.concurrencyLimit}`);

    // Create download promises with rate limiting
    const downloadPromises = assets.map(asset =>
      this.limiter(() => this.downloadAsset(asset))
    );

    // Execute all downloads
    const results = await Promise.all(downloadPromises);

    console.log(`Download complete: ${this.downloadedCount} succeeded, ${this.failedCount} failed`);

    return results;
  }

  /**
   * Download assets with batching for better progress updates
   * @param {Array<object>} assets - Array of asset objects
   * @param {number} batchSize - Number of assets per batch
   * @returns {Promise<Array>} Download results
   */
  async downloadAssetsInBatches(assets, batchSize = 50) {
    // Reset counters
    this.downloadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];

    const results = [];
    const batches = this.createBatches(assets, batchSize);

    console.log(`Downloading ${assets.length} assets in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} assets)`);

      const batchResults = await this.downloadAssets(batch);
      results.push(...batchResults);

      // Small delay between batches to be nice to the API
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
   * Get download statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      downloaded: this.downloadedCount,
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
  getErrors() {
    return this.errors;
  }

  /**
   * Clear statistics
   */
  clearStats() {
    this.downloadedCount = 0;
    this.failedCount = 0;
    this.totalSize = 0;
    this.errors = [];
  }

  /**
   * Validate asset has downloadable URL
   * @param {object} asset - Asset object
   * @returns {boolean} True if asset can be downloaded
   */
  canDownload(asset) {
    return this.getDownloadUrl(asset) !== null;
  }

  /**
   * Filter assets that can be downloaded
   * @param {Array<object>} assets - Array of assets
   * @returns {Array<object>} Filtered assets
   */
  filterDownloadableAssets(assets) {
    return assets.filter(asset => this.canDownload(asset));
  }
}

export default AssetDownloadService;
