# Quick Start Guide

## Prerequisites

- Node.js v18+
- npm v9+
- SmugMug API credentials (for testing)
- BackBlaze B2 credentials (for testing)

## Installation

```bash
# Clone and navigate
cd /Volumes/dev/develop/smugmug-retrieve

# Install all dependencies (already done if you just set up)
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

## Development

### Start Both Servers

```bash
# From project root
npm run dev
```

This starts:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000 (with proxy to backend)

### Start Servers Individually

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

## Testing

### Test Backend Health

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "smugmug-retrieve-backend",
  "timestamp": "2025-11-04T...",
  "uptime": 123.45
}
```

### Test Frontend

Open browser: http://localhost:3000

You should see the configuration screen with:
- SmugMug credentials form
- BackBlaze B2 credentials form
- Test connection buttons
- Start migration button

## Project Structure

```
backend/src/
  ├── server.js              # Express server entry
  ├── routes/                # API endpoints
  ├── services/              # Business logic (TODO: implement)
  ├── models/                # Data models (TODO: implement)
  └── utils/                 # Utilities (TODO: implement)

frontend/src/
  ├── App.jsx                # Main component
  ├── components/            # UI components (complete)
  ├── hooks/                 # Custom hooks (SSE)
  └── styles/                # CSS (Notion-like)
```

## Next Steps

1. **Read the docs:**
   - [docs/brief.md](docs/brief.md) - Project overview
   - [docs/prd.md](docs/prd.md) - Requirements
   - [docs/architecture.md](docs/architecture.md) - Technical design
   - [docs/setup-summary.md](docs/setup-summary.md) - What's done

2. **Implement Epic 1 - Story 1.2:**
   - Research SmugMug OAuth 1.0a
   - Create `backend/src/services/SmugMugService.js`
   - Implement authentication flow

3. **Test with real credentials:**
   - Use "Test Connection" buttons in UI
   - Validate OAuth flow works

## Key Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build frontend for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Run tests (when implemented)
npm test
```

## Environment Variables (Optional)

For development testing, copy `.env.example` to `.env` in backend/:

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

**Note:** In production, credentials are entered via UI, not stored in .env

## Troubleshooting

**Port already in use:**
```bash
# Kill process on port 3001 (backend)
lsof -ti:3001 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

**Dependencies out of sync:**
```bash
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
npm install
cd backend && npm install
cd ../frontend && npm install
```

**Backend won't start:**
- Check Node.js version: `node --version` (should be v18+)
- Check for syntax errors in `backend/src/server.js`
- Check logs in terminal

**Frontend shows blank page:**
- Check browser console for errors
- Ensure backend is running (frontend needs proxy)
- Check Vite config has correct proxy settings

## Documentation

- [README.md](README.md) - Complete project documentation
- [docs/brief.md](docs/brief.md) - Project brief
- [docs/prd.md](docs/prd.md) - Product requirements
- [docs/architecture.md](docs/architecture.md) - Technical architecture
- [docs/setup-summary.md](docs/setup-summary.md) - Setup status

## Ready to Code!

Your project foundation is complete. Start with implementing SmugMug OAuth authentication in Epic 1, Story 1.2.

Good luck! 🚀
