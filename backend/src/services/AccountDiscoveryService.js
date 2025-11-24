import Album from '../models/Album.js';
import Folder from '../models/Folder.js';
import AccountStructure from '../models/AccountStructure.js';

/**
 * AccountDiscoveryService
 * Discovers and maps the complete folder/album structure of a SmugMug account
 */
class AccountDiscoveryService {
  constructor(smugmugService) {
    this.smugmugService = smugmugService;
    this.accountStructure = null;
    this.progressCallback = null;

    // Rate limiting
    this.requestDelay = 100; // ms between requests
    this.lastRequestTime = 0;
  }

  /**
   * Set progress callback for real-time updates
   * @param {Function} callback - Called with (phase, current, total, message)
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Report progress
   */
  reportProgress(phase, current, total, message) {
    if (this.progressCallback) {
      this.progressCallback(phase, current, total, message);
    }
  }

  /**
   * Rate limit requests to respect SmugMug API
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
   * Discover complete account structure
   * @param {boolean} includeEmptyAlbums - Include albums with no media
   * @returns {Promise<AccountStructure>}
   */
  async discoverAccount(includeEmptyAlbums = true) {
    try {
      this.reportProgress('auth', 0, 1, 'Getting authenticated user...');

      // Get authenticated user
      const user = await this.smugmugService.getAuthenticatedUser();
      this.accountStructure = new AccountStructure(user);
      this.accountStructure.startDiscovery();

      console.log(`\n✓ Authenticated as: ${user.Name} (${user.NickName})`);

      // Discover user's albums
      this.reportProgress('discover', 0, 1, 'Discovering albums...');
      await this.discoverUserAlbums(user, includeEmptyAlbums);

      // Complete discovery
      this.accountStructure.completeDiscovery();

      const stats = this.accountStructure.getStats();
      console.log('\n✓ Discovery complete');
      console.log(`  Albums: ${stats.totalAlbums}`);
      console.log(`  Images: ${stats.totalImages}`);
      console.log(`  Videos: ${stats.totalVideos}`);
      console.log(`  Total Assets: ${stats.totalAssets}`);

      this.reportProgress('complete', 1, 1, 'Discovery complete');

      return this.accountStructure;
    } catch (error) {
      console.error('Account discovery error:', error);
      throw new Error(`Failed to discover account structure: ${error.message}`);
    }
  }

  /**
   * Discover all albums for a user
   * @param {object} user - User object
   * @param {boolean} includeEmpty - Include empty albums
   */
  async discoverUserAlbums(user, includeEmpty = true) {
    try {
      await this.respectRateLimit();

      console.log('\nFetching albums...');
      const albums = await this.smugmugService.getAlbums(user.Uris.UserAlbums.Uri);

      console.log(`Found ${albums.length} albums`);

      let processedCount = 0;

      for (const albumData of albums) {
        processedCount++;
        const album = new Album(albumData);

        // Skip empty albums if requested
        if (!includeEmpty && !album.hasMedia()) {
          console.log(`  Skipping empty album: ${album.name}`);
          continue;
        }

        this.reportProgress(
          'discover',
          processedCount,
          albums.length,
          `Processing album: ${album.name}`
        );

        console.log(`  [${processedCount}/${albums.length}] ${album.name} (${album.getTotalMediaCount()} assets)`);

        this.accountStructure.addAlbum(album);

        // Small delay to be respectful
        await this.respectRateLimit();
      }
    } catch (error) {
      console.error('Error discovering albums:', error);
      throw error;
    }
  }

  /**
   * Discover folder hierarchy (recursive)
   * Note: This requires Node API access which may need different permissions
   * @param {string} folderUri - Starting folder URI
   * @param {Folder} parentFolder - Parent folder object
   */
  async discoverFolderHierarchy(folderUri, parentFolder = null) {
    try {
      await this.respectRateLimit();

      // Get folder details
      const folderData = await this.smugmugService.makeAuthenticatedRequest(folderUri);
      const folder = new Folder(folderData.Response.Folder || folderData.Response.Node);

      if (parentFolder) {
        parentFolder.addSubfolder(folder);
      } else {
        this.accountStructure.addRootFolder(folder);
      }

      this.accountStructure.addFolder(folder);

      console.log(`  Folder: ${folder.name}`);

      // Get albums in this folder
      if (folder.uri) {
        try {
          const albums = await this.smugmugService.getAlbums(`${folder.uri}!albums`);
          for (const albumData of albums) {
            const album = new Album(albumData);
            folder.addAlbum(album);
            this.accountStructure.addAlbum(album);
          }
        } catch (error) {
          // Folder might not have albums endpoint
          console.log(`    No albums in folder: ${folder.name}`);
        }
      }

      // Recursively discover subfolders
      // Note: This would require Node API which may need additional permissions
      // For MVP, we're focusing on flat album discovery

      return folder;
    } catch (error) {
      console.error('Error discovering folder:', error);
      throw error;
    }
  }

  /**
   * Get account structure
   * @returns {AccountStructure}
   */
  getAccountStructure() {
    return this.accountStructure;
  }

  /**
   * Export account structure to JSON
   * @returns {object}
   */
  exportStructure() {
    if (!this.accountStructure) {
      throw new Error('No account structure discovered');
    }
    return this.accountStructure.toJSON();
  }

  /**
   * Get discovery summary
   * @returns {object}
   */
  getSummary() {
    if (!this.accountStructure) {
      throw new Error('No account structure discovered');
    }
    return this.accountStructure.toSummary();
  }
}

export default AccountDiscoveryService;
