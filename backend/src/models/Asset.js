/**
 * Asset Model
 * Represents a single image or video asset from SmugMug with complete metadata
 */
class Asset {
  constructor(data, album = null) {
    // Core identifiers
    this.assetId = data.ImageKey || data.assetId;
    this.imageKey = data.ImageKey || data.imageKey;
    this.uri = data.Uri || data.uri;
    this.webUri = data.WebUri || data.webUri;
    this.albumUri = data.AlbumUri || data.albumUri;

    // Asset type
    this.type = this.determineType(data);
    this.isVideo = data.IsVideo || this.type === 'video';
    this.isImage = !this.isVideo;

    // Basic metadata
    this.filename = data.FileName || data.filename;
    this.title = data.Title || data.title;
    this.caption = data.Caption || data.caption;
    this.keywords = data.Keywords || data.keywords || [];

    // Dates
    this.dateUploaded = data.Date || data.dateUploaded;
    this.dateModified = data.LastUpdated || data.dateModified;
    this.dateTaken = data.DateTimeOriginal || data.dateTaken;

    // File information
    this.format = data.Format || data.format;
    this.originalSize = data.OriginalSize || data.originalSize || 0;
    this.originalHeight = data.OriginalHeight || data.originalHeight;
    this.originalWidth = data.OriginalWidth || data.originalWidth;

    // Download URLs
    this.archivedUri = data.ArchivedUri || data.archivedUri;
    this.originalUri = data.Uris?.LargestImage?.Uri || data.originalUri;
    this.largestImageUri = data.Uris?.LargestImage?.Uri;
    this.largestVideoUri = data.Uris?.LargestVideo?.Uri;

    // EXIF data
    this.exif = this.extractExif(data);

    // GPS location
    this.gpsLatitude = data.Latitude || data.gpsLatitude;
    this.gpsLongitude = data.Longitude || data.gpsLongitude;
    this.gpsAltitude = data.Altitude || data.gpsAltitude;

    // Album association
    if (album) {
      this.albumName = album.name;
      this.albumKey = album.albumKey;
      this.albumUri = album.uri;
    }

    // Store raw data for reference
    this.rawData = data;
  }

  /**
   * Determine asset type from data
   */
  determineType(data) {
    if (data.IsVideo) return 'video';
    if (data.Format) {
      const videoFormats = ['mp4', 'mov', 'avi', 'wmv', 'm4v'];
      if (videoFormats.includes(data.Format.toLowerCase())) {
        return 'video';
      }
    }
    return 'image';
  }

  /**
   * Extract EXIF data into structured format
   */
  extractExif(data) {
    const exif = {};

    // Camera info
    if (data.Camera) {
      exif.make = data.Camera.Make;
      exif.model = data.Camera.Model;
    }

    // Exposure settings
    if (data.Aperture) exif.aperture = data.Aperture;
    if (data.FocalLength) exif.focalLength = data.FocalLength;
    if (data.ISO) exif.iso = data.ISO;
    if (data.ExposureTime) exif.exposureTime = data.ExposureTime;
    if (data.ShutterSpeed) exif.shutterSpeed = data.ShutterSpeed;

    // Flash
    if (data.Flash !== undefined) exif.flash = data.Flash;

    // Lens
    if (data.LensModel) exif.lens = data.LensModel;

    // Color space
    if (data.ColorSpace) exif.colorSpace = data.ColorSpace;

    return Object.keys(exif).length > 0 ? exif : null;
  }

  /**
   * Get download URL (prefer original, fallback to largest)
   */
  getDownloadUrl() {
    if (this.isVideo) {
      return this.largestVideoUri || this.originalUri || this.archivedUri;
    }
    return this.originalUri || this.largestImageUri || this.archivedUri;
  }

  /**
   * Get file extension from format
   */
  getFileExtension() {
    if (this.format) {
      return this.format.toLowerCase();
    }
    if (this.filename) {
      const parts = this.filename.split('.');
      return parts.length > 1 ? parts[parts.length - 1] : 'jpg';
    }
    return this.isVideo ? 'mp4' : 'jpg';
  }

  /**
   * Generate safe filename for download
   */
  getSafeFilename() {
    if (this.filename) {
      return this.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
    const ext = this.getFileExtension();
    return `${this.assetId}.${ext}`;
  }

  /**
   * Check if asset has GPS coordinates
   */
  hasGPS() {
    return this.gpsLatitude !== undefined && this.gpsLongitude !== undefined;
  }

  /**
   * Get human-readable file size
   */
  getFormattedSize() {
    if (!this.originalSize) return 'Unknown';
    const bytes = this.originalSize;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * Convert to JSON metadata for sidecar file
   */
  toMetadataJSON() {
    return {
      // Basic info
      filename: this.getSafeFilename(),
      originalFilename: this.filename,
      assetType: this.type,

      // SmugMug references
      smugmugAssetId: this.assetId,
      smugmugUri: this.uri,
      smugmugWebUri: this.webUri,
      albumName: this.albumName,
      albumUri: this.albumUri,

      // Dates
      uploadedToSmugmug: this.dateUploaded,
      lastModified: this.dateModified,
      dateTaken: this.dateTaken,
      retrievedFromSmugmug: new Date().toISOString(),

      // Content metadata
      title: this.title,
      caption: this.caption,
      keywords: this.keywords,

      // File properties
      format: this.format,
      originalSize: this.originalSize,
      dimensions: {
        width: this.originalWidth,
        height: this.originalHeight,
      },

      // EXIF data
      exif: this.exif,

      // GPS location
      gpsCoordinates: this.hasGPS() ? {
        latitude: this.gpsLatitude,
        longitude: this.gpsLongitude,
        altitude: this.gpsAltitude,
      } : null,
    };
  }

  /**
   * Convert to plain object for inventory
   */
  toJSON() {
    return {
      assetId: this.assetId,
      imageKey: this.imageKey,
      type: this.type,
      filename: this.getSafeFilename(),
      originalFilename: this.filename,
      title: this.title,
      caption: this.caption,
      keywords: this.keywords,
      dateUploaded: this.dateUploaded,
      dateTaken: this.dateTaken,
      format: this.format,
      originalSize: this.originalSize,
      dimensions: {
        width: this.originalWidth,
        height: this.originalHeight,
      },
      downloadUrl: this.getDownloadUrl(),
      albumName: this.albumName,
      albumKey: this.albumKey,
      hasGPS: this.hasGPS(),
    };
  }

  /**
   * Get summary string for logging
   */
  toString() {
    return `${this.type.toUpperCase()}: ${this.getSafeFilename()} (${this.getFormattedSize()})`;
  }
}

export default Asset;
