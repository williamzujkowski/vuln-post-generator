#!/usr/bin/env node

/**
 * Vulnerability Blog Post Generator
 * 
 * Generates high-quality blog posts about security vulnerabilities 
 * using LangChain.js and various LLM providers.
 * 
 * Usage:
 *   node index.js --cve CVE-2023-12345  # Generate post for specific CVE
 *   node index.js --latest               # Generate post for latest critical CVE
 *   node index.js --weekly               # Generate weekly rollup post
 *   node index.js --provider openai      # Specify LLM provider
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import modules
import config from './src/config/index.js';
import LlmClient from './src/llm/client.js';
import BlogSaver from './src/output/blog-saver.js';
import ErrorHandler from './src/utils/error-handler.js';

// Directory setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up command line options
const program = new Command();
program
  .option('--cve <id>', 'Generate a blog post for a specific CVE')
  .option('--latest', 'Generate a post for the latest critical vulnerability')
  .option('--weekly', 'Generate a weekly roll-up of vulnerabilities')
  .option('--provider <provider>', 'LLM provider to use (openai, claude, gemini)')
  .option('--output-dir <path>', 'Output directory for blog posts')
  .parse(process.argv);

const options = program.opts();

/**
 * Create input data for a CVE
 * @param {string} cveId - The CVE ID
 * @returns {Promise<Object>} - Vulnerability data
 */
async function createInputData(cveId) {
  // For this demo, we'll use mock data
  // In a real implementation, this would query NVD, MITRE, etc.
  console.log(`Creating input data for ${cveId}...`);
  
  // Return mock data
  return {
    CVE_ID: cveId,
    DESCRIPTION: "This is a mock vulnerability for demonstration purposes.",
    CVSS_SCORE: "9.8",
    CVSS_VECTOR: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    VULNERABILITY_TYPE: "Remote Code Execution",
    AFFECTED_PRODUCTS: "Example Product 1.0, Example Product 2.0",
    TECHNICAL_DETAILS: "The vulnerability exists due to improper input validation in the component.",
    ATTACK_VECTOR: "Network",
    EXPLOIT_STATUS: "Exploited in the wild",
    PATCHES_AVAILABLE: "Yes",
    WORKAROUNDS: "Disable the affected component until patched.",
    REFERENCES: "https://example.com/advisory",
    IS_KEV: "Yes",
    DISCOVERY_DATE: "2023-01-01",
    VENDOR_STATEMENT: "The vendor has acknowledged the issue and provided patches.",
    SUMMARY: "A critical remote code execution vulnerability in Example Product."
  };
}

/**
 * Find the latest critical CVE
 * @returns {Promise<string>} - CVE ID
 */
async function findLatestCriticalCVE() {
  // For this demo, we'll return a mock CVE ID
  return "CVE-2023-12345";
}

/**
 * Main function
 */
async function main() {
  try {
    // Set output directory if provided
    if (options.outputDir) {
      config.setOutputDir(options.outputDir);
    }
    
    // Override provider if specified
    const provider = options.provider || config.getLlmProvider();
    
    // Create LLM client
    const llmClient = new LlmClient(provider);
    
    if (options.cve) {
      // Generate a blog post for a specific CVE
      console.log(`Generating blog post for ${options.cve}...`);
      
      // Create input data
      const inputData = await createInputData(options.cve);
      if (!inputData) {
        console.error("Failed to get vulnerability data");
        process.exit(1);
      }
      
      console.log("Successfully created input data, generating blog post...");
      
      // Generate blog post
      const blogContent = await llmClient.generateBlogPost(inputData);
      if (!blogContent) {
        console.error("Failed to generate blog post");
        process.exit(1);
      }
      
      console.log("Successfully generated blog post, saving...");
      
      // Save blog post
      BlogSaver.saveBlogPost(blogContent, options.cve, inputData);
      
      console.log("Blog post generation complete!");
    } 
    else if (options.latest) {
      console.log("Searching for latest critical vulnerabilities...");
      
      // Find the latest critical vulnerability
      const latestCveId = await findLatestCriticalCVE();
      if (!latestCveId) {
        console.error("Failed to find a recent critical CVE");
        process.exit(1);
      }
      
      console.log(`Found recent critical vulnerability: ${latestCveId}`);
      
      // Create input data
      const inputData = await createInputData(latestCveId);
      if (!inputData) {
        console.error("Failed to get vulnerability data");
        process.exit(1);
      }
      
      console.log("Successfully created input data, generating blog post...");
      
      // Generate blog post
      const blogContent = await llmClient.generateBlogPost(inputData);
      if (!blogContent) {
        console.error("Failed to generate blog post");
        process.exit(1);
      }
      
      console.log("Successfully generated blog post, saving...");
      
      // Save blog post
      BlogSaver.saveBlogPost(blogContent, latestCveId, inputData);
      
      console.log("Blog post generation complete!");
    }
    else if (options.weekly) {
      console.log("Weekly rollup functionality not yet implemented");
      process.exit(1);
    }
    else {
      // No options specified, show help
      program.help();
    }
  } catch (error) {
    ErrorHandler.handleError(error, 'Main process', true);
  }
}

// Run the main function
main();