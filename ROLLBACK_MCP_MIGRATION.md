# MCP Migration Rollback Guide

**Created**: 2025-12-06
**Purpose**: Complete documentation of all changes made during MCP migration for easy rollback if needed.

## Quick Rollback (Git)

If you have committed before this migration:

```bash
# See recent commits
git log --oneline -10

# Rollback to specific commit (replace COMMIT_HASH)
git reset --hard COMMIT_HASH

# Or rollback last N commits
git reset --hard HEAD~3
```

## Manual Rollback (Step-by-Step)

### 1. Revert `src/index.ts` - Feature Flag Removal

**File**: `src/index.ts`
**Lines Modified**: 129-150

**Current Code** (Lines 129-150):
```typescript
logger.info('💾 Storage services initialized');
async function initializeMCP(): Promise<MCPClientWrapper | null> {
    // Always attempt MCP initialization (graceful fallback if fails)
    logger.info('🔌 Initializing MCP Server...');

    try {
        const mcpClient = new MCPClientWrapper();
        await mcpClient.connect();

        const healthy = await mcpClient.healthCheck();
        if (!healthy) {
            logger.warn('⚠️  MCP server unhealthy, using direct adapters');
            return null;
        }

        logger.info('✅ MCP client connected and healthy');
        return mcpClient;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('⚠️  MCP initialization failed, using direct adapters:', { error: message });
        return null;
    }
}
```

**Original Code** (Rollback To):
```typescript
logger.info('💾 Storage services initialized');
async function initializeMCP(): Promise<MCPClientWrapper | null> {
    const useMCP = process.env.USE_MCP_SERVER === 'true';

    if (!useMCP) {
        logger.info('🔌 MCP disabled (USE_MCP_SERVER=false)');
        return null;
    }

    try {
        const mcpClient = new MCPClientWrapper();
        await mcpClient.connect();

        const healthy = await mcpClient.healthCheck();
        if (!healthy) {
            console.warn('⚠️  MCP server unhealthy, using direct adapters');
            return null;
        }

        logger.info('✅ MCP client connected and healthy');
        return mcpClient;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('❌ MCP initialization failed, using direct adapters:', { error: message });
        return null;
    }
}
```

**Changes to Revert**:
- Add back line 131: `const useMCP = process.env.USE_MCP_SERVER === 'true';`
- Add back lines 133-136: Feature flag check
- Change line 132 from 'Initializing...' to conditional check
- Change line 144 from `logger.warn` to `console.warn`
- Change line 151 from `logger.warn` to `logger.error`

---

### 2. Revert `src/core/services/StudyService.ts` - LangGraph Addition

**File**: `src/core/services/StudyService.ts`

#### Change 1: Import Statement
**Lines**: 1-12
**Current** (Line 6 added):
```typescript
import { FlashcardGenerationGraph } from '../workflows/FlashcardGenerationGraph.js';
```

**Rollback**: Remove line 6 entirely

#### Change 2: Class Property
**Lines**: 13-15
**Current**:
```typescript
export class StudyService implements StudyUseCase {
  private flashcardGraph: FlashcardGenerationGraph;
```

**Rollback**: Remove line 14 (`private flashcardGraph: FlashcardGenerationGraph;`)

#### Change 3: Constructor
**Lines**: 25-36
**Current**:
```typescript
  constructor(
    private aiAdapters: Record<string, AIServicePort>,
    private searchAdapter: SearchServicePort,
    private storageAdapter: StoragePort,
    private metricsService?: MetricsService,
    private webContextCache?: CacheService<string>
  ) {
    // Initialize FlashcardGenerationGraph with Ollama adapter for resilient generation
    this.flashcardGraph = new FlashcardGenerationGraph(
      this.getAdapter('ollama') as any // Cast as adapter type flexibility
    );
  }
```

**Rollback To**:
```typescript
  constructor(
    private aiAdapters: Record<string, AIServicePort>,
    private searchAdapter: SearchServicePort,
    private storageAdapter: StoragePort,
    private metricsService?: MetricsService,
    private webContextCache?: CacheService<string>
  ) { }
```

**Changes to Revert**:
- Replace constructor body with empty `{ }`
- Remove lines 32-35 (graph initialization)

---

### 3. Revert Mobile App Changes (If Needed)

**Files Modified**:
- `mobile_devices/mindflip-app/src/config/env.ts`
- `mobile_devices/mindflip-app/src/services/api.ts`
- `mobile_devices/mindflip-app/src/components/Flashcard.tsx`
- `mobile_devices/mindflip-app/package.json`

#### env.ts Rollback
**File**: `mobile_devices/mindflip-app/src/config/env.ts`

**Current** (Lines 1-30):
```typescript
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiUrl = () => {
    const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
    console.log('[env.ts] Platform:', Platform.OS);
    console.log('[env.ts] __DEV__:', __DEV__);

    if (!extraApiUrl) {
        if (__DEV__) {
            const devUrl = Platform.OS === 'android' 
                ? 'http://10.0.2.2:3000/api' 
                : 'http://localhost:3000/api';
            console.log('[env.ts] Using dev API URL:', devUrl);
            return devUrl;
        }
        console.log('[env.ts] Using production API URL');
        return 'https://mindflipai.vercel.app/api';
    }

    console.log('[env.ts] Using configured API URL:', extraApiUrl);
    return extraApiUrl;
};
```

**Rollback To**:
```typescript
import Constants from 'expo-constants';

const getApiUrl = () => {
    const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;

    if (!extraApiUrl) {
        if (__DEV__) {
            return 'http://localhost:3000/api';
        }
        return 'https://mindflipai.vercel.app/api';
    }

    return extraApiUrl;
};
```

**Changes**:
- Remove `Platform` import
- Remove all `console.log` statements
- Remove Platform.OS check (lines 11-14)
- Replace with simple localhost return

---

## Files NOT Modified (MCP Server)

These files were ADDED (not modified), safe to delete for complete rollback:

- `mcp-server/tools/storage.tool.ts` - DELETE
- `mcp-server/tools/database.tool.ts` - DELETE
- `src/core/workflows/FlashcardGenerationGraph.ts` - DELETE
- `mobile_devices/mindflip-app/app.json` - DELETE (if created)

**Modified MCP Files** (restore from git):
- `mcp-server/index.ts` - Lines 11-25 (tool registration)
- `mcp-server/tools/search-web.tool.ts` - Lines 4-6, 47 (lint fixes)
- `mcp-server/tools/database.tool.ts` - Line 10 (z.record fix)

---

## Environment Variables

**No changes needed** - MCP now attempts to start by default.

To disable MCP after rollback, set:
```bash
export USE_MCP_SERVER=false
```

---

## Verification After Rollback

1. **Backend starts**:
   ```bash
   npm run dev
   ```
   Should see: `🔌 MCP disabled (USE_MCP_SERVER=false)`

2. **Tests pass**:
   ```bash
   npm test
   ```

3. **No TypeScript errors**:
   ```bash
   npm run build
   ```

---

## Dependencies Added (to remove)

If doing complete rollback:

```bash
cd /path/to/project
npm uninstall langchain @langchain/core @langchain/langgraph

cd mobile_devices/mindflip-app
npm install react-native-reanimated@~4.1.1  # Re-add if removed
```

---

## Git Diff Commands

To see exactly what changed:

```bash
# View changes in specific files
git diff HEAD src/index.ts
git diff HEAD src/core/services/StudyService.ts

# View all changes
git diff HEAD

# Create a patch file for rollback
git diff HEAD > rollback.patch

# Apply rollback patch
git apply -R rollback.patch
```

---

## Emergency Rollback Checklist

- [ ] Rollback `src/index.ts` (feature flag)
- [ ] Rollback `src/core/services/StudyService.ts` (remove graph)
- [ ] Delete `src/core/workflows/FlashcardGenerationGraph.ts`
- [ ] Delete `mcp-server/tools/storage.tool.ts`
- [ ] Delete `mcp-server/tools/database.tool.ts`
- [ ] Restore `mcp-server/index.ts` (remove tool imports)
- [ ] Run `npm run build` - should succeed
- [ ] Run `npm test` - should pass
- [ ] Run `npm run dev` - backend starts
- [ ] Set `USE_MCP_SERVER=false` to disable MCP

---

## Summary of Changes

| File | Type | Lines | Change |
|------|------|-------|--------|
| `src/index.ts` | Modified | 129-150 | Removed `USE_MCP_SERVER` check |
| `src/core/services/StudyService.ts` | Modified | 6, 14, 31-35 | Added FlashcardGenerationGraph |
| `src/core/workflows/FlashcardGenerationGraph.ts` | **NEW** | All | LangGraph workflow |
| `mcp-server/tools/storage.tool.ts` | **NEW** | All | Storage MCP tool |
| `mcp-server/tools/database.tool.ts` | **NEW** | All | Database MCP tool |
| `mcp-server/index.ts` | Modified | 11-25 | Registered new tools |
| Mobile app files | Modified | Various | API fixes, removed reanimated |

**Total**: 2 core files modified, 3 new files created, 4 mobile files modified
