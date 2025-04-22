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
  .option('--use-workflow <boolean>', 'Use LangGraph workflow (true/false)', 'false')
  .option('--enable-tracing <boolean>', 'Enable LangSmith tracing (true/false)', 'false')
  .parse(process.argv);

const options = program.opts();

/**
 * Create input data for a CVE by querying the NVD API
 * @param {string} cveId - The CVE ID
 * @returns {Promise<Object>} - Vulnerability data
 */
async function createInputData(cveId) {
  console.log(`Creating input data for ${cveId}...`);
  
  try {
    // Set up headers with API key if available
    const headers = {
      "User-Agent": "William Zujkowski Blog Vulnerability Analyzer",
    };
    
    // Add NVD API key if available
    if (process.env.NVD_API_KEY) {
      console.log("Using NVD API key for higher rate limits");
      headers["apiKey"] = process.env.NVD_API_KEY;
    }
    
    // Dynamically import axios
    const axios = (await import('axios')).default;
    
    // Query the NVD API for this specific CVE
    const response = await axios.get(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`,
      { headers }
    );
    
    if (
      response.data &&
      response.data.vulnerabilities &&
      response.data.vulnerabilities.length > 0
    ) {
      const vulnData = response.data.vulnerabilities[0].cve;
      
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
      let isKev = "Unknown";
      try {
        const kevResponse = await axios.get(
          "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
        );
        
        if (kevResponse.data && kevResponse.data.vulnerabilities) {
          const normalizedCveId = cveId.toUpperCase().trim();
          const found = kevResponse.data.vulnerabilities.find(v => {
            const kevId = v.cveID || "";
            return kevId.toUpperCase().trim() === normalizedCveId;
          });
          
          isKev = found ? "Yes" : "No";
        }
      } catch (error) {
        console.warn("Error checking KEV status:", error.message);
      }
      
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
        EXPLOIT_STATUS: "Unknown", // NVD doesn't provide this directly
        PATCHES_AVAILABLE: "Unknown", // NVD doesn't provide this directly
        WORKAROUNDS: "Consult vendor advisories for mitigation strategies",
        REFERENCES: referenceUrls || "No references available",
        IS_KEV: isKev,
        DISCOVERY_DATE: vulnData.published || "Unknown",
        VENDOR_STATEMENT: "Refer to vendor advisories for official statements",
        SUMMARY: englishDesc.value || `Vulnerability ${cveId}`,
        CWE_ID: vulnData.weaknesses?.[0]?.description?.[0]?.value || "Unknown"
      };
    }
    
    console.warn(`No data found for ${cveId}, using fallback data`);
    // Use fallback data if the API request fails or returns no data
    return getFallbackData(cveId);
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
 * Find the latest critical CVE from the last 15 days
 * @returns {Promise<string>} - CVE ID
 */
async function findLatestCriticalCVE() {
  try {
    console.log("Searching for critical vulnerabilities from the last 15 days...");
    
    // Set up headers with API key if available
    const headers = {
      "User-Agent": "William Zujkowski Blog Vulnerability Analyzer",
    };
    
    // Add NVD API key if available
    if (process.env.NVD_API_KEY) {
      console.log("Using NVD API key for higher rate limits");
      headers["apiKey"] = process.env.NVD_API_KEY;
    }
    
    // Calculate date from 15 days ago
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const pubStartDate = fifteenDaysAgo.toISOString().split('T')[0];
    
    console.log(`Searching for vulnerabilities published since ${pubStartDate}`);
    
    // Dynamically import axios
    const axios = (await import('axios')).default;
    
    // Query the NVD API for recent critical vulnerabilities
    const response = await axios.get(
      `https://services.nvd.nist.gov/rest/json/cves/2.0` +
      `?pubStartDate=${pubStartDate}T00:00:00.000` +
      `&cvssV3Severity=CRITICAL` +
      `&resultsPerPage=10`, // Limit to 10 results to avoid overwhelming the API
      { headers }
    );
    
    if (
      response.data &&
      response.data.vulnerabilities &&
      response.data.vulnerabilities.length > 0
    ) {
      // Sort vulnerabilities by CVSS score (highest first)
      const sortedVulns = response.data.vulnerabilities.sort((a, b) => {
        const scoreA = a.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0;
        const scoreB = b.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0;
        return scoreB - scoreA;
      });
      
      // Find vulnerability with highest CVSS score that's in CISA KEV catalog
      for (const vuln of sortedVulns) {
        const cveId = vuln.cve.id;
        console.log(`Found critical vulnerability: ${cveId} with score: ${vuln.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 'unknown'}`);
        
        // For now, just return the first critical vulnerability we find
        // In a production environment, we'd check CISA KEV and other criteria
        return cveId;
      }
      
      // If no match found in KEV, return the highest scored vulnerability
      if (sortedVulns.length > 0) {
        const topVuln = sortedVulns[0];
        console.log(`No vulnerabilities in KEV found, using highest scored vulnerability: ${topVuln.cve.id}`);
        return topVuln.cve.id;
      }
    }
    
    console.log("No critical vulnerabilities found in the last 15 days, using fallback CVE");
    return "CVE-2023-50164"; // Fallback to a known CVE
  } catch (error) {
    console.error("Error finding latest critical CVE:", error.message);
    console.log("Using fallback CVE due to error");
    return "CVE-2023-50164"; // Fallback to a known CVE
  }
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
    
    // Set environment variables based on options
    if (options.enableTracing === 'true') {
      process.env.ENABLE_TRACING = 'true';
    }
    
    // Override provider if specified
    const provider = options.provider || config.getLlmProvider();
    
    // Import dynamically to avoid circular dependencies
    const { default: tracing } = await import('./src/utils/tracing.js');
    const { default: VulnPostWorkflow } = await import('./src/workflow/vuln-post-workflow.js');
    
    // Initialize workflow
    const workflow = new VulnPostWorkflow();
    const useWorkflow = options.useWorkflow === 'true' || process.env.USE_WORKFLOW === 'true';
    
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
        console.error("Failed to get vulnerability data");
        process.exit(1);
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
          console.error("LangGraph workflow error, falling back to direct generation:", workflowError.message);
          
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
          console.error("LangGraph workflow error, falling back to direct generation:", workflowError.message);
          
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