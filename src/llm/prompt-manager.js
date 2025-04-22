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
   * @returns {Promise<string>} - Formatted prompt
   */
  async createVulnerabilityPrompt(inputData, useRag = false) {
    try {
      // Select the appropriate template
      const templateKey = useRag ? 'vulnerabilityRag' : 'vulnerability';
      const template = this.promptTemplates[templateKey];
      
      if (!template) {
        throw new Error(`Prompt template '${templateKey}' not found`);
      }
      
      // We'll extract variables manually for more reliability
      
      // Extract variables manually from the template (more reliable approach)
      const variableRegex = /\{([A-Z_]+)\}/g;
      const extractedVariables = new Set();
      let match;
      
      // Get unique variable names from the template
      while ((match = variableRegex.exec(template)) !== null) {
        extractedVariables.add(match[1]);
      }
      
      const extractedVariablesArray = [...extractedVariables];
      console.log(`Template requires ${extractedVariablesArray.length} variables: ${extractedVariablesArray.join(', ')}`);
      
      // Prepare the input data with defaults for required variables
      const preparedInputData = this.prepareInputData(inputData, template, extractedVariablesArray);
      
      // Create a properly configured LangChain PromptTemplate with all required variables
      const promptTemplate = new PromptTemplate({
        template,
        inputVariables: extractedVariablesArray,
      });
      
      // Format the prompt with prepared input data
      const formattedPrompt = await promptTemplate.format(preparedInputData);
      return formattedPrompt;
    } catch (error) {
      console.error("Error creating prompt template:", error);
      // Fall back to basic prompt
      return this.createBasicPrompt(inputData);
    }
  }
  
  /**
   * Prepare input data by adding default values for missing required variables
   * @param {Object} inputData - Original input data
   * @param {string} template - Template string
   * @param {Array<string>} extractedVariables - Variables extracted by LangChain (optional)
   * @returns {Object} - Prepared input data with defaults
   */
  prepareInputData(inputData, template, extractedVariables = null) {
    // Create a copy of the input data to avoid modifying the original
    const preparedData = { ...inputData };
    
    // Use extracted variables if provided, otherwise extract them manually
    let requiredVariables;
    
    if (extractedVariables && extractedVariables.length > 0) {
      // Use the provided variables
      requiredVariables = new Set(extractedVariables);
      console.log(`Using ${requiredVariables.size} provided variables`);
    } else {
      // Fall back to manual extraction
      console.log("Using manual variable extraction as fallback");
      const variableRegex = /\{([A-Z_]+)\}/g;
      requiredVariables = new Set();
      let match;
      
      // Get unique variable names from the template
      while ((match = variableRegex.exec(template)) !== null) {
        requiredVariables.add(match[1]);
      }
      console.log(`Extracted ${requiredVariables.size} variables from template`);
    }
    
    // Add default values for missing variables
    for (const variable of requiredVariables) {
      if (!(variable in preparedData)) {
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
        preparedData[variable] = defaultValue;
      }
    }
    
    return preparedData;
  }
  
  /**
   * Create a basic fallback prompt when template processing fails
   * @param {Object} inputData - Vulnerability data
   * @returns {string} - Basic prompt
   */
  createBasicPrompt(inputData) {
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