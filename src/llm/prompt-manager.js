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
      
      // Prepare input variables from template
      const inputVariables = Object.keys(inputData);
      
      // Create LangChain prompt template
      const promptTemplate = new PromptTemplate({
        template,
        inputVariables,
      });
      
      // Format the template with the input data
      return promptTemplate.format(inputData);
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