/**
 * LLM Provider Utilities
 *
 * This module provides unified interfaces for OpenAI, Google Gemini, and Anthropic Claude APIs
 * allowing the application to switch between providers easily.
 */

const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Generate content using the selected LLM provider with a tiered approach
 * Uses cheaper models for data gathering and expensive models for final synthesis
 *
 * @param {string} prompt - The prompt to send to the LLM
 * @param {Object} options - Provider-specific options
 * @param {boolean} options.useTieredApproach - Whether to use the tiered approach (default: true)
 * @param {boolean} options.isDataGathering - Whether this is a data gathering step (internal use)
 * @returns {Promise<string>} The generated content
 */
async function generateContent(prompt, options = {}) {
  const provider = process.env.LLM_PROVIDER || "openai";
  const useTieredApproach = options.useTieredApproach !== false; // Default to true unless explicitly disabled

  console.log(`Using LLM provider: ${provider} ${useTieredApproach ? '(tiered approach)' : ''}`);

  // If this is the final compilation or tiered approach is disabled, use the premium model
  if (!useTieredApproach || options.isCompilation) {
    if (provider.toLowerCase() === "gemini") {
      return generateWithGemini(prompt, options);
    } else if (provider.toLowerCase() === "claude") {
      return generateWithClaude(prompt, options);
    } else {
      return generateWithOpenAI(prompt, options);
    }
  }
  
  // For data gathering steps, use cheaper models
  // Step 1: Extract key information using a cheaper model
  console.log("Step 1: Using cheaper model for initial data gathering");
  
  // Create a simplified prompt for data gathering
  const dataGatheringPrompt = `
  Extract and summarize the key technical facts about this vulnerability. Focus on:
  - Technical mechanism
  - Affected systems 
  - Exploitation methods
  - Impact details
  - Technical mitigations
  
  Original prompt: ${prompt}`;
  
  // Use cheaper models for each provider
  let initialData;
  const dataGatheringOptions = { ...options, isDataGathering: true };
  
  if (provider.toLowerCase() === "gemini") {
    dataGatheringOptions.model = "gemini-2.0-flash"; // Use Gemini Flash (cheaper)
    initialData = await generateWithGemini(dataGatheringPrompt, dataGatheringOptions);
  } else if (provider.toLowerCase() === "claude") {
    dataGatheringOptions.model = "claude-3-haiku-20240307"; // Use Claude Haiku (cheaper)
    initialData = await generateWithClaude(dataGatheringPrompt, dataGatheringOptions);
  } else {
    dataGatheringOptions.model = "gpt-3.5-turbo"; // Use GPT-3.5 (cheaper)
    initialData = await generateWithOpenAI(dataGatheringPrompt, dataGatheringOptions);
  }
  
  // Step 2: Generate final content using premium model with the extracted data
  console.log("Step 2: Using premium model for final synthesis");
  
  const synthesisPrompt = `
  Use the following technical analysis as reference while creating your final response:
  
  TECHNICAL ANALYSIS FROM FIRST PASS:
  ${initialData}
  
  ORIGINAL REQUEST:
  ${prompt}
  
  Create a comprehensive, well-structured response using the technical details above.
  `;
  
  // Use premium models for final synthesis
  const finalOptions = { ...options, isCompilation: true };
  
  if (provider.toLowerCase() === "gemini") {
    finalOptions.model = options.model || "gemini-2.0-pro"; // Use default premium model
    return generateWithGemini(synthesisPrompt, finalOptions);
  } else if (provider.toLowerCase() === "claude") {
    finalOptions.model = options.model || "claude-3-opus-20240229"; // Use default premium model
    return generateWithClaude(synthesisPrompt, finalOptions);
  } else {
    finalOptions.model = options.model || "gpt-4-turbo"; // Use default premium model
    return generateWithOpenAI(synthesisPrompt, finalOptions);
  }
}

/**
 * Generate content using OpenAI's API
 *
 * @param {string} prompt - The prompt to send to OpenAI
 * @param {Object} options - OpenAI-specific options
 * @returns {Promise<string>} The generated content
 */
async function generateWithOpenAI(prompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is required when using OpenAI"
    );
  }

  const model = options.model || "gpt-4-turbo";
  const temperature = options.temperature || 0.7;
  const maxTokens = options.maxTokens || 4000;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: model,
        messages: [
          {
            role: "system",
            content: "Security expert analyzing vulnerabilities.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Record token usage
    if (response.data.usage) {
      console.log(`Token usage - Input: ${response.data.usage.prompt_tokens}, Output: ${response.data.usage.completion_tokens}`);
      
      // Export token usage statistics
      global.tokenUsage = global.tokenUsage || {};
      global.tokenUsage.input = response.data.usage.prompt_tokens;
      global.tokenUsage.output = response.data.usage.completion_tokens;
      global.tokenUsage.provider = "openai";
      global.tokenUsage.model = model;
    }
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating content with OpenAI:", error.message);
    if (error.response) {
      console.error("API response:", error.response.data);
    }
    throw error;
  }
}

/**
 * Generate content using Google's Gemini API
 *
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} options - Gemini-specific options
 * @returns {Promise<string>} The generated content
 */
async function generateWithGemini(prompt, options = {}) {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY environment variable is required when using Gemini"
    );
  }

  // If model is not specified in options, use gemini-2.0-flash as default (as requested)
  const model = options.model || "gemini-2.0-flash";
  const temperature = options.temperature || 0.7;

  try {
    // Initialize the Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model });

    // Configure the generation parameters
    const generationConfig = {
      temperature: temperature,
      topK: options.topK || 40,
      topP: options.topP || 0.95,
      maxOutputTokens: options.maxOutputTokens || 8192,
    };

    // Generate content - use a more concise system prompt
    const systemPrompt = "Security expert analyzing vulnerabilities.";
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig,
    });

    // Estimate token usage for Gemini (no direct token count available in API response)
    const responseText = result.response.text();
    const estimatedInputTokens = Math.ceil(fullPrompt.length / 4); // Rough estimate - 1 token ≈ 4 chars
    const estimatedOutputTokens = Math.ceil(responseText.length / 4);
    
    console.log(`Token usage (estimated) - Input: ~${estimatedInputTokens}, Output: ~${estimatedOutputTokens}`);
    
    // Export token usage statistics
    global.tokenUsage = global.tokenUsage || {};
    global.tokenUsage.input = estimatedInputTokens;
    global.tokenUsage.output = estimatedOutputTokens;
    global.tokenUsage.provider = "gemini";
    global.tokenUsage.model = model;
    global.tokenUsage.estimated = true;
    
    return responseText;
  } catch (error) {
    console.error("Error generating content with Gemini:", error.message);
    throw error;
  }
}

/**
 * Generate content using Anthropic's Claude API
 *
 * @param {string} prompt - The prompt to send to Claude
 * @param {Object} options - Claude-specific options
 * @returns {Promise<string>} The generated content
 */
async function generateWithClaude(prompt, options = {}) {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CLAUDE_API_KEY environment variable is required when using Claude"
    );
  }

  const model = options.model || "claude-3-opus-20240229";
  const temperature = options.temperature || 0.7;
  const maxTokens = options.maxTokens || 4000;

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: model,
        system: "Security expert analyzing vulnerabilities.",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    // Record token usage
    if (response.data.usage) {
      console.log(`Token usage - Input: ${response.data.usage.input_tokens}, Output: ${response.data.usage.output_tokens}`);
      
      // Export token usage statistics
      global.tokenUsage = global.tokenUsage || {};
      global.tokenUsage.input = response.data.usage.input_tokens;
      global.tokenUsage.output = response.data.usage.output_tokens;
      global.tokenUsage.provider = "claude";
      global.tokenUsage.model = model;
    }
    
    return response.data.content[0].text;
  } catch (error) {
    console.error("Error generating content with Claude:", error.message);
    if (error.response) {
      console.error("API response:", error.response.data);
    }
    throw error;
  }
}

module.exports = {
  generateContent,
};
