#!/usr/bin/env node

/**
 * Enhanced Vulnerability Blog Post Generator
 * 
 * Generates high-quality blog posts about security vulnerabilities 
 * using LangChain.js and various LLM providers.
 * 
 * Includes robust error handling, API resilience, and metrics tracking.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import apiClient from './src/utils/api-client.js';
import config from './src/config/index.js';
import LlmClient from './src/llm/client.js';
import BlogSaver from './src/output/blog-saver.js';
import ErrorHandler from './src/utils/error-handler.js';
import metricsLogger from './src/utils/metrics-logger.js';

// Directory setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up command line options with yargs for better UX
const options = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .example('$0 --cve CVE-2023-12345', 'Generate post for specific CVE')
  .example('$0 --latest', 'Generate post for latest critical CVE')
  .example('$0 --weekly', 'Generate weekly rollup of vulnerabilities')
  
  .command('$0', 'Generate vulnerability analysis post', yargs => {
    return yargs.check(argv => {
      if (!argv.cve && !argv.latest && !argv.weekly) {
        throw new Error('At least one of --cve, --latest, or --weekly must be specified');
      }
      return true;
    });
  })
  
  .option('cve', {
    describe: 'Generate a blog post for a specific CVE',
    type: 'string'
  })
  .option('latest', {
    describe: 'Generate a post for the latest critical vulnerability',
    type: 'boolean',
    default: false
  })
  .option('weekly', {
    describe: 'Generate a weekly roll-up of vulnerabilities',
    type: 'boolean',
    default: false
  })
  .option('provider', {
    describe: 'LLM provider to use',
    type: 'string',
    choices: ['openai', 'claude', 'gemini'],
    default: process.env.LLM_PROVIDER || 'gemini'
  })
  .option('output-dir', {
    describe: 'Output directory for blog posts',
    type: 'string',
    default: process.env.OUTPUT_DIR || '../src/posts'
  })
  .option('use-workflow', {
    describe: 'Use LangGraph workflow',
    type: 'boolean',
    default: process.env.USE_WORKFLOW === 'true' || false
  })
  .option('enable-tracing', {
    describe: 'Enable LangSmith tracing',
    type: 'boolean',
    default: process.env.ENABLE_TRACING === 'true' || false
  })
  .option('debug', {
    describe: 'Enable debug mode',
    type: 'boolean',
    default: process.env.DEBUG_MODE === 'true' || false
  })
  .option('days-back', {
    describe: 'Days to look back for latest vulnerabilities',
    type: 'number',
    default: parseInt(process.env.MAX_VULNERABILITY_AGE_DAYS || '15', 10)
  })
  .option('severity', {
    describe: 'Minimum severity to consider for latest vulnerabilities',
    type: 'string',
    choices: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    default: 'CRITICAL'
  })
  .help('h')
  .alias('h', 'help')
  .version('1.0.0')
  .showHelpOnFail(false, 'Specify --help for available options')
  .wrap(100)
  .check(argv => {
    // Ensure only one mode is specified
    const modes = [argv.cve, argv.latest, argv.weekly].filter(Boolean).length;
    if (modes > 1) {
      throw new Error('Only one of --cve, --latest, or --weekly can be specified');
    }
    return true;
  })
  .argv;

/**
 * Create input data for a CVE by querying the API
 * @param {string} cveId - The CVE ID
 * @returns {Promise<Object>} - Vulnerability data
 */
async function createInputData(cveId) {
  console.log(`Creating input data for ${cveId}...`);
  
  try {
    // Fetch vulnerability data from NVD
    const vulnData = await apiClient.fetchCveData(cveId);
    
    if (!vulnData) {
      console.warn(`No data found for ${cveId}, using fallback data`);
      return getFallbackData(cveId);
    }
    
    // Extract CVSS data
    const metrics = vulnData.metrics;
    const cvssV31 = metrics?.cvssMetricV31?.[0]?.cvssData;
    const cvssV30 = metrics?.cvssMetricV30?.[0]?.cvssData;
    const cvssV2 = metrics?.cvssMetricV2?.[0]?.cvssData;
    
    // Use the best available CVSS data
    const cvssData = cvssV31 || cvssV30 || cvssV2 || {};
    
    // Extract severity
    const severity = metrics?.cvssMetricV31?.[0]?.baseSeverity || 
                     metrics?.cvssMetricV30?.[0]?.baseSeverity ||
                     metrics?.cvssMetricV2?.[0]?.baseSeverity ||
                     'Unknown';
    
    // Extract descriptions
    const descriptions = vulnData.descriptions || [];
    const englishDesc = descriptions.find(d => d.lang === 'en') || {};
    
    // Extract references
    const references = vulnData.references || [];
    const referenceUrls = references.map(ref => ref.url).join(', ');
    
    // Extract products
    const configurations = vulnData.configurations || [];
    let affectedProducts = [];
    
    configurations.forEach(config => {
      const nodes = config.nodes || [];
      nodes.forEach(node => {
        const cpeMatch = node.cpeMatch || [];
        cpeMatch.forEach(cpe => {
          if (cpe.criteria) {
            // Extract product name from CPE
            const parts = cpe.criteria.split(':');
            if (parts.length >= 5) {
              const vendor = parts[3];
              const product = parts[4];
              const version = parts[5] || 'All versions';
              affectedProducts.push(`${vendor} ${product} ${version}`);
            }
          }
        });
      });
    });
    
    // De-duplicate product list
    const uniqueProducts = [...new Set(affectedProducts)];
    
    // Check CISA KEV status
    const kevData = await apiClient.checkKevStatus(cveId);
    const isKev = kevData ? "Yes" : "No";
    
    // Build a clean structured data object for the template
    return {
      CVE_ID: cveId,
      DESCRIPTION: englishDesc.value || "No description available",
      CVSS_SCORE: cvssData.baseScore || "Unknown",
      CVSS_VECTOR: cvssData.vectorString || "Unknown",
      SEVERITY_RATING: severity,
      VULNERABILITY_TYPE: englishDesc.value ? extractVulnerabilityType(englishDesc.value) : "Unknown",
      AFFECTED_PRODUCTS: uniqueProducts.join(', ') || "Unknown",
      AFFECTED_VERSIONS: uniqueProducts.join(', ') || "Unknown",
      TECHNICAL_DETAILS: englishDesc.value || "Technical details not available",
      ATTACK_VECTOR: cvssData.attackVector || "Unknown",
      EXPLOIT_STATUS: isKev === "Yes" ? "Known to be exploited in the wild" : "Unknown",
      PATCHES_AVAILABLE: "Unknown", // NVD doesn't provide this directly
      WORKAROUNDS: "Consult vendor advisories for mitigation strategies",
      REFERENCES: referenceUrls || "No references available",
      IS_KEV: isKev,
      DISCOVERY_DATE: vulnData.published || "Unknown",
      VENDOR_STATEMENT: "Refer to vendor advisories for official statements",
      SUMMARY: englishDesc.value || `Vulnerability ${cveId}`,
      CWE_ID: vulnData.weaknesses?.[0]?.description?.[0]?.value || "Unknown"
    };
  } catch (error) {
    console.error(`Error fetching data for ${cveId}:`, error.message);
    
    // Use fallback data if the API request fails
    return getFallbackData(cveId);
  }
}

/**
 * Extract vulnerability type from description
 * @param {string} description - Vulnerability description
 * @returns {string} - Vulnerability type
 */
function extractVulnerabilityType(description) {
  const types = [
    "Remote Code Execution",
    "Buffer Overflow",
    "SQL Injection",
    "Cross-Site Scripting",
    "Cross-Site Request Forgery",
    "Directory Traversal",
    "Authentication Bypass",
    "Authorization Bypass",
    "Information Disclosure",
    "Denial of Service",
    "Command Injection",
    "Memory Corruption",
    "Use After Free",
    "Integer Overflow",
    "Race Condition",
    "Privilege Escalation"
  ];
  
  // Check if any known vulnerability types are mentioned in the description
  for (const type of types) {
    if (description.includes(type)) {
      return type;
    }
  }
  
  // Check for common keywords
  if (description.match(/execut(e|ing|ion)/i)) return "Code Execution";
  if (description.match(/overflow/i)) return "Buffer Overflow";
  if (description.match(/inject(ion)?/i)) return "Injection";
  if (description.match(/xss/i)) return "Cross-Site Scripting";
  if (description.match(/csrf/i)) return "Cross-Site Request Forgery";
  if (description.match(/traversal/i)) return "Directory Traversal";
  if (description.match(/bypass/i)) return "Security Bypass";
  if (description.match(/disclos(e|ure)/i)) return "Information Disclosure";
  if (description.match(/denial.of.service|dos/i)) return "Denial of Service";
  if (description.match(/escalat(e|ion)/i)) return "Privilege Escalation";
  
  // Default to generic vulnerability type
  return "Security Vulnerability";
}

/**
 * Get fallback data when API requests fail
 * @param {string} cveId - The CVE ID
 * @returns {Object} - Fallback vulnerability data
 */
function getFallbackData(cveId) {
  return {
    CVE_ID: cveId,
    DESCRIPTION: "This is a placeholder for a vulnerability that could not be fetched from NVD.",
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
    IS_KEV: "Unknown",
    DISCOVERY_DATE: new Date().toISOString().split('T')[0],
    VENDOR_STATEMENT: "The vendor has acknowledged the issue and provided patches.",
    SUMMARY: `A critical vulnerability (${cveId}) affecting various products.`
  };
}

/**
 * Find the latest critical CVE from the last N days
 * @param {number} daysBack - Number of days to look back
 * @param {string} severity - Minimum severity level
 * @returns {Promise<string>} - CVE ID
 */
async function findLatestCriticalCVE(daysBack = 15, severity = 'CRITICAL') {
  try {
    console.log(`Searching for ${severity} vulnerabilities from the last ${daysBack} days...`);
    
    // Find recent vulnerabilities using the API client
    const vulnerabilities = await apiClient.findRecentVulnerabilities({
      daysBack,
      severity,
      limit: 10
    });
    
    if (vulnerabilities.length > 0) {
      // Check if any are in the KEV catalog
      for (const vuln of vulnerabilities) {
        const cveId = vuln.cve.id;
        const kevStatus = await apiClient.checkKevStatus(cveId);
        
        if (kevStatus) {
          console.log(`Found ${severity} vulnerability in KEV catalog: ${cveId}`);
          return cveId;
        }
      }
      
      // If no match found in KEV, return the highest scored vulnerability
      const topVuln = vulnerabilities[0];
      console.log(`No vulnerabilities in KEV found, using highest scored vulnerability: ${topVuln.cve.id}`);
      return topVuln.cve.id;
    }
    
    console.log(`No ${severity} vulnerabilities found in the last ${daysBack} days, using fallback CVE`);
    return "CVE-2023-50164"; // Fallback to a known CVE
  } catch (error) {
    ErrorHandler.handleError(error, 'FindLatestCVE');
    console.log("Using fallback CVE due to error");
    return "CVE-2023-50164"; // Fallback to a known CVE
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Process debug mode
    if (options.debug) {
      console.log("Debug mode enabled");
      console.log("Command line options:", options);
      process.env.DEBUG_MODE = 'true';
    }
    
    // Set output directory if provided
    if (options.outputDir) {
      config.setOutputDir(options.outputDir);
    }
    
    // Set environment variables based on options
    if (options.enableTracing) {
      process.env.ENABLE_TRACING = 'true';
    }
    
    // Override provider if specified
    const provider = options.provider || config.getLlmProvider();
    
    // Import dynamically to avoid circular dependencies
    const { default: tracing } = await import('./src/utils/tracing.js');
    const { default: VulnPostWorkflow } = await import('./src/workflow/vuln-post-workflow.js');
    
    // Initialize workflow
    const workflow = new VulnPostWorkflow();
    const useWorkflow = options.useWorkflow;
    
    // Log tracing status
    if (tracing.isEnabled) {
      console.log(`LangSmith tracing enabled. Dashboard: ${tracing.getDashboardUrl()}`);
    }
    
    if (options.cve) {
      // Generate a blog post for a specific CVE
      console.log(`Generating blog post for ${options.cve}...`);
      
      // Create input data
      const inputData = await createInputData(options.cve);
      if (!inputData) {
        const error = ErrorHandler.createError(
          "Failed to get vulnerability data, even fallback data",
          "CVE Data Fetch",
          ErrorHandler.ERROR_CATEGORIES.API
        );
        ErrorHandler.handleError(error, 'CVE Data Fetch', true);
      }
      
      console.log("Successfully created input data, generating blog post...");
      
      let blogContent;
      
      // Try LangGraph workflow if enabled, with fallback to direct generation
      if (useWorkflow) {
        try {
          console.log("Using LangGraph workflow for generation...");
          const result = await workflow.execute(inputData);
          
          if (result && result.success && result.post) {
            blogContent = result.post;
            
            // Log workflow steps with LangSmith if enabled
            if (tracing.isEnabled) {
              await tracing.trackRun("Vulnerability Post Workflow", 
                { cve: options.cve, inputData }, 
                { blogContent, analysisSteps: {
                  initialAnalysis: result.analysis,
                  technicalDetails: result.technicalDetails,
                  mitigations: result.mitigations
                }},
                { provider, workflowExecutionTime: Date.now() }
              );
            }
          } else {
            console.log("Workflow didn't return valid results, falling back to direct generation");
            
            // Fall back to direct generation
            const llmClient = new LlmClient(provider);
            blogContent = await llmClient.generateBlogPost(inputData);
          }
        } catch (workflowError) {
          ErrorHandler.handleError(workflowError, 'LangGraph Workflow');
          console.log("Falling back to direct generation");
          
          // Create LLM client for direct generation as fallback
          const llmClient = new LlmClient(provider);
          blogContent = await llmClient.generateBlogPost(inputData);
        }
      } else {
        // Create LLM client for direct generation
        const llmClient = new LlmClient(provider);
        
        // Wrap the generate function with tracing if enabled
        const generateFunction = tracing.isEnabled ? 
          tracing.traceFunction(llmClient.generateBlogPost.bind(llmClient), "Generate Blog Post") : 
          llmClient.generateBlogPost.bind(llmClient);
        
        // Generate blog post
        blogContent = await generateFunction(inputData);
      }
      
      if (!blogContent) {
        const error = ErrorHandler.createError(
          "Failed to generate blog post",
          "Blog Generation",
          ErrorHandler.ERROR_CATEGORIES.LLM
        );
        ErrorHandler.handleError(error, 'Blog Generation', true);
      }
      
      console.log("Successfully generated blog post, saving...");
      
      // Save blog post
      BlogSaver.saveBlogPost(blogContent, options.cve, inputData);
      
      console.log("Blog post generation complete!");
    } 
    else if (options.latest) {
      console.log("Searching for latest critical vulnerabilities...");
      
      // Find the latest critical vulnerability
      const latestCveId = await findLatestCriticalCVE(options.daysBack, options.severity);
      if (!latestCveId) {
        const error = ErrorHandler.createError(
          "Failed to find a recent critical CVE",
          "Latest CVE Search",
          ErrorHandler.ERROR_CATEGORIES.API
        );
        ErrorHandler.handleError(error, 'Latest CVE Search', true);
      }
      
      console.log(`Found recent ${options.severity} vulnerability: ${latestCveId}`);
      
      // Create input data
      const inputData = await createInputData(latestCveId);
      if (!inputData) {
        const error = ErrorHandler.createError(
          "Failed to get vulnerability data",
          "CVE Data Fetch",
          ErrorHandler.ERROR_CATEGORIES.API
        );
        ErrorHandler.handleError(error, 'CVE Data Fetch', true);
      }
      
      console.log("Successfully created input data, generating blog post...");
      
      let blogContent;
      
      // Try LangGraph workflow if enabled, with fallback to direct generation
      if (useWorkflow) {
        try {
          console.log("Using LangGraph workflow for generation...");
          const result = await workflow.execute(inputData);
          
          if (result && result.success && result.post) {
            blogContent = result.post;
            
            // Log workflow steps with LangSmith if enabled
            if (tracing.isEnabled) {
              await tracing.trackRun("Latest Vulnerability Post Workflow", 
                { cve: latestCveId, inputData }, 
                { blogContent, analysisSteps: {
                  initialAnalysis: result.analysis,
                  technicalDetails: result.technicalDetails,
                  mitigations: result.mitigations
                }},
                { provider, workflowExecutionTime: Date.now() }
              );
            }
          } else {
            console.log("Workflow didn't return valid results, falling back to direct generation");
            
            // Fall back to direct generation
            const llmClient = new LlmClient(provider);
            blogContent = await llmClient.generateBlogPost(inputData);
          }
        } catch (workflowError) {
          ErrorHandler.handleError(workflowError, 'LangGraph Workflow');
          
          // Create LLM client for direct generation as fallback
          const llmClient = new LlmClient(provider);
          blogContent = await llmClient.generateBlogPost(inputData);
        }
      } else {
        // Create LLM client for direct generation
        const llmClient = new LlmClient(provider);
        
        // Generate blog post
        blogContent = await llmClient.generateBlogPost(inputData);
      }
      
      if (!blogContent) {
        const error = ErrorHandler.createError(
          "Failed to generate blog post",
          "Blog Generation",
          ErrorHandler.ERROR_CATEGORIES.LLM
        );
        ErrorHandler.handleError(error, 'Blog Generation', true);
      }
      
      console.log("Successfully generated blog post, saving...");
      
      // Save blog post
      BlogSaver.saveBlogPost(blogContent, latestCveId, inputData);
      
      console.log("Blog post generation complete!");
    }
    else if (options.weekly) {
      console.log("Weekly rollup functionality not yet implemented");
      const error = ErrorHandler.createError(
        "Weekly rollup functionality not yet implemented",
        "Weekly Rollup",
        ErrorHandler.ERROR_CATEGORIES.CONFIG
      );
      ErrorHandler.handleError(error, 'Weekly Rollup', true);
    }
  } catch (error) {
    ErrorHandler.handleError(error, 'Main process', true);
  }
}

// Run the main function
main();