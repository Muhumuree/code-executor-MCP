import { promises as fs } from 'fs';
import * as path from 'path';
import AsyncLock from 'async-lock';
import { FileSystemService } from '../utils/filesystem.js';

/**
 * Configuration file manager for CLI operations.
 *
 * Provides:
 * - Atomic config file writes (temp file + rename)
 * - Backup creation with timestamps
 * - Field merging (preserves unknown fields)
 * - AsyncLock protection for concurrent writes
 * - Path validation (prevents traversal attacks)
 *
 * Constitutional Compliance:
 * - Principle 2 (Security): Path validation via FileSystemService
 * - Principle 5 (SOLID): SRP = config file I/O only, NOT validation logic
 * - Principle 6 (Concurrency): AsyncLock protects concurrent writes
 */
export class ConfigManager {
  private fsService: FileSystemService;
  private writeLock: AsyncLock;

  constructor() {
    this.fsService = new FileSystemService();
    this.writeLock = new AsyncLock();
  }

  /**
   * Read configuration file
   *
   * @param configPath - Path to config file
   * @returns Parsed config object, or null if file doesn't exist
   * @throws Error if file exists but contains invalid JSON
   */
  async readConfig(configPath: string): Promise<Record<string, any> | null> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error; // Invalid JSON or other error
    }
  }

  /**
   * Write configuration file atomically
   *
   * Uses temp file + atomic rename to prevent corruption.
   * Optionally creates timestamped backup before overwriting.
   *
   * @param configPath - Path to config file
   * @param config - Configuration object to write
   * @param options - Write options (backup creation, allowed roots)
   */
  async writeConfig(
    configPath: string,
    config: Record<string, any>,
    options: { createBackup?: boolean; allowedRoots?: string[] } = {}
  ): Promise<void> {
    await this.writeLock.acquire('config-write', async () => {
      await this.writeConfigInternal(configPath, config, options);
    });
  }

  /**
   * Internal write logic (no lock - caller must acquire)
   */
  private async writeConfigInternal(
    configPath: string,
    config: Record<string, any>,
    options: { createBackup?: boolean; allowedRoots?: string[] } = {}
  ): Promise<void> {
    const { createBackup = false, allowedRoots = [] } = options;

    // Validate path if allowed roots specified
    if (allowedRoots.length > 0) {
      const isAllowed = await this.fsService.isPathAllowed(configPath, allowedRoots);
      if (!isAllowed) {
        throw new Error(`Path not allowed: ${configPath}`);
      }
    }

    // Create parent directory if needed
    await fs.mkdir(path.dirname(configPath), { recursive: true });

    // Create simple backup if requested
    if (createBackup) {
      try {
        await fs.access(configPath);
        const backupPath = `${configPath}.backup`;
        await fs.copyFile(configPath, backupPath);
      } catch {
        // File doesn't exist - no backup needed
      }
    }

    // Write to temp file first
    const tempPath = `${configPath}.tmp`;
    const jsonContent = JSON.stringify(config, null, 2) + '\n';
    await fs.writeFile(tempPath, jsonContent, 'utf-8');

    // Atomic rename (atomic on all modern filesystems)
    await fs.rename(tempPath, configPath);
  }

  /**
   * Update configuration file (merge with existing)
   *
   * Reads existing config, merges updates, writes atomically.
   * Preserves unknown fields (defensive programming).
   *
   * @param configPath - Path to config file
   * @param updates - Partial config to merge
   * @param options - Update options (backup creation)
   */
  async updateConfig(
    configPath: string,
    updates: Record<string, any>,
    options: { createBackup?: boolean; allowedRoots?: string[] } = {}
  ): Promise<void> {
    await this.writeLock.acquire('config-write', async () => {
      // Read existing config
      const existing = await this.readConfig(configPath) || {};

      // Deep merge (preserves nested fields)
      const merged = this.deepMerge(existing, updates);

      // Write merged config (use internal method to avoid deadlock)
      await this.writeConfigInternal(configPath, merged, options);
    });
  }

  /**
   * Create timestamped backup of config file
   *
   * Backup format: <original>.backup-YYYY-MM-DDTHH-MM-SS
   *
   * @param configPath - Path to config file to backup
   * @returns Backup file path, or null if source doesn't exist
   */
  async backupConfig(configPath: string): Promise<string | null> {
    try {
      await fs.access(configPath);

      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const backupPath = `${configPath}.backup-${timestamp}`;

      await fs.copyFile(configPath, backupPath);
      return backupPath;
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return null; // Source file doesn't exist
      }
      throw error;
    }
  }

  /**
   * Deep merge two objects (recursive)
   *
   * Preserves fields from both objects.
   * Right side (updates) takes precedence on conflicts.
   *
   * @param target - Base object
   * @param source - Updates to merge
   * @returns Merged object
   */
  private deepMerge(
    target: Record<string, any>,
    source: Record<string, any>
  ): Record<string, any> {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        // Recursive merge for nested objects
        result[key] = this.deepMerge(
          result[key] && typeof result[key] === 'object' ? result[key] : {},
          source[key]
        );
      } else {
        // Direct assignment for primitives and arrays
        result[key] = source[key];
      }
    }

    return result;
  }
}
