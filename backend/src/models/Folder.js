/**
 * Folder Model
 * Represents a SmugMug folder that can contain albums and sub-folders
 */
class Folder {
  constructor(data) {
    this.folderId = data.NodeID || data.folderId;
    this.name = data.Name || data.name;
    this.urlName = data.UrlName || data.urlName;
    this.uri = data.Uri || data.uri;
    this.webUri = data.WebUri || data.webUri;
    this.type = data.Type || data.type;
    this.description = data.Description || data.description;

    // Parent folder (if nested)
    this.parentUri = data.Parent?.Uri || data.parentUri;
    this.parentName = data.Parent?.Name || data.parentName;

    // Privacy
    this.privacy = data.Privacy || data.privacy;

    // Timestamps
    this.created = data.DateAdded || data.created;
    this.modified = data.DateModified || data.modified;

    // Children (populated during traversal)
    this.albums = [];
    this.subfolders = [];

    // Store raw data
    this.rawData = data;
  }

  /**
   * Add album to folder
   */
  addAlbum(album) {
    this.albums.push(album);
  }

  /**
   * Add subfolder
   */
  addSubfolder(folder) {
    this.subfolders.push(folder);
  }

  /**
   * Get total album count including subfolders
   */
  getTotalAlbumCount(recursive = false) {
    let count = this.albums.length;
    if (recursive) {
      this.subfolders.forEach(subfolder => {
        count += subfolder.getTotalAlbumCount(true);
      });
    }
    return count;
  }

  /**
   * Check if folder has children
   */
  hasChildren() {
    return this.albums.length > 0 || this.subfolders.length > 0;
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      folderId: this.folderId,
      name: this.name,
      urlName: this.urlName,
      uri: this.uri,
      webUri: this.webUri,
      type: this.type,
      description: this.description,
      parentUri: this.parentUri,
      parentName: this.parentName,
      privacy: this.privacy,
      created: this.created,
      modified: this.modified,
      albumCount: this.albums.length,
      subfolderCount: this.subfolders.length,
      albums: this.albums.map(a => a.toJSON ? a.toJSON() : a),
      subfolders: this.subfolders.map(f => f.toJSON ? f.toJSON() : f),
    };
  }
}

export default Folder;
