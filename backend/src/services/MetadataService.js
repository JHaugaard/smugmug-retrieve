/**
 * Metadata Service
 * Handles extraction of SmugMug metadata and generation of JSON sidecar files
 */
class MetadataService {
  constructor() {
    this.extractionErrors = [];
  }

  /**
   * Extract complete metadata from SmugMug API response
   * @param {object} smugmugImage - Image object from SmugMug API
   * @param {object} albumInfo - Album information
   * @returns {object} Structured metadata
   */
  extractMetadata(smugmugImage, albumInfo = {}) {
    try {
      // Core metadata structure following JSON sidecar schema
      const metadata = {
        filename: smugmugImage.FileName || 'unknown',
        smugmugAssetId: smugmugImage.ImageKey || smugmugImage.AlbumImageUri || null,
        albumName: albumInfo.name || null,
        albumUri: albumInfo.uri || null,
        uploadedToSmugmug: smugmugImage.UploadDate || smugmugImage.Date || null,
        retrievedFromSmugmug: new Date().toISOString(),

        // Descriptive metadata
        keywords: this.extractKeywords(smugmugImage),
        title: smugmugImage.Title || null,
        caption: smugmugImage.Caption || null,

        // Date/time metadata
        dateTimeOriginal: smugmugImage.DateTimeOriginal || smugmugImage.Date || null,
        lastUpdated: smugmugImage.LastUpdated || null,

        // EXIF data
        exif: this.extractExifData(smugmugImage),

        // GPS coordinates
        gpsCoordinates: this.extractGpsCoordinates(smugmugImage),

        // Technical metadata
        format: smugmugImage.Format || null,
        originalSize: {
          width: smugmugImage.OriginalWidth || null,
          height: smugmugImage.OriginalHeight || null,
        },
        fileSize: smugmugImage.Size || smugmugImage.ArchivedSize || null,

        // Asset URLs (for reference)
        smugmugUris: {
          imageUri: smugmugImage.Uri || smugmugImage.ImageUri || null,
          albumImageUri: smugmugImage.AlbumImageUri || null,
          archivedUri: smugmugImage.ArchivedUri || null,
        },

        // Privacy and visibility
        isPublic: smugmugImage.IsPublic || false,
        isProtected: smugmugImage.IsProtected || false,

        // Additional fields (catch-all for any extra metadata)
        additionalMetadata: this.extractAdditionalMetadata(smugmugImage),
      };

      // Remove null/undefined values for cleaner JSON
      return this.cleanMetadata(metadata);
    } catch (error) {
      console.error('Metadata extraction error:', error);
      this.extractionErrors.push({
        filename: smugmugImage.FileName,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      // Return minimal metadata on error
      return {
        filename: smugmugImage.FileName || 'unknown',
        smugmugAssetId: smugmugImage.ImageKey || null,
        retrievedFromSmugmug: new Date().toISOString(),
        extractionError: error.message,
      };
    }
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
