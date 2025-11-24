# Epic 2 Services - Quick Usage Guide

## Service Initialization

```javascript
import FileSystemManager from './services/FileSystemManager.js';
import MetadataService from './services/MetadataService.js';
import AssetDownloadService from './services/AssetDownloadService.js';
import ErrorLogger from './services/ErrorLogger.js';
import ProgressTracker from './services/ProgressTracker.js';
import BackBlazeB2Service from './services/BackBlazeB2Service.js';
import AssetUploadService from './services/AssetUploadService.js';
import SmugMugService from './services/SmugMugService.js';

// 1. Initialize FileSystemManager
const sessionId = 'migration-' + Date.now();
const fsManager = new FileSystemManager(sessionId);
await fsManager.initialize();

// Check disk space
await fsManager.ensureSufficientSpace(30); // 30GB required

// 2. Initialize Error Logger
const errorLogger = new ErrorLogger(fsManager, sessionId);

// 3. Initialize Progress Tracker
const progressTracker = new ProgressTracker(sessionId);

// 4. Initialize SmugMug Service (from Epic 1)
const smugmugService = new SmugMugService(apiKey, apiSecret);
smugmugService.setAccessToken(accessToken, accessTokenSecret);

// 5. Initialize Metadata Service
const metadataService = new MetadataService();

// 6. Initialize Download Service
const downloadService = new AssetDownloadService(smugmugService, fsManager);
downloadService.setConcurrencyLimit(8); // Optional: adjust concurrency

// Set progress callback
downloadService.setProgressCallback((current, total, filename, error) => {
  if (error) {
    console.log(`Failed: ${filename} - ${error}`);
  } else {
    console.log(`Downloaded: ${filename} (${current} assets)`);
  }
});

// 7. Initialize B2 Service (from Epic 1, enhanced in Epic 2)
const b2Service = new BackBlazeB2Service(accountId, applicationKey);
await b2Service.authorize();
await b2Service.validateBucket(bucketName);

b2Service.setConcurrencyLimit(8); // Optional: adjust concurrency
b2Service.setProgressCallback((current, total, filename, error) => {
  if (error) {
    console.log(`Upload failed: ${filename} - ${error}`);
  } else {
    console.log(`Uploaded: ${filename} (${current} assets)`);
  }
});

// 8. Initialize Asset Upload Service (Orchestrator)
const uploadService = new AssetUploadService(
  downloadService,
  metadataService,
  b2Service,
  fsManager,
  errorLogger,
  progressTracker
);
```

## Basic Usage Examples

### Example 1: Process a Single Asset

```javascript
// Get asset from inventory (from Epic 1)
const asset = {
  assetId: 'abc123',
  filename: 'IMG_1234.jpg',
  archivedUri: 'https://smugmug.com/photos/...',
  albumUri: '/api/v2/album/xyz',
  rawSmugmugData: { /* full SmugMug API response */ }
};

const albumInfo = {
  name: 'Vacation 2024',
  uri: '/api/v2/album/xyz'
};

// Process asset through complete pipeline
const result = await uploadService.processAsset(asset, albumInfo);

if (result.success) {
  console.log(`✅ Successfully processed ${result.filename}`);
  console.log(`   Size: ${result.size} bytes`);
  console.log(`   Metadata: ${result.metadataExtracted ? 'Yes' : 'No'}`);
} else {
  console.log(`❌ Failed to process ${result.filename}`);
  console.log(`   Phase: ${result.phase}`);
  console.log(`   Error: ${result.error}`);
}
```

### Example 2: Process Multiple Assets

```javascript
// Get assets from inventory
const assets = [
  { assetId: '1', filename: 'IMG_001.jpg', archivedUri: '...', albumUri: '...' },
  { assetId: '2', filename: 'IMG_002.jpg', archivedUri: '...', albumUri: '...' },
  // ... more assets
];

// Map of album URIs to album info
const albumInfoMap = {
  '/api/v2/album/xyz': { name: 'Vacation 2024', uri: '/api/v2/album/xyz' }
};

// Process all assets
const summary = await uploadService.processAssets(assets, albumInfoMap);

console.log(`Processed ${summary.total} assets:`);
console.log(`  Successful: ${summary.successful}`);
console.log(`  Failed: ${summary.failed}`);
```

### Example 3: Subscribe to Progress Updates

```javascript
// Subscribe to progress tracker
const subscriptionId = progressTracker.subscribe((event) => {
  console.log(`[${event.type}]`, event.data);

  if (event.type === 'phase') {
    console.log(`Phase changed to: ${event.data.phase}`);
  }

  if (event.type === 'progress') {
    console.log(`Downloaded: ${event.data.downloaded}/${event.data.discovered}`);
    console.log(`Uploaded: ${event.data.uploaded}/${event.data.discovered}`);
    console.log(`Errors: ${event.data.errors}`);
  }

  if (event.type === 'complete') {
    console.log(`Migration complete!`);
    console.log(event.data.summary);
  }
});

// Later: unsubscribe
progressTracker.unsubscribe(subscriptionId);
```

### Example 4: Manual Download-Only Workflow

```javascript
// Just download assets without uploading
const assets = [...]; // Asset list

for (const asset of assets) {
  progressTracker.setCurrentOperation(`Downloading ${asset.filename}`);

  const result = await downloadService.downloadAsset(asset);

  if (result.success) {
    progressTracker.incrementDownloaded();

    // Extract metadata
    const metadata = metadataService.extractMetadata(
      asset.rawSmugmugData,
      { name: 'Album Name', uri: '/api/v2/album/xyz' }
    );

    // Generate JSON
    const jsonContent = metadataService.generateJsonSidecar(metadata);
    const jsonFilename = metadataService.getJsonSidecarFilename(asset.filename);

    // Save JSON
    await fsManager.writeFile(jsonFilename, Buffer.from(jsonContent, 'utf8'));

    console.log(`✅ Downloaded and saved metadata: ${asset.filename}`);
  } else {
    progressTracker.incrementErrors();
    errorLogger.logDownloadError(asset.filename, asset.assetId, result.error);
  }
}
```

### Example 5: Manual Upload-Only Workflow

```javascript
// Upload already-downloaded files
const files = [
  { fileName: 'IMG_001.jpg', contentType: 'image/jpeg' },
  { fileName: 'IMG_002.jpg', contentType: 'image/jpeg' },
  // ... more files
];

// Prepare upload data
const uploadData = [];
for (const file of files) {
  const fileData = await fsManager.readFile(file.fileName);
  uploadData.push({
    data: fileData,
    fileName: file.fileName,
    contentType: file.contentType
  });
}

// Upload with concurrency
const results = await b2Service.uploadMultipleFilesWithConcurrency(uploadData);

// Check results
for (const result of results) {
  if (result.success) {
    console.log(`✅ Uploaded: ${result.fileName}`);

    // Cleanup after successful upload
    await fsManager.deleteFile(result.fileName);
  } else {
    console.log(`❌ Failed: ${result.fileName} - ${result.error}`);
    errorLogger.logUploadError(result.fileName, result.error);
  }
}
```

## Error Handling

### Retrieve and Save Error Log

```javascript
// At end of migration
const errorLog = errorLogger.generateErrorLog();
console.log(`Total errors: ${errorLog.totalErrors}`);
console.log('Errors by phase:', errorLog.errorsByPhase);

// Save to file
const errorLogPath = await errorLogger.saveErrorLog();
console.log(`Error log saved to: ${errorLogPath}`);

// Also save as CSV
const csvPath = await errorLogger.saveErrorLogAsCSV();
console.log(`CSV error log saved to: ${csvPath}`);
```

### Get Error Summary

```javascript
const summary = errorLogger.getErrorSummary();
console.log('Error Summary:');
console.log(`  Total: ${summary.total}`);
console.log(`  By Phase:`, summary.byPhase);
console.log(`  Retryable: ${summary.retryable}`);
console.log('Recent errors:', summary.recent);
```

## Progress Tracking

### Manual Progress Updates

```javascript
// Set phase
progressTracker.setPhase('download', 'Starting asset downloads');

// Update counts
progressTracker.setDiscovered(1100); // Total assets found

// As downloads complete
progressTracker.incrementDownloaded();
progressTracker.setCurrentOperation('Downloading IMG_1234.jpg');

// When switching to uploads
progressTracker.setPhase('upload', 'Uploading assets to B2');

// As uploads complete
progressTracker.incrementUploaded();

// Mark complete
progressTracker.complete(true); // true = success
```

### Get Progress Summary

```javascript
const summary = progressTracker.getSummary();
console.log('Progress Summary:');
console.log(`  Phase: ${summary.phase}`);
console.log(`  Discovered: ${summary.discovered}`);
console.log(`  Downloaded: ${summary.downloaded}`);
console.log(`  Uploaded: ${summary.uploaded}`);
console.log(`  Errors: ${summary.errors}`);
console.log(`  Success Rate: ${summary.successRate}%`);
console.log(`  Duration: ${summary.durationFormatted}`);
```

## Cleanup

```javascript
// Cleanup after migration
const storageUsage = await fsManager.getStorageUsage();
console.log(`Current storage: ${storageUsage.sizeGB} GB (${storageUsage.fileCount} files)`);

// Full cleanup
const cleaned = await fsManager.cleanupAll();
if (cleaned) {
  console.log('✅ Session directory cleaned up');
}
```

## Configuration Options

### Download Service Configuration

```javascript
downloadService.setConcurrencyLimit(10); // Increase parallel downloads
downloadService.retryAttempts = 5;        // Increase retry attempts
downloadService.retryDelay = 3000;        // 3 second delay between retries
```

### Upload Service Configuration

```javascript
b2Service.setConcurrencyLimit(10);        // Increase parallel uploads
b2Service.retryAttempts = 5;              // Increase retry attempts
b2Service.retryDelay = 3000;              // 3 second delay

uploadService.setCleanupAfterUpload(true);  // Enable cleanup (default)
uploadService.setUploadMetadataFiles(true); // Enable JSON uploads (default)
```

### Progress Tracker Configuration

```javascript
progressTracker.setThrottleInterval(2000); // Update every 2 seconds
```

## Getting Statistics

```javascript
// Download stats
const downloadStats = downloadService.getStats();
console.log('Download Stats:', downloadStats);

// Upload stats
const uploadStats = b2Service.getUploadStats();
console.log('Upload Stats:', uploadStats);

// Combined stats from orchestrator
const allStats = uploadService.getStats();
console.log('All Stats:', allStats);
```

## Complete Workflow Example

```javascript
async function migrateAssets(apiKey, apiSecret, accessToken, accessTokenSecret,
                             b2AccountId, b2AppKey, b2Bucket, assets) {
  // 1. Setup
  const sessionId = 'migration-' + Date.now();
  const fsManager = new FileSystemManager(sessionId);
  await fsManager.initialize();
  await fsManager.ensureSufficientSpace(30);

  const errorLogger = new ErrorLogger(fsManager, sessionId);
  const progressTracker = new ProgressTracker(sessionId);

  // 2. Services
  const smugmugService = new SmugMugService(apiKey, apiSecret);
  smugmugService.setAccessToken(accessToken, accessTokenSecret);

  const metadataService = new MetadataService();
  const downloadService = new AssetDownloadService(smugmugService, fsManager);

  const b2Service = new BackBlazeB2Service(b2AccountId, b2AppKey);
  await b2Service.authorize();
  await b2Service.validateBucket(b2Bucket);

  const uploadService = new AssetUploadService(
    downloadService, metadataService, b2Service,
    fsManager, errorLogger, progressTracker
  );

  // 3. Subscribe to progress
  progressTracker.subscribe((event) => {
    console.log(`[${event.type}]`, event.data.message || event.data);
  });

  // 4. Process assets
  progressTracker.setPhase('download', 'Starting migration');
  progressTracker.setDiscovered(assets.length);

  const result = await uploadService.processAssets(assets, {});

  // 5. Complete
  progressTracker.complete(result.failed === 0);

  // 6. Save error log
  if (errorLogger.hasErrors()) {
    await errorLogger.saveErrorLog();
  }

  // 7. Cleanup
  await fsManager.cleanupAll();

  // 8. Summary
  const summary = progressTracker.getSummary();
  console.log('Migration Complete!');
  console.log(`  Success Rate: ${summary.successRate}%`);
  console.log(`  Duration: ${summary.durationFormatted}`);

  return summary;
}
```

## Tips and Best Practices

1. **Always initialize FileSystemManager first** - Other services depend on it
2. **Check disk space before starting** - Prevents mid-migration failures
3. **Subscribe to progress tracker early** - Capture all events
4. **Use AssetUploadService for simplicity** - Handles complete pipeline
5. **Save error log even on success** - Useful for debugging partial failures
6. **Configure concurrency based on network** - Higher isn't always better
7. **Test with small batch first** - Validate workflow before full migration
8. **Monitor storage usage** - Ensure cleanup is working properly

## Troubleshooting

### Issue: Downloads timing out
**Solution:** Increase timeout or reduce concurrency
```javascript
downloadService.setConcurrencyLimit(5);
```

### Issue: B2 upload failures
**Solution:** Check bucket permissions, increase retry attempts
```javascript
b2Service.retryAttempts = 5;
```

### Issue: Running out of disk space
**Solution:** Enable cleanup, reduce batch size
```javascript
uploadService.setCleanupAfterUpload(true);
```

### Issue: Progress not updating
**Solution:** Check throttle interval, ensure callbacks are set
```javascript
progressTracker.setThrottleInterval(500); // Update more frequently
```
