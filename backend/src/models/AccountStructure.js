/**
 * AccountStructure Model
 * Represents the complete folder/album hierarchy of a SmugMug account
 */
class AccountStructure {
  constructor(user) {
    this.user = {
      name: user.Name,
      nickName: user.NickName,
      domain: user.Domain,
      uri: user.Uri,
    };

    this.rootFolders = [];
    this.allAlbums = [];
    this.allFolders = [];

    // Discovery metadata
    this.discoveryStarted = null;
    this.discoveryCompleted = null;
    this.totalAlbums = 0;
    this.totalFolders = 0;
    this.totalImages = 0;
    this.totalVideos = 0;
  }

  /**
   * Add root folder
   */
  addRootFolder(folder) {
    this.rootFolders.push(folder);
    this.allFolders.push(folder);
  }

  /**
   * Add album to tracking
   */
  addAlbum(album) {
    this.allAlbums.push(album);
    this.totalAlbums++;
    this.totalImages += album.imageCount || 0;
    this.totalVideos += album.videoCount || 0;
  }

  /**
   * Add folder to tracking
   */
  addFolder(folder) {
    this.allFolders.push(folder);
    this.totalFolders++;
  }

  /**
   * Mark discovery as started
   */
  startDiscovery() {
    this.discoveryStarted = new Date().toISOString();
  }

  /**
   * Mark discovery as completed
   */
  completeDiscovery() {
    this.discoveryCompleted = new Date().toISOString();
  }

  /**
   * Get discovery statistics
   */
  getStats() {
    return {
      totalFolders: this.totalFolders,
      totalAlbums: this.totalAlbums,
      totalImages: this.totalImages,
      totalVideos: this.totalVideos,
      totalAssets: this.totalImages + this.totalVideos,
      discoveryStarted: this.discoveryStarted,
      discoveryCompleted: this.discoveryCompleted,
      discoveryDuration: this.discoveryCompleted && this.discoveryStarted
        ? new Date(this.discoveryCompleted) - new Date(this.discoveryStarted)
        : null,
    };
  }

  /**
   * Get flat list of all albums
   */
  getAllAlbums() {
    return this.allAlbums;
  }

  /**
   * Get albums with media only
   */
  getAlbumsWithMedia() {
    return this.allAlbums.filter(album => album.hasMedia());
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      user: this.user,
      stats: this.getStats(),
      rootFolders: this.rootFolders.map(f => f.toJSON()),
      allAlbums: this.allAlbums.map(a => a.toJSON()),
    };
  }

  /**
   * Export summary for logging
   */
  toSummary() {
    return {
      user: this.user.nickName,
      stats: this.getStats(),
    };
  }
}

export default AccountStructure;
