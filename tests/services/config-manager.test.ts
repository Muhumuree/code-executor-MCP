import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../../src/services/config-manager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `config-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    testConfigPath = path.join(testDir, '.mcp.json');
    configManager = new ConfigManager();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('readConfig', () => {
    it('should_readConfig_when_fileExists', async () => {
      const testConfig = {
        mcpServers: {
          filesystem: {
            command: 'node',
            args: ['dist/index.js']
          }
        }
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2), 'utf-8');

      const config = await configManager.readConfig(testConfigPath);

      expect(config).toEqual(testConfig);
    });

    it('should_returnNull_when_fileDoesNotExist', async () => {
      const nonExistent = path.join(testDir, 'missing.json');

      const config = await configManager.readConfig(nonExistent);

      expect(config).toBeNull();
    });

    it('should_throwError_when_invalidJSON', async () => {
      await fs.writeFile(testConfigPath, 'invalid json{', 'utf-8');

      await expect(configManager.readConfig(testConfigPath))
        .rejects.toThrow(/Unexpected token/);
    });
  });

  describe('writeConfig', () => {
    it('should_writeConfig_when_validDataProvided', async () => {
      const testConfig = {
        mcpServers: {
          zen: {
            command: 'node',
            args: ['zen.js']
          }
        }
      };

      await configManager.writeConfig(testConfigPath, testConfig);

      const written = await fs.readFile(testConfigPath, 'utf-8');
      expect(JSON.parse(written)).toEqual(testConfig);
    });

    it('should_createBackup_when_fileAlreadyExists', async () => {
      const originalConfig = { version: 1 };
      await fs.writeFile(testConfigPath, JSON.stringify(originalConfig), 'utf-8');

      const newConfig = { version: 2 };
      await configManager.writeConfig(testConfigPath, newConfig, { createBackup: true });

      // Verify backup was created
      const backupPath = `${testConfigPath}.backup`;
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      expect(JSON.parse(backupContent)).toEqual(originalConfig);

      // Verify new config was written
      const newContent = await fs.readFile(testConfigPath, 'utf-8');
      expect(JSON.parse(newContent)).toEqual(newConfig);
    });

    it('should_notCreateBackup_when_backupDisabled', async () => {
      const originalConfig = { version: 1 };
      await fs.writeFile(testConfigPath, JSON.stringify(originalConfig), 'utf-8');

      const newConfig = { version: 2 };
      await configManager.writeConfig(testConfigPath, newConfig, { createBackup: false });

      // Verify no backup was created
      const backupPath = `${testConfigPath}.backup`;
      await expect(fs.access(backupPath)).rejects.toThrow();
    });

    it('should_writeAtomically_when_multipleWritesConcurrent', async () => {
      const configs = Array.from({ length: 10 }, (_, i) => ({ version: i }));

      // Concurrent writes
      const writes = configs.map(config =>
        configManager.writeConfig(testConfigPath, config, { createBackup: false })
      );

      await Promise.all(writes);

      // Verify file is valid JSON (not corrupted)
      const finalContent = await fs.readFile(testConfigPath, 'utf-8');
      const parsed = JSON.parse(finalContent);
      expect(parsed).toHaveProperty('version');
      expect(typeof parsed.version).toBe('number');
    });
  });

  describe('updateConfig', () => {
    it('should_mergeFields_when_updatingExisting', async () => {
      const existingConfig = {
        mcpServers: {
          filesystem: { command: 'node' }
        },
        customField: 'preserve-me'
      };

      await fs.writeFile(testConfigPath, JSON.stringify(existingConfig), 'utf-8');

      const updates = {
        mcpServers: {
          zen: { command: 'python' }
        }
      };

      await configManager.updateConfig(testConfigPath, updates);

      const result = await fs.readFile(testConfigPath, 'utf-8');
      const parsed = JSON.parse(result);

      // Verify merge (both servers present)
      expect(parsed.mcpServers).toHaveProperty('filesystem');
      expect(parsed.mcpServers).toHaveProperty('zen');

      // Verify unknown fields preserved
      expect(parsed.customField).toBe('preserve-me');
    });

    it('should_createFile_when_configDoesNotExist', async () => {
      const newConfig = {
        mcpServers: {
          filesystem: { command: 'node' }
        }
      };

      await configManager.updateConfig(testConfigPath, newConfig);

      const written = await fs.readFile(testConfigPath, 'utf-8');
      expect(JSON.parse(written)).toEqual(newConfig);
    });
  });

  describe('backupConfig', () => {
    it('should_createTimestampedBackup_when_fileExists', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:30:00Z'));

      const testConfig = { version: 1 };
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig), 'utf-8');

      const backupPath = await configManager.backupConfig(testConfigPath);

      expect(backupPath).toMatch(/\.backup-2025-01-15T10-30-00/);

      const backupContent = await fs.readFile(backupPath, 'utf-8');
      expect(JSON.parse(backupContent)).toEqual(testConfig);

      vi.useRealTimers();
    });

    it('should_returnNull_when_fileDoesNotExist', async () => {
      const nonExistent = path.join(testDir, 'missing.json');

      const backupPath = await configManager.backupConfig(nonExistent);

      expect(backupPath).toBeNull();
    });
  });

  describe('concurrency', () => {
    it('should_preventCorruption_when_concurrentWrites', async () => {
      // 10 concurrent updates
      const updates = Array.from({ length: 10 }, (_, i) => ({
        key: `value-${i}`
      }));

      const writes = updates.map(update =>
        configManager.writeConfig(testConfigPath, update, { createBackup: false })
      );

      await Promise.all(writes);

      // Verify file is valid JSON
      const content = await fs.readFile(testConfigPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty('key');
    });
  });

  describe('security', () => {
    it('should_preventPathTraversal_when_maliciousPathProvided', async () => {
      const maliciousPath = path.join(testDir, '..', '..', 'etc', 'passwd');

      await expect(
        configManager.writeConfig(maliciousPath, {}, { allowedRoots: [testDir] })
      ).rejects.toThrow(/Path not allowed/);
    });
  });
});
