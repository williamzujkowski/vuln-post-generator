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
        // Use LangChain's token counting if available, otherwise use approximation
        try {
          // Dynamic import for token counters to avoid dependency issues
          return {
            countTokens: async (text) => {
              try {
                const { getOpenAITokenCount } = await import("langchain/tokens/openai");
                return await getOpenAITokenCount(text);
              } catch (error) {
                console.warn("Could not use LangChain token counter, using approximation");
                // Fallback to approximation
                return Math.ceil(text.length / 4);
              }
            }
          };
        } catch (error) {
          console.warn("Could not import LangChain token counter, using approximation");
          return {
            countTokens: (text) => Math.ceil(text.length / 4)
          };
        }
        
      case 'claude':
      case 'anthropic':
        // For Claude, use their approximation when available
        try {
          return {
            countTokens: async (text) => {
              try {
                const { getAnthropicTokenCount } = await import("langchain/tokens/anthropic");
                return await getAnthropicTokenCount(text);
              } catch (error) {
                console.warn("Could not use LangChain token counter, using approximation");
                // Claude token counting approximation (slightly different than OpenAI)
                return Math.ceil(text.length / 3.5);
              }
            }
          };
        } catch (error) {
          console.warn("Could not import LangChain token counter, using approximation");
          return {
            countTokens: (text) => Math.ceil(text.length / 3.5)
          };
        }
        
      case 'gemini':
      case 'google':
        // Google's Gemini models use similar tokenization to OpenAI
        return {
          countTokens: (text) => {
            // For Gemini, use approximation as it has similar token patterns to OpenAI
            return Math.ceil(text.length / 4);
          }
        };
        
      default:
        throw new Error(`Unsupported LLM provider: ${targetProvider}`);
    }
  }
}

export default LlmProviderFactory;