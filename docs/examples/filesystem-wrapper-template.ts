/**
 * Filesystem MCP Wrapper Template
 *
 * ⚠️ COPY THIS FILE TO YOUR PROJECT - DO NOT IMPORT FROM THIS PACKAGE
 *
 * Why? MCP servers update independently. Copy this template and maintain
 * it when @modelcontextprotocol/server-filesystem updates.
 *
 * Usage:
 * 1. Copy utils-template.ts to src/lib/mcp/utils.ts
 * 2. Copy this file to src/lib/mcp/filesystem.ts
 * 3. Install filesystem MCP in your .mcp.json
 * 4. Adapt parameters to match YOUR installed version
 * 5. Maintain it when the filesystem server updates
 *
 * Last verified: 2024-11-09 with @modelcontextprotocol/server-filesystem
 */

import { callMCPToolSafe, parseMCPResult, parseArrayResult, parseStringResult } from './utils';

/**
 * Read file contents
 */
export async function readFile(path: string): Promise<string> {
  const result = await callMCPToolSafe(
    'mcp__filesystem__read_file',
    { path },
    'filesystem read_file'
  );

  // Handle both string and { content: string } response formats
  if (typeof result === 'string') {
    return result;
  }
  if (typeof result === 'object' && result !== null && 'content' in result) {
    return (result as { content: string }).content;
  }
  return parseStringResult(result);
}

/**
 * Read multiple files
 */
export async function readMultipleFiles(paths: string[]): Promise<string[]> {
  const result = await callMCPToolSafe(
    'mcp__filesystem__read_multiple_files',
    { paths },
    'filesystem read_multiple_files'
  );

  return parseArrayResult<string>(result);
}

/**
 * Write file contents
 */
export async function writeFile(path: string, content: string): Promise<void> {
  await callMCPToolSafe(
    'mcp__filesystem__write_file',
    { path, content },
    'filesystem write_file'
  );
}

/**
 * Create directory
 */
export async function createDirectory(path: string): Promise<void> {
  await callMCPToolSafe(
    'mcp__filesystem__create_directory',
    { path },
    'filesystem create_directory'
  );
}

/**
 * List directory contents
 */
export async function listDirectory(path: string): Promise<string[]> {
  const result = await callMCPToolSafe(
    'mcp__filesystem__list_directory',
    { path },
    'filesystem list_directory'
  );

  return parseArrayResult<string>(result);
}

/**
 * Search for files by pattern
 */
export async function searchFiles(
  pattern: string,
  path?: string
): Promise<string[]> {
  const result = await callMCPToolSafe(
    'mcp__filesystem__search_files',
    { pattern, ...(path && { path }) },
    'filesystem search_files'
  );

  return parseArrayResult<string>(result);
}

/**
 * Get file info
 */
export async function getFileInfo(path: string): Promise<{
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
  isFile: boolean;
}> {
  const result = await callMCPToolSafe(
    'mcp__filesystem__get_file_info',
    { path },
    'filesystem get_file_info'
  );

  return parseMCPResult(result);
}

/**
 * Move/rename file
 */
export async function moveFile(source: string, destination: string): Promise<void> {
  await callMCPToolSafe(
    'mcp__filesystem__move_file',
    { source, destination },
    'filesystem move_file'
  );
}

/**
 * Get directory tree
 */
export async function directoryTree(
  path: string,
  maxDepth?: number
): Promise<any> {
  const result = await callMCPToolSafe(
    'mcp__filesystem__directory_tree',
    { path, ...(maxDepth && { maxDepth }) },
    'filesystem directory_tree'
  );

  return parseMCPResult(result);
}

// Add more filesystem tool wrappers as needed...
