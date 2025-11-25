/**
 * Metadata Service
 * Handles extraction of SmugMug metadata and generation of JSON sidecar files
 */
class MetadataService {
  constructor() {
    this.extractionErrors = [];
  }

  /**
   * Extract complete metadata from SmugMug API response or Asset object
   * @param {object} source - Image object from SmugMug API or Asset object
   * @param {object} albumInfo - Album information
   * @returns {object} Structured metadata
   */
  extractMetadata(source, albumInfo = {}) {
    try {
      // Normalize the source - handle both raw SmugMug data and Asset objects
      const data = this.normalizeSource(source);

      // Build clean, flat metadata structure
      const metadata = {
        // Core identification
        filename: data.filename,
        smugmugAssetId: data.assetId,

        // Album info
        albumName: data.albumName || albumInfo.name || null,
        albumKey: data.albumKey || null,

        // Timestamps
        retrievedFromSmugmug: new Date().toISOString(),
        dateTaken: data.dateTaken || null,
        dateUploaded: data.dateUploaded || null,
        dateModified: data.dateModified || null,

        // Content metadata
        title: data.title || null,
        caption: data.caption || null,
        keywords: data.keywords || [],

        // File properties
        format: data.format || null,
        fileSize: data.fileSize || null,
        dimensions: data.dimensions || null,

        // EXIF data (if available)
        exif: data.exif || null,

        // GPS coordinates (if available)
        gpsCoordinates: data.gpsCoordinates || null,

        // Privacy
        isPublic: data.isPublic || false,
        isProtected: data.isProtected || false,

        // SmugMug reference URLs
        webUri: data.webUri || null,
      };

      // Remove null/undefined values for cleaner JSON
      return this.cleanMetadata(metadata);
    } catch (error) {
      console.error('Metadata extraction error:', error);
      const filename = source.filename || source.FileName || 'unknown';
      this.extractionErrors.push({
        filename,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      // Return minimal metadata on error
      return {
        filename,
        smugmugAssetId: source.assetId || source.ImageKey || null,
        retrievedFromSmugmug: new Date().toISOString(),
        extractionError: error.message,
      };
    }
  }

  /**
   * Normalize source data from either raw SmugMug API or Asset object
   * @param {object} source - Raw data or Asset object
   * @returns {object} Normalized data object
   */
  normalizeSource(source) {
    // Check if this is an Asset object (has specific Asset properties)
    const isAssetObject = source.rawData !== undefined ||
                          (source.assetId !== undefined && source.getSafeFilename !== undefined);

    if (isAssetObject) {
      // Extract from Asset object
      return {
        filename: source.filename || source.getSafeFilename?.() || 'unknown',
        assetId: source.assetId || source.imageKey,
        albumName: source.albumName,
        albumKey: source.albumKey,
        dateTaken: source.dateTaken,
        dateUploaded: source.dateUploaded,
        dateModified: source.dateModified,
        title: source.title,
        caption: source.caption,
        keywords: this.normalizeKeywords(source.keywords),
        format: source.format,
        fileSize: source.originalSize,
        dimensions: source.originalWidth && source.originalHeight ? {
          width: source.originalWidth,
          height: source.originalHeight,
        } : null,
        exif: source.exif,
        gpsCoordinates: source.gpsLatitude && source.gpsLongitude ? {
          latitude: source.gpsLatitude,
          longitude: source.gpsLongitude,
          altitude: source.gpsAltitude || null,
        } : null,
        isPublic: source.isPublic || false,
        isProtected: source.isProtected || false,
        webUri: source.webUri,
      };
    }

    // Handle raw SmugMug API response
    return {
      filename: source.FileName || source.filename || 'unknown',
      assetId: source.ImageKey || source.assetId,
      albumName: source.albumName,
      albumKey: source.AlbumKey || source.albumKey,
      dateTaken: source.DateTimeOriginal || source.dateTaken,
      dateUploaded: source.Date || source.DateTimeUploaded || source.dateUploaded,
      dateModified: source.LastUpdated || source.dateModified,
      title: source.Title || source.title,
      caption: source.Caption || source.caption,
      keywords: this.extractKeywords(source),
      format: source.Format || source.format,
      fileSize: source.OriginalSize || source.ArchivedSize || source.originalSize,
      dimensions: source.OriginalWidth && source.OriginalHeight ? {
        width: source.OriginalWidth,
        height: source.OriginalHeight,
      } : null,
      exif: this.extractExifData(source),
      gpsCoordinates: this.extractGpsCoordinates(source),
      isPublic: source.IsPublic || source.isPublic || false,
      isProtected: source.Protected || source.isProtected || false,
      webUri: source.WebUri || source.webUri,
    };
  }

  /**
   * Normalize keywords to array format
   * @param {string|Array} keywords - Keywords in various formats
   * @returns {Array<string>} Normalized array of keywords
   */
  normalizeKeywords(keywords) {
    if (!keywords) return [];
    if (Array.isArray(keywords)) return keywords.filter(k => k);
    if (typeof keywords === 'string') {
      // Handle semicolon-separated (SmugMug format) or comma-separated
      const separator = keywords.includes(';') ? ';' : ',';
      return keywords.split(separator).map(k => k.trim()).filter(k => k);
    }
    return [];
  }

  /**
   * Extract keywords from SmugMug image
   * @param {object} smugmugImage - Image object
   * @returns {Array<string>} Array of keywords
   */
  extractKeywords(smugmugImage) {
    const keywords = [];

    // Keywords can be in various fields
    if (smugmugImage.Keywords) {
      // Keywords might be comma-separated string or array
      if (typeof smugmugImage.Keywords === 'string') {
        keywords.push(...smugmugImage.Keywords.split(',').map(k => k.trim()).filter(k => k));
      } else if (Array.isArray(smugmugImage.Keywords)) {
        keywords.push(...smugmugImage.Keywords);
      }
    }

    // Check KeywordArray field
    if (smugmugImage.KeywordArray && Array.isArray(smugmugImage.KeywordArray)) {
      keywords.push(...smugmugImage.KeywordArray);
    }

    // Remove duplicates and return
    return [...new Set(keywords)];
  }

  /**
   * Extract EXIF data
   * @param {object} smugmugImage - Image object
   * @returns {object|null} EXIF data
   */
  extractExifData(smugmugImage) {
    const exif = {};

    // Camera information
    if (smugmugImage.Make) exif.make = smugmugImage.Make;
    if (smugmugImage.Model) exif.model = smugmugImage.Model;

    // Lens information
    if (smugmugImage.LensModel) exif.lensModel = smugmugImage.LensModel;
    if (smugmugImage.FocalLength) exif.focalLength = smugmugImage.FocalLength;

    // Exposure settings
    if (smugmugImage.Aperture) exif.aperture = smugmugImage.Aperture;
    if (smugmugImage.ISO) exif.iso = smugmugImage.ISO;
    if (smugmugImage.ExposureTime) exif.shutterSpeed = smugmugImage.ExposureTime;
    if (smugmugImage.ShutterSpeed) exif.shutterSpeed = smugmugImage.ShutterSpeed;

    // Other EXIF fields
    if (smugmugImage.Flash) exif.flash = smugmugImage.Flash;
    if (smugmugImage.WhiteBalance) exif.whiteBalance = smugmugImage.WhiteBalance;
    if (smugmugImage.MeteringMode) exif.meteringMode = smugmugImage.MeteringMode;
    if (smugmugImage.ExposureProgram) exif.exposureProgram = smugmugImage.ExposureProgram;
    if (smugmugImage.ExposureCompensation) exif.exposureCompensation = smugmugImage.ExposureCompensation;

    // Return null if no EXIF data found
    return Object.keys(exif).length > 0 ? exif : null;
  }

  /**
   * Extract GPS coordinates
   * @param {object} smugmugImage - Image object
   * @returns {object|null} GPS coordinates
   */
  extractGpsCoordinates(smugmugImage) {
    if (smugmugImage.Latitude && smugmugImage.Longitude) {
      return {
        latitude: smugmugImage.Latitude,
        longitude: smugmugImage.Longitude,
        altitude: smugmugImage.Altitude || null,
      };
    }

    // Check for GPS object
    if (smugmugImage.GPS) {
      return {
        latitude: smugmugImage.GPS.Latitude || null,
        longitude: smugmugImage.GPS.Longitude || null,
        altitude: smugmugImage.GPS.Altitude || null,
      };
    }

    return null;
  }

  /**
   * Extract additional metadata fields not covered by main schema
   * @param {object} smugmugImage - Image object
   * @returns {object} Additional metadata
   */
  extractAdditionalMetadata(smugmugImage) {
    const additional = {};

    // List of fields already handled
    const handledFields = [
      'FileName', 'ImageKey', 'AlbumImageUri', 'UploadDate', 'Date', 'Title', 'Caption',
      'Keywords', 'KeywordArray', 'DateTimeOriginal', 'LastUpdated', 'Format',
      'OriginalWidth', 'OriginalHeight', 'Size', 'ArchivedSize', 'Uri', 'ImageUri',
      'ArchivedUri', 'IsPublic', 'IsProtected', 'Make', 'Model', 'LensModel',
      'FocalLength', 'Aperture', 'ISO', 'ExposureTime', 'ShutterSpeed', 'Flash',
      'WhiteBalance', 'MeteringMode', 'ExposureProgram', 'ExposureCompensation',
      'Latitude', 'Longitude', 'Altitude', 'GPS',
    ];

    // Capture any additional fields
    for (const [key, value] of Object.entries(smugmugImage)) {
      if (!handledFields.includes(key) && value !== null && value !== undefined) {
        // Skip Uris object (already handled)
        if (key === 'Uris' || key === 'Links') {
          continue;
        }
        additional[key] = value;
      }
    }

    return Object.keys(additional).length > 0 ? additional : null;
  }

  /**
   * Remove null/undefined values from metadata object
   * @param {object} metadata - Metadata object
   * @returns {object} Cleaned metadata
   */
  cleanMetadata(metadata) {
    const cleaned = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        const cleanedNested = this.cleanMetadata(value);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key] = cleanedNested;
        }
      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          cleaned[key] = value;
        }
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Generate JSON sidecar file content
   * @param {object} metadata - Extracted metadata
   * @returns {string} JSON string with proper formatting
   */
  generateJsonSidecar(metadata) {
    try {
      return JSON.stringify(metadata, null, 2);
    } catch (error) {
      console.error('JSON generation error:', error);
      throw new Error(`Failed to generate JSON: ${error.message}`);
    }
  }

  /**
   * Generate filename for JSON sidecar
   * @param {string} originalFilename - Original asset filename
   * @returns {string} JSON sidecar filename
   */
  getJsonSidecarFilename(originalFilename) {
    return `${originalFilename}.json`;
  }

  /**
   * Validate JSON schema consistency
   * @param {object} metadata - Metadata object
   * @returns {boolean} True if valid
   */
  validateMetadataSchema(metadata) {
    // Required fields
    const requiredFields = ['filename', 'retrievedFromSmugmug'];

    for (const field of requiredFields) {
      if (!metadata[field]) {
        console.warn(`Missing required field: ${field}`);
        return false;
      }
    }

    // Validate date format (ISO 8601)
    if (metadata.retrievedFromSmugmug) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (!dateRegex.test(metadata.retrievedFromSmugmug)) {
        console.warn('Invalid date format for retrievedFromSmugmug');
        return false;
      }
    }

    return true;
  }

  /**
   * Get extraction errors
   * @returns {Array} List of extraction errors
   */
  getExtractionErrors() {
    return this.extractionErrors;
  }

  /**
   * Clear extraction errors
   */
  clearExtractionErrors() {
    this.extractionErrors = [];
  }

  /**
   * Generate consolidated manifest from multiple metadata objects
   * @param {Array<object>} metadataList - List of metadata objects
   * @returns {object} Consolidated manifest
   */
  generateConsolidatedManifest(metadataList) {
    return {
      manifestVersion: '1.0',
      generatedAt: new Date().toISOString(),
      totalAssets: metadataList.length,
      assets: metadataList.map((metadata, index) => ({
        index: index + 1,
        ...metadata,
      })),
    };
  }
}

export default MetadataService;
