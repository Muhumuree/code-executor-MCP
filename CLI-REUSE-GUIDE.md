# CLI Reuse Guide - Code Executor MCP

Quick reference for reusing codebase functionality in CLI implementation.

---

## TL;DR - What's Available

| Need | Where | Reuse | Effort |
|------|-------|-------|--------|
| **Read config files** | `src/config-discovery.ts` | Direct | 5 min |
| **Validate paths** | `src/utils.ts:isAllowedPath()` | Direct | 5 min |
| **Write audit logs** | `src/audit-logger.ts` | Direct | 10 min |
| **Backup configs** | ❌ Missing | Build | 30 min |
| **PID locking** | ❌ Missing | Build | 45 min |
| **Write config files** | Partial (read exists) | Adapt | 20 min |

---

## Quick Copy-Paste Solutions

### Solution 1: Use ConfigDiscoveryService Directly

```typescript
// cli/config-manager.ts
import { ConfigDiscoveryService } from '../src/config-discovery';

export const configManager = new ConfigDiscoveryService();

// Usage
async function loadConfig() {
  const config = await configManager.findConfig();
  console.log(`Allowed read paths: ${config.security?.allowRead}`);
}
```

**What you get**:
- ✅ Multi-source config discovery (project → user → defaults)
- ✅ Environment variable overrides
- ✅ Zod validation
- ✅ Cache management
- ❌ No write capability (limitation)

**Files needed**:
- `src/config-discovery.ts` (copy)
- `src/config-types.ts` (copy - has Zod schemas)

---

### Solution 2: Use AuditLogger Directly

```typescript
// cli/audit.ts
import { AuditLogger } from '../src/audit-logger';

const auditLog = new AuditLogger({
  logDir: '~/.code-executor/audit-logs',
  retentionDays: 30,
});

// Log CLI operations
async function logCommand(command: string, success: boolean) {
  await auditLog.log({
    timestamp: new Date().toISOString(),
    correlationId: `cli-${Date.now()}`,
    eventType: 'tool_call',
    status: success ? 'success' : 'failure',
    metadata: { command },
  });
}
```

**What you get**:
- ✅ Daily log rotation (YYYY-MM-DD format)
- ✅ 30-day retention (configurable)
- ✅ JSONL format (streaming-friendly)
- ✅ Thread-safe (AsyncLock protected)
- ✅ Automatic cleanup

**Files needed**:
- `src/audit-logger.ts` (copy)
- `src/interfaces/audit-logger.ts` (copy - has interfaces)
- Dependency: `async-lock` (already in package.json)

---

### Solution 3: Path Validation

```typescript
// cli/path-validator.ts
import { isAllowedPath } from '../src/utils';

async function validatePath(userPath: string, allowedRoots: string[]) {
  const isValid = await isAllowedPath(userPath, allowedRoots);
  if (!isValid) {
    throw new Error(`Path not allowed: ${userPath}`);
  }
}

// Usage
await validatePath('/home/user/config.json', ['/home/user']);  // ✅
await validatePath('/etc/passwd', ['/home/user']);              // ❌
```

**What you get**:
- ✅ Symlink resolution (prevents escapes)
- ✅ Path canonicalization
- ✅ Works with `../../../` attacks
- ✅ Gracefully handles non-existent paths

**Files needed**:
- `src/utils.ts` (copy - includes isAllowedPath + helpers)

---

## Building What's Missing

### Missing 1: Config File Write (Atomic + Backup)

**Location**: Create `cli/config-writer.ts`

```typescript
import { promises as fs } from 'fs';
import * as path from 'path';
import type { PartialConfig } from '../src/config-types';

export class ConfigWriter {
  /**
   * Write config file atomically with backup
   *
   * 1. Backup existing file (if exists)
   * 2. Write to temp file
   * 3. Atomic rename to target
   */
  async writeConfig(
    filePath: string,
    config: PartialConfig,
    createBackup: boolean = true
  ): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const backupPath = `${absolutePath}.backup`;
    const tempPath = `${absolutePath}.tmp`;

    // Step 1: Create backup of existing file
    if (createBackup) {
      try {
        await fs.copyFile(absolutePath, backupPath);
        console.log(`✓ Backed up existing config to ${backupPath}`);
      } catch (error) {
        // File doesn't exist (first write) - not an error
      }
    }

    // Step 2: Write to temp file first
    const jsonPayload = JSON.stringify(config, null, 2);
    await fs.writeFile(tempPath, jsonPayload, 'utf-8');

    // Step 3: Atomic rename (atomic on all modern filesystems)
    await fs.rename(tempPath, absolutePath);
    console.log(`✓ Wrote config to ${absolutePath}`);
  }

  /**
   * Restore config from backup
   */
  async restoreBackup(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    const backupPath = `${absolutePath}.backup`;

    try {
      await fs.copyFile(backupPath, absolutePath);
      console.log(`✓ Restored config from backup`);
    } catch (error) {
      throw new Error(`No backup found: ${backupPath}`);
    }
  }
}
```

**Usage**:
```typescript
const writer = new ConfigWriter();
await writer.writeConfig('.code-executor.json', config);
```

---

### Missing 2: PID-Based Locking

**Location**: Create `cli/pid-lock.ts`

```typescript
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export class PIDLock {
  private lockPath: string;
  private timeout: number;

  constructor(
    lockFile: string = path.join(os.homedir(), '.code-executor', '.lock'),
    timeoutMs: number = 1000 * 60 * 60  // 1 hour default
  ) {
    this.lockPath = lockFile;
    this.timeout = timeoutMs;
  }

  /**
   * Acquire lock (blocks if held by running process)
   */
  async acquire(): Promise<void> {
    const startTime = Date.now();

    while (true) {
      try {
        // Try to create lock atomically
        await fs.mkdir(path.dirname(this.lockPath), { recursive: true });
        await fs.writeFile(
          this.lockPath,
          `${process.pid}\n${Date.now()}`,
          'utf-8'
        );
        return;  // ✅ Lock acquired
      } catch (error) {
        // Lock exists - check if process is still running
        try {
          const content = await fs.readFile(this.lockPath, 'utf-8');
          const [pid, timestamp] = content.trim().split('\n');
          const pidNum = parseInt(pid, 10);
          const timeMs = parseInt(timestamp, 10);

          // Check if lock is stale (older than timeout)
          if (Date.now() - timeMs > this.timeout) {
            console.warn(`⚠️  Removing stale lock (${this.timeout / 1000}s old)`);
            await this.release();
            continue;  // Retry
          }

          // Check if process still exists
          if (!this.processExists(pidNum)) {
            console.warn(`✓ Lock process ${pidNum} no longer running, removing lock`);
            await this.release();
            continue;  // Retry
          }

          // Process still running - wait and retry
          if (Date.now() - startTime > 5000) {
            throw new Error(
              `Lock held by process ${pidNum} (${(Date.now() - startTime) / 1000}s)`
            );
          }

          await this.sleep(100);
        } catch (readError) {
          // Lock file corrupted - remove it
          await this.release();
          continue;  // Retry
        }
      }
    }
  }

  /**
   * Release lock
   */
  async release(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch {
      // Already released or doesn't exist
    }
  }

  private processExists(pid: number): boolean {
    try {
      process.kill(pid, 0);  // Signal 0 = check existence only
      return true;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: acquire lock for duration of callback (auto-release)
   */
  async withLock<T>(callback: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await callback();
    } finally {
      await this.release();
    }
  }
}
```

**Usage**:
```typescript
const lock = new PIDLock();

// Simple acquire/release
await lock.acquire();
try {
  // Do work...
} finally {
  await lock.release();
}

// Or use helper
await lock.withLock(async () => {
  // Do work - auto-released
});
```

---

## Integration Pattern

```typescript
// cli/cli.ts (main CLI entry point)
import { ConfigDiscoveryService } from '../src/config-discovery';
import { AuditLogger } from '../src/audit-logger';
import { ConfigWriter } from './config-writer';
import { PIDLock } from './pid-lock';

class CLIManager {
  private configDiscovery: ConfigDiscoveryService;
  private auditLogger: AuditLogger;
  private configWriter: ConfigWriter;
  private pidLock: PIDLock;

  constructor() {
    this.configDiscovery = new ConfigDiscoveryService();
    this.auditLogger = new AuditLogger();
    this.configWriter = new ConfigWriter();
    this.pidLock = new PIDLock();
  }

  async runCommand(command: string, args: unknown): Promise<void> {
    await this.pidLock.withLock(async () => {
      const startTime = Date.now();
      let success = false;

      try {
        const config = await this.configDiscovery.findConfig();

        // Execute command...
        success = true;
      } catch (error) {
        console.error(`✗ Command failed: ${error.message}`);
        success = false;
        throw error;
      } finally {
        // Log to audit trail
        await this.auditLogger.log({
          timestamp: new Date().toISOString(),
          correlationId: `cli-${process.pid}-${startTime}`,
          eventType: 'tool_call',
          status: success ? 'success' : 'failure',
          latencyMs: Date.now() - startTime,
          metadata: { command, args },
        });
      }
    });
  }
}
```

---

## File Copy Checklist

### MUST COPY (Direct Reuse)
- [ ] `src/audit-logger.ts`
- [ ] `src/interfaces/audit-logger.ts`
- [ ] `src/config-discovery.ts`
- [ ] `src/config-types.ts`
- [ ] `src/utils.ts` (at least `isAllowedPath`, `normalizeError`)

### RECOMMENDED COPY (Reference)
- [ ] `src/security.ts` (path validation patterns)
- [ ] `src/schema-cache.ts` (AsyncLock usage examples)

### BUILD NEW (CLI-Specific)
- [ ] `cli/config-writer.ts` (see above)
- [ ] `cli/pid-lock.ts` (see above)
- [ ] `cli/cli-manager.ts` (integration)

---

## Dependencies Needed

Add to `package.json`:
```json
{
  "dependencies": {
    "async-lock": "^1.4.1",
    "zod": "^3.x.x"
  },
  "devDependencies": {
    "@types/node": "^22.x.x"
  }
}
```

These are already in the monorepo, so just reference them.

---

## Testing Strategy

```typescript
// cli/__tests__/integration.test.ts
describe('CLI Integration', () => {
  it('should acquire and release lock', async () => {
    const lock = new PIDLock();
    await lock.acquire();
    expect(fs.existsSync(lockPath)).toBe(true);
    await lock.release();
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('should read config from discovery service', async () => {
    const config = await configDiscovery.findConfig();
    expect(config).toBeDefined();
    expect(config.version).toBe(1);
  });

  it('should write config atomically', async () => {
    const writer = new ConfigWriter();
    const testConfig = { version: 1 };
    await writer.writeConfig(testPath, testConfig);

    const written = await fs.readFile(testPath, 'utf-8');
    expect(JSON.parse(written)).toEqual(testConfig);
  });
});
```

---

## Gotchas & Tips

1. **AsyncLock is NOT inter-process** - Use PID-based locking for cross-process safety
2. **Path validation is ASYNC** - Remember to `await isAllowedPath()`
3. **Config is cached** - Call `configDiscovery.clearCache()` if needed
4. **Audit logs are immutable** - Append-only, can't modify existing entries
5. **JSONL format** - One object per line, no array wrapper
6. **Symlinks** - `isAllowedPath()` resolves them automatically
7. **Backup timing** - Create backup BEFORE writing (in case write fails midway)

---

## Reference: Exact File Locations

All files are in the code-executor-mcp repository at:

```
/home/alexandrueremia/projects/code-executor-mcp/
├── src/
│   ├── audit-logger.ts          ← Copy this
│   ├── config-discovery.ts      ← Copy this
│   ├── config-types.ts          ← Copy this
│   ├── config.ts                ← Reference
│   ├── security.ts              ← Reference
│   ├── utils.ts                 ← Copy this
│   └── interfaces/
│       └── audit-logger.ts      ← Copy this
```

---

**Last Updated**: 2025-11-18
**Status**: Ready for CLI implementation
