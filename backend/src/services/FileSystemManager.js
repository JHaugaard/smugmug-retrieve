import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * File System Manager Service
 * Handles temporary file storage, cleanup, and disk space management
 */
class FileSystemManager {
  constructor(sessionId = null) {
    this.sessionId = sessionId || this.generateSessionId();
    this.baseDir = path.join(os.tmpdir(), `smugmug-migration-${this.sessionId}`);
    this.downloadsDir = path.join(this.baseDir, 'downloads');
    this.logsDir = path.join(this.baseDir, 'logs');
    this.initialized = false;
  }

  /**
   * Generate a unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Initialize directory structure
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Create base directory
      await fs.mkdir(this.baseDir, { recursive: true, mode: 0o700 });

      // Create subdirectories
      await fs.mkdir(this.downloadsDir, { recursive: true, mode: 0o700 });
      await fs.mkdir(this.logsDir, { recursive: true, mode: 0o700 });

      this.initialized = true;

      console.log(`File system initialized at: ${this.baseDir}`);
    } catch (error) {
      console.error('Failed to initialize file system:', error);
      throw new Error(`File system initialization failed: ${error.message}`);
    }
  }

  /**
   * Check available disk space
   * @returns {Promise<{available: number, total: number, availableGB: number}>}
   */
  async checkDiskSpace() {
    try {
      const stats = await fs.statfs(os.tmpdir());
      const available = stats.bavail * stats.bsize;
      const total = stats.blocks * stats.bsize;
      const availableGB = available / (1024 ** 3);

      return {
        available,
        total,
        availableGB: Math.round(availableGB * 100) / 100,
      };
    } catch (error) {
      console.error('Failed to check disk space:', error);
      throw new Error(`Disk space check failed: ${error.message}`);
    }
  }

  /**
   * Ensure sufficient disk space is available
   * @param {number} requiredGB - Required space in GB (default: 30GB)
   * @returns {Promise<boolean>}
   */
  async ensureSufficientSpace(requiredGB = 30) {
    const { availableGB } = await this.checkDiskSpace();

    if (availableGB < requiredGB) {
      throw new Error(
        `Insufficient disk space. Required: ${requiredGB}GB, Available: ${availableGB}GB`
      );
    }

    return true;
  }

  /**
   * Write file to downloads directory
   * @param {string} fileName - File name
   * @param {Buffer} data - File data
   * @returns {Promise<string>} Full file path
   */
  async writeFile(fileName, data) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const filePath = path.join(this.downloadsDir, fileName);
      await fs.writeFile(filePath, data, { mode: 0o600 });

      return filePath;
    } catch (error) {
      console.error(`Failed to write file ${fileName}:`, error);
      throw new Error(`File write failed: ${error.message}`);
    }
  }

  /**
   * Read file from downloads directory
   * @param {string} fileName - File name
   * @returns {Promise<Buffer>} File data
   */
  async readFile(fileName) {
    try {
      const filePath = path.join(this.downloadsDir, fileName);
      return await fs.readFile(filePath);
    } catch (error) {
      console.error(`Failed to read file ${fileName}:`, error);
      throw new Error(`File read failed: ${error.message}`);
    }
  }

  /**
   * Check if file exists in downloads directory
   * @param {string} fileName - File name
   * @returns {Promise<boolean>}
   */
  async fileExists(fileName) {
    try {
      const filePath = path.join(this.downloadsDir, fileName);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a specific file
   * @param {string} fileName - File name
   * @returns {Promise<boolean>}
   */
  async deleteFile(fileName) {
    try {
      const filePath = path.join(this.downloadsDir, fileName);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Get directory size
   * @param {string} directory - Directory path
   * @returns {Promise<number>} Size in bytes
   */
  async getDirectorySize(directory) {
    try {
      const files = await fs.readdir(directory);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to get directory size:', error);
      return 0;
    }
  }

  /**
   * Get current storage usage
   * @returns {Promise<{sizeBytes: number, sizeGB: number, fileCount: number}>}
   */
  async getStorageUsage() {
    try {
      if (!this.initialized) {
        return { sizeBytes: 0, sizeGB: 0, fileCount: 0 };
      }

      const sizeBytes = await this.getDirectorySize(this.downloadsDir);
      const sizeGB = Math.round((sizeBytes / (1024 ** 3)) * 100) / 100;

      const files = await fs.readdir(this.downloadsDir);
      const fileCount = files.length;

      return {
        sizeBytes,
        sizeGB,
        fileCount,
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { sizeBytes: 0, sizeGB: 0, fileCount: 0 };
    }
  }

  /**
   * Clean up specific files (after successful upload)
   * @param {Array<string>} fileNames - List of file names to delete
   * @returns {Promise<{deleted: number, failed: number}>}
   */
  async cleanupFiles(fileNames) {
    let deleted = 0;
    let failed = 0;

    for (const fileName of fileNames) {
      const success = await this.deleteFile(fileName);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }

    return { deleted, failed };
  }

  /**
   * Clean up entire session directory
   * @returns {Promise<boolean>}
   */
  async cleanupAll() {
    try {
      if (!this.initialized) {
        return true;
      }

      await fs.rm(this.baseDir, { recursive: true, force: true });
      console.log(`Cleaned up session directory: ${this.baseDir}`);
      this.initialized = false;
      return true;
    } catch (error) {
      console.error('Failed to cleanup session directory:', error);
      return false;
    }
  }

  /**
   * Write log file
   * @param {string} fileName - Log file name
   * @param {string|object} data - Log data
   * @returns {Promise<string>} Full file path
   */
  async writeLog(fileName, data) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const filePath = path.join(this.logsDir, fileName);
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

      await fs.writeFile(filePath, content, { mode: 0o600 });

      return filePath;
    } catch (error) {
      console.error(`Failed to write log ${fileName}:`, error);
      throw new Error(`Log write failed: ${error.message}`);
    }
  }

  /**
   * Append to log file
   * @param {string} fileName - Log file name
   * @param {string} data - Data to append
   * @returns {Promise<void>}
   */
  async appendLog(fileName, data) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const filePath = path.join(this.logsDir, fileName);
      await fs.appendFile(filePath, data + '\n', { mode: 0o600 });
    } catch (error) {
      console.error(`Failed to append to log ${fileName}:`, error);
      throw new Error(`Log append failed: ${error.message}`);
    }
  }

  /**
   * Get paths for session directories
   * @returns {object} Directory paths
   */
  getPaths() {
    return {
      base: this.baseDir,
      downloads: this.downloadsDir,
      logs: this.logsDir,
      sessionId: this.sessionId,
    };
  }

  /**
   * Generate unique filename to avoid conflicts
   * @param {string} originalFileName - Original filename
   * @param {number} attempt - Attempt number (for retries)
   * @returns {string} Unique filename
   */
  generateUniqueFileName(originalFileName, attempt = 0) {
    if (attempt === 0) {
      return originalFileName;
    }

    const lastDot = originalFileName.lastIndexOf('.');
    if (lastDot === -1) {
      return `${originalFileName}_${attempt.toString().padStart(3, '0')}`;
    }

    const name = originalFileName.substring(0, lastDot);
    const ext = originalFileName.substring(lastDot);
    return `${name}_${attempt.toString().padStart(3, '0')}${ext}`;
  }
}

export default FileSystemManager;
