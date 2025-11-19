/**
 * ToolDetector Service Tests
 *
 * **TDD PHASE:** RED (Failing Tests)
 * **COVERAGE TARGET:** 90%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolDetector } from '../../src/cli/tool-detector.js';
import { AI_TOOL_REGISTRY, type AIToolMetadata } from '../../src/cli/tool-registry.js';

// Mock fs/promises module
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  constants: {
    R_OK: 4,
  },
}));

// Import mocked module
import * as fs from 'node:fs/promises';

describe('ToolDetector', () => {
  let toolDetector: ToolDetector;

  beforeEach(() => {
    toolDetector = new ToolDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectInstalledTools', () => {
    it('should_returnEmptyArray_when_noToolsInstalled', async () => {
      // Mock fs.access to throw for all paths (no tools installed)
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await toolDetector.detectInstalledTools();

      expect(result).toEqual([]);
    });

    it('should_returnInstalledTools_when_configFilesExist', async () => {
      // Mock fs.access to succeed only for Claude Code (case-insensitive matching)
      vi.mocked(fs.access).mockImplementation(async (path: any) => {
        const pathStr = path.toString().toLowerCase();
        if (pathStr.includes('claude')) {
          return; // Success
        }
        throw new Error('ENOENT'); // File not found
      });

      const result = await toolDetector.detectInstalledTools();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('claude-code');
      expect(result[0].name).toBe('Claude Code');
    });

    it('should_returnMultipleTools_when_multipleConfigsExist', async () => {
      // Mock fs.access to succeed for Claude Code and Cursor (case-insensitive)
      vi.mocked(fs.access).mockImplementation(async (path: any) => {
        const pathStr = path.toString().toLowerCase();
        if (pathStr.includes('claude') || pathStr.includes('cursor')) {
          return; // Success
        }
        throw new Error('ENOENT');
      });

      const result = await toolDetector.detectInstalledTools();

      expect(result.length).toBeGreaterThanOrEqual(2);
      const ids = result.map(t => t.id);
      expect(ids).toContain('claude-code');
      expect(ids).toContain('cursor');
    });

    it('should_checkAccessPermission_when_validatingConfigPaths', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await toolDetector.detectInstalledTools();

      // Should check access for all tools supported on current platform
      expect(fs.access).toHaveBeenCalled();
      // Verify fs.constants.R_OK (read permission) is used
      const calls = vi.mocked(fs.access).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      calls.forEach(call => {
        expect(call[1]).toBe(fs.constants.R_OK);
      });
    });

    it('should_skipUnsupportedPlatforms_when_detectingTools', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await toolDetector.detectInstalledTools();

      // Should only check paths for current platform
      const checkedPaths = vi.mocked(fs.access).mock.calls.map(call => call[0] as string);

      // All checked paths should be defined (not undefined from unsupported platforms)
      expect(checkedPaths.every(p => p !== undefined)).toBe(true);
    });

    it('should_handlePermissionErrors_when_configFileUnreadable', async () => {
      // Mock fs.access to throw permission error
      vi.mocked(fs.access).mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' }));

      const result = await toolDetector.detectInstalledTools();

      // Should gracefully handle permission errors (treat as not installed)
      expect(result).toEqual([]);
    });

    it('should_parallelizeChecks_when_multipleToolsScanned', async () => {
      let callCount = 0;
      vi.mocked(fs.access).mockImplementation(async () => {
        callCount++;
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('ENOENT');
      });

      const startTime = Date.now();
      await toolDetector.detectInstalledTools();
      const elapsed = Date.now() - startTime;

      // If parallelized, should complete much faster than sequential (10ms * N tools)
      const expectedSequentialTime = callCount * 10;
      expect(elapsed).toBeLessThan(expectedSequentialTime * 0.5); // At least 2x faster
    });

    it('should_returnToolMetadata_when_toolDetected', async () => {
      vi.mocked(fs.access).mockImplementation(async (path: any) => {
        const pathStr = path.toString().toLowerCase();
        if (pathStr.includes('claude')) {
          return;
        }
        throw new Error('ENOENT');
      });

      const result = await toolDetector.detectInstalledTools();

      expect(result[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        configPaths: expect.any(Object),
        website: expect.any(String),
      });
    });
  });

  describe('isToolInstalled', () => {
    it('should_returnTrue_when_configFileExists', async () => {
      const claudeCode = AI_TOOL_REGISTRY.find(t => t.id === 'claude-code')!;
      vi.mocked(fs.access).mockResolvedValue();

      const result = await toolDetector.isToolInstalled(claudeCode);

      expect(result).toBe(true);
    });

    it('should_returnFalse_when_configFileNotFound', async () => {
      const claudeCode = AI_TOOL_REGISTRY.find(t => t.id === 'claude-code')!;
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await toolDetector.isToolInstalled(claudeCode);

      expect(result).toBe(false);
    });

    it('should_returnFalse_when_toolNotSupportedOnPlatform', async () => {
      // Create a mock tool with no config path for current platform
      const mockTool: AIToolMetadata = {
        id: 'test-tool',
        name: 'Test Tool',
        description: 'Test',
        configPaths: {
          // Intentionally empty for current platform
        },
        website: 'https://test.com',
      };

      const result = await toolDetector.isToolInstalled(mockTool);

      expect(result).toBe(false);
    });
  });

  describe('getInstalledToolCount', () => {
    it('should_returnZero_when_noToolsInstalled', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const count = await toolDetector.getInstalledToolCount();

      expect(count).toBe(0);
    });

    it('should_returnCorrectCount_when_multipleToolsInstalled', async () => {
      vi.mocked(fs.access).mockImplementation(async (path: any) => {
        const pathStr = path.toString().toLowerCase();
        if (pathStr.includes('claude') || pathStr.includes('cursor')) {
          return;
        }
        throw new Error('ENOENT');
      });

      const count = await toolDetector.getInstalledToolCount();

      expect(count).toBeGreaterThanOrEqual(2);
    });
  });
});
