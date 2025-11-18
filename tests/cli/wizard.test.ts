/**
 * CLIWizard Tests
 *
 * **TDD PHASE:** RED (Failing Tests) → GREEN (Implementation)
 * **COVERAGE TARGET:** 90%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CLIWizard } from '../../src/cli/wizard.js';
import { ToolDetector } from '../../src/cli/tool-detector.js';
import type { AIToolMetadata } from '../../src/cli/tool-registry.js';

// Mock fs/promises for ToolDetector
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  constants: {
    R_OK: 4,
  },
}));

// Mock prompts
vi.mock('prompts', () => ({
  default: vi.fn(),
}));

import * as fs from 'node:fs/promises';
import prompts from 'prompts';

describe('CLIWizard', () => {
  let wizard: CLIWizard;
  let toolDetector: ToolDetector;

  beforeEach(() => {
    toolDetector = new ToolDetector();
    wizard = new CLIWizard(toolDetector);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('selectTools', () => {
    const mockInstalledTools: AIToolMetadata[] = [
      {
        id: 'claude-code',
        name: 'Claude Code',
        description: 'Anthropic\'s official CLI for Claude',
        configPaths: { linux: '~/.claude/CLAUDE.md' },
        website: 'https://code.claude.com',
      },
      {
        id: 'cursor',
        name: 'Cursor',
        description: 'AI-first code editor',
        configPaths: { linux: '~/.cursor/config.json' },
        website: 'https://cursor.sh',
      },
      {
        id: 'windsurf',
        name: 'Windsurf',
        description: 'AI-powered development assistant',
        configPaths: { linux: '~/.windsurf/config.json' },
        website: 'https://windsurf.ai',
      },
    ];

    it('should_returnSelectedTools_when_multipleToolsChosen', async () => {
      vi.spyOn(toolDetector, 'detectInstalledTools').mockResolvedValue(mockInstalledTools);
      vi.mocked(prompts).mockResolvedValue({ selectedTools: ['claude-code', 'cursor'] });

      const result = await wizard.selectTools();

      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toContain('claude-code');
      expect(result.map(t => t.id)).toContain('cursor');
    });

    it('should_returnSingleTool_when_oneToolChosen', async () => {
      vi.spyOn(toolDetector, 'detectInstalledTools').mockResolvedValue(mockInstalledTools);
      vi.mocked(prompts).mockResolvedValue({ selectedTools: ['claude-code'] });

      const result = await wizard.selectTools();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('claude-code');
      expect(result[0].name).toBe('Claude Code');
    });

    it('should_returnAllTools_when_allToolsSelected', async () => {
      vi.spyOn(toolDetector, 'detectInstalledTools').mockResolvedValue(mockInstalledTools);
      vi.mocked(prompts).mockResolvedValue({ selectedTools: ['claude-code', 'cursor', 'windsurf'] });

      const result = await wizard.selectTools();

      expect(result).toHaveLength(3);
      expect(result.map(t => t.id)).toEqual(['claude-code', 'cursor', 'windsurf']);
    });

    it('should_returnCorrectMetadata_when_toolsSelected', async () => {
      vi.spyOn(toolDetector, 'detectInstalledTools').mockResolvedValue(mockInstalledTools);
      vi.mocked(prompts).mockResolvedValue({ selectedTools: ['claude-code'] });

      const result = await wizard.selectTools();

      // Verify returned metadata is complete
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('configPaths');
      expect(result[0]).toHaveProperty('website');

      // Verify correct tool returned
      expect(result[0].id).toBe('claude-code');
      expect(result[0].name).toBe('Claude Code');
    });

    it('should_throwError_when_noToolsInstalled', async () => {
      vi.spyOn(toolDetector, 'detectInstalledTools').mockResolvedValue([]);

      await expect(wizard.selectTools()).rejects.toThrow('No AI tools detected');
    });

    it('should_includeWebsiteInMetadata_when_toolSelected', async () => {
      vi.spyOn(toolDetector, 'detectInstalledTools').mockResolvedValue(mockInstalledTools);
      vi.mocked(prompts).mockResolvedValue({ selectedTools: ['claude-code'] });

      const result = await wizard.selectTools();

      expect(result[0].website).toBe('https://code.claude.com');
    });

    it('should_preserveToolOrder_when_returningResults', async () => {
      vi.spyOn(toolDetector, 'detectInstalledTools').mockResolvedValue(mockInstalledTools);
      vi.mocked(prompts).mockResolvedValue({ selectedTools: ['cursor', 'claude-code'] });

      const result = await wizard.selectTools();

      // Result should maintain selection order
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('cursor');
      expect(result[1].id).toBe('claude-code');
    });

    it('should_returnEmptyArray_when_promptCancelled', async () => {
      vi.spyOn(toolDetector, 'detectInstalledTools').mockResolvedValue(mockInstalledTools);
      vi.mocked(prompts).mockResolvedValue({ selectedTools: [] });

      const result = await wizard.selectTools();

      expect(result).toEqual([]);
    });
  });
});
