# SmugMug to Backblaze B2 Migration Tool - Session Context

## Project Overview
Node.js/React application for migrating ~4,600 photos/videos from SmugMug to Backblaze B2, preserving metadata (especially keywords) via JSON sidecar files.

## Current Status: ✅ WORKING END-TO-END

### Latest Session (2025-11-25)

**Fixes Completed:**
1. **Start Migration Button** - Fixed button staying grayed out after OAuth authentication
   - Simplified disabled logic to only check `oauthState.authenticated`
   - Added error clearing when SmugMug OAuth and B2 test succeed
   - [ConfigurationScreen.jsx:396](frontend/src/components/ConfigurationScreen.jsx#L396)

2. **Video Filtering** - Added "Exclude videos" option (default: enabled)
   - Videos now filtered DURING enumeration, not after
   - Fixes issue where test mode grabbed only videos from first album
   - UI checkbox added to Migration Options
   - [AssetInventoryService.js:75-79](backend/src/services/AssetInventoryService.js#L75-L79)
   - [ConfigurationScreen.jsx:366-375](frontend/src/components/ConfigurationScreen.jsx#L366-L375)

3. **JSON Sidecar Structure** - Fixed `filename: "unknown"` bug and cleaned up structure
   - MetadataService now properly handles Asset objects (was expecting raw API data)
   - Added `normalizeSource()` method to detect input type
   - Cleaner, flatter JSON output with keywords as top-level array
   - [MetadataService.js:16-163](backend/src/services/MetadataService.js#L16-L163)
   - [AssetUploadService.js:64](backend/src/services/AssetUploadService.js#L64)

**Housekeeping:**
- Removed `.bmad-core` directory (unused BMAD framework files)
- Deleted `affectionate-antonelli` branch (abandoned worktree experiment from Claude Desktop)

### New JSON Sidecar Format
```json
{
  "filename": "photo 9.jpg",
  "smugmugAssetId": "nT9PLcn",
  "albumName": "Kline and Martin Photos",
  "albumKey": "DRLkfT",
  "retrievedFromSmugmug": "2025-11-25T...",
  "dateTaken": "2015-02-23T01:35:29+00:00",
  "dateUploaded": "2019-07-13T17:03:38+00:00",
  "keywords": ["Martin", "Pat", "Portrait", "Car", "Eileen"],
  "format": "JPG",
  "fileSize": 613231,
  "dimensions": { "width": 1517, "height": 1015 },
  "webUri": "https://haugaard.smugmug.com/Kline-Martin-Photos/i-nT9PLcn"
}
```

### Previous Session (2025-11-24)
Successfully completed first test migration:
- ✅ SmugMug OAuth 1.0a authentication working
- ✅ Album discovery working (found 2 albums, 1,106 total assets)
- ✅ Asset enumeration working
- ✅ Downloads from SmugMug working
- ✅ Metadata extraction working
- ✅ Uploads to Backblaze B2 working

## Fixed Issues (All Sessions)

### SmugMug API Path Duplication
**Problem:** URIs were duplicated like `/api/v2/api/v2/user/...`
**Fix:** Updated `SmugMugService.makeAuthenticatedRequest()` to detect paths already containing `/api/v2`

### OAuth Signature Invalid (401 errors)
**Problem:** Query parameters weren't included in OAuth signature calculation
**Fix:** Added query params to `requestData.data` for GET requests before signing

### Service Dependency Injection
**Problem:** Multiple services had missing constructor parameters
**Fixes:** ErrorLogger, AssetDownloadService, AssetUploadService all properly initialized

### Backblaze B2 Restricted Keys
**Problem:** Restricted application keys couldn't call `listBuckets()` without parameters
**Fix:** Check `authData.allowed.bucketId` first for restricted keys

### Video-Only Album Issue
**Problem:** Test mode with 10 assets grabbed only videos from "Home Movies" album, then filtering removed all
**Fix:** Filter videos during enumeration, continue to next album until target count reached

## Architecture Notes

### Key Components
- **Backend:** Express.js API (port 3001)
- **Frontend:** React SPA (port 3000)
- **Services:**
  - `SmugMugService`: OAuth 1.0a + API v2
  - `BackBlazeB2Service`: B2 uploads with restricted key support
  - `MigrationOrchestrator`: Coordinates entire workflow
  - `AssetInventoryService`: Enumerates assets with pagination, video filtering
  - `MetadataService`: Generates JSON sidecars (handles both Asset objects and raw API data)
  - `ErrorLogger`: Structured error tracking

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

## Next Steps

### Ready to Test
- Run migration with new JSON structure to verify filename and keywords are correct
- Confirm cleaner JSON output in B2

### Future Enhancements
1. Test with larger batches (50, 100 images)
2. Run full migration of all ~1,063 images
3. Add progress persistence/resume capability
4. Consider adding date-based folder organization in B2

## Credentials & Configuration

**SmugMug API:**
- API Key: `XJCbKrt8V6zTs8QqVvSznzK4sqv7G3qh`
- Using OAuth 1.0a with access tokens stored in environment variables

**Backblaze B2:**
- Bucket: `smugmug-retrieve-test`
- Using restricted application key
- Account ID: `000680229fef358000000000e`

## Files Modified This Session (2025-11-25)

- `frontend/src/components/ConfigurationScreen.jsx` - Button fix, excludeVideos checkbox, error clearing
- `backend/src/routes/migration.routes.js` - excludeVideos parameter handling
- `backend/src/services/MigrationOrchestrator.js` - Pass excludeVideos to inventory service
- `backend/src/services/AssetInventoryService.js` - Video filtering during enumeration
- `backend/src/services/MetadataService.js` - Complete rewrite of extractMetadata, normalizeSource
- `backend/src/services/AssetUploadService.js` - Simplified metadata extraction call

## Git Status
- Branch: `main`
- Last commit: `9b1f4a8` (Debugging and file clean up)
- Deleted branch: `affectionate-antonelli` (worktree experiment)

## Contact & Resources

- SmugMug API Docs: https://api.smugmug.com/api/v2/doc
- Backblaze B2 Docs: https://www.backblaze.com/b2/docs/
- User: haugaard (SmugMug username)
