/**
 * ModuleFormatDetector Tests - Verify ES Module vs CommonJS detection
 *
 * **TEST STRATEGY:**
 * - TDD approach: Tests written BEFORE implementation
 * - Coverage: package.json "type" field detection (ESM/CommonJS/default)
 * - Edge cases: Missing package.json, malformed JSON, missing "type" field
 * - Mocking: fs.readFile mocked to simulate various package.json scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { ModuleFormatDetector } from '../../src/cli/module-detector.js';

// Mock fs.readFile for all tests
vi.mock('node:fs/promises');

describe('ModuleFormatDetector', () => {
  let detector: ModuleFormatDetector;

  beforeEach(() => {
    detector = new ModuleFormatDetector();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectModuleFormat', () => {
    it('should return "esm" when package.json has "type": "module"', async () => {
      const mockPackageJson = JSON.stringify({ type: 'module', name: 'test-package' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('esm');
      expect(result.source).toBe('package.json');
      expect(fs.readFile).toHaveBeenCalledWith('/fake/path/package.json', 'utf8');
    });

    it('should return "commonjs" when package.json has "type": "commonjs"', async () => {
      const mockPackageJson = JSON.stringify({ type: 'commonjs', name: 'test-package' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('commonjs');
      expect(result.source).toBe('package.json');
    });

    it('should return "commonjs" (default) when package.json is missing "type" field', async () => {
      const mockPackageJson = JSON.stringify({ name: 'test-package', version: '1.0.0' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('commonjs');
      expect(result.source).toBe('package.json (default)');
    });

    it('should return "commonjs" (default) when package.json does not exist', async () => {
      const error = new Error('ENOENT: no such file or directory');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('commonjs');
      expect(result.source).toBe('no package.json (default)');
    });

    it('should throw error when package.json contains invalid JSON', async () => {
      const malformedJson = '{ "name": "test", invalid }';
      vi.mocked(fs.readFile).mockResolvedValue(malformedJson);

      await expect(detector.detectModuleFormat('/fake/path')).rejects.toThrow('Invalid JSON in package.json');
    });

    it('should throw error when package.json "type" field has invalid value', async () => {
      const mockPackageJson = JSON.stringify({ type: 'unknown-format' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      await expect(detector.detectModuleFormat('/fake/path')).rejects.toThrow('Invalid "type" field');
    });

    it('should throw error when package.json is not a valid object', async () => {
      const mockPackageJson = JSON.stringify(['array', 'not', 'object']);
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      await expect(detector.detectModuleFormat('/fake/path')).rejects.toThrow('package.json must be an object');
    });

    it('should handle package.json with null "type" field (default to CommonJS)', async () => {
      const mockPackageJson = JSON.stringify({ type: null, name: 'test-package' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('commonjs');
      expect(result.source).toBe('package.json (default)');
    });

    it('should handle empty package.json (default to CommonJS)', async () => {
      const mockPackageJson = JSON.stringify({});
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('commonjs');
      expect(result.source).toBe('package.json (default)');
    });

    it('should normalize path with trailing slash', async () => {
      const mockPackageJson = JSON.stringify({ type: 'module' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      await detector.detectModuleFormat('/fake/path/');

      expect(fs.readFile).toHaveBeenCalledWith('/fake/path/package.json', 'utf8');
    });

    it('should handle Windows-style paths', async () => {
      const mockPackageJson = JSON.stringify({ type: 'module' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      await detector.detectModuleFormat('C:\\Users\\test\\project');

      expect(fs.readFile).toHaveBeenCalledWith('C:\\Users\\test\\project/package.json', 'utf8');
    });

    it('should throw error on non-ENOENT fs errors', async () => {
      const error = new Error('EACCES: permission denied');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(detector.detectModuleFormat('/fake/path')).rejects.toThrow('EACCES: permission denied');
    });
  });

  describe('isESM', () => {
    it('should return true when detecting ESM format', async () => {
      const mockPackageJson = JSON.stringify({ type: 'module' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.isESM('/fake/path');

      expect(result).toBe(true);
    });

    it('should return false when detecting CommonJS format', async () => {
      const mockPackageJson = JSON.stringify({ type: 'commonjs' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.isESM('/fake/path');

      expect(result).toBe(false);
    });

    it('should return false for default CommonJS (missing package.json)', async () => {
      const error = new Error('ENOENT');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await detector.isESM('/fake/path');

      expect(result).toBe(false);
    });
  });

  describe('getImportSyntax', () => {
    it('should return ESM import syntax when format is ESM', async () => {
      const mockPackageJson = JSON.stringify({ type: 'module' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.getImportSyntax('/fake/path');

      expect(result).toContain('import');
      expect(result).toContain('export');
    });

    it('should return CommonJS require syntax when format is CommonJS', async () => {
      const mockPackageJson = JSON.stringify({ type: 'commonjs' });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.getImportSyntax('/fake/path');

      expect(result).toContain('require');
      expect(result).toContain('module.exports');
    });
  });

  describe('edge cases', () => {
    it('should handle very large package.json files (>1MB)', async () => {
      const largePackageJson = JSON.stringify({
        type: 'module',
        dependencies: Object.fromEntries(
          Array.from({ length: 10000 }, (_, i) => [`package-${i}`, `^1.0.0`])
        )
      });
      vi.mocked(fs.readFile).mockResolvedValue(largePackageJson);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('esm');
    });

    it('should handle package.json with unicode characters', async () => {
      const mockPackageJson = JSON.stringify({
        type: 'module',
        name: '测试包',
        description: 'Тестовый пакет'
      });
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('esm');
    });

    it('should handle package.json with extra whitespace', async () => {
      const mockPackageJson = `

      {
        "type"  :   "module"  ,
        "name"  :  "test-package"
      }

      `;
      vi.mocked(fs.readFile).mockResolvedValue(mockPackageJson);

      const result = await detector.detectModuleFormat('/fake/path');

      expect(result.format).toBe('esm');
    });
  });
});
