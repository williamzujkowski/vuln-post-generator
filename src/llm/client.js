// LLM Client for vulnerability post generation using LangChain
import { HumanMessage } from "langchain/schema";
import { PromptTemplate } from "langchain/prompts";
import LlmProviderFactory from "./provider.js";
import PromptManager from "./prompt-manager.js";
import config from "../config/index.js";
import metricsLogger from "../utils/metrics-logger.js";

/**
 * LLM client for generating vulnerability blog posts using LangChain
 */
class LlmClient {
  constructor(provider = null) {
    this.provider = provider || config.getLlmProvider();
    
    // Try to create the provider with fallback options in preferred order:
    // First OpenAI (GPT-4o), then Claude (Opus), then Gemini
    try {
      this.llm = LlmProviderFactory.createProvider(this.provider);
    } catch (error) {
      console.warn(`Failed to initialize primary provider ${this.provider}: ${error.message}`);
      
      // Try Claude as fallback if primary is not Claude
      if (this.provider.toLowerCase() !== 'claude' && this.provider.toLowerCase() !== 'anthropic') {
        try {
          console.log("Attempting to fall back to Claude...");
          this.provider = 'claude';
          this.llm = LlmProviderFactory.createProvider(this.provider);
        } catch (claudeError) {
          console.warn(`Failed to initialize Claude fallback: ${claudeError.message}`);
          
          // Try Gemini as last resort
          if (this.provider.toLowerCase() !== 'gemini' && this.provider.toLowerCase() !== 'google') {
            try {
              console.log("Attempting to fall back to Gemini...");
              this.provider = 'gemini';
              this.llm = LlmProviderFactory.createProvider(this.provider);
            } catch (geminiError) {
              console.error("All fallback providers failed! This is a critical error.");
              throw new Error("Failed to initialize any LLM provider: " + error.message);
            }
          } else {
            throw error; // Original error if Gemini was the initial provider
          }
        }
      } else {
        // Try Gemini as fallback if Claude was already the primary
        try {
          console.log("Attempting to fall back to Gemini...");
          this.provider = 'gemini';
          this.llm = LlmProviderFactory.createProvider(this.provider);
        } catch (geminiError) {
          console.error("All fallback providers failed! This is a critical error.");
          throw new Error("Failed to initialize any LLM provider: " + error.message);
        }
      }
    }
    
    console.log(`Successfully initialized LLM provider: ${this.provider}`);
    this.promptManager = new PromptManager();
    this.tokenTracker = LlmProviderFactory.getTokenTracker(this.provider);
  }
  
  /**
   * Generate a blog post for a vulnerability or general topic
   * @param {Object} inputData - Data about the vulnerability or topic
   * @param {boolean} useRag - Whether to use RAG-enhanced generation
   * @param {string} templateContext - Optional template context for formatting
   * @returns {Promise<string>} - Generated blog post content
   */
  async generateBlogPost(inputData, useRag = false, templateContext = '') {
    try {
      // Determine if this is a vulnerability post or general blog post
      const isVulnPost = inputData.CVE_ID !== undefined;
      
      if (isVulnPost) {
        console.log(`Generating vulnerability post with ${this.provider}...`);
      } else {
        console.log(`Generating general blog post on "${inputData.TOPIC}" with ${this.provider}...`);
      }
      
      // Create appropriate fallback prompt based on post type
      const fallbackPrompt = isVulnPost ? 
        // Vulnerability post fallback
        `
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
        ` :
        // General blog post fallback
        `
        You are a technical writer creating a detailed blog post about ${inputData.TOPIC || 'the specified topic'}.
        
        Here is what we know about the topic:
        
        ${JSON.stringify(inputData, null, 2)}
        
        Write a comprehensive and technical blog post about this topic.
        Include sections for:
        1. Introduction
        2. Background and Context
        3. Technical Details
        4. Implementation or Application
        5. Best Practices
        6. Conclusion
        
        Format it as Markdown with appropriate headings, code examples, and bullet points.
        ${templateContext ? '\n\nUse this template format for the final post:\n' + templateContext : ''}
        `;
      
      try {
        // Record start time for metrics
        const startTime = new Date();
        
        // Try to create the prompt from template based on post type
        const prompt = isVulnPost ? 
          await this.promptManager.createVulnerabilityPrompt(inputData, useRag) :
          await this.promptManager.createGeneralBlogPrompt(inputData);
        
        // Estimate token usage 
        let estimatedTokens;
        try {
          estimatedTokens = await this.tokenTracker.countTokens(prompt);
        } catch (error) {
          // If token counting fails, just log and continue
          console.warn("Token counting failed, continuing without count:", error.message);
          estimatedTokens = "unknown";
        }
        console.log(`Estimated input tokens: ${estimatedTokens}`);
        
        // Call the LLM with LangChain
        const response = await this.llm.invoke([
          new HumanMessage(prompt)
        ]);
        
        // Record end time for metrics
        const endTime = new Date();
        
        // Process the response content
        let content = response.content;
        
        // Check if the response is just echoing back the input template
        if (content.includes("# Vulnerability Summary Blog Post Generator") && 
            content.includes("## INPUT DATA") &&
            content.includes("## BLOG GUIDELINES") &&
            content.includes("## CONTENT STRUCTURE")) {
          console.warn("LLM echoed back the template instead of generating content, using fallback prompt...");
          
          // Generate a simplified fallback prompt
          const fallbackPrompt = `
            You are a security expert writing about CVE-${inputData.CVE_ID || 'unknown'}.
            
            Create a detailed technical blog post about this vulnerability in Markdown format.
            Include proper sections for:
            1. Executive Summary
            2. Technical details
            3. Impact assessment
            4. Mitigation recommendations
            
            Here is what we know about the vulnerability:
            ${JSON.stringify(inputData, null, 2)}
            
            Keep the output focused, technical, and useful for security professionals.
          `;
          
          // Call with simplified fallback prompt
          console.log("Retrying with simplified prompt...");
          const fallbackResponse = await this.llm.invoke([
            new HumanMessage(fallbackPrompt)
          ]);
          
          content = fallbackResponse.content;
        }
        
        // Log metrics about this run
        metricsLogger.logRun({
          name: `Generate Blog Post: ${inputData.CVE_ID || 'unknown'}`,
          model: config.getModelName(this.provider),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          inputTokens: typeof estimatedTokens === 'number' ? estimatedTokens : Math.ceil(prompt.length / 4),
          outputTokens: Math.ceil(content.length / 4),
          status: 'success',
          metadata: {
            cveId: inputData.CVE_ID,
            useRag: useRag,
            provider: this.provider
          }
        });
        
        return content;
      } catch (templateError) {
        console.log('Using fallback prompt due to template error:', templateError.message);
        
        // Record start time for metrics
        const startTime = new Date();
        
        // Call the LLM with fallback prompt
        const response = await this.llm.invoke([
          new HumanMessage(fallbackPrompt)
        ]);
        
        // Record end time for metrics
        const endTime = new Date();
        
        // Process the response content
        let generatedContent = response.content;
        
        // Check if the response is just echoing back the input template
        if (generatedContent.includes("You are a security expert writing a detailed blog post about vulnerability") && 
            generatedContent.includes("Write a comprehensive and technical blog post about this vulnerability")) {
          console.warn("LLM echoed back the fallback template instead of generating content, creating an ultra-simplified prompt...");
          
          // Generate an ultra-simplified fallback prompt
          const ultraSimplePrompt = `
            Write a technical blog post about CVE-${inputData.CVE_ID || 'unknown'}.
            
            Include these sections:
            - Summary
            - Technical Details
            - Impact
            - Mitigation
            
            Vulnerability Info: Critical RCE in ${inputData.AFFECTED_PRODUCTS || 'the affected software'}.
            
            Format in Markdown.
          `;
          
          // Call with ultra-simplified prompt
          console.log("Retrying with ultra-simplified prompt...");
          const finalFallbackResponse = await this.llm.invoke([
            new HumanMessage(ultraSimplePrompt)
          ]);
          
          generatedContent = finalFallbackResponse.content;
        }
        
        // Get token counts from response or estimate
        const inputTokens = response.usage?.promptTokens || Math.ceil(fallbackPrompt.length / 4);
        const outputTokens = response.usage?.completionTokens || Math.ceil(generatedContent.length / 4);
        
        // Log token usage if available from LLM
        if (response.usage) {
          console.log(`Token Usage Summary (Fallback):`);
          console.log(`Provider: ${this.provider}`);
          console.log(`Model: ${config.getModelName(this.provider)}`);
          console.log(`Input tokens: ${response.usage.promptTokens}`);
          console.log(`Output tokens: ${response.usage.completionTokens}`);
          console.log(`Total tokens: ${response.usage.totalTokens}`);
        }
        
        // Log metrics about this fallback run
        metricsLogger.logRun({
          name: `Generate Blog Post (Fallback): ${inputData.CVE_ID || 'unknown'}`,
          model: config.getModelName(this.provider),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          inputTokens,
          outputTokens,
          status: 'success',
          metadata: {
            cveId: inputData.CVE_ID,
            useRag: useRag,
            provider: this.provider,
            fallback: true,
            error: templateError.message
          }
        });
        
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
        new HumanMessage(prompt)
      ]);
      
      return response.content;
    } catch (error) {
      console.error('Error generating summary:', error);
      return `A vulnerability affecting ${inputData.AFFECTED_PRODUCTS || 'various systems'} with CVSS score ${inputData.CVSS_SCORE || 'unknown'}.`;
    }
  }
}

export default LlmClient;