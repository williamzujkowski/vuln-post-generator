// LLM Provider using LangChain.js
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import config from "../config/index.js";

/**
 * Factory class for creating LLM providers using LangChain
 */
class LlmProviderFactory {
  /**
   * Create an LLM provider instance based on configuration
   * @param {string} provider - Optional provider override
   * @returns {ChatOpenAI|ChatAnthropic|ChatGoogleGenerativeAI} - LangChain chat model
   */
  static createProvider(provider = null) {
    const targetProvider = provider || config.getLlmProvider();
    const apiKey = config.getApiKey(targetProvider);
    const modelName = config.getModelName(targetProvider);
    
    // Common options for all providers
    const options = {
      temperature: 0.7,
      modelName: modelName,
      verbose: true
    };
    
    switch (targetProvider.toLowerCase()) {
      case 'openai':
        return new ChatOpenAI({
          ...options,
          openAIApiKey: apiKey,
        });
        
      case 'claude':
      case 'anthropic':
        return new ChatAnthropic({
          ...options,
          anthropicApiKey: apiKey,
        });
        
      case 'gemini':
      case 'google':
        return new ChatGoogleGenerativeAI({
          ...options,
          apiKey: apiKey,
        });
        
      default:
        throw new Error(`Unsupported LLM provider: ${targetProvider}`);
    }
  }
  
  /**
   * Get token usage tracking helper for the given provider
   * @param {string} provider - The LLM provider
   * @returns {Object} - Token tracking tools
   */
  static getTokenTracker(provider = null) {
    const targetProvider = provider || config.getLlmProvider();
    
    // Return provider-specific token tracking helpers
    switch (targetProvider.toLowerCase()) {
      case 'openai':
        return {
          countTokens: (text) => {
            // OpenAI token counting logic
            // For a simple approximation: ~4 chars per token
            return Math.ceil(text.length / 4);
          }
        };
        
      case 'claude':
      case 'anthropic':
        return {
          countTokens: (text) => {
            // Claude token counting logic
            // For a simple approximation: ~4 chars per token
            return Math.ceil(text.length / 4);
          }
        };
        
      case 'gemini':
      case 'google':
        return {
          countTokens: (text) => {
            // Gemini token counting logic
            // For a simple approximation: ~4 chars per token
            return Math.ceil(text.length / 4);
          }
        };
        
      default:
        throw new Error(`Unsupported LLM provider: ${targetProvider}`);
    }
  }
}

export default LlmProviderFactory;