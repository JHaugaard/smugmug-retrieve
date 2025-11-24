# SmugMug Asset Retrieval System - Technical Architecture Document

## Document Information

**Version:** 1.0
**Last Updated:** 2025-11-04
**Author:** Technical Architect
**Status:** Complete - Ready for Implementation

---

## Executive Summary

This document defines the technical architecture for the SmugMug Asset Retrieval System, a web-based utility for migrating photography assets from SmugMug to BackBlaze B2 storage with complete metadata preservation. The architecture prioritizes simplicity, reliability, and speed-to-completion for a personal two-use migration tool.

**Key Architectural Decisions:**
- **Monolithic Node.js application** with Express backend and React frontend
- **Server-Sent Events (SSE)** for real-time progress updates
- **In-memory state management** with file-based error logging
- **Sequential processing with controlled concurrency** for API operations
- **Flat file storage** in B2 with JSON sidecar metadata files

---

## Technology Stack

### Backend

**Runtime:** Node.js v18+ (LTS)
- Excellent async/await support for I/O-heavy operations
- Native JSON handling and streaming capabilities
- Mature OAuth 1.0a library ecosystem

**Framework:** Express v4.x
- Lightweight, minimal setup
- Perfect for utility applications
- Simple routing and middleware pattern

**Core Libraries:**

| Library | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.0 | Web server and routing |
| `oauth-1.0a` | ^2.2.6 | OAuth 1.0a signature generation |
| `axios` | ^1.6.0 | HTTP client for API requests |
| `backblaze-b2` | ^1.7.0 | Official B2 SDK |
| `dotenv` | ^16.0.0 | Environment configuration (dev only) |

### Frontend

**Framework:** React 18+ with Vite
- Component-based UI architecture
- Fast development with hot module reload
- Minimal build configuration

**State Management:** React useState/useContext
- Simple local state for configuration
- Context for progress monitoring
- No Redux/external state library needed

**HTTP Client:** Fetch API (native)
- Built-in, no additional dependencies
- EventSource API for SSE progress updates

**Styling:** Minimal custom CSS
- Clean, Notion-like aesthetic
- CSS Modules or styled-components for component isolation
- No heavy UI framework (no Bootstrap/Material UI)

### Development Tools

- **Package Manager:** npm (v9+)
- **Code Quality:** ESLint, Prettier
- **Testing:** Jest for unit tests (optional)
- **Version Control:** Git

### Deployment/Hosting

**Recommended Approach:** Local execution
- Run on developer's machine during migrations
- No hosting costs
- Direct file system access for temporary storage

**Alternative:** Simple VPS (if remote access needed)
- DigitalOcean Droplet ($6/month)
- Or use existing Hostinger VPS
- PM2 for process management

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                      │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Config Screen  │  │   Progress   │  │ Completion      │ │
│  │                │→ │   Monitor    │→ │ Summary         │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
│         ↓                    ↑                               │
│      HTTP POST          SSE Stream                           │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↑
         ↓                    ↑
┌─────────────────────────────────────────────────────────────┐
│                  Node.js Express Backend                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Migration Orchestrator Service            │  │
│  │  • Coordinates workflow phases                       │  │
│  │  • Manages progress state                            │  │
│  │  • Broadcasts SSE updates                            │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓              ↓              ↓                      │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ SmugMug  │  │   Metadata   │  │   BackBlaze B2      │  │
│  │ Service  │  │   Service    │  │   Service           │  │
│  └──────────┘  └──────────────┘  └─────────────────────┘  │
│       ↓               ↓                    ↓                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │         File System Manager (Temp Storage)          │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓                                  ↓
         ↓                                  ↓
┌─────────────────┐                ┌──────────────────────┐
│  SmugMug API v2 │                │  BackBlaze B2 API    │
│  (OAuth 1.0a)   │                │  (S3-compatible)     │
└─────────────────┘                └──────────────────────┘
```

### Component Descriptions

#### Frontend Components

**ConfigurationScreen**
- Form for SmugMug credentials (API key, secret)
- Form for B2 credentials (account ID, app key, bucket)
- Test mode toggle with asset count selector
- "Test Connection" validation buttons
- "Start Migration" action button

**ProgressMonitor**
- Real-time SSE subscription to backend progress events
- Display: current phase, counts (discovered/downloaded/uploaded)
- Error counter with expandable error preview
- Simple progress bars or percentage displays

**CompletionSummary**
- Final statistics display
- Success rate calculation
- Error log download link
- "Start New Migration" button

#### Backend Services

**MigrationOrchestrator**
- Entry point for migration workflow
- Phase coordination: Auth → Discover → Download → Upload → Complete
- Progress state management (in-memory)
- SSE broadcast to connected clients
- Error aggregation and logging

**SmugMugService**
- OAuth 1.0a authentication flow
- Album/gallery discovery with recursive traversal
- Asset enumeration with pagination
- Image/video download with streaming
- Metadata extraction from API responses
- Rate limit respect (exponential backoff)

**MetadataService**
- Parse SmugMug API metadata responses
- Generate JSON sidecar structure
- Handle missing/optional fields gracefully
- Validate JSON schema consistency
- Write JSON files to temp storage

**BackBlazeB2Service**
- B2 authentication and token management
- Bucket validation
- File upload with streaming
- Filename conflict resolution
- Progress tracking
- Upload retry logic (simple)

**FileSystemManager**
- Temp directory creation and cleanup
- File write/read operations
- Directory size monitoring
- Cleanup after successful upload

---

## Data Models

### Configuration Model

```typescript
interface MigrationConfig {
  smugmug: {
    apiKey: string;
    apiSecret: string;
  };
  backblaze: {
    accountId: string;
    applicationKey: string;
    bucketName: string;
  };
  testMode: boolean;
  testAssetLimit: number; // default: 10, max: 50
}
```

### Asset Inventory Model

```typescript
interface Asset {
  assetId: string; // SmugMug asset ID
  filename: string; // Original filename from SmugMug
  type: 'image' | 'video';
  smugmugUri: string; // Download URL
  albumName: string;
  albumUri: string;
  metadata: SmugMugMetadata; // Raw metadata from API
}

interface SmugMugMetadata {
  keywords: string[];
  caption?: string;
  title?: string;
  date?: string;
  exif?: Record<string, any>;
  uploadDate?: string;
  lastUpdated?: string;
  [key: string]: any; // Capture all available fields
}
```

### Progress State Model

```typescript
interface MigrationProgress {
  phase: 'auth' | 'discover' | 'download' | 'upload' | 'complete' | 'error';
  discovered: number;
  downloaded: number;
  uploaded: number;
  errors: number;
  currentOperation: string; // e.g., "Downloading IMG_1234.jpg"
  startTime: Date;
  estimatedCompletion?: Date;
}
```

### Error Log Model

```typescript
interface ErrorEntry {
  timestamp: string; // ISO 8601
  phase: 'download' | 'upload' | 'metadata' | 'auth' | 'discovery';
  filename?: string;
  assetId?: string;
  errorMessage: string;
  errorCode?: string;
  retryable: boolean;
}
```

### JSON Sidecar Schema

Each asset gets a JSON file: `{original-filename}.json`

```json
{
  "filename": "IMG_1234.jpg",
  "smugmugAssetId": "abc123xyz",
  "albumName": "Vacation 2024",
  "albumUri": "https://smugmug.com/album/...",
  "uploadedToSmugmug": "2024-03-15T10:30:00Z",
  "retrievedFromSmugmug": "2025-11-04T14:22:00Z",
  "keywords": ["beach", "sunset", "california"],
  "title": "Golden Hour at Malibu",
  "caption": "Beautiful sunset over the Pacific Ocean",
  "exif": {
    "make": "Canon",
    "model": "EOS R5",
    "focalLength": "24mm",
    "aperture": "f/8",
    "iso": 100,
    "shutterSpeed": "1/250"
  },
  "dateTimeOriginal": "2024-03-15T18:45:00Z",
  "gpsCoordinates": {
    "latitude": 34.0259,
    "longitude": -118.7798
  }
}
```

---

## API Integration Patterns

### SmugMug API v2 Integration

**Authentication Flow:**

```
1. User provides API Key + Secret in UI
2. Backend generates OAuth request token
   POST https://api.smugmug.com/services/oauth/1.0a/getRequestToken
3. Backend redirects user to SmugMug authorization page
   https://api.smugmug.com/services/oauth/1.0a/authorize?oauth_token={request_token}
4. User authorizes, SmugMug redirects back with verifier
5. Backend exchanges verifier for access token
   POST https://api.smugmug.com/services/oauth/1.0a/getAccessToken
6. Store access token in-memory for session
```

**Asset Discovery Pattern:**

```
1. GET /api/v2/user/{username}!authuser (get authenticated user)
2. GET /api/v2/user/{username}!albums (list albums)
3. For each album:
   - GET /api/v2/album/{album_key}!images (paginated)
   - Extract image URIs, metadata
4. Build complete asset inventory in memory
```

**Rate Limiting Strategy:**
- SmugMug allows reasonable request rates (exact limits TBD from docs)
- Implement exponential backoff on 429 responses
- Add configurable delay between requests (default: 100ms)

**Error Handling:**
- 401 Unauthorized → Re-authentication required
- 429 Rate Limited → Exponential backoff (2s, 4s, 8s, 16s, fail)
- 5xx Server Error → Retry 3 times, then log and continue
- Network errors → Retry 3 times with backoff

### BackBlaze B2 Integration

**Authentication:**

```
1. POST https://api.backblazeb2.com/b2api/v2/b2_authorize_account
   Authorization: Basic {base64(accountId:applicationKey)}
2. Response includes: authorizationToken, apiUrl, downloadUrl
3. Use authorizationToken for all subsequent requests
```

**Upload Pattern:**

```
1. GET {apiUrl}/b2api/v2/b2_get_upload_url?bucketId={bucket_id}
2. For each file:
   - POST {uploadUrl} with file stream
   - Headers: Authorization, X-Bz-File-Name, Content-Type, Content-Length
   - SHA1 hash in X-Bz-Content-Sha1 header
3. Handle filename conflicts with suffix: {filename}_001.jpg
```

**Large File Handling:**
- Files <100MB: Single upload request
- Files >100MB: Use large file API (b2_start_large_file, b2_upload_part, b2_finish_large_file)
- For this project, video files unlikely to exceed 100MB, so single upload sufficient

**Error Handling:**
- 401 Unauthorized → Re-authorize
- 503 Service Unavailable → Retry with backoff
- Upload failure → Log, continue to next file
- Bucket not found → Fatal error, halt migration

---

## File System Strategy

### Temporary Storage

**Directory Structure:**
```
/tmp/smugmug-migration-{session-id}/
  downloads/
    IMG_1234.jpg
    IMG_1234.json
    video_001.mp4
    video_001.json
  logs/
    error-log.json
    migration-summary.json
```

**Cleanup Strategy:**
- Delete individual files immediately after successful B2 upload
- Keep JSON files until completion for potential debugging
- Full cleanup on completion or error
- Configurable retention for error scenarios (default: 24 hours)

**Disk Space Monitoring:**
- Check available space before download
- Estimate: 25GB temporary storage needed
- Warn user if insufficient space (<30GB available)

---

## Progress Tracking & Communication

### Server-Sent Events (SSE) Implementation

**Why SSE over WebSockets:**
- Simpler implementation (unidirectional server → client)
- Auto-reconnection built-in
- HTTP-based, no special server requirements
- Perfect for progress updates

**SSE Endpoint:** `GET /api/migration/progress`

**Event Types:**

```javascript
// Phase change event
{
  type: 'phase',
  data: {
    phase: 'download',
    message: 'Starting asset downloads'
  }
}

// Progress update event
{
  type: 'progress',
  data: {
    discovered: 1100,
    downloaded: 543,
    uploaded: 0,
    errors: 2
  }
}

// Current operation event (throttled)
{
  type: 'operation',
  data: {
    message: 'Downloading IMG_1234.jpg (543/1100)'
  }
}

// Error event
{
  type: 'error',
  data: {
    filename: 'IMG_9999.jpg',
    error: 'Download failed: 404 Not Found'
  }
}

// Completion event
{
  type: 'complete',
  data: {
    success: true,
    totalAssets: 1100,
    successful: 1098,
    failed: 2,
    errorLogPath: '/tmp/smugmug-migration-xyz/logs/error-log.json'
  }
}
```

**Frontend SSE Consumption:**

```javascript
const eventSource = new EventSource('/api/migration/progress');

eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data);
  updateProgressUI(data);
});

eventSource.addEventListener('complete', (event) => {
  const data = JSON.parse(event.data);
  showCompletionSummary(data);
  eventSource.close();
});
```

---

## Error Handling Strategy

### Error Categories

**Critical Errors (Halt Migration):**
- SmugMug authentication failure
- B2 authentication failure
- B2 bucket not found
- Insufficient disk space
- Invalid configuration

**Recoverable Errors (Log & Continue):**
- Individual asset download failure
- Individual asset upload failure
- Metadata extraction failure
- JSON generation failure

### Error Logging Format

**File:** `error-log.json`

```json
{
  "migrationId": "session-xyz-123",
  "startTime": "2025-11-04T14:00:00Z",
  "errors": [
    {
      "timestamp": "2025-11-04T14:15:23Z",
      "phase": "download",
      "assetId": "abc123",
      "filename": "IMG_9999.jpg",
      "errorMessage": "HTTP 404: Asset not found",
      "errorCode": "ASSET_NOT_FOUND",
      "retryable": false
    }
  ]
}
```

### Retry Logic

**SmugMug API Requests:**
- Rate limit (429): Exponential backoff (2s, 4s, 8s, 16s, fail)
- Server error (5xx): 3 retries with 2s delay
- Network timeout: 3 retries with 5s delay

**B2 Upload Requests:**
- Rate limit (429): Exponential backoff
- Service unavailable (503): 3 retries with 5s delay
- Upload failure: Log and continue (no retry in MVP)

---

## Security Considerations

### Credential Handling

**Storage:**
- NO persistent storage of credentials
- Credentials only in memory during migration session
- Environment variables for development (.env, gitignored)

**Transmission:**
- HTTPS required for all API communications
- OAuth 1.0a signatures prevent credential exposure

### Data Protection

**Temporary Files:**
- Created with restrictive permissions (600 or 700)
- Deleted immediately after B2 upload
- Session directory isolated from other processes

**Error Logs:**
- Do not log full credentials
- Sanitize OAuth tokens from error messages
- User responsible for error log file security

---

## Performance Optimization

### Concurrency Strategy

**Asset Downloads:**
- 5-10 parallel downloads using async/await + Promise.all
- Controlled with simple semaphore pattern
- Avoids overwhelming SmugMug API

**B2 Uploads:**
- 5-10 parallel uploads
- Independent of downloads (can overlap)

**Memory Management:**
- Stream large files (avoid loading entire file into memory)
- Process assets in batches of 50-100 for progress updates

### Progress Update Throttling

- Broadcast SSE progress update every 10 assets processed
- Or every 5 seconds (whichever comes first)
- Prevents SSE flooding during rapid processing

---

## Testing Strategy

### Unit Tests (Optional MVP)

**Critical Components:**
- OAuth signature generation (SmugMugService)
- Metadata extraction and JSON generation (MetadataService)
- Filename conflict resolution (FileSystemManager)
- Error log formatting

**Testing Framework:** Jest
- Focus on pure functions
- Mock external APIs (SmugMug, B2)

### Manual Testing Checklist

**Pre-Migration:**
- [ ] SmugMug OAuth flow completes successfully
- [ ] B2 authentication succeeds
- [ ] Bucket validation works
- [ ] Invalid credentials are rejected with clear errors

**Test Mode (5-10 assets):**
- [ ] Asset discovery completes
- [ ] Downloads succeed
- [ ] Metadata JSON files are well-formed
- [ ] B2 uploads succeed
- [ ] Progress updates appear in UI
- [ ] Completion summary is accurate

**Full Migration (Project 1):**
- [ ] All assets processed
- [ ] Success rate ≥99%
- [ ] Keyword metadata preserved correctly
- [ ] Error log is accessible and readable
- [ ] Temporary files cleaned up

---

## Deployment Architecture

### Local Deployment (Recommended)

**Setup:**
```bash
git clone <repo>
cd smugmug-retrieve
npm install
npm run build
npm start
```

**Access:** `http://localhost:3000`

**Advantages:**
- No hosting costs
- Direct file system access
- Simple setup
- Secure (localhost only)

**Process:**
1. Start application locally
2. Open browser to localhost:3000
3. Enter credentials, start migration
4. Monitor progress
5. Review completion summary
6. Stop application when done

### VPS Deployment (Optional)

**Platform:** DigitalOcean Droplet or Hostinger VPS

**Setup:**
```bash
# On VPS
git clone <repo>
cd smugmug-retrieve
npm install
npm run build
pm2 start npm --name smugmug-app -- start
pm2 save
pm2 startup
```

**Access:** `http://<vps-ip>:3000`

**Security:**
- Use Nginx reverse proxy with HTTPS (Let's Encrypt)
- Firewall: Allow only port 443
- Basic auth for additional protection (optional)

---

## Project Structure

```
smugmug-retrieve/
├── backend/
│   ├── src/
│   │   ├── server.js                 # Express app entry point
│   │   ├── routes/
│   │   │   ├── migration.routes.js   # Migration API endpoints
│   │   │   └── health.routes.js      # Health check
│   │   ├── services/
│   │   │   ├── MigrationOrchestrator.js
│   │   │   ├── SmugMugService.js
│   │   │   ├── MetadataService.js
│   │   │   ├── BackBlazeB2Service.js
│   │   │   └── FileSystemManager.js
│   │   ├── models/
│   │   │   ├── Asset.js
│   │   │   ├── MigrationConfig.js
│   │   │   └── ProgressState.js
│   │   └── utils/
│   │       ├── logger.js
│   │       └── errorHandler.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Main app component
│   │   ├── components/
│   │   │   ├── ConfigurationScreen.jsx
│   │   │   ├── ProgressMonitor.jsx
│   │   │   └── CompletionSummary.jsx
│   │   ├── hooks/
│   │   │   └── useSSE.js             # SSE subscription hook
│   │   └── styles/
│   │       └── app.css               # Notion-like styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── brief.md
│   ├── prd.md
│   └── architecture.md               # This document
├── .gitignore
├── README.md
└── package.json                      # Root package.json (if monorepo)
```

---

## Implementation Phases (Epic Alignment)

### Phase 1: Foundation & SmugMug Integration (Epic 1)

**Stories 1.1 - 1.4**

**Deliverables:**
- Express server running with basic routes
- SmugMug OAuth 1.0a flow working
- Asset discovery and enumeration functional
- Manual testing confirms connectivity

**Acceptance:**
- Can authenticate with SmugMug
- Asset inventory is generated successfully
- Logs show all albums/images discovered

---

### Phase 2: Asset Processing & B2 Storage (Epic 2)

**Stories 2.1 - 2.5**

**Deliverables:**
- Asset download from SmugMug working
- Metadata extraction + JSON generation
- B2 authentication and upload functional
- Error logging implemented
- Progress tracking in place

**Acceptance:**
- Test mode (10 assets) completes successfully
- JSON sidecar files are well-formed
- Assets appear in B2 bucket
- Error log captures failures correctly

---

### Phase 3: User Interface & Orchestration (Epic 3)

**Stories 3.1 - 3.5**

**Deliverables:**
- React UI with Notion-like design
- Configuration screen with validation
- SSE-based progress monitoring
- Completion summary screen
- End-to-end orchestration

**Acceptance:**
- Full migration works via UI
- Progress updates in real-time
- Test mode toggle functions correctly
- Application can be reused for second account

---

## Migration Execution Plan (Project 1)

### Pre-Migration Checklist

- [ ] Code complete and tested with test mode
- [ ] SmugMug API credentials obtained
- [ ] B2 account created, bucket created
- [ ] B2 application key generated
- [ ] Local machine has 30GB+ free space
- [ ] Stable internet connection confirmed

### Execution Steps

1. **Test Run (Week 1):**
   - Run test mode with 10 assets
   - Validate metadata completeness (spot-check keywords)
   - Review error log format
   - Confirm B2 uploads successful

2. **Full Project 1 Migration (Week 2):**
   - Start full migration (1,100 images, 40 videos)
   - Monitor progress via UI
   - Allow 4-8 hours for completion (estimate)
   - Review completion summary
   - Spot-check keyword preservation in JSON files

3. **Validation (Week 2):**
   - Verify asset count in B2 matches expected
   - Download and inspect sample JSON files
   - Confirm success rate ≥99%
   - Archive error log for records

4. **Project 2 Migration (Future):**
   - Repeat process with fresh credentials
   - 3,500 images (estimate 8-16 hours)

### Contingency Planning

**If Success Rate < 99%:**
- Review error log to identify patterns
- Determine if errors are SmugMug-side (missing assets) or code bugs
- Re-run for failed assets only (manual list) if needed

**If OAuth Expires During Migration:**
- Implement token refresh logic (enhancement)
- Or restart migration (acceptable for MVP)

---

## Future Enhancements (Post-MVP)

### Phase 2 Features (Optional)

1. **Consolidated Manifest:**
   - Generate `project-manifest.json` with all asset metadata
   - Easier querying/searching than individual sidecar files

2. **Retry Failed Transfers:**
   - Parse error log, re-attempt only failed assets
   - Avoids re-processing successful uploads

3. **Metadata Search UI:**
   - Simple interface to query JSON files by keyword/date
   - Hosted separately or integrated

4. **B2 Folder Organization:**
   - Option to organize uploads by album/date/keyword
   - Nested folder structure instead of flat

### Long-Term Vision

**Portfolio Display Application:**
- Separate project using B2-stored assets
- Gallery views, public/private access
- Metadata-driven navigation (keywords, albums, dates)

---

## Open Questions for Implementation

### Requires Research Before Coding

1. **SmugMug API Rate Limits:**
   - What are exact rate limits for image/album endpoints?
   - Does subscriber status affect limits?

2. **SmugMug Metadata Fields:**
   - Complete list of available metadata fields from API?
   - Are keywords guaranteed to be in API response?

3. **OAuth Token Expiration:**
   - How long do SmugMug OAuth tokens last?
   - Is refresh token flow needed for long migrations?

4. **B2 Upload Performance:**
   - Optimal concurrency for this use case?
   - Does B2 throttle uploads after certain thresholds?

### Decisions During Implementation

1. **JSON Schema Refinement:**
   - Finalize structure after seeing real SmugMug API responses
   - Handle edge cases (missing EXIF, no keywords, etc.)

2. **Filename Conflict Resolution:**
   - Use counter suffix (_001, _002) or UUID?
   - Document chosen approach

3. **Progress Update Frequency:**
   - Balance between UI responsiveness and SSE overhead
   - Tune based on testing

---

## Success Criteria (Architecture Phase)

This architecture document is successful when:

✅ **Clarity:** Developer can start implementation without ambiguity
✅ **Completeness:** All Epic 1-3 requirements are addressed
✅ **Feasibility:** Technology choices are validated and appropriate
✅ **Traceability:** Clear mapping from PRD stories to architecture components
✅ **Risk Mitigation:** Key technical risks are addressed with strategies

---

## Next Steps

### For Development Team (You)

1. **Review & Approve Architecture:**
   - Confirm tech stack choices align with preferences
   - Adjust any architectural decisions as needed

2. **Set Up Development Environment:**
   - Initialize Node.js project (Story 1.1)
   - Install dependencies
   - Configure ESLint/Prettier

3. **Begin Epic 1 Implementation:**
   - Start with Story 1.2: SmugMug OAuth
   - Research OAuth 1.0a library (`oauth-1.0a` + `axios`)
   - Implement authentication flow

4. **SmugMug API Research:**
   - Review official API v2 documentation
   - Test API calls with Postman/curl
   - Document rate limits and metadata structure

5. **Create POC:**
   - Test SmugMug OAuth → Download 1 image → Upload to B2
   - Validate end-to-end feasibility before full implementation

---

**Document Status:** ✅ COMPLETE - Ready for Implementation

**Architect Sign-Off:** This architecture provides comprehensive technical guidance for building the SmugMug Asset Retrieval System per the PRD specifications. The monolithic Node.js + React architecture is appropriate for the project's scope, timeline, and personal-use context.
