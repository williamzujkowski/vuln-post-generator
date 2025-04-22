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
      
      // Extract template variables - variables in the template are in the format {VARIABLE_NAME}
      const variableRegex = /\{([A-Z_]+)\}/g;
      const matches = template.matchAll(variableRegex);
      const requiredVariables = [...new Set([...matches].map(match => match[1]))];
      
      // Create a complete input data object with all required variables
      const completeInputData = { ...inputData };
      
      // Add missing variables with default values
      for (const variable of requiredVariables) {
        if (!(variable in completeInputData)) {
          // Set default values for known variables
          switch (variable) {
            case 'VULN_NAME':
              completeInputData.VULN_NAME = inputData.SUMMARY || 
                                           `${inputData.VULNERABILITY_TYPE || 'Security'} vulnerability in ${inputData.AFFECTED_PRODUCTS || 'affected software'}`;
              break;
            case 'SEVERITY_RATING':
              // Derive severity rating from CVSS score if available
              if (inputData.CVSS_SCORE) {
                const score = parseFloat(inputData.CVSS_SCORE);
                if (score >= 9.0) completeInputData.SEVERITY_RATING = 'Critical';
                else if (score >= 7.0) completeInputData.SEVERITY_RATING = 'High';
                else if (score >= 4.0) completeInputData.SEVERITY_RATING = 'Medium';
                else completeInputData.SEVERITY_RATING = 'Low';
              } else {
                completeInputData.SEVERITY_RATING = 'Unknown';
              }
              break;
            case 'AFFECTED_SOFTWARE':
              completeInputData.AFFECTED_SOFTWARE = inputData.AFFECTED_PRODUCTS || 'Unknown software';
              break;
            case 'AFFECTED_VERSIONS':
              completeInputData.AFFECTED_VERSIONS = inputData.AFFECTED_PRODUCTS || 'Unknown versions';
              break;
            case 'VULN_SUMMARY':
              completeInputData.VULN_SUMMARY = inputData.SUMMARY || inputData.DESCRIPTION || 'No summary available';
              break;
            case 'POC_INFO':
              completeInputData.POC_INFO = inputData.EXPLOIT_STATUS || 'Unknown';
              break;
            case 'IMPACT_ANALYSIS':
              completeInputData.IMPACT_ANALYSIS = 'Potential impact details are not fully available.';
              break;
            case 'MITIGATION_GUIDANCE':
              completeInputData.MITIGATION_GUIDANCE = inputData.WORKAROUNDS || inputData.PATCHES_AVAILABLE || 'No specific mitigation guidance available.';
              break;
            default:
              completeInputData[variable] = `No ${variable.toLowerCase().replace(/_/g, ' ')} information available`;
          }
          console.log(`Added default value for missing variable: ${variable}`);
        }
      }
      
      // Create LangChain prompt template with all required variables
      const promptTemplate = new PromptTemplate({
        template,
        inputVariables: requiredVariables,
      });
      
      // Format the template with the complete input data
      return promptTemplate.format(completeInputData);
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