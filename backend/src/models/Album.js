/**
 * Album Model
 * Represents a SmugMug album/gallery with its metadata
 */
class Album {
  constructor(data) {
    this.albumId = data.AlbumKey || data.albumId;
    this.albumKey = data.AlbumKey || data.albumKey;
    this.name = data.Name || data.name;
    this.title = data.Title || data.title;
    this.description = data.Description || data.description;
    this.keywords = data.Keywords || data.keywords || [];
    this.uri = data.Uri || data.uri;
    this.webUri = data.WebUri || data.webUri;
    this.imageCount = data.ImageCount || data.imageCount || 0;
    this.videoCount = data.VideoCount || data.videoCount || 0;
    this.created = data.Date || data.created;
    this.modified = data.LastUpdated || data.modified;

    // Privacy and permissions
    this.privacy = data.Privacy || data.privacy;
    this.canShare = data.CanShare || data.canShare || false;

    // Album type
    this.albumType = data.Type || data.albumType;

    // Parent folder (if nested)
    this.folderUri = data.Folder?.Uri || data.folderUri;
    this.folderName = data.Folder?.Name || data.folderName;

    // Store raw data for reference
    this.rawData = data;
  }

  /**
   * Check if album has any media
   */
  hasMedia() {
    return this.imageCount > 0 || this.videoCount > 0;
  }

  /**
   * Get total media count
   */
  getTotalMediaCount() {
    return this.imageCount + this.videoCount;
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      albumId: this.albumId,
      albumKey: this.albumKey,
      name: this.name,
      title: this.title,
      description: this.description,
      keywords: this.keywords,
      uri: this.uri,
      webUri: this.webUri,
      imageCount: this.imageCount,
      videoCount: this.videoCount,
      created: this.created,
      modified: this.modified,
      privacy: this.privacy,
      canShare: this.canShare,
      albumType: this.albumType,
      folderUri: this.folderUri,
      folderName: this.folderName,
    };
  }
}

export default Album;
