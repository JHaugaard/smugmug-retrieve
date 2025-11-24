# SmugMug Asset Retrieval System

A personal utility web application for migrating photography assets from SmugMug to BackBlaze B2 storage with complete metadata preservation.

## Overview

This tool extracts images and videos from SmugMug accounts via API, preserves metadata (especially keywords) in JSON sidecar files, and uploads everything to BackBlaze B2 cloud storage. Designed for two account migrations with ~4,600 total assets.

## Features

- **SmugMug OAuth 1.0a Authentication** - Secure API access
- **Complete Asset Discovery** - Enumerate all albums, galleries, images, and videos
- **Metadata Preservation** - Extract and save metadata as JSON sidecar files
- **BackBlaze B2 Integration** - Upload assets to B2 with flat storage structure
- **Real-time Progress Tracking** - Monitor migration with Server-Sent Events
- **Test Mode** - Validate workflow with small sample before full migration
- **Error Logging** - Track failed operations with detailed error reports
- **Clean, Notion-like UI** - Simple, functional interface

## Tech Stack

- **Backend:** Node.js (v18+) with Express
- **Frontend:** React 18 with Vite
- **APIs:** SmugMug API v2, BackBlaze B2 API
- **Key Libraries:** oauth-1.0a, axios, backblaze-b2

## Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- SmugMug account with API credentials (API Key + Secret)
- BackBlaze B2 account with Application Key
- At least 30GB free disk space (for temporary storage)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd smugmug-retrieve
```

### 2. Install Dependencies

```bash
npm run install:all
```

This installs dependencies for both backend and frontend workspaces.

### 3. Configure Environment (Optional for Development)

Copy the example environment file:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your credentials (for development testing only). **Note:** In production use, credentials are entered via the web UI and not stored persistently.

### 4. Start Development Servers

From the project root:

```bash
# Start both backend and frontend
npm run dev

# Or start individually:
npm run dev:backend  # Backend on port 3001
npm run dev:frontend # Frontend on port 3000
```

### 5. Access the Application

Open your browser to: `http://localhost:3000`

## Usage

### Configuration

1. Enter your **SmugMug API credentials** (API Key + Secret)
2. Enter your **BackBlaze B2 credentials** (Account ID, Application Key, Bucket Name)
3. Optionally enable **Test Mode** to process a limited number of assets (default: 10)
4. Click **Test Connection** buttons to validate credentials
5. Click **Start Migration** to begin

### Migration Process

The application will automatically:

1. Authenticate with SmugMug API
2. Discover all albums and assets
3. Download images and videos
4. Extract metadata and generate JSON sidecar files
5. Upload assets and metadata to B2
6. Display completion summary with success/failure statistics

### Progress Monitoring

- Real-time updates show current phase, asset counts, and progress percentages
- Error counter displays any failed operations
- Recent errors preview at bottom of progress screen

### Completion

- Summary report shows total assets, success rate, and error count
- Download error log (if applicable) for detailed failure information
- Option to start new migration for second SmugMug account

## Project Structure

```
smugmug-retrieve/
├── backend/               # Node.js Express backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic (SmugMug, B2, Metadata)
│   │   ├── models/        # Data models
│   │   └── utils/         # Utilities
│   └── package.json
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # Custom React hooks (SSE)
│   │   └── styles/        # CSS (Notion-like)
│   └── package.json
├── docs/                  # Documentation
│   ├── brief.md           # Project brief
│   ├── prd.md             # Product requirements
│   └── architecture.md    # Technical architecture
└── README.md              # This file
```

## Development Roadmap

### Epic 1: Foundation & SmugMug Integration ✅ COMPLETE
- [x] Project setup and basic web server (Story 1.1) ✅
- [x] SmugMug OAuth 1.0a authentication (Story 1.2) ✅
- [x] Account structure discovery (Story 1.3) ✅
- [x] Asset enumeration and inventory (Story 1.4) ✅

### Epic 2: Asset Processing & B2 Storage
- [ ] Asset download from SmugMug
- [ ] Metadata extraction and JSON generation
- [ ] BackBlaze B2 authentication
- [ ] B2 upload with progress tracking
- [ ] Error logging

### Epic 3: User Interface & Orchestration
- [x] Configuration screen UI
- [x] Progress monitoring UI
- [x] Completion summary screen
- [ ] Test/sample mode implementation
- [ ] End-to-end workflow orchestration

## Testing

### Manual Testing

1. **Test Mode**: Use test mode (10 assets) to validate workflow before full migration
2. **Connection Tests**: Use "Test Connection" buttons in UI to validate credentials
3. **Spot-check Metadata**: After migration, review sample JSON files for completeness

### Unit Tests (Optional)

```bash
npm run test --workspace=backend
```

## Deployment

### Local Deployment (Recommended)

Run the application on your local machine during migrations:

```bash
npm run build    # Build frontend
npm start        # Start backend with production build
```

Access at: `http://localhost:3001`

### VPS Deployment (Optional)

For remote access, deploy to a VPS:

```bash
# On VPS
git clone <repo>
cd smugmug-retrieve
npm install
npm run build
pm2 start npm --name smugmug-app -- start
```

## Security Notes

- **No Persistent Credential Storage**: Credentials are only stored in memory during migration
- **HTTPS Required**: All API communications use HTTPS
- **Temporary Files**: Local downloads are deleted after successful B2 upload
- **Error Logs**: May contain filenames but not credentials

## Troubleshooting

### SmugMug Authentication Fails
- Verify API Key and Secret are correct
- Check that SmugMug account is active
- Ensure OAuth callback URL is configured (if required)

### B2 Upload Fails
- Verify B2 credentials (Account ID, Application Key)
- Confirm bucket exists and is accessible
- Check bucket permissions allow uploads

### Migration Stalls
- Check network connection
- Review browser console for errors
- Check backend logs for API rate limiting

## License

MIT License - Personal use project

## Author

John - 2025

## Support

For issues or questions, review:
- [docs/brief.md](docs/brief.md) - Project overview and goals
- [docs/prd.md](docs/prd.md) - Product requirements
- [docs/architecture.md](docs/architecture.md) - Technical architecture

---

**Project Status:** 🚧 In Development

**Target Completion:** Project 1 migration by 12/31/2025
