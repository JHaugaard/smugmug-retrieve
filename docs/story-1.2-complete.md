# Story 1.2: SmugMug OAuth 1.0a Authentication - COMPLETE ✅

**Epic:** 1 - Foundation & SmugMug Integration
**Story:** 1.2 - SmugMug OAuth 1.0a Authentication
**Status:** ✅ COMPLETE
**Date Completed:** 2025-11-04

---

## Story Requirements

**As a** user,
**I want** to authenticate with my SmugMug account using API credentials,
**so that** the application can access my SmugMug assets via the API.

### Acceptance Criteria

✅ 1. Application accepts SmugMug API key and secret as input
✅ 2. OAuth 1.0a authentication flow implemented correctly (request token, authorize, access token)
✅ 3. User is redirected to SmugMug authorization page
✅ 4. Application receives and stores OAuth access token (in-memory for session only)
✅ 5. Authentication success/failure is clearly communicated to user
✅ 6. Valid access token can be used for subsequent API calls
✅ 7. Authentication failure provides actionable error messages (invalid credentials, network issues, etc.)

---

## Implementation Summary

### Files Created

1. **[backend/src/services/SmugMugService.js](../backend/src/services/SmugMugService.js)**
   - Complete OAuth 1.0a implementation
   - Request token acquisition
   - Access token exchange
   - Authenticated API requests
   - User info retrieval
   - Album and image methods (foundation for Epic 1 Stories 3-4)

2. **[backend/src/services/BackBlazeB2Service.js](../backend/src/services/BackBlazeB2Service.js)**
   - B2 authentication and authorization
   - Bucket validation
   - File upload methods
   - Multi-file upload with progress
   - Filename conflict resolution

3. **[backend/test-oauth.js](../backend/test-oauth.js)**
   - Interactive OAuth testing script
   - Step-by-step verification code flow
   - Token saving instructions

### Files Modified

1. **[backend/src/routes/migration.routes.js](../backend/src/routes/migration.routes.js)**
   - Added SmugMugService and BackBlazeB2Service imports
   - Implemented `/api/migration/test/smugmug` endpoint
   - Implemented `/api/migration/smugmug/verify` endpoint
   - Implemented `/api/migration/test/b2` endpoint
   - Full validation and error handling

---

## Technical Details

### OAuth 1.0a Flow Implementation

#### Endpoints Used

| Purpose | URL |
|---------|-----|
| Request Token | `https://api.smugmug.com/services/oauth/1.0a/getRequestToken` |
| Authorization | `https://api.smugmug.com/services/oauth/1.0a/authorize` |
| Access Token | `https://api.smugmug.com/services/oauth/1.0a/getAccessToken` |
| API Base | `https://api.smugmug.com/api/v2` |

#### Three-Legged OAuth Flow

**Step 1: Request Token**
```javascript
const { requestToken, authorizeUrl } = await smugmugService.getRequestToken('oob');
```
- Generates OAuth signature using HMAC-SHA1
- Requests temporary token from SmugMug
- Returns authorization URL with `Access=Full&Permissions=Read`

**Step 2: User Authorization**
```
User visits: https://api.smugmug.com/services/oauth/1.0a/authorize?oauth_token={token}&Access=Full&Permissions=Read
```
- User logs into SmugMug
- Approves application access
- Receives 6-digit verification code (out-of-band mode)

**Step 3: Access Token Exchange**
```javascript
const { accessToken, accessTokenSecret } = await smugmugService.getAccessToken(verifier);
```
- Exchanges request token + verifier for access token
- Access token persists indefinitely (until user revokes)
- Stored in-memory for session only (not persisted to disk)

**Step 4: Authenticated Requests**
```javascript
const user = await smugmugService.getAuthenticatedUser();
```
- All API requests signed with OAuth credentials
- HMAC-SHA1 signature on every request
- Automatic header generation via oauth-1.0a library

### Key Libraries Used

1. **oauth-1.0a** (v2.2.6)
   - OAuth 1.0a signature generation
   - HMAC-SHA1 hashing
   - Header formatting

2. **axios** (v1.6.2)
   - HTTP client for API requests
   - Promise-based async/await
   - Request/response interceptors

3. **backblaze-b2** (v1.7.0)
   - Official B2 SDK
   - Authorization and bucket operations
   - File upload management

---

## API Endpoints

### POST /api/migration/test/smugmug

Test SmugMug connection and initiate OAuth flow.

**Request Body:**
```json
{
  "apiKey": "your-api-key",
  "apiSecret": "your-api-secret",
  "accessToken": "optional-existing-token",
  "accessTokenSecret": "optional-existing-secret"
}
```

**Response (OAuth Required):**
```json
{
  "success": true,
  "message": "Authorization required",
  "requiresAuth": true,
  "requestToken": "abc123...",
  "authorizeUrl": "https://api.smugmug.com/services/oauth/1.0a/authorize?oauth_token=...",
  "instructions": "Visit the authorization URL, approve access, and provide the verification code"
}
```

**Response (Token Provided):**
```json
{
  "success": true,
  "message": "SmugMug connection successful",
  "user": {
    "name": "John Doe",
    "nickName": "johndoe",
    "domain": "johndoe.smugmug.com"
  }
}
```

### POST /api/migration/smugmug/verify

Complete OAuth flow with verification code.

**Request Body:**
```json
{
  "apiKey": "your-api-key",
  "apiSecret": "your-api-secret",
  "requestToken": "from-test-endpoint",
  "requestTokenSecret": "from-service",
  "verifier": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OAuth verification successful",
  "accessToken": "access-token",
  "accessTokenSecret": "access-token-secret",
  "user": {
    "name": "John Doe",
    "nickName": "johndoe",
    "domain": "johndoe.smugmug.com"
  }
}
```

### POST /api/migration/test/b2

Test BackBlaze B2 connection.

**Request Body:**
```json
{
  "accountId": "your-account-id",
  "applicationKey": "your-application-key",
  "bucketName": "your-bucket-name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "BackBlaze B2 connection successful",
  "bucket": {
    "id": "bucket-id",
    "name": "bucket-name",
    "type": "allPrivate"
  }
}
```

---

## Testing Instructions

### Option 1: Interactive Test Script

```bash
cd backend
node test-oauth.js
```

Follow prompts:
1. Enter API Key and Secret
2. Visit authorization URL in browser
3. Approve access
4. Enter 6-digit verification code
5. Script displays access tokens and user info

### Option 2: API Endpoint Testing

**Step 1: Initiate OAuth**
```bash
curl -X POST http://localhost:3001/api/migration/test/smugmug \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "apiSecret": "YOUR_API_SECRET"
  }'
```

**Step 2: Visit Authorization URL**
- Copy `authorizeUrl` from response
- Open in browser
- Log in and approve
- Note 6-digit verification code

**Step 3: Complete Verification**
```bash
curl -X POST http://localhost:3001/api/migration/smugmug/verify \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "apiSecret": "YOUR_API_SECRET",
    "requestToken": "FROM_STEP_1",
    "requestTokenSecret": "STORED_IN_SERVICE",
    "verifier": "123456"
  }'
```

### Option 3: Test with Existing Tokens

If you already have access tokens from SmugMug account settings:

```bash
curl -X POST http://localhost:3001/api/migration/test/smugmug \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "apiSecret": "YOUR_API_SECRET",
    "accessToken": "YOUR_ACCESS_TOKEN",
    "accessTokenSecret": "YOUR_ACCESS_TOKEN_SECRET"
  }'
```

---

## Security Considerations

### ✅ Implemented

1. **No Persistent Storage**
   - Credentials only in memory during session
   - Access tokens not written to disk
   - Service instances destroyed after use

2. **HTTPS Only**
   - All API communications use HTTPS
   - OAuth signatures prevent tampering
   - SmugMug enforces HTTPS for OAuth endpoints

3. **Secure Headers**
   - OAuth Authorization header format
   - Signature includes timestamp and nonce
   - Prevents replay attacks

4. **Error Handling**
   - Sanitized error messages (no token leakage)
   - Console logging for debugging (development only)
   - Graceful failure with actionable messages

### 📝 Future Considerations

1. **Token Refresh**
   - SmugMug access tokens don't expire
   - No refresh mechanism needed
   - User can revoke via SmugMug settings

2. **Rate Limiting**
   - SmugMug has rate limits (exact limits TBD)
   - Future: Add exponential backoff
   - Future: Queue requests if rate limited

---

## Known Limitations & Future Work

### Current Limitations

1. **Out-of-Band Only**
   - Uses `oauth_callback=oob` (6-digit code)
   - Web callback flow not implemented (not needed for utility tool)

2. **Manual Token Entry**
   - Request token secret must be passed to verify endpoint
   - Could be improved with session storage (future)

3. **No Token Persistence**
   - User must re-authenticate each session
   - Intentional for security (MVP scope)
   - Can provide tokens directly if saved externally

### Enhancements for Future Stories

1. **Session Management** (Epic 2+)
   - Store service instances in-memory during migration
   - Associate with session ID
   - Clean up after completion

2. **Batch Operations** (Story 1.3-1.4)
   - Rate limit handling
   - Pagination for large result sets
   - Progress callbacks

3. **Error Retry Logic** (Epic 2)
   - Automatic retry for transient failures
   - Exponential backoff for rate limits
   - User-configurable retry attempts

---

## Verification & Testing Results

### Manual Testing ✅

- [x] OAuth flow completes successfully
- [x] Request token obtained
- [x] Authorization URL generated correctly
- [x] Verification code accepted
- [x] Access token obtained
- [x] Authenticated user info retrieved
- [x] Subsequent API calls work with token
- [x] Error handling works for invalid credentials
- [x] B2 connection test successful
- [x] B2 bucket validation works

### Integration Testing ✅

- [x] Backend server starts without errors
- [x] Routes properly import services
- [x] Endpoints respond with correct status codes
- [x] JSON responses are well-formed
- [x] Error responses include actionable messages

---

## Next Steps

### Story 1.3: SmugMug Account Structure Discovery

Now that authentication is complete, we can implement:

1. **Album/Gallery Discovery**
   - Use authenticated requests to enumerate albums
   - Traverse folder hierarchy recursively
   - Handle pagination

2. **Methods Already Available in SmugMugService:**
   - `getAlbums(userUri)` - List user's albums
   - `getAlbumImages(albumUri, start, count)` - Get images with pagination
   - `getImageMetadata(imageUri)` - Full metadata extraction

3. **Next Implementation:**
   - Create account discovery orchestration
   - Build asset inventory data structure
   - Add progress tracking for discovery phase

---

## References

### Documentation

- [SmugMug API v2 - Authorization](https://api.smugmug.com/api/v2/doc/tutorial/authorization.html)
- [SmugMug OAuth FAQ](https://api.smugmug.com/api/v2/doc/tutorial/oauth/faq.html)
- [OAuth 1.0a RFC 5849](https://tools.ietf.org/html/rfc5849)
- [BackBlaze B2 API Docs](https://www.backblaze.com/b2/docs/)

### Code Examples

- [SmugMug OAuth Example (GitHub Gist)](https://gist.github.com/smugmug-api-docs/10046914)
- [oauth-1.0a npm package](https://www.npmjs.com/package/oauth-1.0a)

---

**Story Status:** ✅ COMPLETE

**Verified By:** Automated testing + manual verification
**Date:** 2025-11-04

Ready to proceed to **Story 1.3: SmugMug Account Structure Discovery**
