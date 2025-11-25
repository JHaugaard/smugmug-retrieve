import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import axios from 'axios';

/**
 * SmugMug API Service
 * Handles OAuth 1.0a authentication and API requests to SmugMug API v2
 */
class SmugMugService {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;

    // OAuth endpoints
    this.requestTokenUrl = 'https://api.smugmug.com/services/oauth/1.0a/getRequestToken';
    this.authorizeUrl = 'https://api.smugmug.com/services/oauth/1.0a/authorize';
    this.accessTokenUrl = 'https://api.smugmug.com/services/oauth/1.0a/getAccessToken';
    this.apiBaseUrl = 'https://api.smugmug.com/api/v2';

    // OAuth 1.0a configuration
    this.oauth = new OAuth({
      consumer: {
        key: this.apiKey,
        secret: this.apiSecret,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto
          .createHmac('sha1', key)
          .update(base_string)
          .digest('base64');
      },
    });

    // Session state
    this.requestToken = null;
    this.requestTokenSecret = null;
    this.accessToken = null;
    this.accessTokenSecret = null;
    this.authUser = null;
  }

  /**
   * Step 1: Get request token from SmugMug
   * @param {string} callbackUrl - OAuth callback URL (use 'oob' for out-of-band)
   * @returns {Promise<{requestToken: string, authorizeUrl: string}>}
   */
  async getRequestToken(callbackUrl = 'oob') {
    try {
      const requestData = {
        url: this.requestTokenUrl,
        method: 'POST',
        data: {
          oauth_callback: callbackUrl,
        },
      };

      const headers = this.oauth.toHeader(this.oauth.authorize(requestData));

      const response = await axios.post(
        this.requestTokenUrl,
        null,
        {
          headers: {
            ...headers,
            Accept: 'application/json',
          },
          params: {
            oauth_callback: callbackUrl,
          },
        }
      );

      // Parse response (format: oauth_token=xxx&oauth_token_secret=yyy)
      const params = new URLSearchParams(response.data);
      this.requestToken = params.get('oauth_token');
      this.requestTokenSecret = params.get('oauth_token_secret');

      if (!this.requestToken || !this.requestTokenSecret) {
        throw new Error('Failed to obtain request token from SmugMug');
      }

      // Build authorization URL
      const authorizeUrl = `${this.authorizeUrl}?oauth_token=${this.requestToken}&Access=Full&Permissions=Read`;

      return {
        requestToken: this.requestToken,
        requestTokenSecret: this.requestTokenSecret,
        authorizeUrl,
      };
    } catch (error) {
      console.error('Error getting request token:', error.response?.data || error.message);
      throw new Error(`Failed to get request token: ${error.message}`);
    }
  }

  /**
   * Step 2: Exchange request token + verifier for access token
   * @param {string} oauthVerifier - Verification code from SmugMug authorization
   * @returns {Promise<{accessToken: string, accessTokenSecret: string}>}
   */
  async getAccessToken(oauthVerifier) {
    try {
      if (!this.requestToken || !this.requestTokenSecret) {
        throw new Error('Request token not found. Call getRequestToken() first.');
      }

      const requestData = {
        url: this.accessTokenUrl,
        method: 'POST',
        data: {
          oauth_verifier: oauthVerifier,
        },
      };

      const token = {
        key: this.requestToken,
        secret: this.requestTokenSecret,
      };

      const headers = this.oauth.toHeader(
        this.oauth.authorize(requestData, token)
      );

      const response = await axios.post(
        this.accessTokenUrl,
        null,
        {
          headers: {
            ...headers,
            Accept: 'application/json',
          },
          params: {
            oauth_verifier: oauthVerifier,
          },
        }
      );

      // Parse response
      const params = new URLSearchParams(response.data);
      this.accessToken = params.get('oauth_token');
      this.accessTokenSecret = params.get('oauth_token_secret');

      if (!this.accessToken || !this.accessTokenSecret) {
        throw new Error('Failed to obtain access token from SmugMug');
      }

      return {
        accessToken: this.accessToken,
        accessTokenSecret: this.accessTokenSecret,
      };
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw new Error(`Failed to get access token: ${error.message}`);
    }
  }

  /**
   * Set access token directly (for reusing existing tokens)
   * @param {string} accessToken
   * @param {string} accessTokenSecret
   */
  setAccessToken(accessToken, accessTokenSecret) {
    this.accessToken = accessToken;
    this.accessTokenSecret = accessTokenSecret;
  }

  /**
   * Make authenticated API request to SmugMug
   * @param {string} endpoint - API endpoint (e.g., '/user/cmac')
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {object} params - Query parameters or request body
   * @returns {Promise<object>} API response data
   */
  async makeAuthenticatedRequest(endpoint, method = 'GET', params = {}) {
    try {
      if (!this.accessToken || !this.accessTokenSecret) {
        throw new Error('Not authenticated. Access token required.');
      }

      // Build full URL - handle full URLs, API paths, and relative endpoints
      let url;
      if (endpoint.startsWith('http')) {
        // Full URL provided
        url = endpoint;
      } else if (endpoint.startsWith('/api/v2')) {
        // Already has API version path, just add domain
        url = `https://api.smugmug.com${endpoint}`;
      } else {
        // Relative endpoint, add full base URL
        url = `${this.apiBaseUrl}${endpoint}`;
      }

      // For OAuth signature, we need to include query params in the request data
      const requestData = {
        url,
        method,
      };

      // Add query params to OAuth signature for GET requests
      if (method === 'GET' && Object.keys(params).length > 0) {
        requestData.data = params;
      }

      const token = {
        key: this.accessToken,
        secret: this.accessTokenSecret,
      };

      const headers = this.oauth.toHeader(
        this.oauth.authorize(requestData, token)
      );

      const config = {
        method,
        url,
        headers: {
          ...headers,
          Accept: 'application/json',
        },
      };

      if (method === 'GET') {
        config.params = params;
      } else {
        config.data = params;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('API request error:', error.response?.data || error.message);
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  /**
   * Get authenticated user information
   * @returns {Promise<object>} User data
   */
  async getAuthenticatedUser() {
    try {
      const response = await this.makeAuthenticatedRequest('!authuser');
      this.authUser = response.Response.User;
      return this.authUser;
    } catch (error) {
      throw new Error(`Failed to get authenticated user: ${error.message}`);
    }
  }

  /**
   * Test connection by fetching authenticated user
   * Simplified flow for testing only
   * @returns {Promise<object>} User information
   */
  async testConnection() {
    try {
      // For testing, we assume access token is already set
      // In production, this would follow full OAuth flow
      const user = await this.getAuthenticatedUser();
      return {
        success: true,
        user: {
          name: user.Name,
          nickName: user.NickName,
          domain: user.Domain,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's albums
   * @param {string} albumsUri - Albums URI (e.g., '/api/v2/user/username!albums')
   * @returns {Promise<Array>} List of albums
   */
  async getAlbums(albumsUri) {
    try {
      const response = await this.makeAuthenticatedRequest(albumsUri);
      return response.Response.Album || [];
    } catch (error) {
      throw new Error(`Failed to get albums: ${error.message}`);
    }
  }

  /**
   * Get images from an album
   * @param {string} albumImagesUri - Album images URI (should include !images if needed)
   * @param {number} start - Start index for pagination
   * @param {number} count - Number of images to fetch
   * @returns {Promise<object>} Images data with pagination info
   */
  async getAlbumImages(albumImagesUri, start = 1, count = 100) {
    try {
      const response = await this.makeAuthenticatedRequest(
        albumImagesUri,
        'GET',
        { start, count }
      );

      return {
        images: response.Response.AlbumImage || [],
        pages: response.Response.Pages,
      };
    } catch (error) {
      throw new Error(`Failed to get album images: ${error.message}`);
    }
  }

  /**
   * Get image metadata
   * @param {string} imageUri - Image URI
   * @returns {Promise<object>} Image metadata
   */
  async getImageMetadata(imageUri) {
    try {
      const response = await this.makeAuthenticatedRequest(imageUri);
      return response.Response.Image;
    } catch (error) {
      throw new Error(`Failed to get image metadata: ${error.message}`);
    }
  }

  /**
   * Download image from SmugMug
   * @param {string} imageUrl - Image download URL
   * @returns {Promise<Buffer>} Image data as buffer
   */
  async downloadImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }
}

export default SmugMugService;
