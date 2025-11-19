import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WrapperGenerator } from '../../src/cli/wrapper-generator.js';
import type { MCPServerSelection } from '../../src/cli/types.js';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

/**
 * T073.5: Input Validation Security Tests
 *
 * **PURPOSE:** Verify input validation prevents code injection attacks
 * **ATTACK VECTORS:** Malicious MCP names attempting path traversal or code injection
 * **SECURITY PRINCIPLE:** Principle 2 (Zero Tolerance Security)
 *
 * **WHY:** WrapperGenerator uses input validation as PRIMARY defense layer.
 * Malicious MCP names are REJECTED before reaching template engine:
 * - {{process.exit()}} - Rejected (contains {})
 * - <script>alert('XSS')</script> - Rejected (contains <>)
 * - ../../../etc/passwd - Rejected (contains /)
 * - Unicode/emoji attacks - Rejected (non-alphanumeric)
 *
 * **DEFENSE LAYERS:**
 * 1. Input validation: Only [a-zA-Z0-9_-]+ allowed
 * 2. Handlebars auto-escaping: Secondary defense (if validation bypassed)
 *
 * **ALLOWED NAMES:** alphanumeric, hyphens, underscores (e.g., my-server_123)
 */
describe('Input Validation Security (T073.5)', () => {
  let generator: WrapperGenerator;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test outputs
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'input-validation-'));
    generator = new WrapperGenerator({
      outputDir: tempDir,
      templateDir: path.join(process.cwd(), 'templates'),
      manifestPath: path.join(tempDir, 'manifest.json'),
    });
  });

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Valid MCP Names (Acceptance)', () => {
    it('should_acceptAlphanumeric_when_validMCPName', async () => {
      // Arrange: Valid alphanumeric name
      const validMCP: MCPServerSelection = {
        name: 'filesystem',
        description: 'File system operations',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 5,
      };

      // Act & Assert: Should generate successfully
      const result = await generator.generateWrapper(validMCP, 'typescript', []);
      expect(result.success).toBe(true);
      expect(result.outputPath).toBeDefined();

      // Verify file was created
      const code = await fs.readFile(result.outputPath, 'utf-8');
      expect(code).toContain('filesystem'); // MCP name appears in wrapper
    });

    it('should_acceptHyphens_when_validMCPName', async () => {
      // Arrange: Name with hyphens
      const validMCP: MCPServerSelection = {
        name: 'my-server-123',
        description: 'Server with hyphens',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      const result = await generator.generateWrapper(validMCP, 'python', []);
      expect(result.success).toBe(true);
    });

    it('should_acceptUnderscores_when_validMCPName', async () => {
      // Arrange: Name with underscores
      const validMCP: MCPServerSelection = {
        name: 'my_server_v2',
        description: 'Server with underscores',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      const result = await generator.generateWrapper(validMCP, 'typescript', []);
      expect(result.success).toBe(true);
    });
  });

  describe('Code Injection Attacks (Rejection)', () => {
    it('should_rejectProcessExit_when_maliciousMCPName', async () => {
      // Arrange: MCP with process.exit() injection attempt
      const maliciousMCP: MCPServerSelection = {
        name: '{{process.exit()}}',
        description: 'Malicious name',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert: Should throw validation error
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });

    it('should_rejectRequireExec_when_attemptingCommandInjection', async () => {
      // Arrange: Require/exec injection attempt
      const maliciousMCP: MCPServerSelection = {
        name: "require('child_process')",
        description: 'Command injection',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'python', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });

    it('should_rejectConstructorAccess_when_attemptingSandboxEscape', async () => {
      // Arrange: Constructor access attempt
      const maliciousMCP: MCPServerSelection = {
        name: "constructor.constructor('return process')()",
        description: 'Sandbox escape',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });
  });

  describe('Path Traversal Attacks (Rejection)', () => {
    it('should_rejectPathTraversal_when_attemptingDirectoryEscape', async () => {
      // Arrange: Path traversal attempt
      const maliciousMCP: MCPServerSelection = {
        name: '../../../etc/passwd',
        description: 'Path traversal',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });

    it('should_rejectAbsolutePath_when_attemptingFileSystemAccess', async () => {
      // Arrange: Absolute path attempt
      const maliciousMCP: MCPServerSelection = {
        name: '/etc/shadow',
        description: 'Absolute path',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'python', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });
  });

  describe('Script Tag Injection (Rejection)', () => {
    it('should_rejectScriptTags_when_attemptingXSS', async () => {
      // Arrange: XSS-style script tag injection
      const maliciousMCP: MCPServerSelection = {
        name: '<script>alert("XSS")</script>',
        description: 'XSS attempt',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });

    it('should_rejectHTMLEntities_when_attemptingEncoding', async () => {
      // Arrange: HTML entity encoding attempt
      const maliciousMCP: MCPServerSelection = {
        name: '&lt;script&gt;',
        description: 'Entity encoding',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'python', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });
  });

  describe('Unicode and Encoding Attacks (Rejection)', () => {
    it('should_rejectUnicode_when_attemptingHomoglyphAttack', async () => {
      // Arrange: Unicode homoglyph attempt (Cyrillic 'а' looks like Latin 'a')
      const maliciousMCP: MCPServerSelection = {
        name: 'sаfe-name', // Contains Cyrillic 'а' (U+0430)
        description: 'Homoglyph attack',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });

    it('should_rejectEmoji_when_attemptingNonASCII', async () => {
      // Arrange: Emoji injection
      const maliciousMCP: MCPServerSelection = {
        name: 'server😈hack',
        description: 'Emoji injection',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'python', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });

    it('should_rejectNullBytes_when_attemptingStringTermination', async () => {
      // Arrange: Null byte injection
      const maliciousMCP: MCPServerSelection = {
        name: 'safe\x00malicious',
        description: 'Null byte',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });
  });

  describe('Empty/Whitespace Attacks (Rejection)', () => {
    it('should_rejectEmptyName_when_noNameProvided', async () => {
      // Arrange: Empty name
      const maliciousMCP: MCPServerSelection = {
        name: '',
        description: 'Empty name',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*empty/);
    });

    it('should_rejectSpaces_when_attemptingWhitespace', async () => {
      // Arrange: Name with spaces
      const maliciousMCP: MCPServerSelection = {
        name: 'my server',
        description: 'Spaces in name',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'python', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });

    it('should_rejectWhitespaceOnly_when_attemptingInvisible', async () => {
      // Arrange: Whitespace-only name
      const maliciousMCP: MCPServerSelection = {
        name: '   ',
        description: 'Whitespace only',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });
  });

  describe('CVE-2021-23369 Protection', () => {
    it('should_rejectHandlebarsRCE_when_attemptingPrototypeAccess', async () => {
      // Arrange: CVE-2021-23369 exploit attempt (Handlebars RCE)
      const maliciousMCP: MCPServerSelection = {
        name: '{{this.constructor.constructor}}',
        description: 'CVE-2021-23369',
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act & Assert: Blocked by input validation (primary defense)
      await expect(
        generator.generateWrapper(maliciousMCP, 'typescript', [])
      ).rejects.toThrow(/Invalid MCP name.*invalid characters/);
    });
  });

  describe('Description Field Safety (Secondary Defense)', () => {
    it('should_allowUnsafeDescription_when_notUsedInCode', async () => {
      // Arrange: Valid name, but malicious description
      const mcp: MCPServerSelection = {
        name: 'safe-server',
        description: "{{process.exit()}} <script>alert('xss')</script>",
        type: 'STDIO',
        status: 'online',
        sourceConfig: '/fake/config.json',
        toolCount: 1,
      };

      // Act: Generate wrapper
      const result = await generator.generateWrapper(mcp, 'typescript', []);

      // Assert: Wrapper generated (description not used in executable code)
      expect(result.success).toBe(true);
      expect(result.outputPath).toBeDefined();

      // Read generated code
      const code = await fs.readFile(result.outputPath, 'utf-8');
      expect(code).toBeDefined();

      // Malicious content should be HTML-escaped by Handlebars
      // {{process.exit()}} → {{process.exit()}} (literal, not executed)
      // <script> → &lt;script&gt; (HTML entities)
      expect(code).toMatch(/{{process\.exit\(\)}}/); // Escaped template syntax
      expect(code).toMatch(/&lt;script&gt;/); // HTML entities
      expect(code).not.toContain('<script>'); // NOT raw script tag
    });
  });
});
