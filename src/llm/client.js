// LLM Client for vulnerability post generation using LangChain
import { HumanMessage } from "langchain/schema";
import LlmProviderFactory from "./provider.js";
import PromptManager from "./prompt-manager.js";
import config from "../config/index.js";

/**
 * LLM client for generating vulnerability blog posts using LangChain
 */
class LlmClient {
  constructor(provider = null) {
    this.provider = provider || config.getLlmProvider();
    this.llm = LlmProviderFactory.createProvider(this.provider);
    this.promptManager = new PromptManager();
    this.tokenTracker = LlmProviderFactory.getTokenTracker(this.provider);
  }
  
  /**
   * Generate a blog post for a vulnerability
   * @param {Object} inputData - Data about the vulnerability
   * @param {boolean} useRag - Whether to use RAG-enhanced generation
   * @returns {Promise<string>} - Generated blog post content
   */
  async generateBlogPost(inputData, useRag = false) {
    try {
      console.log(`Generating vulnerability post with ${this.provider}...`);
      
      // Create a fallback prompt
      const fallbackPrompt = `
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
      
      try {
        // Try to create the prompt from template
        const prompt = this.promptManager.createVulnerabilityPrompt(inputData, useRag);
        
        // Estimate token usage 
        const estimatedTokens = this.tokenTracker.countTokens(prompt);
        console.log(`Estimated input tokens: ${estimatedTokens}`);
        
        // Call the LLM with LangChain
        const response = await this.llm.invoke([
          new HumanMessage({ content: prompt })
        ]);
        
        return response.content;
      } catch (templateError) {
        console.log('Using fallback prompt due to template error:', templateError.message);
        
        // Call the LLM with fallback prompt
        const response = await this.llm.invoke([
          new HumanMessage({ content: fallbackPrompt })
        ]);
        
        // Extract and return the content
        const generatedContent = response.content;
        
        // Log token usage if available from LLM
        if (response.usage) {
          console.log(`Token Usage Summary (Fallback):`);
          console.log(`Provider: ${this.provider}`);
          console.log(`Model: ${config.getModelName(this.provider)}`);
          console.log(`Input tokens: ${response.usage.promptTokens}`);
          console.log(`Output tokens: ${response.usage.completionTokens}`);
          console.log(`Total tokens: ${response.usage.totalTokens}`);
        }
        
        return generatedContent;
      }
    } catch (error) {
      console.error('Error generating blog post with LLM:', error);
      throw error;
    }
  }
  
  /**
   * Generate a summary for a vulnerability
   * @param {Object} inputData - Basic vulnerability data
   * @returns {Promise<string>} - Generated summary
   */
  async generateSummary(inputData) {
    try {
      const prompt = `
        Summarize the following vulnerability in 2-3 concise sentences:
        
        CVE ID: ${inputData.CVE_ID || 'unknown'}
        Description: ${inputData.DESCRIPTION || 'unknown'}
        CVSS Score: ${inputData.CVSS_SCORE || 'unknown'}
        Affected Products: ${inputData.AFFECTED_PRODUCTS || 'unknown'}
      `;
      
      const response = await this.llm.invoke([
        new HumanMessage({ content: prompt })
      ]);
      
      return response.content;
    } catch (error) {
      console.error('Error generating summary:', error);
      return `A vulnerability affecting ${inputData.AFFECTED_PRODUCTS || 'various systems'} with CVSS score ${inputData.CVSS_SCORE || 'unknown'}.`;
    }
  }
}

export default LlmClient;