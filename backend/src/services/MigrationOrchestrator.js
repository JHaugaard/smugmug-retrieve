import { v4 as uuidv4 } from 'uuid';
import SmugMugService from './SmugMugService.js';
import AccountDiscoveryService from './AccountDiscoveryService.js';
import AssetInventoryService from './AssetInventoryService.js';
import BackBlazeB2Service from './BackBlazeB2Service.js';
import AssetDownloadService from './AssetDownloadService.js';
import AssetUploadService from './AssetUploadService.js';
import MetadataService from './MetadataService.js';
import FileSystemManager from './FileSystemManager.js';
import ErrorLogger from './ErrorLogger.js';
import ProgressTracker from './ProgressTracker.js';

/**
 * MigrationOrchestrator
 *
 * Coordinates the complete migration workflow from SmugMug to BackBlaze B2.
 * This is the central service that ties together all Epic 1 and Epic 2 services.
 *
 * Workflow Phases:
 * 1. Authentication (SmugMug OAuth + B2)
 * 2. Discovery (Account structure + Asset enumeration)
 * 3. Download (Download assets from SmugMug)
 * 4. Upload (Upload assets + metadata to B2)
 * 5. Complete (Cleanup + Generate summary)
 *
 * Features:
 * - Real-time progress tracking via ProgressTracker
 * - Comprehensive error logging via ErrorLogger
 * - Test mode support (limit asset count)
 * - Automatic cleanup of temporary files
 * - SSE broadcast support for UI updates
 */
class MigrationOrchestrator {
  constructor(config) {
    this.config = config;
    this.sessionId = uuidv4();

    // Initialize services (order matters - FileSystemManager must be first)
    this.fileSystemManager = new FileSystemManager(this.sessionId);
    this.progressTracker = new ProgressTracker(this.sessionId);
    this.errorLogger = new ErrorLogger(this.fileSystemManager, this.sessionId);

    // Service instances (initialized during workflow)
    this.smugmugService = null;
    this.b2Service = null;
    this.accountStructure = null;
    this.assetInventory = null;

    // Migration state
    this.isRunning = false;
    this.isPaused = false;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Get the session ID for this migration
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Subscribe to progress updates (for SSE broadcasting)
   */
  subscribeToProgress(callback) {
    this.progressTracker.subscribe(callback);
  }

  /**
   * Unsubscribe from progress updates
   */
  unsubscribeFromProgress(callback) {
    this.progressTracker.unsubscribe(callback);
  }

  /**
   * Get current progress state
   */
  getProgress() {
    return this.progressTracker.getState();
  }

  /**
   * Main migration workflow orchestration
   */
  async runMigration() {
    if (this.isRunning) {
      throw new Error('Migration is already running');
    }

    this.isRunning = true;
    this.startTime = new Date();
    this.progressTracker.setPhase('auth', 'Starting migration...');

    try {
      // Phase 1: Authentication
      await this.authenticateServices();

      // Phase 2: Discovery & Enumeration
      await this.discoverAndEnumerate();

      // Phase 3: Download & Upload Pipeline
      await this.processAssets();

      // Phase 4: Completion
      await this.complete();

      this.endTime = new Date();
      return this.generateSummary();

    } catch (error) {
      this.errorLogger.logCriticalError('migration', error.message);
      this.progressTracker.setPhase('error', `Migration failed: ${error.message}`);

      // Save error log
      await this.errorLogger.saveErrorLog(
        this.fileSystemManager.getLogFilePath('error-log.json')
      );

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Phase 1: Authenticate with SmugMug and BackBlaze B2
   */
  async authenticateServices() {
    this.progressTracker.setPhase('auth', 'Authenticating with SmugMug...');

    try {
      // Initialize SmugMug service
      const { apiKey, apiSecret, accessToken, accessTokenSecret } = this.config.smugmug;
      this.smugmugService = new SmugMugService(apiKey, apiSecret);

      // If we already have access tokens, use them
      if (accessToken && accessTokenSecret) {
        this.smugmugService.setAccessToken(accessToken, accessTokenSecret);
      } else {
        throw new Error('SmugMug access tokens are required. Please complete OAuth flow first.');
      }

      // Test SmugMug connection
      const smugmugUser = await this.smugmugService.testConnection();
      this.progressTracker.setCurrentOperation(
        `Connected to SmugMug as ${smugmugUser.user.Name}`
      );

      // Initialize BackBlaze B2 service
      this.progressTracker.setCurrentOperation('Authenticating with BackBlaze B2...');
      const { accountId, applicationKey, bucketName } = this.config.backblaze;
      this.b2Service = new BackBlazeB2Service(accountId, applicationKey);

      await this.b2Service.testConnection(bucketName);
      this.progressTracker.setCurrentOperation(`Connected to B2 bucket: ${bucketName}`);

      // Initialize file system
      await this.fileSystemManager.initialize();
      this.progressTracker.setCurrentOperation('File system initialized');

    } catch (error) {
      this.errorLogger.logAuthError('SmugMug or B2 authentication', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Phase 2: Discover account structure and enumerate assets
   */
  async discoverAndEnumerate() {
    this.progressTracker.setPhase('discover', 'Discovering SmugMug account structure...');

    try {
      // Discover account structure
      const discoveryService = new AccountDiscoveryService(this.smugmugService);

      discoveryService.setProgressCallback((phase, current, total, message) => {
        this.progressTracker.setCurrentOperation(message);
      });

      this.accountStructure = await discoveryService.discoverAccount(true);

      const structureStats = this.accountStructure.getStats();
      this.progressTracker.setCurrentOperation(
        `Discovered ${structureStats.totalAlbums} albums with ${structureStats.totalAssetCount} assets`
      );

      // Enumerate assets
      this.progressTracker.setCurrentOperation('Enumerating assets...');
      const inventoryService = new AssetInventoryService(
        this.smugmugService,
        this.accountStructure
      );

      inventoryService.setProgressCallback((phase, current, total, message) => {
        this.progressTracker.setCurrentOperation(message);
      });

      // Apply test mode limit if enabled
      const assetLimit = this.config.testMode ? this.config.testAssetLimit : 0;

      // Pass excludeVideos option to filter during enumeration
      await inventoryService.buildInventory(assetLimit, this.config.excludeVideos);

      this.assetInventory = inventoryService;
      const assets = inventoryService.getAssets();

      this.progressTracker.setDiscovered(assets.length);
      this.progressTracker.setCurrentOperation(
        `Asset enumeration complete: ${assets.length} assets to process`
      );

      if (this.config.testMode) {
        this.progressTracker.setCurrentOperation(
          `TEST MODE: Processing ${assets.length} of ${structureStats.totalAssetCount} total assets`
        );
      }

    } catch (error) {
      this.errorLogger.logDiscoveryError('Account discovery', error.message);
      throw new Error(`Discovery failed: ${error.message}`);
    }
  }

  /**
   * Phase 3: Download and upload assets with metadata
   */
  async processAssets() {
    const assets = this.assetInventory.getAssets();

    if (assets.length === 0) {
      this.progressTracker.setPhase('complete', 'No assets to process');
      return;
    }

    this.progressTracker.setPhase('download', `Processing ${assets.length} assets...`);

    try {
      // Initialize processing services
      const downloadService = new AssetDownloadService(this.smugmugService, this.fileSystemManager);
      const metadataService = new MetadataService();
      const uploadService = new AssetUploadService(
        downloadService,
        metadataService,
        this.b2Service,
        this.fileSystemManager,
        this.errorLogger,
        this.progressTracker
      );

      // Configure services
      downloadService.setConcurrencyLimit(8);
      this.b2Service.setConcurrencyLimit(8);

      // Set up progress callbacks
      downloadService.setProgressCallback((phase, current, total, message) => {
        this.progressTracker.incrementDownloaded();
        this.progressTracker.setCurrentOperation(
          `Downloaded ${current}/${total}: ${message}`
        );
      });

      this.b2Service.setProgressCallback((phase, current, total, message) => {
        this.progressTracker.incrementUploaded();
        this.progressTracker.setCurrentOperation(
          `Uploaded ${current}/${total}: ${message}`
        );
      });

      // Process assets in batches for better progress tracking
      const batchSize = 50;
      for (let i = 0; i < assets.length; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);

        this.progressTracker.setCurrentOperation(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(assets.length / batchSize)}`
        );

        await this.processBatch(batch, uploadService);
      }

      // Log any errors from services
      const downloadErrors = downloadService.getErrors();
      const uploadErrors = this.b2Service.getUploadErrors();

      downloadErrors.forEach(err => {
        this.errorLogger.logDownloadError(
          err.filename || err.assetId,
          err.assetId,
          err.error
        );
        this.progressTracker.incrementErrors();
      });

      uploadErrors.forEach(err => {
        this.errorLogger.logUploadError(
          err.filename,
          err.assetId || 'unknown',
          err.error
        );
        this.progressTracker.incrementErrors();
      });

    } catch (error) {
      this.errorLogger.logCriticalError('Asset processing', error.message);
      throw new Error(`Asset processing failed: ${error.message}`);
    }
  }

  /**
   * Process a batch of assets
   */
  async processBatch(assets, uploadService) {
    const promises = assets.map(async (asset) => {
      try {
        await uploadService.processAsset(asset);
      } catch (error) {
        // Individual asset errors are already logged by services
        console.error(`Failed to process asset ${asset.assetId}:`, error.message);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Phase 4: Cleanup and generate completion summary
   */
  async complete() {
    this.progressTracker.setPhase('complete', 'Finalizing migration...');

    try {
      // Save error log
      await this.errorLogger.saveErrorLog();

      // Generate migration summary
      const summary = this.generateSummary();
      await this.fileSystemManager.writeLog('migration-summary.json', JSON.stringify(summary, null, 2));

      // Cleanup temporary files (optional - keep for debugging in MVP)
      // await this.fileSystemManager.cleanupDownloads();

      this.progressTracker.setCurrentOperation('Migration complete');

      // Broadcast completion event
      this.progressTracker.broadcastCompletion(summary);

    } catch (error) {
      console.error('Cleanup error:', error);
      // Don't throw - migration is essentially complete
    }
  }

  /**
   * Generate migration summary report
   */
  generateSummary() {
    const progress = this.progressTracker.getState();
    const errorSummary = this.errorLogger.getErrorSummary();

    const totalAssets = progress.discovered;
    const successful = progress.uploaded;
    const failed = progress.errors;
    const successRate = totalAssets > 0
      ? Math.round((successful / totalAssets) * 100)
      : 0;

    return {
      sessionId: this.sessionId,
      success: successRate >= 99,
      totalAssets,
      successful,
      failed,
      successRate,
      startTime: this.startTime,
      endTime: this.endTime || new Date(),
      duration: this.endTime
        ? Math.round((this.endTime - this.startTime) / 1000)
        : null,
      testMode: this.config.testMode,
      testAssetLimit: this.config.testAssetLimit,
      excludeVideos: this.config.excludeVideos,
      bucketName: this.config.backblaze.bucketName,
      errorLogPath: `${this.fileSystemManager.getPaths().logs}/error-log.json`,
      errors: errorSummary
    };
  }

  /**
   * Get error log for download
   */
  async getErrorLog() {
    return this.errorLogger.getErrorLog();
  }

  /**
   * Cancel/pause migration (future enhancement)
   */
  pause() {
    this.isPaused = true;
    this.progressTracker.setCurrentOperation('Migration paused');
  }

  resume() {
    this.isPaused = false;
    this.progressTracker.setCurrentOperation('Migration resumed');
  }
}

export default MigrationOrchestrator;
