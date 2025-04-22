// Prompt management for vulnerability post generation
import fs from 'fs';
import path from 'path';
import { PromptTemplate } from "langchain/prompts";
import config from "../config/index.js";

/**
 * Manages prompt templates for vulnerability post generation
 */
class PromptManager {
  constructor() {
    this.promptsDir = config.getPromptsDir();
    this.promptTemplates = {};
    this.initializePromptTemplates();
  }
  
  /**
   * Initialize and load all prompt templates
   */
  initializePromptTemplates() {
    try {
      // Regular vulnerability post prompt
      const vulnPromptPath = path.join(this.promptsDir, 'threat-blog-post.prompt');
      if (fs.existsSync(vulnPromptPath)) {
        this.promptTemplates.vulnerability = fs.readFileSync(vulnPromptPath, 'utf8');
      } else {
        console.warn(`Vulnerability prompt template not found at: ${vulnPromptPath}`);
      }
      
      // RAG-enhanced vulnerability post prompt
      const ragPromptPath = path.join(this.promptsDir, 'threat-blog-post-rag.prompt');
      if (fs.existsSync(ragPromptPath)) {
        this.promptTemplates.vulnerabilityRag = fs.readFileSync(ragPromptPath, 'utf8');
      } else {
        console.warn(`RAG vulnerability prompt template not found at: ${ragPromptPath}`);
      }
    } catch (error) {
      console.error('Error initializing prompt templates:', error);
    }
  }
  
  /**
   * Create a vulnerability blog post prompt with LangChain PromptTemplate
   * @param {Object} inputData - Vulnerability data for the prompt
   * @param {boolean} useRag - Whether to use the RAG-enhanced prompt
   * @returns {string} - Formatted prompt
   */
  createVulnerabilityPrompt(inputData, useRag = false) {
    try {
      // Select the appropriate template
      const templateKey = useRag ? 'vulnerabilityRag' : 'vulnerability';
      const template = this.promptTemplates[templateKey];
      
      if (!template) {
        throw new Error(`Prompt template '${templateKey}' not found`);
      }
      
      // Simple template variable replacement
      // Extract all variable names from the template (format: {VARIABLE_NAME})
      let processedTemplate = template;
      const variableRegex = /\{([A-Z_]+)\}/g;
      let match;
      
      // Get unique variable names from the template
      const requiredVariables = new Set();
      while ((match = variableRegex.exec(template)) !== null) {
        requiredVariables.add(match[1]);
      }
      
      // Generate default values for missing variables
      for (const variable of requiredVariables) {
        if (!(variable in inputData)) {
          let defaultValue = '';
          
          // Set default values for known variables
          switch (variable) {
            case 'CVE_ID':
              defaultValue = inputData.CVE_ID || 'Unknown CVE';
              break;
            case 'VULN_NAME':
              defaultValue = inputData.SUMMARY || 
                            `${inputData.VULNERABILITY_TYPE || 'Security'} vulnerability in ${inputData.AFFECTED_PRODUCTS || 'affected software'}`;
              break;
            case 'CVSS_SCORE':
              defaultValue = inputData.CVSS_SCORE || 'Unknown';
              break;
            case 'CVSS_VECTOR':
              defaultValue = inputData.CVSS_VECTOR || 'Unknown';
              break;
            case 'SEVERITY_RATING':
              // Derive severity rating from CVSS score if available
              if (inputData.CVSS_SCORE) {
                const score = parseFloat(inputData.CVSS_SCORE);
                if (score >= 9.0) defaultValue = 'Critical';
                else if (score >= 7.0) defaultValue = 'High';
                else if (score >= 4.0) defaultValue = 'Medium';
                else defaultValue = 'Low';
              } else {
                defaultValue = 'Unknown';
              }
              break;
            case 'AFFECTED_SOFTWARE':
              defaultValue = inputData.AFFECTED_PRODUCTS || 'Unknown software';
              break;
            case 'AFFECTED_VERSIONS':
              defaultValue = inputData.AFFECTED_PRODUCTS || 'Unknown versions';
              break;
            case 'VULN_SUMMARY':
              defaultValue = inputData.SUMMARY || inputData.DESCRIPTION || 'No summary available';
              break;
            case 'TECHNICAL_DETAILS':
              defaultValue = inputData.TECHNICAL_DETAILS || 'Technical details are not fully available.';
              break;
            case 'POC_INFO':
              defaultValue = inputData.EXPLOIT_STATUS || 'Unknown';
              break;
            case 'IMPACT_ANALYSIS':
              defaultValue = 'Potential impact details are not fully available.';
              break;
            case 'MITIGATION_GUIDANCE':
              defaultValue = inputData.WORKAROUNDS || inputData.PATCHES_AVAILABLE || 'No specific mitigation guidance available.';
              break;
            case 'REFERENCE_URLS':
              defaultValue = inputData.REFERENCES || 'No reference URLs available';
              break;
            case 'CWE_ID':
              defaultValue = 'CWE ID not specified';
              break;
            case 'THREAT_ACTORS':
              defaultValue = 'No specific threat actor information available';
              break;
            case 'AWS_IMPACT':
              defaultValue = 'AWS impact not specified';
              break;
            case 'CLOUD_RELEVANCE':
              defaultValue = 'Cloud relevance not specified';
              break;
            case 'IMAGE_PATH_PLACEHOLDER':
              defaultValue = 'blog/security-blog.jpg';
              break;
            default:
              defaultValue = `No ${variable.toLowerCase().replace(/_/g, ' ')} information available`;
          }
          
          console.log(`Added default value for missing variable: ${variable}`);
          
          // Replace variable in template string
          processedTemplate = processedTemplate.replace(
            new RegExp(`\\{${variable}\\}`, 'g'), 
            defaultValue
          );
        } else {
          // Use the provided value from inputData
          processedTemplate = processedTemplate.replace(
            new RegExp(`\\{${variable}\\}`, 'g'), 
            String(inputData[variable])
          );
        }
      }
      
      return processedTemplate;
    } catch (error) {
      console.error('Error creating vulnerability prompt:', error);
      
      // Fallback to a basic prompt
      return `
        You are a security expert writing a detailed blog post about vulnerability ${inputData.CVE_ID || 'unknown'}.
        
        Here is what we know about the vulnerability:
        
        ${JSON.stringify(inputData, null, 2)}
        
        Write a comprehensive and technical blog post about this vulnerability.
        Include sections for:
        1. Introduction and Summary
        2. Technical Details
        3. Impact Assessment
        4. Exploit Details
        5. Mitigation Recommendations
        6. Conclusion
        
        Format it as Markdown.
      `;
    }
  }
  
  /**
   * Get the raw prompt template
   * @param {string} name - Template name
   * @returns {string} - Raw template
   */
  getRawTemplate(name) {
    return this.promptTemplates[name];
  }
}

export default PromptManager;