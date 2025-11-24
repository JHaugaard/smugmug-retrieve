import express from 'express';

const router = express.Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'smugmug-retrieve-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
