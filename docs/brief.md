# Project Brief: SmugMug Asset Retrieval System

## Executive Summary

**SmugMug Asset Retrieval System** is a personal utility web application designed to extract and preserve photography assets from two SmugMug accounts (~4,600 images total, ~40 videos) with complete metadata retention. The system authenticates with SmugMug via API, downloads images and videos with their associated metadata (particularly keywords for Project 1), and stores them in BackBlaze B2 cloud storage. This is a single-purpose migration tool optimized for speed-to-completion while serving as a practical learning project for API integration, cloud storage operations, and metadata handling patterns.

**Primary Problem:** Personal photography assets locked in SmugMug accounts need to be extracted with full metadata preservation and stored in independent cloud storage (B2) for long-term control and portability.

**Target User:** You (solo developer/photographer) managing two distinct SmugMug accounts requiring one-time asset migration.

**Key Value Proposition:** Fast, reliable one-time migration of ~4,600 assets with complete metadata preservation, while providing hands-on learning experience with real-world API integration and cloud storage workflows.

---

## Problem Statement

### Current State

You have two SmugMug accounts containing approximately 4,600 images and 40+ videos that are currently locked within SmugMug's proprietary ecosystem. While SmugMug provides hosting and display capabilities, the assets and their associated metadata (particularly extensive keyword collections for the smaller project) are not easily portable or independently accessible. There is no straightforward way to bulk extract these assets with complete metadata preservation for independent storage and future use.

### Pain Points

- **Vendor Lock-in:** Assets remain dependent on SmugMug's platform, pricing, and policies
- **Limited Control:** Cannot directly manage files in preferred cloud storage (BackBlaze B2)
- **Metadata Risk:** Keyword data (critical for Project 1's ~1,100 images) could be lost during manual export
- **Manual Export Inadequacy:** Downloading 4,600+ assets individually or via basic export tools is time-prohibitive and risks metadata loss
- **No Learning Value:** Manual approaches don't provide hands-on experience with API integration, cloud storage patterns, or JSON data handling
- **Time Constraint:** Project 1 SmugMug account expires 12/31/2025, after which API access (likely) and assets become inaccessible

### Why Existing Solutions Fall Short

- SmugMug's native export may not preserve all metadata fields consistently
- Third-party tools (if any exist) don't target B2 storage specifically
- Manual scripting requires significant upfront research and trial-and-error
- Generic file transfer tools don't handle SmugMug API authentication or metadata extraction

### Urgency

Project 1 has a hard deadline of 12/31/2025 due to account expiration. This is a personal project with flexible timeline for Project 2, but solving it programmatically delivers dual value: (1) practical asset liberation with metadata preservation, and (2) real-world learning experience with API integration and JSON data handling that can be applied to future projects. Fortunately, the time-constrained project is the smaller of the two (~1,100 images vs ~3,500 images).

---

## Proposed Solution

### Core Concept

Build a functional web application that authenticates with SmugMug API v2, discovers and retrieves all images and videos from a specified account, extracts complete metadata (especially keywords), and uploads assets to BackBlaze B2 storage with metadata preserved in JSON sidecar files. The application will be designed for sequential single-account processing, usable twice (once per SmugMug account) with fresh configuration for each run.

### Key Components

**1. SmugMug API Integration**
- OAuth authentication with user's SmugMug subscriber credentials
- Album/gallery enumeration and traversal
- Image and video asset discovery and download
- Metadata extraction (EXIF, keywords, captions, dates, etc.)

**2. Metadata Handling & JSON Structure**
- Extract all available metadata from SmugMug API responses
- Structure metadata as JSON files: `{filename}.json` alongside each asset
- Include option for consolidated JSON manifest: `{filename: metadata_object}` for entire project
- Prioritize keyword preservation for Project 1

**3. BackBlaze B2 Storage**
- B2 API authentication and bucket creation/management
- Upload assets with progress tracking
- Store JSON metadata as sidecar files in same bucket
- Flat storage structure (no folder hierarchy preservation)

**4. Functional UI**
- Simple web interface for configuration (SmugMug credentials, B2 credentials, project selection)
- Progress monitoring during extraction/upload
- Summary report upon completion (asset counts, any errors/skipped files)

**5. Error Handling**
- Log failed downloads/uploads by filename with error reason
- Continue processing remaining assets on error
- Generate final error report at completion

**6. Configuration Management**
- Fresh credential entry each use (no persistent storage)
- Support for switching between two account configurations
- Simple, functional interface prioritized over elaborate UX

### Key Differentiators

- **B2-Specific:** Direct integration with BackBlaze B2 (not generic cloud storage)
- **Metadata-First:** JSON sidecar approach preserves all metadata in human-readable, future-proof format
- **Learning-Optimized:** Architecture choices favor understanding API patterns and JSON handling over enterprise-scale complexity
- **Sequential Single-Account:** No need for multi-tenant architecture - simple, focused tool

### Why This Will Succeed

- SmugMug API v2 is well-documented and stable
- BackBlaze B2 has straightforward S3-compatible API
- JSON metadata format is flexible, readable, and easy to work with
- Scope is contained: ~4,600 assets across two uses, no ongoing maintenance
- Success criteria are clear: all assets in B2 with metadata intact
- Timeline provides adequate buffer for Project 1 (smaller, more urgent project)

---

## Target Users

### Primary User Segment: Solo Developer/Photographer

**Profile:**
- You (single user, no multi-user requirements)
- Technical comfort level: Capable of working with web applications, APIs, and cloud storage
- SmugMug subscriber with two active accounts containing photography assets
- Seeking hands-on learning experience with API integration and JSON data handling

**Current Behaviors & Workflows:**
- Managing photography assets across SmugMug accounts
- Interested in migrating to independent cloud storage (BackBlaze B2)
- Willing to build custom tooling for specific use cases
- Values practical learning opportunities through real-world projects

**Specific Needs:**
- Extract ~4,600 images and ~40 videos from two SmugMug accounts
- Preserve metadata (especially keywords for Project 1)
- Store assets in BackBlaze B2 with flat structure
- Complete Project 1 migration by 12/31/2025 (account expiration deadline)
- Gain experience with API integration and JSON handling patterns

**Goals:**
- Asset liberation: Full control over photography collection outside SmugMug
- Metadata preservation: Retain all keyword data (critical for Project 1)
- Learning: Practical experience with SmugMug API, B2 API, and JSON data structures
- Speed to completion: Functional solution prioritized over perfect architecture

---

## Goals & Success Metrics

### Business Objectives

- **Asset Migration:** Successfully extract 100% of accessible images and videos from both SmugMug accounts to BackBlaze B2 storage
- **Metadata Preservation:** Retain all keyword data for Project 1 (~1,100 images) in JSON format with zero data loss
- **Timeline Compliance:** Complete Project 1 migration by 12/31/2025
- **Learning Outcomes:** Gain hands-on experience with SmugMug API v2, BackBlaze B2 API, and JSON data structure design

### User Success Metrics

- **Completion Rate:** All assets from selected SmugMug account successfully uploaded to B2
- **Metadata Integrity:** JSON sidecar files contain complete metadata for each asset (especially keywords)
- **Error Transparency:** Clear error log identifying any failed downloads/uploads by filename
- **Usability:** Successfully complete second account migration without code changes (configuration only)

### Key Performance Indicators (KPIs)

| KPI | Definition & Target |
|-----|---------------------|
| **Asset Transfer Success Rate** | ≥99% of images/videos successfully transferred to B2 (allowing for potential corrupted/inaccessible source files) |
| **Metadata Capture Rate** | 100% of available metadata fields captured in JSON sidecar files |
| **Project 1 Deadline Compliance** | Project 1 (1,100 images, 40 videos) completed by 12/31/2025 |
| **Error Reporting Accuracy** | Every failed asset logged with filename and error reason |
| **Reusability** | Project 2 migration completed using same codebase with fresh configuration |

---

## MVP Scope

### Core Features (Must Have)

- **SmugMug OAuth Authentication:** Implement OAuth 1.0a flow to authenticate with SmugMug API v2 using subscriber credentials. User enters API key/secret and authorizes access via SmugMug's authorization flow.

- **Asset Discovery & Enumeration:** Traverse SmugMug account structure (albums, galleries, folders) to discover all images and videos. Build complete inventory of assets to be downloaded.

- **Image & Video Download:** Download all discovered assets from SmugMug to local staging/temp storage with progress tracking (count/percentage).

- **Metadata Extraction:** Extract all available metadata from SmugMug API responses (keywords, captions, EXIF data, dates, album info, etc.) for each asset.

- **JSON Sidecar Generation:** Create `{filename}.json` file for each asset containing complete metadata in structured JSON format. Store alongside asset in B2.

- **BackBlaze B2 Upload:** Authenticate with B2 API, upload all assets to specified bucket using flat storage structure (no nested folders). Include progress tracking.

- **Error Logging:** Log any failed downloads/uploads with filename and error reason. Continue processing remaining assets. Generate final error report at completion.

- **Configuration UI:** Simple web interface to enter SmugMug credentials (API key/secret), B2 credentials (account ID, application key, bucket name), and initiate migration process.

- **Progress Monitoring:** Display real-time status during migration: assets discovered, downloaded, uploaded, errors encountered.

- **Completion Summary:** Final report showing total assets processed, successful transfers, errors encountered, and location of error log.

### Out of Scope for MVP

- Multi-account concurrent processing (sequential single-account only)
- Credential storage/persistence (fresh entry each use)
- SmugMug folder hierarchy preservation in B2 (flat storage only)
- Asset preview/thumbnail generation
- Duplicate detection or deduplication
- Bandwidth throttling or rate limiting controls (use API defaults)
- Image editing, resizing, or format conversion
- Database storage (JSON files only)
- Automated retry logic for failed transfers (manual re-run acceptable)
- Portfolio display functionality
- Automated backup scheduling or syncing

### MVP Success Criteria

**MVP is successful when:**

1. All assets from a SmugMug account are successfully transferred to B2 with ≥99% success rate
2. JSON sidecar files contain complete metadata (verified via spot-check of keyword data)
3. Error log clearly identifies any failed assets
4. Application can be reused for second account with only credential changes
5. Project 1 migration completed by 12/31/2025

---

## Post-MVP Vision

### Phase 2 Features

Given this is a personal two-use utility tool, Post-MVP features are minimal and entirely optional. If the tool proves valuable or you want to extend learning:

- **Consolidated Metadata Manifest:** Generate single `project-manifest.json` file containing `{filename: metadata}` mapping for entire migration (easier querying/searching)
- **Retry Failed Transfers:** Add ability to re-run only failed assets from error log without re-processing successful ones
- **Metadata Search/Filter UI:** Simple interface to search keywords, dates, or other metadata fields in JSON sidecar files (useful after migration)
- **B2 Bucket Organization:** Option to organize assets into folders/prefixes in B2 based on metadata (album name, date, keywords)

### Long-term Vision

**Portfolio Display (Original Part 2 Concept):**

Once assets are in B2 with metadata, future project could build portfolio site using B2-stored images. This would be a separate project/PRD, potentially featuring:
- Gallery views organized by metadata (keywords, albums, dates)
- Public/private access controls
- Responsive image display
- Hosted on Hostinger VPS or shared hosting

**Reusability for Other Platforms:**

The architecture (API integration → metadata extraction → cloud storage) could be adapted for other photo platforms (Flickr, Google Photos, etc.) if similar needs arise.

### Expansion Opportunities

- **Metadata Enhancement:** Tools to bulk-edit keywords/tags in JSON files
- **Asset Analysis:** Reports on collection statistics (file types, sizes, keyword frequency)
- **Backup Verification:** Tools to verify B2 storage integrity matches original SmugMug content
- **Multi-Source Migration:** Extend to support other photo services beyond SmugMug

---

## Technical Considerations

### Platform Requirements

- **Target Platforms:** Web application (browser-based UI)
- **Browser/OS Support:** Modern browsers (Chrome, Firefox, Safari, Edge) - no legacy IE support needed
- **Performance Requirements:**
  - Handle ~4,600 asset enumeration without timeout
  - Support file downloads up to 10MB (assume max video file size)
  - Progress updates at reasonable intervals (every 10-50 assets processed)

### Architecture Considerations

- **Repository Structure:** Single repository (monorepo not needed for this scale)
- **Service Architecture:** Simple web application - monolithic architecture acceptable
  - Backend handles SmugMug API, B2 API, orchestration
  - Frontend provides configuration UI and progress monitoring
  - No need for microservices, serverless, or distributed architecture

- **Integration Requirements:**
  - SmugMug API v2 (OAuth 1.0a authentication)
  - BackBlaze B2 API (S3-compatible or native B2 API)
  - JSON file generation and storage

- **Security/Compliance:**
  - Secure credential handling (no storage, fresh entry each use)
  - HTTPS for API communications (standard)
  - No PII beyond user's own SmugMug/B2 credentials
  - No compliance requirements (personal use only)

### Key Technical Constraints

- **API Rate Limits:** Must respect SmugMug API rate limits (documented in API v2 docs)
- **File Size Handling:** Support images (2-4MB typical) and videos (size TBD, assume <50MB)
- **Network Reliability:** Basic error handling for failed HTTP requests (log and continue)
- **Storage:** Local temp storage for downloads before B2 upload (estimate ~20GB max needed temporarily)

### Tech Stack & Hosting Selection

**NOTE:** Technology stack and hosting platform decisions will be handled by separate custom Claude Skills developed specifically for this purpose. This project serves as a test case for those newly-built skills. The Brief and PRD focus on **what** needs to be built; the tech stack skill will determine **how** (languages, frameworks, libraries), and the hosting skill will determine **where** (deployment platform).

---

## Constraints & Assumptions

### Constraints

**Budget:**
- Minimal cost tolerance - prefer free-tier or low-cost services
- BackBlaze B2: ~$0.005/GB storage + $0.01/GB download (estimate ~$0.10-0.20 for 20GB stored)
- SmugMug API: No additional cost beyond existing subscriber account
- Hosting: TBD via separate tech stack evaluation skill

**Timeline:**
- **Hard deadline:** Project 1 (1,100 images, 40 videos) complete by 12/31/2025 due to account expiration
- **Soft timeline:** Project 2 (3,500 images) - no specific deadline
- Prioritize Project 1 completion with buffer time (target mid-December 2025)

**Resources:**
- Solo developer (you)
- Development time: Prioritize speed to completion over architectural perfection
- No team collaboration requirements
- Learning curve acceptable if documented/educational

**Technical:**
- Must work with SmugMug API v2 (OAuth 1.0a)
- Must integrate with BackBlaze B2 API
- Sequential single-account processing only (no concurrent multi-account)
- Credentials entered fresh each use (no persistent storage)
- Flat storage structure in B2 (no folder hierarchy)

**Operational:**
- Two-use tool (one run per SmugMug account)
- Manual initiation (no automated scheduling)
- Acceptable to run on local machine during migration
- Error handling: continue on failure, log errors

### Key Assumptions

- SmugMug API v2 provides complete access to all images, videos, and metadata for subscriber accounts
- SmugMug API access requires active subscriber account (expires 12/31/2025 for Project 1)
- Metadata structure is consistent across both SmugMug accounts
- BackBlaze B2 API (S3-compatible or native) is stable and well-documented
- OAuth 1.0a libraries/implementations exist in common web development languages
- ~20GB total storage (4,600 images @ 2-4MB avg) is acceptable cost for B2
- Network bandwidth sufficient for downloading/uploading ~20GB over reasonable timeframe
- JSON sidecar file approach preserves all necessary metadata fields
- SmugMug account access will remain valid through migration completion
- No significant SmugMug API changes or deprecations before 12/31/2025
- Error rate <1% is acceptable (≥99% success rate target)
- Manual re-run for failed assets is acceptable alternative to automated retry

### Dependencies

**External Services:**
- SmugMug API v2 availability and stability
- BackBlaze B2 API availability and stability
- Active SmugMug subscriber credentials (API key/secret)
- BackBlaze B2 account credentials (account ID, application key, bucket)

**Technical Dependencies:**
- Tech stack selection (handled by separate Claude Skill)
- Hosting platform selection (handled by separate Claude Skill)
- OAuth 1.0a implementation library (language-dependent)
- HTTP client library for API requests
- JSON parsing/generation library

---

## Risks & Open Questions

### Key Risks

**SmugMug Account Expiration (HIGH PRIORITY):**
- **Risk:** Project 1 SmugMug account expires 12/31/2025. If migration not completed by then, API access likely lost and assets become inaccessible.
- **Impact:** Complete loss of access to ~1,100 images and 40 videos with extensive keyword metadata.
- **Mitigation:** Prioritize Project 1 development and execution. Build buffer time into schedule (target completion by mid-December 2025).

**OAuth 1.0a Implementation Complexity:**
- **Risk:** OAuth 1.0a is older and more complex than OAuth 2.0. May require significant time to implement correctly.
- **Impact:** Delays in development timeline, potential authentication failures.
- **Mitigation:** Research available libraries early in tech stack selection. Consider allocating extra time for authentication implementation. Early POC testing.

**SmugMug API Rate Limiting:**
- **Risk:** API may throttle requests during bulk asset enumeration/download (~1,100-3,500 assets). Could extend migration time significantly.
- **Impact:** Migration takes hours or days instead of minutes/hours.
- **Mitigation:** Review SmugMug API rate limit documentation. Implement respectful request pacing. Plan for migration to run over several hours/days if needed.

**Incomplete Metadata Extraction:**
- **Risk:** SmugMug API may not expose all metadata fields visible in web UI (especially custom keywords). Could result in data loss.
- **Impact:** Loss of critical keyword data for Project 1, undermining primary objective.
- **Mitigation:** Early proof-of-concept to test metadata extraction completeness. Document any known gaps before full migration.

**Large File Handling:**
- **Risk:** Videos (40+ files) may be larger than expected, causing download/upload timeouts or memory issues.
- **Impact:** Failed transfers, incomplete migration.
- **Mitigation:** Test with largest video files first. Implement streaming/chunked transfer if needed.

**Network Interruption During Migration:**
- **Risk:** Long-running migration (~4,600 assets) vulnerable to network failures, requiring restart.
- **Impact:** Lost progress, need to restart entire migration.
- **Mitigation:** Log progress continuously. Design to allow manual continuation from error log if needed.

**B2 Storage Costs Exceeding Expectations:**
- **Risk:** While estimated at ~$0.10-0.20, unexpected data volume could increase costs.
- **Impact:** Higher than anticipated expenses.
- **Mitigation:** Monitor B2 usage during Project 1. Confirm costs before proceeding to Project 2.

### Open Questions

**SmugMug API Specifics:**
- Does SmugMug API v2 require active subscriber account, or do credentials persist after expiration?
- What are exact rate limits for asset enumeration and download endpoints?
- Are there known metadata fields that API doesn't expose?
- Can API access all asset types (images, videos) uniformly?

**Metadata Structure:**
- What is complete list of metadata fields available from SmugMug API?
- Should JSON schema be designed upfront, or discovered iteratively?
- How should missing/optional metadata fields be handled in JSON (null, omit, empty string)?
- Should consolidated manifest be generated in addition to sidecar files, or one approach only?

**B2 Upload Strategy:**
- Should files be uploaded as discovered/downloaded (streaming), or batch after all downloads complete?
- What is optimal B2 upload concurrency for this scale?
- Should B2 object metadata include any SmugMug metadata, or rely solely on sidecar files?
- How to handle filename conflicts or special characters in B2?

**Error Recovery:**
- If migration fails partway through, can user safely restart, or risk of duplicates in B2?
- Should app detect/skip already-uploaded files on restart?
- What level of retry logic is appropriate (none, simple retry, exponential backoff)?

**Testing Strategy:**
- Should there be a "dry run" mode to test without uploading to B2?
- How to validate metadata integrity before declaring success?
- What constitutes adequate testing before running Project 1 migration?

### Areas Needing Further Research

- **SmugMug API v2 Documentation Review:** Comprehensive review of authentication, rate limits, endpoints, metadata fields
- **OAuth 1.0a Library Availability:** Survey of OAuth 1.0a implementations in candidate languages (Node.js, Python, etc.)
- **BackBlaze B2 API Patterns:** Review B2 upload best practices, error handling, progress tracking
- **JSON Schema Design:** Design metadata JSON structure to balance completeness and usability
- **Proof-of-Concept Testing:** Small-scale test (10-20 images) to validate end-to-end flow before full implementation

---

## Next Steps

### Immediate Actions

1. **Complete Project Brief** ✅ - Document saved to [docs/brief.md](docs/brief.md)
2. **Create Product Requirements Document (PRD)** - Use this brief as foundation for detailed PRD with functional/non-functional requirements, epics, and user stories
3. **Review SmugMug API v2 Documentation** - Understand authentication, endpoints, rate limits, metadata fields
4. **Invoke Tech Stack Evaluation Skill** - Use custom Claude Skill to determine language, framework, libraries
5. **Invoke Hosting Platform Skill** - Determine deployment target (local, VPS, shared hosting)
6. **Develop Proof-of-Concept** - Test SmugMug OAuth → metadata extraction → B2 upload with 10-20 images
7. **Validate Metadata Completeness** - Confirm all needed metadata (especially keywords) is captured
8. **Build MVP** - Full implementation following PRD
9. **Execute Project 1 Migration** - Complete before 12/31/2025 deadline
10. **Execute Project 2 Migration** - No deadline pressure

### Handoff to PRD Creation

This Project Brief provides comprehensive context for creating a detailed Product Requirements Document. The PRD should expand on:

- **Functional Requirements:** Specific capabilities and behaviors
- **Non-Functional Requirements:** Performance, security, usability standards
- **User Interface Design Goals:** UI/UX approach for configuration and progress monitoring
- **Epic and Story Breakdown:** Logical development phases and implementation tasks
- **Acceptance Criteria:** Testable conditions for each story

The PRD will serve as the blueprint for architecture design and implementation.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-04
**Author:** John (PM Agent)
**Status:** Complete - Ready for PRD Creation
