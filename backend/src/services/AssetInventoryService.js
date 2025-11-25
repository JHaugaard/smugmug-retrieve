import Asset from '../models/Asset.js';

/**
 * AssetInventoryService
 * Enumerates all assets (images and videos) from discovered albums
 * Builds complete inventory with metadata and download URLs
 */
class AssetInventoryService {
  constructor(smugmugService, accountStructure) {
    this.smugmugService = smugmugService;
    this.accountStructure = accountStructure;
    this.assets = [];
    this.progressCallback = null;

    // Pagination settings
    this.imagesPerPage = 100; // SmugMug API default/max

    // Rate limiting
    this.requestDelay = 100; // ms between requests
    this.lastRequestTime = 0;

    // Statistics
    this.stats = {
      totalAlbums: 0,
      processedAlbums: 0,
      totalAssets: 0,
      totalImages: 0,
      totalVideos: 0,
      totalSize: 0,
      startTime: null,
      endTime: null,
      errors: [],
    };
  }

  /**
   * Set progress callback for real-time updates
   * @param {Function} callback - Called with (phase, current, total, message, details)
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Report progress
   */
  reportProgress(phase, current, total, message, details = {}) {
    if (this.progressCallback) {
      this.progressCallback(phase, current, total, message, details);
    }
  }

  /**
   * Rate limit requests
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve =>
        setTimeout(resolve, this.requestDelay - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Build complete asset inventory from account structure
   * @param {number} testLimit - Limit assets for testing (0 = no limit)
   * @param {boolean} excludeVideos - Whether to exclude video assets
   * @returns {Promise<Array<Asset>>}
   */
  async buildInventory(testLimit = 0, excludeVideos = false) {
    try {
      this.stats.startTime = new Date().toISOString();
      this.assets = [];
      this.excludeVideos = excludeVideos;

      const albums = this.accountStructure.getAlbumsWithMedia();
      this.stats.totalAlbums = albums.length;

      console.log(`\n✓ Starting asset enumeration`);
      console.log(`  Albums with media: ${albums.length}`);
      if (testLimit > 0) {
        console.log(`  TEST MODE: Limiting to ${testLimit} assets`);
      }
      if (excludeVideos) {
        console.log(`  IMAGES ONLY: Excluding video files`);
      }
      console.log('');

      this.reportProgress('enumerate', 0, albums.length, 'Starting asset enumeration');

      let totalAssetsFound = 0;
      let videosSkipped = 0;

      for (const album of albums) {
        // Check test limit
        if (testLimit > 0 && totalAssetsFound >= testLimit) {
          console.log(`\n✓ Test limit reached (${testLimit} assets)`);
          break;
        }

        try {
          this.stats.processedAlbums++;

          // Fetch more than needed if filtering videos, to ensure we get enough images
          const remainingNeeded = testLimit > 0 ? testLimit - totalAssetsFound : 0;
          const albumAssetsToFetch = testLimit > 0
            ? Math.min(album.getTotalMediaCount(), remainingNeeded * 3) // Fetch 3x to account for videos
            : album.getTotalMediaCount();

          console.log(`[${this.stats.processedAlbums}/${albums.length}] ${album.name}`);
          console.log(`  Expected: ${album.getTotalMediaCount()} assets`);

          this.reportProgress(
            'enumerate',
            this.stats.processedAlbums,
            albums.length,
            `Processing album: ${album.name}`,
            { album: album.name, expected: album.getTotalMediaCount() }
          );

          // Enumerate assets in this album with pagination
          const result = await this.enumerateAlbumAssets(album, albumAssetsToFetch, testLimit > 0 ? testLimit - totalAssetsFound : 0);

          totalAssetsFound += result.added;
          videosSkipped += result.videosSkipped;

          console.log(`  Found: ${result.added} assets${result.videosSkipped > 0 ? ` (${result.videosSkipped} videos skipped)` : ''}`);

        } catch (error) {
          console.error(`  ❌ Error processing album "${album.name}":`, error.message);
          this.stats.errors.push({
            album: album.name,
            albumKey: album.albumKey,
            error: error.message,
          });
        }

        await this.respectRateLimit();
      }

      this.stats.endTime = new Date().toISOString();
      this.stats.totalAssets = this.assets.length;
      this.stats.totalImages = this.assets.filter(a => a.isImage).length;
      this.stats.totalVideos = this.assets.filter(a => a.isVideo).length;
      this.stats.videosSkipped = videosSkipped;
      this.stats.totalSize = this.assets.reduce((sum, a) => sum + (a.originalSize || 0), 0);

      console.log(`\n✓ Asset enumeration complete`);
      console.log(`  Total assets: ${this.stats.totalAssets}`);
      console.log(`  Images: ${this.stats.totalImages}`);
      console.log(`  Videos: ${this.stats.totalVideos}`);
      if (videosSkipped > 0) {
        console.log(`  Videos skipped: ${videosSkipped}`);
      }
      console.log(`  Total size: ${this.getFormattedSize(this.stats.totalSize)}`);
      console.log(`  Errors: ${this.stats.errors.length}`);

      this.reportProgress('complete', 1, 1, 'Asset enumeration complete', {
        totalAssets: this.stats.totalAssets,
      });

      return this.assets;

    } catch (error) {
      console.error('Asset inventory error:', error);
      throw new Error(`Failed to build asset inventory: ${error.message}`);
    }
  }

  /**
   * Enumerate all assets in a single album (with pagination)
   * @param {Album} album - Album to enumerate
   * @param {number} fetchLimit - Maximum assets to fetch from API (0 = all)
   * @param {number} targetLimit - Target number of assets to add (for test mode with filtering)
   * @returns {Promise<{added: number, videosSkipped: number}>}
   */
  async enumerateAlbumAssets(album, fetchLimit = 0, targetLimit = 0) {
    let addedCount = 0;
    let videosSkipped = 0;
    let start = 1;
    let hasMore = true;
    let totalFetched = 0;

    while (hasMore) {
      await this.respectRateLimit();

      try {
        // Determine count for this page
        const remainingToFetch = fetchLimit > 0 ? fetchLimit - totalFetched : this.imagesPerPage;
        const count = fetchLimit > 0
          ? Math.min(this.imagesPerPage, remainingToFetch)
          : this.imagesPerPage;

        if (count <= 0) {
          hasMore = false;
          break;
        }

        const result = await this.smugmugService.getAlbumImages(
          `${album.uri}!images`,
          start,
          count
        );

        const images = result.images || [];
        totalFetched += images.length;

        console.log(`    Page ${Math.ceil(start / this.imagesPerPage)}: ${images.length} assets`);

        // Process each image
        for (const imageData of images) {
          const asset = new Asset(imageData, album);

          // Skip videos if excludeVideos is enabled
          if (this.excludeVideos && asset.isVideo) {
            videosSkipped++;
            continue;
          }

          this.assets.push(asset);
          addedCount++;

          // Check if we've reached the target limit (for test mode)
          if (targetLimit > 0 && addedCount >= targetLimit) {
            hasMore = false;
            break;
          }
        }

        // Check if there are more pages
        const pages = result.pages;
        hasMore = hasMore && pages && pages.NextPage !== undefined;

        if (hasMore) {
          start += count;
        }

        // Check if we've reached the fetch limit
        if (fetchLimit > 0 && totalFetched >= fetchLimit) {
          hasMore = false;
        }

      } catch (error) {
        console.error(`    ❌ Error fetching page (start=${start}):`, error.message);
        this.stats.errors.push({
          album: album.name,
          page: start,
          error: error.message,
        });
        hasMore = false; // Stop on error
      }
    }

    return { added: addedCount, videosSkipped };
  }

  /**
   * Get all assets
   */
  getAssets() {
    return this.assets;
  }

  /**
   * Get images only
   */
  getImages() {
    return this.assets.filter(a => a.isImage);
  }

  /**
   * Get videos only
   */
  getVideos() {
    return this.assets.filter(a => a.isVideo);
  }

  /**
   * Get assets for a specific album
   */
  getAssetsByAlbum(albumName) {
    return this.assets.filter(a => a.albumName === albumName);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      duration: this.stats.startTime && this.stats.endTime
        ? new Date(this.stats.endTime) - new Date(this.stats.startTime)
        : null,
    };
  }

  /**
   * Export inventory to JSON
   */
  exportInventory() {
    return {
      user: this.accountStructure.user,
      stats: this.getStats(),
      assets: this.assets.map(a => a.toJSON()),
    };
  }

  /**
   * Export metadata for all assets (for JSON sidecar files)
   */
  exportMetadata() {
    const metadata = {};
    this.assets.forEach(asset => {
      const filename = asset.getSafeFilename();
      metadata[filename] = asset.toMetadataJSON();
    });
    return metadata;
  }

  /**
   * Get formatted file size
   */
  getFormattedSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  /**
   * Get asset summary for logging
   */
  getSummary() {
    const stats = this.getStats();
    return {
      totalAssets: stats.totalAssets,
      images: stats.totalImages,
      videos: stats.totalVideos,
      totalSize: this.getFormattedSize(stats.totalSize),
      albumsProcessed: stats.processedAlbums,
      errors: stats.errors.length,
      duration: stats.duration ? `${Math.round(stats.duration / 1000)}s` : null,
    };
  }
}

export default AssetInventoryService;
