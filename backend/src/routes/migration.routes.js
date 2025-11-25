import express from 'express';
import SmugMugService from '../services/SmugMugService.js';
import BackBlazeB2Service from '../services/BackBlazeB2Service.js';
import AccountDiscoveryService from '../services/AccountDiscoveryService.js';
import AssetInventoryService from '../services/AssetInventoryService.js';
import MigrationOrchestrator from '../services/MigrationOrchestrator.js';

const router = express.Router();

// Store active migration sessions (in-memory for MVP)
const activeMigrations = new Map();

/**
 * Start migration endpoint
 * POST /api/migration/start
 */
router.post('/start', async (req, res) => {
  try {
    const { smugmug, backblaze, testMode, testAssetLimit, excludeVideos } = req.body;

    // Validate configuration
    if (!smugmug?.apiKey || !smugmug?.apiSecret) {
      return res.status(400).json({
        success: false,
        error: 'SmugMug API credentials are required'
      });
    }

    if (!smugmug?.accessToken || !smugmug?.accessTokenSecret) {
      return res.status(400).json({
        success: false,
        error: 'SmugMug access tokens are required. Please complete OAuth flow first.'
      });
    }

    if (!backblaze?.accountId || !backblaze?.applicationKey || !backblaze?.bucketName) {
      return res.status(400).json({
        success: false,
        error: 'BackBlaze B2 credentials are required'
      });
    }

    // Create migration configuration
    const config = {
      smugmug: {
        apiKey: smugmug.apiKey,
        apiSecret: smugmug.apiSecret,
        accessToken: smugmug.accessToken,
        accessTokenSecret: smugmug.accessTokenSecret
      },
      backblaze: {
        accountId: backblaze.accountId,
        applicationKey: backblaze.applicationKey,
        bucketName: backblaze.bucketName
      },
      testMode: testMode || false,
      testAssetLimit: testAssetLimit || 10,
      excludeVideos: excludeVideos !== false // Default to true
    };

    // Initialize MigrationOrchestrator
    const orchestrator = new MigrationOrchestrator(config);
    const sessionId = orchestrator.getSessionId();

    // Store in active migrations
    activeMigrations.set(sessionId, orchestrator);

    // Start migration asynchronously (don't await - run in background)
    orchestrator.runMigration()
      .then(summary => {
        console.log(`Migration ${sessionId} completed:`, summary);
      })
      .catch(error => {
        console.error(`Migration ${sessionId} failed:`, error);
      })
      .finally(() => {
        // Keep migration in map for 1 hour for error log retrieval
        setTimeout(() => {
          activeMigrations.delete(sessionId);
        }, 60 * 60 * 1000);
      });

    // Return immediately with session ID
    res.json({
      success: true,
      message: 'Migration started',
      sessionId
    });
  } catch (error) {
    console.error('Migration start error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Progress stream endpoint (Server-Sent Events)
 * GET /api/migration/progress/:sessionId
 */
router.get('/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // Get migration orchestrator
  const orchestrator = activeMigrations.get(sessionId);
  if (!orchestrator) {
    res.status(404).json({
      success: false,
      error: 'Migration session not found'
    });
    return;
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  const connectedEvent = {
    type: 'connected',
    message: 'Progress stream connected',
    sessionId
  };
  res.write(`data: ${JSON.stringify(connectedEvent)}\n\n`);

  // Send current progress state
  const currentState = orchestrator.getProgress();
  res.write(`event: progress\n`);
  res.write(`data: ${JSON.stringify(currentState)}\n\n`);

  // Subscribe to progress updates from orchestrator
  const callback = (event) => {
    try {
      // Send event with type
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    } catch (error) {
      console.error('Error sending SSE event:', error);
    }
  };

  orchestrator.subscribeToProgress(callback);

  // Keep connection alive with heartbeat
  const keepAlive = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      clearInterval(keepAlive);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    orchestrator.unsubscribeFromProgress(callback);
    res.end();
  });
});

/**
 * Test SmugMug connection
 * POST /api/migration/test/smugmug
 */
router.post('/test/smugmug', async (req, res) => {
  try {
    const { apiKey, apiSecret, accessToken, accessTokenSecret } = req.body;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({
        success: false,
        error: 'API Key and Secret are required'
      });
    }

    const smugmugService = new SmugMugService(apiKey, apiSecret);

    // If access token provided, use it directly (for testing with existing tokens)
    if (accessToken && accessTokenSecret) {
      smugmugService.setAccessToken(accessToken, accessTokenSecret);
      const result = await smugmugService.testConnection();

      return res.json({
        success: true,
        message: 'SmugMug connection successful',
        user: result.user
      });
    }

    // Otherwise, initiate OAuth flow
    const { requestToken, requestTokenSecret, authorizeUrl } = await smugmugService.getRequestToken('oob');

    res.json({
      success: true,
      message: 'Authorization required',
      requiresAuth: true,
      requestToken,
      requestTokenSecret,
      authorizeUrl,
      instructions: 'Visit the authorization URL, approve access, and provide the verification code'
    });
  } catch (error) {
    console.error('SmugMug test error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Complete SmugMug OAuth flow
 * POST /api/migration/smugmug/verify
 */
router.post('/smugmug/verify', async (req, res) => {
  try {
    const { apiKey, apiSecret, requestToken, requestTokenSecret, verifier } = req.body;

    // Debug logging
    console.log('OAuth verify request received:', {
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING',
      apiSecret: apiSecret ? 'present' : 'MISSING',
      requestToken: requestToken ? `${requestToken.substring(0, 10)}...` : 'MISSING',
      requestTokenSecret: requestTokenSecret ? `${requestTokenSecret.substring(0, 10)}...` : 'MISSING',
      verifier: verifier || 'MISSING'
    });

    if (!apiKey || !apiSecret || !requestToken || !requestTokenSecret || !verifier) {
      return res.status(400).json({
        success: false,
        error: 'Missing required OAuth parameters'
      });
    }

    const smugmugService = new SmugMugService(apiKey, apiSecret);
    smugmugService.requestToken = requestToken;
    smugmugService.requestTokenSecret = requestTokenSecret;

    const { accessToken, accessTokenSecret } = await smugmugService.getAccessToken(verifier);
    const user = await smugmugService.getAuthenticatedUser();

    res.json({
      success: true,
      message: 'OAuth verification successful',
      accessToken,
      accessTokenSecret,
      user: {
        name: user.Name,
        nickName: user.NickName,
        domain: user.Domain,
      }
    });
  } catch (error) {
    console.error('OAuth verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Discover SmugMug account structure
 * POST /api/migration/discover
 */
router.post('/discover', async (req, res) => {
  try {
    const { apiKey, apiSecret, accessToken, accessTokenSecret, includeEmptyAlbums } = req.body;

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      return res.status(400).json({
        success: false,
        error: 'API credentials and access tokens are required'
      });
    }

    const smugmugService = new SmugMugService(apiKey, apiSecret);
    smugmugService.setAccessToken(accessToken, accessTokenSecret);

    const discoveryService = new AccountDiscoveryService(smugmugService);

    // Set up progress callback (could be enhanced with SSE later)
    discoveryService.setProgressCallback((phase, current, total, message) => {
      console.log(`[${phase}] ${current}/${total}: ${message}`);
    });

    // Discover account structure
    const accountStructure = await discoveryService.discoverAccount(
      includeEmptyAlbums !== false
    );

    const summary = accountStructure.toSummary();
    const stats = accountStructure.getStats();

    res.json({
      success: true,
      message: 'Account discovery complete',
      user: accountStructure.user,
      stats: stats,
      albums: accountStructure.getAllAlbums().map(a => a.toJSON()),
    });
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Enumerate assets (build complete inventory)
 * POST /api/migration/enumerate
 */
router.post('/enumerate', async (req, res) => {
  try {
    const { apiKey, apiSecret, accessToken, accessTokenSecret, testLimit, includeEmptyAlbums } = req.body;

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      return res.status(400).json({
        success: false,
        error: 'API credentials and access tokens are required'
      });
    }

    // Step 1: Discover account structure
    const smugmugService = new SmugMugService(apiKey, apiSecret);
    smugmugService.setAccessToken(accessToken, accessTokenSecret);

    const discoveryService = new AccountDiscoveryService(smugmugService);
    const accountStructure = await discoveryService.discoverAccount(
      includeEmptyAlbums !== false
    );

    // Step 2: Build asset inventory
    const inventoryService = new AssetInventoryService(smugmugService, accountStructure);

    inventoryService.setProgressCallback((phase, current, total, message) => {
      console.log(`[${phase}] ${current}/${total}: ${message}`);
    });

    await inventoryService.buildInventory(testLimit || 0);

    const stats = inventoryService.getStats();
    const summary = inventoryService.getSummary();

    res.json({
      success: true,
      message: 'Asset enumeration complete',
      user: accountStructure.user,
      summary: summary,
      stats: stats,
      sampleAssets: inventoryService.getAssets().slice(0, 10).map(a => a.toJSON()),
    });
  } catch (error) {
    console.error('Enumeration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test BackBlaze B2 connection
 * POST /api/migration/test/b2
 */
router.post('/test/b2', async (req, res) => {
  try {
    const { accountId, applicationKey, bucketName } = req.body;

    if (!accountId || !applicationKey || !bucketName) {
      return res.status(400).json({
        success: false,
        error: 'Account ID, Application Key, and Bucket Name are required'
      });
    }

    const b2Service = new BackBlazeB2Service(accountId, applicationKey);
    const result = await b2Service.testConnection(bucketName);

    res.json({
      success: true,
      message: 'BackBlaze B2 connection successful',
      bucket: result.bucket
    });
  } catch (error) {
    console.error('B2 test error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Download error log for a migration session
 * GET /api/migration/error-log/:sessionId
 */
router.get('/error-log/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get migration orchestrator
    const orchestrator = activeMigrations.get(sessionId);
    if (!orchestrator) {
      return res.status(404).json({
        success: false,
        error: 'Migration session not found or expired'
      });
    }

    // Get error log
    const errorLog = await orchestrator.getErrorLog();

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="error-log-${sessionId}.json"`);

    res.json(errorLog);
  } catch (error) {
    console.error('Error log retrieval error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
