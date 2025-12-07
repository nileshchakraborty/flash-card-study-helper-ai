# MindFlip AI - TODO & Feature Backlog

## 🔴 High Priority (P0)

### Backend Stability & Testing
- [ ] Investigate and fix remaining force-exit warning in `express-rate-limit` integration tests
- [x] Standardize error responses with request IDs and error codes ✅ NEW
- [x] Add request logging middleware for debugging ✅ NEW
- [x] Enhanced health check endpoint with system info ✅ NEW
- [ ] Implement request validation middleware (comprehensive)
- [ ] Add API rate limiting configuration for production

### Backend File Processing & Question Generation
- [x] **Add support for all document formats for flashcard/quiz generation:**
  - [x] PDF support (already implemented)
  - [x] Image support (already implemented via Tesseract OCR)
  - [x] DOCX (Word documents) support using `mammoth` ✅ NEW
  - [x] XLSX (Excel spreadsheets) support using `xlsx` ✅ NEW
  - [x] Plain text (.txt) support (already implemented)
  - [ ] URL scraping for question generation (currently only for web context)
- [x] Enhance `processFile` method to handle all formats ✅ NEW
- [x] Add file format validation and error handling ✅ NEW
- [x] Add input validation (topic length, count ranges, file size) ✅ NEW
- [x] Add unit tests for file format processing ✅ NEW
- [ ] Add E2E tests for file upload and flashcard generation

### Mobile App Development
- [ ] Complete React Native cross-platform client
  - [ ] Basic screens and navigation
  - [ ] API integration with backend
  - [ ] Offline mode support
  - [ ] Push notifications for quiz reminders
- [ ] Mobile-backend integration verification
  - [ ] Verify API routes match mobile expectations
  - [ ] Test data format consistency
  - [ ] Confirm authentication flow

### WebLLM & Client-Side AI
- [ ] Fix WebLLM integration issues
  - [ ] Ensure offline AI mode works without backend calls
  - [ ] Verify WebSocket session management
  - [ ] Test flashcard generation in offline mode
- [ ] Improve JSON parsing for various LLM output formats
- [ ] Add fallback mechanisms for client-side generation failures

---

## 🟡 Medium Priority (P1)

### Quiz Features
- [ ] **Quiz UI Refinements**
  - [ ] Hide "Quiz History" and "Your Performance" by default
  - [ ] Show sections only after quiz completion
  - [ ] Add "Review Quiz" button to completion popup
  - [ ] Display quiz results and answers in review mode
- [ ] Fix quiz generation empty results issue
- [ ] Add quiz difficulty progression
- [ ] Implement adaptive quiz generation based on performance

### GraphQL Enhancements
- [ ] **Phase 5.3 Optimizations**
  - [ ] Implement DataLoader for batching
  - [ ] Add response caching
  - [ ] Optimize query performance
- [ ] **Phase 6 Performance Testing**
  - [ ] Benchmark GraphQL API vs REST API
  - [ ] Identify bottlenecks
  - [ ] Optimize slow queries
- [ ] Complete GraphQL authentication context tests
- [ ] Add GraphQL schema validation tests

### Deep Dive Mode
- [ ] Enhance knowledge retrieval with sub-topic breakdown
- [ ] Implement multi-source research per sub-topic
- [ ] Add context aggregation
- [ ] Generate advanced flashcards from aggregated context
- [ ] Integrate recommended learning paths

### Authentication & Security
- [ ] Fix authentication flow issues
  - [ ] Ensure JWT tokens work consistently
  - [ ] Verify singleton pattern for AuthService
- [ ] Add OAuth provider configuration
- [ ] Implement session management improvements
- [ ] Add CSRF protection

---

## 🟢 Low Priority (P2)

### Frontend Improvements
- [ ] Resolve frontend build issues (MIME type errors)
- [ ] Improve UI/UX consistency
- [ ] Add loading states and skeleton screens
- [ ] Implement dark mode
- [ ] Add accessibility features (ARIA labels, keyboard navigation)

### Storage & Persistence
- [ ] Fix deck save API errors
- [ ] Implement deck versioning
- [ ] Add export/import functionality (JSON, CSV, Anki format)
- [ ] Implement cloud sync for decks and progress

### Study Features
- [ ] Add spaced repetition algorithm (SM-2 or similar)
- [ ] Implement study statistics and analytics
- [ ] Add study streak tracking
- [ ] Create study reminders and notifications
- [ ] Add collaborative study sessions

### Production & Deployment
- [ ] Complete production logging silencing
- [ ] Add monitoring and alerting (Sentry, etc.)
- [ ] Set up CI/CD pipeline
- [ ] Add automated E2E tests in CI
- [ ] Configure CDN for static assets
- [ ] Add database migrations system

---

## 🔧 Technical Debt

### Code Quality
- [ ] Resolve all TypeScript linting errors
  - [ ] Fix unused imports
  - [ ] Fix `any` types
  - [ ] Add proper type definitions
- [ ] Add JSDoc comments to public APIs
- [ ] Refactor large files (>500 lines)
- [ ] Remove deprecated code

### Testing
- [ ] Increase unit test coverage to 90%+
- [ ] Add integration tests for all services
- [ ] Fix flaky E2E tests
- [ ] Add performance regression tests
- [ ] Implement visual regression testing

### Documentation
- [ ] Update API documentation
- [ ] Add architecture decision records (ADRs)
- [ ] Create developer onboarding guide
- [ ] Document deployment process
- [ ] Add troubleshooting guide

---

## 🎯 Feature Ideas (Backlog)

### AI & Generation
- [ ] Support multiple LLM providers (OpenAI, Anthropic, etc.)
- [ ] Add custom prompt templates
- [ ] Implement AI-powered study recommendations
- [ ] Add context-aware hint generation
- [ ] Support image-based flashcards

### Social & Collaboration
- [ ] User profiles and achievements
- [ ] Share decks with other users
- [ ] Community deck marketplace
- [ ] Study groups and leaderboards
- [ ] Discussion forums per topic

### Advanced Features
- [ ] Voice recording for pronunciation practice
- [ ] Handwriting recognition for language learning
- [ ] Augmented reality flashcard mode
- [ ] Gamification (XP, levels, badges)
- [ ] Integration with note-taking apps (Notion, Obsidian)

### Platform Expansion
- [ ] Desktop app (Electron)
- [ ] Browser extension
- [ ] API for third-party integrations
- [ ] Webhook support
- [ ] Zapier integration

---

## 📝 Completed Features ✅

### Recent Completions (December 2025)
- [x] **Backend Robustness Fixes**
  - [x] Fix getAdapter "Not implemented" errors
  - [x] Disable background tasks in tests
  - [x] Implement network request cleanup (AbortController, no keep-alive)
  - [x] Add shutdown() method for resource cleanup
  - [x] Add Upstash Vector service graceful degradation
  - [x] Update all tests with proper teardown
- [x] Quiz timer functionality
- [x] MCP (Model Context Protocol) integration
- [x] Hybrid adapters with fallback mechanisms
- [x] Singleton AuthService pattern
- [x] Runtime preference (Ollama/WebLLM) with automatic fallback
- [x] Flashcard output validation and repair

### Historical Completions
- [x] Basic flashcard generation (AI-only, web-only, hybrid)
- [x] Multi-source web scraping
- [x] PDF and image file processing
- [x] Quiz generation and history
- [x] Deck management
- [x] GraphQL API (Phases 1-4)
- [x] Express REST API
- [x] Supabase integration
- [x] Redis caching
- [x] BullMQ job queue
- [x] Swagger documentation
- [x] Google OAuth authentication

---

## 🗓️ Version Planning

### v1.1 (Next Release) - Mobile & Polish
**Target:** Q1 2025
- Mobile app (iOS + Android)
- Quiz UI refinements
- WebLLM offline mode fixes
- GraphQL optimizations

### v1.2 - Social & Analytics
**Target:** Q2 2025
- User profiles
- Deck sharing
- Study analytics
- Performance dashboard

### v2.0 - Platform Expansion
**Target:** Q3 2025
- Desktop app
- Browser extension
- Advanced AI features
- Third-party integrations

---

## 📊 Metrics & Goals

### Technical Metrics
- Test coverage: **Current ~75%** → Goal: **90%+**
- API response time: **Current ~500ms** → Goal: **<200ms**
- Uptime: **Current 99.5%** → Goal: **99.9%**

### Product Metrics
- Daily active users: **TBD**
- Flashcards generated per day: **TBD**
- User retention (30-day): **TBD**

---

**Last Updated:** 2025-12-07  
**Maintained by:** Development Team