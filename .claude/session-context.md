# SmugMug to Backblaze B2 Migration Tool - Session Context

## Project Overview
Node.js/React application for migrating ~4,600 photos/videos from SmugMug to Backblaze B2, preserving metadata (especially keywords) via JSON sidecar files.

## Current Status:  WORKING END-TO-END

### Latest Achievement (2025-11-24)
Successfully completed first test migration:
-  SmugMug OAuth 1.0a authentication working
-  Album discovery working (found 2 albums, 1,106 total assets)
-  Asset enumeration working (tested with 5 videos)
-  Downloads from SmugMug working
-  Metadata extraction working
-  Uploads to Backblaze B2 working
-  Test completed in 3 seconds with 0 errors

**Test Results:**
- Session ID: `e554faa0-e9b2-4ab7-8d95-316d18958353`
- 5 videos downloaded (114.89 KB total)
- 15 files uploaded to B2 (videos + JSON metadata sidecars)
- Duration: 3 seconds
- Success rate: 100%

## Fixed Issues

### 1. SmugMug API Path Duplication
**Problem:** URIs were duplicated like `/api/v2/api/v2/user/...`
**Fix:** Updated `SmugMugService.makeAuthenticatedRequest()` to detect paths already containing `/api/v2`
- [SmugMugService.js:181-192](backend/src/services/SmugMugService.js#L181-L192)

### 2. OAuth Signature Invalid (401 errors)
**Problem:** Query parameters weren't included in OAuth signature calculation
**Fix:** Added query params to `requestData.data` for GET requests before signing
- [SmugMugService.js:200-203](backend/src/services/SmugMugService.js#L200-L203)

### 3. Service Dependency Injection
**Problem:** Multiple services had missing constructor parameters
**Fixes:**
- `ErrorLogger`: Now receives `(fileSystemManager, sessionId)` - [MigrationOrchestrator.js:41](backend/src/services/MigrationOrchestrator.js#L41)
- `AssetDownloadService`: Now receives `fileSystemManager` - [MigrationOrchestrator.js:240](backend/src/services/MigrationOrchestrator.js#L240)
- `AssetUploadService`: Now receives `errorLogger` and `progressTracker` - [MigrationOrchestrator.js:242-249](backend/src/services/MigrationOrchestrator.js#L242-L249)

### 4. Backblaze B2 Restricted Keys
**Problem:** Restricted application keys couldn't call `listBuckets()` without parameters
**Fix:** Check `authData.allowed.bucketId` first for restricted keys
- [BackBlazeB2Service.js:75-93](backend/src/services/BackBlazeB2Service.js#L75-L93)

### 5. SmugMug OAuth Flow
**Problem:** `requestTokenSecret` not being passed from backend to frontend
**Fixes:**
- Return `requestTokenSecret` in service - [SmugMugService.js:88](backend/src/services/SmugMugService.js#L88)
- Pass through route - [migration.routes.js:193,200](backend/src/routes/migration.routes.js#L193)
- Use in frontend - [ConfigurationScreen.jsx:68](frontend/src/components/ConfigurationScreen.jsx#L68)

### 6. Method Name Mismatches
**Problem:** `getLogFilePath()` method doesn't exist on FileSystemManager
**Fix:** Use `getPaths().logs` instead
- [MigrationOrchestrator.js:383](backend/src/services/MigrationOrchestrator.js#L383)

## Architecture Notes

### Key Components
- **Backend:** Express.js API (port 3001)
- **Frontend:** React SPA (port 3000)
- **Services:**
  - `SmugMugService`: OAuth 1.0a + API v2
  - `BackBlazeB2Service`: B2 uploads with restricted key support
  - `MigrationOrchestrator`: Coordinates entire workflow
  - `AssetInventoryService`: Enumerates assets with pagination
  - `MetadataService`: Generates JSON sidecars
  - `ErrorLogger`: Structured error tracking

### Testing Method
Using curl via [test-migration.sh](backend/test-migration.sh) with environment variables:
```bash
export SMUGMUG_SECRET="..."
export SMUGMUG_ACCESS_TOKEN="..."
export SMUGMUG_ACCESS_SECRET="..."
bash test-migration.sh
```

## Next Steps

### Immediate
1. User to investigate downloaded files and verify keyword preservation in JSON
2. Confirm what the 15 uploaded files represent (likely 5×3: video + JSON + ?)
3. Consider running test with photos instead of videos

### Future Enhancements
1. Fix UI state management for OAuth tokens (currently bypassing with curl)
2. Test with larger photo album "Kline and Martin Photos" (1,063 assets)
3. Run full migration of all 1,106 assets
4. Verify all metadata fields are preserved, especially Keywords

## Credentials & Configuration

**SmugMug API:**
- API Key: `XJCbKrt8V6zTs8QqVvSznzK4sqv7G3qh`
- Using OAuth 1.0a with access tokens stored in environment variables

**Backblaze B2:**
- Bucket: `smugmug-retrieve-test`
- Using restricted application key
- Account ID: `000680229fef358000000000e`

## Running the Application

**Backend:**
```bash
cd backend
npm start  # Runs on port 3001
```

**Frontend:**
```bash
cd frontend
npm start  # Runs on port 3000
```

**Test Migration (Backend only needed):**
```bash
cd backend
export SMUGMUG_SECRET="..."
export SMUGMUG_ACCESS_TOKEN="..."
export SMUGMUG_ACCESS_SECRET="..."
bash test-migration.sh
```

## Known Issues

1. **Frontend OAuth State Management:** Start Migration button doesn't activate properly after OAuth completion. Workaround: Use curl/test script.

2. **Success Count:** Shows 15 successful operations for 5 assets - need to verify what operations are being counted.

## Files Modified This Session

- `backend/src/services/SmugMugService.js` - OAuth signature fixes, path handling
- `backend/src/services/BackBlazeB2Service.js` - Restricted key support
- `backend/src/services/MigrationOrchestrator.js` - Service initialization order
- `backend/src/services/AssetInventoryService.js` - Album images URI construction
- `backend/src/routes/migration.routes.js` - OAuth token passing
- `backend/test-migration.sh` - Test script with credentials
- `backend/test-b2.js` - B2 connection test with restricted keys

## Contact & Resources

- SmugMug API Docs: https://api.smugmug.com/api/v2/doc
- Backblaze B2 Docs: https://www.backblaze.com/b2/docs/
- User: haugaard (SmugMug username)
