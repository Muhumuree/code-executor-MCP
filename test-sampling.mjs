// Load environment variables
process.env.CODE_EXECUTOR_SAMPLING_ENABLED = 'true';
process.env.CODE_EXECUTOR_AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'AIzaSyBHSaRQHOYfotUqdQP4W2BMDTKi9YoPW1Q';

// Import the executor and config
import { executeTypescriptInSandbox } from './dist/executors/sandbox-executor.js';
import { MCPClientPool } from './dist/mcp/client-pool.js';
import { initConfig } from './dist/config/loader.js';

const code = `
// Test Gemini sampling
const response = await llm.ask("What is 2 + 2? Answer with just the number.");
console.log("LLM Response:", response);
`;

// Initialize configuration first
await initConfig();

const mcpClientPool = new MCPClientPool();
await mcpClientPool.initialize();

console.log('🧪 Testing Gemini sampling integration...\n');
const result = await executeTypescriptInSandbox(
  {
    code,
    allowedTools: [],
    timeoutMs: 30000,
    permissions: {},
    enableSampling: true,
    maxSamplingRounds: 5,
    maxSamplingTokens: 1000,
  },
  mcpClientPool,
  null  // No MCP server
);

console.log('\n✅ Result:', JSON.stringify(result, null, 2));
await mcpClientPool.disconnect();
