# SmugMug Asset Retrieval System - Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Successfully extract 100% of accessible images and videos from two SmugMug accounts (~4,600 total assets) to BackBlaze B2 storage
- Preserve all metadata (especially keywords for Project 1) in JSON sidecar files with zero data loss
- Complete Project 1 migration (1,100 images, 40 videos) by 12/31/2025 deadline (account expiration)
- Provide hands-on learning experience with SmugMug API v2, BackBlaze B2 API, and JSON data handling
- Create reusable tool that works for second account migration with only configuration changes
- Achieve ≥99% asset transfer success rate with clear error logging for any failures
- Enable future asset utilization through portable JSON metadata structure

### Background Context

Two SmugMug accounts contain approximately 4,600 images and 40+ videos currently locked within SmugMug's ecosystem. Project 1 (~1,100 images with extensive keyword metadata, 40 videos) has a hard deadline of 12/31/2025 due to account expiration, after which API access will likely be lost. Project 2 (~3,500 images) has no specific timeline. Manual export is impractical due to scale and metadata loss risks.

This project builds a web-based migration tool to authenticate with SmugMug API v2, enumerate all assets, download them with complete metadata extraction, and upload to BackBlaze B2 storage in a flat structure with JSON sidecar files. The solution prioritizes speed-to-completion while providing practical learning value in API integration, OAuth authentication, and structured data handling. The tool will be used sequentially for both accounts with fresh credential entry each time.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-11-04 | 1.0 | Initial PRD creation from Project Brief | John (PM Agent) |

---

## Requirements

### Functional Requirements

- **FR1:** System shall authenticate with SmugMug API v2 using OAuth 1.0a flow with user-provided API key and secret
- **FR2:** System shall enumerate all albums, galleries, and folders in the authenticated SmugMug account
- **FR3:** System shall discover and inventory all images and videos within the SmugMug account structure
- **FR4:** System shall download all discovered image assets from SmugMug to local temporary storage
- **FR5:** System shall download all discovered video assets from SmugMug to local temporary storage
- **FR6:** System shall extract all available metadata from SmugMug API for each asset (keywords, captions, EXIF, dates, album information)
- **FR7:** System shall generate a JSON sidecar file (`{filename}.json`) for each asset containing complete structured metadata
- **FR8:** System shall authenticate with BackBlaze B2 API using user-provided account ID, application key, and bucket name
- **FR9:** System shall upload all downloaded assets to specified B2 bucket using flat storage structure (no nested folders)
- **FR10:** System shall upload JSON sidecar files alongside their corresponding assets to B2
- **FR11:** System shall display real-time progress during migration including: assets discovered, downloaded, uploaded, and errors encountered
- **FR12:** System shall log any failed downloads or uploads with filename and specific error reason
- **FR13:** System shall continue processing remaining assets when individual asset failures occur
- **FR14:** System shall generate a completion summary report showing total assets processed, successful transfers, errors, and error log location
- **FR15:** System shall provide a web-based configuration interface for entering SmugMug credentials, B2 credentials, and initiating migration
- **FR16:** System shall accept fresh credential entry for each migration run without persistent storage
- **FR17:** System shall support test/sample mode to process a limited number of assets (user-specified, default 10) for workflow validation

### Non-Functional Requirements

- **NFR1:** System shall handle enumeration of up to 5,000 assets without timeout or performance degradation
- **NFR2:** System shall support download and upload of files up to 50MB in size
- **NFR3:** System shall achieve ≥99% asset transfer success rate (allowing for potentially corrupted source files)
- **NFR4:** System shall capture 100% of available metadata fields in JSON sidecar files
- **NFR5:** System shall provide progress updates at intervals no longer than processing every 50 assets
- **NFR6:** System shall respect SmugMug API rate limits as documented in API v2 specifications
- **NFR7:** System shall handle network failures gracefully with clear error logging
- **NFR8:** System shall NOT persistently store user credentials (SmugMug or B2)
- **NFR9:** System shall use HTTPS for all API communications with SmugMug and BackBlaze B2
- **NFR10:** System shall be reusable for multiple account migrations with only credential/configuration changes
- **NFR11:** System shall require no more than 25GB of local temporary storage during operation
- **NFR12:** System shall operate on modern web browsers (Chrome, Firefox, Safari, Edge) without legacy browser support

---

## User Interface Design Goals

### Overall UX Vision

Simple, utilitarian interface focused on configuration and monitoring. Notion-like aesthetic - clean, minimal, functional with no elaborate labels. No elaborate design required - prioritize clarity, progress visibility, and error transparency. Single-page or minimal navigation approach. User enters credentials, initiates migration, monitors progress, and reviews completion summary. Clean, straightforward workflow with no unnecessary friction.

### Key Interaction Paradigms

- **Configuration-then-Execute:** User provides all required inputs (credentials, bucket name) in a single form, validates, then triggers migration with one action
- **Passive Monitoring:** Once started, user observes progress without interaction (no manual intervention required during processing)
- **Error Transparency:** Any failures are immediately visible in progress display, with detailed error log accessible at completion
- **Session-Based:** No account creation or login - each migration is a standalone session with fresh credential entry
- **Test-First Option:** User can run sample migration (5-10 assets) to validate workflow before committing to full migration

### Core Screens and Views

1. **Configuration Screen** - Form to enter SmugMug credentials (API key, secret), B2 credentials (account ID, application key, bucket name), test mode toggle, validate inputs
2. **Migration Progress View** - Real-time display showing: assets discovered, assets downloaded, assets uploaded, current operation, error count
3. **Completion Summary Screen** - Final report with success/failure counts, error log location, option to start new migration

### Accessibility

**None** - Given this is a personal utility tool for single-user use with no public access, accessibility standards (WCAG) are not required. Focus on functional clarity over compliance.

### Branding

**None** - No branding requirements. Simple, clean interface using default framework/library styling is acceptable. Prioritize function over form.

### Target Device and Platforms

**Desktop Only (Web)** - Application designed for desktop browser use on modern browsers (Chrome, Firefox, Safari, Edge). No mobile responsiveness required. Migration operations (handling thousands of assets) are desktop-appropriate tasks.

---

## Technical Assumptions

### Repository Structure: Monorepo

Single repository containing frontend and backend code. No need for multiple repositories given the scale and single-developer context.

### Service Architecture: Monolith

Simple monolithic web application. Backend handles SmugMug API integration, B2 API integration, file processing, and orchestration. Frontend provides SPA interface (Notion-like aesthetic - clean, minimal, functional). No microservices, serverless, or distributed architecture needed.

### Testing Requirements: Manual Testing + Basic Unit Tests

Given speed-to-completion priority and personal-use context:
- Manual testing for core workflows (auth, asset discovery, download/upload)
- Basic unit tests for critical logic (metadata extraction, JSON generation, error handling)
- Test mode: "Sample run" capability to process small subset (5-10 assets) before full migration
- No elaborate test automation, e2e frameworks, or CI/CD required for MVP

### Additional Technical Assumptions and Requests

- **OAuth 1.0a Implementation:** Use established library for SmugMug OAuth - don't build from scratch
- **JSON Schema:** Follow best practices for metadata structure; prioritize readability and flexibility
- **Filename Conflict Resolution:** Handle gracefully using standard approaches (append counter, hash, or UUID suffix)
- **Progress Tracking:** Simple in-memory state sufficient (no persistent progress database needed)
- **Error Logging:** Write errors to simple text or JSON log file for review
- **Temporary Storage:** Use system temp directory for downloads before B2 upload; clean up after completion
- **Concurrent Operations:** Reasonable concurrency for downloads/uploads (e.g., 5-10 parallel operations) to improve performance without overwhelming APIs
- **API Client Libraries:** Prefer official or well-maintained community libraries for SmugMug and B2 APIs
- **Configuration Validation:** Validate credentials and connectivity before starting full migration
- **Sample/Test Mode:** Support processing first N assets (user-specified, default 5-10) to validate workflow before committing to full migration

### Tech Stack & Hosting Selection

**NOTE:** Technology stack and hosting platform decisions will be handled by separate custom Claude Skills developed specifically for this purpose. This project serves as a test case for those newly-built skills. The PRD focuses on **what** needs to be built; the tech stack skill will determine **how** (languages, frameworks, libraries), and the hosting skill will determine **where** (deployment platform).

---

## Epic List

### Epic 1: Foundation & SmugMug Integration
Establish project infrastructure, implement SmugMug OAuth authentication and asset discovery, validate end-to-end connectivity with test mode capability.

### Epic 2: Asset Processing & B2 Storage
Implement asset download, metadata extraction with JSON sidecar generation, and BackBlaze B2 upload with progress tracking and error handling.

### Epic 3: User Interface & Migration Orchestration
Build configuration UI (Notion-like), orchestrate full migration workflow with progress monitoring, completion summary, and test/sample mode.

---

## Epic 1: Foundation & SmugMug Integration

### Epic Goal

Establish project foundation with basic web application structure and implement complete SmugMug API integration including OAuth 1.0a authentication, account structure traversal, and asset discovery. By the end of this epic, the system can authenticate with SmugMug and enumerate all images/videos ready for download, validating API connectivity and feasibility before building the full processing pipeline.

---

### Story 1.1: Project Setup and Basic Web Server

**As a** developer,
**I want** a functional web application skeleton with basic server infrastructure,
**so that** I have a foundation to build SmugMug integration and UI features.

#### Acceptance Criteria

1. Project repository initialized with appropriate structure (frontend/backend separation if applicable)
2. Web server running and accessible on localhost with health check endpoint
3. Basic routing infrastructure in place
4. Development environment configured with necessary dependencies
5. Simple "hello world" or landing page renders successfully
6. README with setup instructions created

---

### Story 1.2: SmugMug OAuth 1.0a Authentication

**As a** user,
**I want** to authenticate with my SmugMug account using API credentials,
**so that** the application can access my SmugMug assets via the API.

#### Acceptance Criteria

1. Application accepts SmugMug API key and secret as input
2. OAuth 1.0a authentication flow implemented correctly (request token, authorize, access token)
3. User is redirected to SmugMug authorization page
4. Application receives and stores OAuth access token (in-memory for session only)
5. Authentication success/failure is clearly communicated to user
6. Valid access token can be used for subsequent API calls
7. Authentication failure provides actionable error messages (invalid credentials, network issues, etc.)

---

### Story 1.3: SmugMug Account Structure Discovery

**As a** user,
**I want** the application to discover all albums, galleries, and folders in my SmugMug account,
**so that** all organizational structures can be traversed to find assets.

#### Acceptance Criteria

1. Application retrieves authenticated user's SmugMug account information
2. All top-level albums and galleries are discovered via API
3. Nested folders/sub-albums are recursively discovered
4. Account structure is stored in memory for asset enumeration
5. API rate limits are respected during discovery
6. Discovery progress is logged (number of albums/galleries found)
7. Discovery failures are logged with specific error details
8. Empty albums/galleries are handled gracefully

---

### Story 1.4: Asset Enumeration and Inventory

**As a** user,
**I want** the application to enumerate all images and videos across my SmugMug account,
**so that** I have a complete inventory of assets to be migrated.

#### Acceptance Criteria

1. Application traverses all discovered albums/galleries to find assets
2. All image assets are identified and cataloged (filename, SmugMug URI, album location)
3. All video assets are identified and cataloged separately
4. Total asset count (images + videos) is calculated and displayed
5. Asset inventory includes necessary metadata references for later extraction
6. Enumeration handles pagination for large albums correctly
7. API rate limits respected during enumeration
8. Enumeration errors are logged but processing continues for remaining albums
9. Final inventory report shows: total images, total videos, total albums processed, any errors

---

## Epic 2: Asset Processing & B2 Storage

### Epic Goal

Implement the core asset processing pipeline: download images and videos from SmugMug, extract complete metadata, generate JSON sidecar files, and upload everything to BackBlaze B2 storage. This epic delivers the fundamental migration capability with error handling and progress tracking, enabling headless/programmatic migrations even before the full UI is complete.

---

### Story 2.1: Asset Download from SmugMug

**As a** user,
**I want** the application to download images and videos from SmugMug to local temporary storage,
**so that** assets can be processed and uploaded to B2.

#### Acceptance Criteria

1. Application downloads image files from SmugMug using asset inventory from Epic 1
2. Application downloads video files from SmugMug
3. Downloaded files are stored in system temporary directory with appropriate naming
4. Download progress is tracked (count of assets downloaded, percentage complete)
5. Failed downloads are logged with filename and error reason
6. Download continues for remaining assets when individual failures occur
7. Supports files up to 50MB in size without timeout
8. Implements reasonable concurrency (5-10 parallel downloads) for performance
9. Respects SmugMug API rate limits during download operations
10. Downloaded files retain appropriate extensions based on content type

---

### Story 2.2: Metadata Extraction and JSON Sidecar Generation

**As a** user,
**I want** complete metadata extracted from SmugMug and saved as JSON sidecar files,
**so that** all asset information (especially keywords) is preserved alongside images.

#### Acceptance Criteria

1. Application extracts all available metadata from SmugMug API for each asset (keywords, captions, EXIF, dates, album info, descriptions)
2. Metadata is structured into well-formed JSON following best practices
3. JSON sidecar file created for each asset with naming pattern `{filename}.json`
4. Missing or optional metadata fields are handled gracefully (null, omit, or empty string per JSON best practices)
5. Keyword data is captured completely and accurately (critical for Project 1)
6. JSON files are human-readable with appropriate formatting/indentation
7. Filename conflicts in JSON generation are handled gracefully (append counter/hash if needed)
8. Metadata extraction failures are logged but don't block asset download/upload
9. JSON schema is consistent across all assets

---

### Story 2.3: BackBlaze B2 Authentication and Bucket Setup

**As a** user,
**I want** the application to authenticate with BackBlaze B2 and prepare for asset upload,
**so that** assets and metadata can be stored in my B2 bucket.

#### Acceptance Criteria

1. Application accepts B2 account ID, application key, and bucket name as input
2. B2 authentication flow implemented correctly using B2 API
3. Authentication success/failure is clearly communicated
4. Application validates bucket exists and is accessible
5. If bucket doesn't exist, appropriate error message is provided (no auto-creation in MVP)
6. Authentication tokens are stored in-memory for session only
7. Connection to B2 is validated before proceeding to upload
8. Authentication failure provides actionable error messages

---

### Story 2.4: B2 Upload with Flat Storage Structure

**As a** user,
**I want** assets and JSON sidecar files uploaded to B2 in a flat storage structure,
**so that** all my SmugMug content is safely stored in independent cloud storage.

#### Acceptance Criteria

1. Application uploads all downloaded image files to specified B2 bucket
2. Application uploads all downloaded video files to B2 bucket
3. Application uploads all JSON sidecar files to B2 bucket alongside corresponding assets
4. Flat storage structure is used (no nested folders/prefixes)
5. Filename conflicts are resolved gracefully using best practices (append counter/hash/UUID suffix)
6. Upload progress is tracked (count of files uploaded, percentage complete)
7. Failed uploads are logged with filename and error reason
8. Upload continues for remaining assets when individual failures occur
9. Implements reasonable concurrency (5-10 parallel uploads) for performance
10. Temporary local files are cleaned up after successful B2 upload
11. Supports uploading files up to 50MB in size

---

### Story 2.5: Error Logging and Progress Tracking

**As a** user,
**I want** clear error logs and progress tracking throughout the migration,
**so that** I can monitor the process and identify any issues.

#### Acceptance Criteria

1. Application maintains in-memory state of migration progress (discovered, downloaded, uploaded counts)
2. All errors (download failures, upload failures, metadata extraction issues) are logged to file with timestamp, filename, and error details
3. Error log uses structured format (JSON or clearly formatted text)
4. Progress state is updated in real-time as operations complete
5. Error log location is known and accessible after migration completes
6. Progress can be queried/displayed (will be used by Epic 3 UI)
7. Logging doesn't significantly impact performance
8. Critical errors vs. warnings are distinguished in logs
9. Summary statistics are available: total assets, successful operations, failed operations

---

## Epic 3: User Interface & Migration Orchestration

### Epic Goal

Build a clean, Notion-like web UI for configuration and monitoring, orchestrate the complete migration workflow from authentication through completion, and implement test/sample mode for validation. This epic delivers the polished, user-facing experience that makes the tool easily reusable for both SmugMug account migrations with minimal friction.

---

### Story 3.1: Configuration Screen UI

**As a** user,
**I want** a simple web interface to enter credentials and configure migration settings,
**so that** I can easily set up and initiate migrations without command-line interaction.

#### Acceptance Criteria

1. Clean, Notion-like UI design (minimal, functional, no elaborate labels)
2. Configuration form includes fields for:
   - SmugMug API Key (text input)
   - SmugMug API Secret (password/hidden input)
   - B2 Account ID (text input)
   - B2 Application Key (password/hidden input)
   - B2 Bucket Name (text input)
3. Form validation ensures all required fields are filled
4. "Test Connection" buttons for SmugMug and B2 to validate credentials before full migration
5. Clear error messages for invalid credentials or connectivity issues
6. Form is accessible via root URL of application
7. No user account creation or login required (session-based)
8. UI works on desktop browsers (Chrome, Firefox, Safari, Edge)

---

### Story 3.2: Test/Sample Mode Configuration

**As a** user,
**I want** to run a test migration with a small sample of assets,
**so that** I can verify the workflow works correctly before processing thousands of files.

#### Acceptance Criteria

1. Configuration screen includes "Test Mode" toggle/checkbox
2. When Test Mode enabled, user can specify number of assets to process (default: 10, max: 50)
3. Test Mode clearly indicated in UI (visual distinction from full migration)
4. Test Mode runs complete workflow (auth → discover → download → metadata → B2 upload) but limits asset count
5. Test Mode selects first N assets from inventory (predictable, not random)
6. Test Mode completion indicates success and prompts user to run full migration or adjust settings
7. Test Mode uses same error handling and logging as full migration
8. User can easily switch from Test Mode to full migration after validation

---

### Story 3.3: Migration Progress Monitoring UI

**As a** user,
**I want** to see real-time progress as the migration runs,
**so that** I know the system is working and can estimate completion time.

#### Acceptance Criteria

1. Progress view displays automatically after migration starts
2. Real-time updates show:
   - Current operation/phase (e.g., "Discovering assets", "Downloading", "Uploading to B2")
   - Assets discovered (count)
   - Assets downloaded (count, percentage)
   - Assets uploaded to B2 (count, percentage)
   - Errors encountered (count)
3. Progress indicators use simple, clear design (numbers, percentages, progress bars optional)
4. Updates occur at reasonable intervals (at least every 10-50 assets processed)
5. UI remains responsive during long-running migration
6. No user interaction required during migration (passive monitoring)
7. Notion-like aesthetic maintained (clean, minimal)
8. Progress view works for both Test Mode and full migration

---

### Story 3.4: Completion Summary and Error Report

**As a** user,
**I want** a clear completion summary with success/failure details,
**so that** I know the migration finished and can review any issues.

#### Acceptance Criteria

1. Completion screen displays automatically when migration finishes
2. Summary includes:
   - Total assets processed
   - Successful downloads (count)
   - Successful uploads to B2 (count)
   - Failed operations (count)
   - Error log file location/link
3. Success rate percentage is calculated and displayed
4. Clear indication of whether migration met ≥99% success target
5. Error log is accessible (download link or inline display)
6. Option to start new migration (returns to configuration screen with fresh form)
7. Completion summary distinguishes between Test Mode results and full migration results
8. Summary data can be copied/saved for record-keeping

---

### Story 3.5: End-to-End Migration Orchestration

**As a** user,
**I want** the application to orchestrate the complete migration workflow seamlessly,
**so that** I can configure once and let the system handle all steps automatically.

#### Acceptance Criteria

1. Clicking "Start Migration" button triggers complete workflow:
   - SmugMug OAuth authentication
   - Account structure discovery
   - Asset enumeration
   - Asset download
   - Metadata extraction & JSON generation
   - B2 authentication
   - B2 upload (assets + JSON)
   - Completion summary
2. Workflow transitions between phases automatically without user intervention
3. Progress UI updates reflect current phase throughout workflow
4. Errors in any phase are logged and workflow continues where possible
5. Critical failures (e.g., authentication failure) halt workflow with clear error message
6. Workflow respects Test Mode asset limit if enabled
7. Workflow completes successfully for both small (test) and large (full) migrations
8. Temporary files are cleaned up after successful completion
9. Application state is reset after completion, ready for next migration run with fresh credentials

---

## Checklist Results Report

### Executive Summary

- **Overall PRD Completeness:** 95%
- **MVP Scope Appropriateness:** Just Right
- **Readiness for Architecture Phase:** Ready
- **Most Critical Concerns:** Tech stack selection deferred (by design), no wireframes/mockups (acceptable for utility tool)

### Category Analysis Table

| Category                         | Status  | Critical Issues |
| -------------------------------- | ------- | --------------- |
| 1. Problem Definition & Context  | PASS    | None |
| 2. MVP Scope Definition          | PASS    | None |
| 3. User Experience Requirements  | PASS    | None - Notion-like UI specified, appropriate for context |
| 4. Functional Requirements       | PASS    | None |
| 5. Non-Functional Requirements   | PASS    | None |
| 6. Epic & Story Structure        | PASS    | None |
| 7. Technical Guidance            | PARTIAL | Tech stack deferred to separate skills (intentional) |
| 8. Cross-Functional Requirements | PASS    | None |
| 9. Clarity & Communication       | PASS    | None |

### Top Issues by Priority

#### BLOCKERS
None - PRD is ready for next phase.

#### HIGH
None identified.

#### MEDIUM
- **Tech Stack Specificity:** Language/framework choices deferred to separate Claude Skills. Architect will need this input before detailed design. *Note: This is intentional workflow design, not a PRD deficiency.*

#### LOW
- **Visual Mockups:** No wireframes provided, but "Notion-like" aesthetic is clear guidance for personal utility tool.

### MVP Scope Assessment

✅ **Well-Scoped MVP:**
- Test/sample mode provides safety valve before full migration (smart addition)
- Out-of-scope list is clear and appropriate
- 3 epics deliver incremental value logically
- Stories are sized for AI agent execution (2-4 hour sessions)

**Timeline Realism:**
- 3 epics × 4-5 stories each = ~14 stories total
- At ~2-4 hours per story, estimate 30-60 hours total development
- Project 1 deadline (12/31/2025) is very achievable

### Technical Readiness

✅ **Clear Technical Constraints:**
- OAuth 1.0a requirement explicit
- SmugMug API v2 and B2 API integrations specified
- Monolithic architecture, monorepo structure documented
- Testing approach defined (manual + basic unit tests)

✅ **Identified Technical Risks:**
- OAuth 1.0a complexity acknowledged
- SmugMug rate limits flagged
- Metadata extraction completeness identified as POC validation need
- Large file handling noted

⚠️ **Deferred to Tech Stack Skills:**
- Language/framework selection
- Hosting platform selection
- This is intentional workflow design - Architect will receive these inputs from separate skills

### Recommendations

#### For Immediate Next Steps:
1. ✅ **PRD is READY FOR ARCHITECT** - No blocking issues
2. **Invoke Tech Stack Selection Skill** - Architect will need language/framework decisions
3. **Invoke Hosting Platform Skill** - Deployment target needed for architectural design
4. **Review Brief + PRD** - Ensure alignment with scope and approach before development
5. **Plan POC Sprint** - Consider Epic 1 Story 1-4 as POC to validate SmugMug API feasibility

### Final Decision

✅ **READY FOR ARCHITECT**

The PRD and epics are comprehensive, properly structured, and ready for architectural design. The Brief provides excellent foundation context. Tech stack and hosting decisions are appropriately deferred to specialized skills per project workflow design.

---

## Next Steps

### Architect Prompt

Review the Project Brief ([docs/brief.md](docs/brief.md)) and this PRD ([docs/prd.md](docs/prd.md)) to understand the SmugMug Asset Retrieval System. This is a personal utility web application for migrating ~4,600 images and videos from two SmugMug accounts to BackBlaze B2 storage with complete metadata preservation in JSON sidecar files. Once tech stack and hosting decisions are provided by separate Claude Skills, create a comprehensive technical architecture document covering system design, data models, API integration patterns, error handling strategy, and implementation guidance for the 3 epics and 14 stories defined in this PRD.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-04
**Author:** John (PM Agent)
**Status:** Complete - Ready for Architecture Phase
