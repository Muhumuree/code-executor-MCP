import { WrapperGenerator } from './dist/cli/wrapper-generator.js';
import * as fs from 'fs/promises';

const generator = new WrapperGenerator({
  outputDir: '/tmp/test-wrappers-debug',
  templateDir: './templates'
});

const mcp = {
  name: 'filesystem',
  description: 'File system operations',
  type: 'STDIO',
  status: 'online',
  toolCount: 2,
  sourceConfig: '/test/config.json',
  tools: [
    {
      name: 'mcp__filesystem__read_file',
      description: 'Read file contents',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'mcp__filesystem__write_file',
      description: 'Write file contents',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
    },
  ],
};

try {
  const result = await generator.generateWrapper(mcp, 'typescript', 'esm');
  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.success && result.outputPath) {
    const content = await fs.readFile(result.outputPath, 'utf-8');
    console.log('\n=== Generated Content (first 500 chars) ===');
    console.log(content.substring(0, 500));
  }
} catch (error) {
  console.error('ERROR:', error.message);
  console.error(error.stack);
}
