#!/usr/bin/env node

/**
 * Test LLM Providers
 *
 * This utility helps test both OpenAI and Gemini models with a simple prompt
 * to verify API keys and compare output quality.
 *
 * Usage:
 *   node test-models.js [--provider openai|gemini|both]
 */

const { program } = require("commander");
const dotenv = require("dotenv");
const { generateContent } = require("./llm-providers");

// Load environment variables
dotenv.config();

program
  .option(
    "-p, --provider <provider>",
    "Which LLM provider to test (openai, gemini, claude, or all)",
    "all"
  )
  .parse(process.argv);

const options = program.opts();

// Simple test prompt
const testPrompt = `
Please provide a short summary (3-4 sentences) of the dangers of path traversal vulnerabilities in web applications,
especially in cloud environments. Format your response as a brief paragraph suitable for a technical blog.
`;

async function testOpenAI() {
  console.log("\n=== Testing OpenAI ===");

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is missing");
    return false;
  }

  try {
    // Save the original LLM_PROVIDER
    const originalProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "openai";

    console.log("Sending test prompt to OpenAI...");
    const startTime = Date.now();
    const response = await generateContent(testPrompt, { model: "gpt-4-turbo" });
    const endTime = Date.now();

    console.log("\nResponse:");
    console.log(response);
    console.log(`\nGeneration took ${(endTime - startTime) / 1000} seconds`);

    // Restore the original provider
    process.env.LLM_PROVIDER = originalProvider;
    return true;
  } catch (error) {
    console.error(`Error testing OpenAI: ${error.message}`);
    return false;
  }
}

async function testGemini() {
  console.log("\n=== Testing Google Gemini (gemini-2.0-flash) ===");

  if (!process.env.GOOGLE_API_KEY) {
    console.error("Error: GOOGLE_API_KEY environment variable is missing");
    return false;
  }

  try {
    // Save the original LLM_PROVIDER
    const originalProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "gemini";

    console.log("Sending test prompt to Gemini...");
    const startTime = Date.now();
    const response = await generateContent(testPrompt, { model: "gemini-2.0-flash" });
    const endTime = Date.now();

    console.log("\nResponse:");
    console.log(response);
    console.log(`\nGeneration took ${(endTime - startTime) / 1000} seconds`);

    // Restore the original provider
    process.env.LLM_PROVIDER = originalProvider;
    return true;
  } catch (error) {
    console.error(`Error testing Gemini: ${error.message}`);
    return false;
  }
}

// Add function to test Claude
async function testClaude() {
  console.log("\n=== Testing Anthropic Claude ===");

  if (!process.env.CLAUDE_API_KEY) {
    console.error("Error: CLAUDE_API_KEY environment variable is missing");
    return false;
  }

  try {
    // Save the original LLM_PROVIDER
    const originalProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "claude";

    console.log("Sending test prompt to Claude...");
    const startTime = Date.now();
    const response = await generateContent(testPrompt, {
      model: "claude-3-opus-20240229",
    });
    const endTime = Date.now();

    console.log("\nResponse:");
    console.log(response);
    console.log(`\nGeneration took ${(endTime - startTime) / 1000} seconds`);

    // Restore the original provider
    process.env.LLM_PROVIDER = originalProvider;
    return true;
  } catch (error) {
    console.error(`Error testing Claude: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("Testing LLM providers with a simple prompt");

  // Check which providers have keys available
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GOOGLE_API_KEY;
  const hasClaude = !!process.env.CLAUDE_API_KEY;
  const availableProviders = [];
  
  if (hasOpenAI) availableProviders.push("OpenAI");
  if (hasGemini) availableProviders.push("Gemini");
  if (hasClaude) availableProviders.push("Claude");
  
  console.log(`Available providers with API keys: ${availableProviders.length > 0 ? availableProviders.join(", ") : "None"}`);
  
  if (availableProviders.length === 0) {
    console.log("❌ No API keys found. Please provide at least one API key (OPENAI_API_KEY, GOOGLE_API_KEY, or CLAUDE_API_KEY)");
    process.exit(1);
  }

  let results = {
    openai: false,
    gemini: false,
    claude: false,
  };

  // Only test providers that have API keys
  if ((options.provider === "openai" || options.provider === "all") && hasOpenAI) {
    results.openai = await testOpenAI();
  } else if (options.provider === "openai" && !hasOpenAI) {
    console.log("⚠️ OpenAI API key not found, skipping OpenAI test");
  }

  if ((options.provider === "gemini" || options.provider === "all") && hasGemini) {
    results.gemini = await testGemini();
  } else if (options.provider === "gemini" && !hasGemini) {
    console.log("⚠️ Google API key not found, skipping Gemini test");
  }

  if ((options.provider === "claude" || options.provider === "all") && hasClaude) {
    results.claude = await testClaude();
  } else if (options.provider === "claude" && !hasClaude) {
    console.log("⚠️ Claude API key not found, skipping Claude test");
  }

  console.log("\n=== Test Results ===");
  if (options.provider === "openai" || options.provider === "all") {
    if (hasOpenAI) {
      console.log(`OpenAI: ${results.openai ? "SUCCESS ✅" : "FAILED ❌"}`);
    } else {
      console.log("OpenAI: NOT TESTED (no API key) ⚠️");
    }
  }
  
  if (options.provider === "gemini" || options.provider === "all") {
    if (hasGemini) {
      console.log(`Gemini: ${results.gemini ? "SUCCESS ✅" : "FAILED ❌"}`);
    } else {
      console.log("Gemini: NOT TESTED (no API key) ⚠️");
    }
  }
  
  if (options.provider === "claude" || options.provider === "all") {
    if (hasClaude) {
      console.log(`Claude: ${results.claude ? "SUCCESS ✅" : "FAILED ❌"}`);
    } else {
      console.log("Claude: NOT TESTED (no API key) ⚠️");
    }
  }

  // Check if at least one tested provider is working
  const workingProviders = [];
  if (results.openai) workingProviders.push("OpenAI");
  if (results.gemini) workingProviders.push("Gemini");
  if (results.claude) workingProviders.push("Claude");

  if (workingProviders.length > 0) {
    console.log(
      `\nWorking providers: ${workingProviders.join(", ")}. You can use any of these for generating vulnerability posts.`
    );
  } else if (availableProviders.length > 0) {
    console.log("\n❌ None of the available providers are working. Please check your API keys and try again.");
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
