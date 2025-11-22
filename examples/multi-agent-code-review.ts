/**
 * Multi-Agent AI Code Review Example
 *
 * Demonstrates MCP Sampling with 5 AI agents collaborating to:
 * 1. Review code for issues
 * 2. Analyze security vulnerabilities
 * 3. Refactor to modern JavaScript
 * 4. Generate comprehensive tests
 * 5. Write documentation
 *
 * Run via code-executor-mcp with sampling enabled.
 */

// Sample code to review (intentionally flawed)
const codeToReview = `
function calculateDiscount(price, customerType) {
  var discount = 0;
  if (customerType == "premium") {
    discount = price * 0.2;
  } else if (customerType == "regular") {
    discount = price * 0.1;
  }
  return price - discount;
}
`;

console.log('🚀 Starting Multi-Agent AI Code Analysis\n');

// AGENT 1: Code Reviewer
console.log('👨‍💻 Agent 1: Code Reviewer analyzing...');
const review = await llm.ask(`Review this JavaScript code and list 5 specific issues (bugs, style, performance, type safety):

${codeToReview}

Format: numbered list, be concise.`);
console.log('📋 Issues Found:');
console.log(review);
console.log('\n---\n');

// AGENT 2: Security Analyst
console.log('🔒 Agent 2: Security Analyst checking...');
const security = await llm.ask(`Analyze this code for security vulnerabilities:

${codeToReview}

Consider: injection, type coercion, edge cases. Rate: SAFE/RISKY/UNSAFE`);
console.log('🛡️ Security Assessment:');
console.log(security);
console.log('\n---\n');

// AGENT 3: Refactoring Expert
console.log('⚡ Agent 3: Refactoring to modern JavaScript...');
const refactored = await llm.ask(`Refactor this code using:
- ES6+ features
- TypeScript-style JSDoc
- Immutability
- Better naming

${codeToReview}

Return ONLY the improved code.`);
console.log('✨ Refactored Code:');
console.log(refactored);
console.log('\n---\n');

// AGENT 4: Test Generator
console.log('🧪 Agent 4: Generating test suite...');
const tests = await llm.ask(`Generate 3 Vitest test cases for:

${refactored.substring(0, 300)}

Include: happy path, edge case, type error. Brief code only.`);
console.log('🎯 Test Cases:');
console.log(tests);
console.log('\n---\n');

// AGENT 5: Documentation Writer
console.log('📚 Agent 5: Creating documentation...');
const docs = await llm.ask(`Write a brief JSDoc comment (3-4 lines) for:

${refactored.substring(0, 200)}

Include @param and @returns.`);
console.log('📝 Documentation:');
console.log(docs);

// Summary
console.log('\n\n🎉 === ANALYSIS COMPLETE ===');
console.log('✅ 5 AI agents collaborated');
console.log('✅ Code reviewed, secured, refactored, tested, documented');
console.log('✅ Total processing: ~10-15 seconds');
console.log('\nThis demonstrates sampling\'s power for:');
console.log('- Iterative problem solving');
console.log('- Multi-perspective analysis');
console.log('- Autonomous code improvement');
console.log('- Complex multi-step workflows');
