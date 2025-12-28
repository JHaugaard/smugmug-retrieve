import path from 'path';

/**
 * Asset Upload Service
 * Orchestrates the complete asset processing pipeline: download, metadata extraction, and B2 upload
 */
class AssetUploadService {
  constructor(
    assetDownloadService,
    metadataService,
    storageService,
    fileSystemManager,
    errorLogger,
    progressTracker
  ) {
    this.downloadService = assetDownloadService;
    this.metadataService = metadataService;
    this.storageService = storageService;
    this.fsManager = fileSystemManager;
    this.errorLogger = errorLogger;
    this.progressTracker = progressTracker;

    // Configuration
    this.cleanupAfterUpload = true;
    this.uploadMetadataFiles = true;
  }

  /**
   * Process a single asset: download, extract metadata, generate JSON, upload to B2
   * @param {object} asset - Asset object from inventory
   * @param {object} albumInfo - Album information
   * @returns {Promise<object>} Processing result
   */
  async processAsset(asset, albumInfo = {}) {
    const assetFileName = asset.filename;

    try {
      // Step 1: Download asset from SmugMug
      this.progressTracker.setCurrentOperation(`Downloading ${assetFileName}`);
      const downloadResult = await this.downloadService.downloadAsset(asset);

      if (!downloadResult.success) {
        this.errorLogger.logDownloadError(
          assetFileName,
          asset.assetId,
          downloadResult.error,
          false
        );
        return {
          success: false,
          phase: 'download',
          filename: assetFileName,
          error: downloadResult.error,
        };
      }

      // Step 2: Extract metadata and generate JSON sidecar
      this.progressTracker.setCurrentOperation(`Extracting metadata for ${assetFileName}`);
      let metadata = null;
      let jsonFileName = null;
      let jsonFilePath = null;

      try {
        metadata = this.metadataService.extractMetadata(asset, albumInfo);
        const jsonContent = this.metadataService.generateJsonSidecar(metadata);

        jsonFileName = this.metadataService.getJsonSidecarFilename(assetFileName);
        jsonFilePath = await this.fsManager.writeFile(jsonFileName, Buffer.from(jsonContent, 'utf8'));
      } catch (metadataError) {
        this.errorLogger.logMetadataError(
          assetFileName,
          asset.assetId,
          metadataError.message
        );
        // Continue with upload even if metadata extraction fails
      }

      // Step 3: Upload asset to storage
      this.progressTracker.setCurrentOperation(`Uploading ${assetFileName}`);
      const assetData = await this.fsManager.readFile(assetFileName);
      const contentType = this.getContentType(assetFileName);

      const uploadResult = await this.storageService.uploadFileWithRetry(
        assetData,
        assetFileName,
        contentType
      );

      if (!uploadResult.success) {
        this.errorLogger.logUploadError(
          assetFileName,
          uploadResult.error,
          true
        );
        return {
          success: false,
          phase: 'upload',
          filename: assetFileName,
          error: uploadResult.error,
        };
      }

      this.progressTracker.incrementUploaded();

      // Step 4: Upload JSON sidecar if enabled and exists
      if (this.uploadMetadataFiles && jsonFileName && jsonFilePath) {
        this.progressTracker.setCurrentOperation(`Uploading metadata for ${assetFileName}`);
        const jsonData = await this.fsManager.readFile(jsonFileName);

        const jsonUploadResult = await this.storageService.uploadFileWithRetry(
          jsonData,
          jsonFileName,
          'application/json'
        );

        if (!jsonUploadResult.success) {
          this.errorLogger.logUploadError(
            jsonFileName,
            jsonUploadResult.error,
            true
          );
        }
      }

      // Step 5: Cleanup local files if enabled
      if (this.cleanupAfterUpload) {
        await this.fsManager.deleteFile(assetFileName);
        if (jsonFileName) {
          await this.fsManager.deleteFile(jsonFileName);
        }
      }

      return {
        success: true,
        filename: assetFileName,
        size: downloadResult.size,
        metadataExtracted: metadata !== null,
      };
    } catch (error) {
      this.errorLogger.logError({
        phase: 'processing',
        filename: assetFileName,
        assetId: asset.assetId,
        message: error.message,
      });

      return {
        success: false,
        phase: 'processing',
        filename: assetFileName,
        error: error.message,
      };
    }
  }

  /**
   * Process multiple assets
   * @param {Array<object>} assets - Array of asset objects
   * @param {object} albumInfoMap - Map of album URIs to album info
   * @returns {Promise<object>} Processing results
   */
  async processAssets(assets, albumInfoMap = {}) {
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    this.progressTracker.setPhase('download', 'Starting asset download and processing');

    for (const asset of assets) {
      const albumInfo = albumInfoMap[asset.albumUri] || {};
      const result = await this.processAsset(asset, albumInfo);

      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        this.progressTracker.incrementErrors();
      }
    }

    return {
      total: assets.length,
      successful: successCount,
      failed: failureCount,
      results,
    };
  }

  /**
   * Get content type from filename
   * @param {string} filename - Filename
   * @returns {string} MIME type
   */
  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();

    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.psd': 'image/vnd.adobe.photoshop',
      '.arw': 'image/x-sony-arw',
      '.dop': 'application/octet-stream',
      '.xmp': 'application/rdf+xml',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Enable/disable cleanup after upload
   * @param {boolean} enabled - Whether to cleanup
   */
  setCleanupAfterUpload(enabled) {
    this.cleanupAfterUpload = enabled;
  }

  /**
   * Enable/disable metadata file uploads
   * @param {boolean} enabled - Whether to upload metadata
   */
  setUploadMetadataFiles(enabled) {
    this.uploadMetadataFiles = enabled;
  }

  /**
   * Get processing statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      download: this.downloadService.getStats(),
      upload: this.storageService.getUploadStats(),
      errors: this.errorLogger.getErrorSummary(),
      progress: this.progressTracker.getSummary(),
    };
  }
}

export default AssetUploadService;
