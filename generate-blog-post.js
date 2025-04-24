#!/usr/bin/env node

/**
 * General Blog Post Generator
 * 
 * Generates high-quality blog posts on various technical topics
 * using LangChain.js and various LLM providers.
 * 
 * Usage:
 *   node generate-blog-post.js --topic "Topic title"  # Generate post for specific topic
 *   node generate-blog-post.js --provider openai      # Specify LLM provider
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import modules
import config from './src/config/index.js';
import LlmClient from './src/llm/client.js';
import PromptManager from './src/llm/prompt-manager.js';
import BlogSaver from './src/output/blog-saver.js';
import ErrorHandler from './src/utils/error-handler.js';

// Directory setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up command line options
const program = new Command();
program
  .option('--topic <title>', 'Generate a blog post on a specific topic')
  .option('--category <category>', 'Category of the blog post (e.g., ai, cloud, security)')
  .option('--provider <provider>', 'LLM provider to use (openai, claude, gemini)')
  .option('--output-dir <path>', 'Output directory for blog posts')
  .option('--enable-tracing <boolean>', 'Enable LangSmith tracing (true/false)', 'false')
  .parse(process.argv);

const options = program.opts();

/**
 * Create input data structure for the blog post generation
 * @param {string} topic - The blog post topic
 * @param {string} category - The blog post category
 * @returns {Object} - Blog post data
 */
function createInputData(topic, category) {
  console.log(`Creating input data for topic: ${topic}, category: ${category}...`);
  
  // Default categories if none provided
  const validCategories = ['ai', 'cloud', 'security', 'quantum', 'devops', 'programming', 'database'];
  const normalizedCategory = category ? category.toLowerCase() : 'technology';
  
  // Use the first valid category or default to 'technology'
  const finalCategory = validCategories.includes(normalizedCategory) ? 
    normalizedCategory : 'technology';
  
  // Generate tags based on category
  let tags = [finalCategory];
  switch(finalCategory) {
    case 'ai':
      tags.push('machine-learning', 'data-science');
      break;
    case 'cloud':
      tags.push('aws', 'infrastructure');
      break;
    case 'security':
      tags.push('cybersecurity', 'infosec');
      break;
    case 'quantum':
      tags.push('quantum-computing', 'physics');
      break;
    case 'devops':
      tags.push('cicd', 'automation');
      break;
    case 'programming':
      tags.push('development', 'coding');
      break;
    case 'database':
      tags.push('data', 'sql');
      break;
    default:
      tags.push('technology', 'software');
  }
  
  return {
    TOPIC: topic,
    CATEGORY: finalCategory,
    TAGS: tags.join(', '),
    TARGET_AUDIENCE: 'Technology enthusiasts, developers, and IT professionals',
    AUDIENCE_LEVEL: 'Intermediate',
    REQUIRED_SECTIONS: 'Introduction, Background, Technical Details, Implementation, Best Practices, Conclusion',
    CODE_LANGUAGE: finalCategory === 'programming' ? 'javascript, python, or another relevant language' : 'appropriate for the topic',
    TONE: 'Conversational yet authoritative',
    FORMAT: 'Markdown with proper headings, code blocks, and bullet points',
    MIN_WORDS: '1400',
    MAX_WORDS: '2100'
  };
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
    
    // Check if topic is provided
    if (!options.topic) {
      console.error('Error: --topic parameter is required');
      program.help();
      process.exit(1);
    }
    
    // Generate a blog post for the specified topic
    console.log(`Generating blog post for topic: ${options.topic}...`);
    
    // Create input data
    const inputData = createInputData(options.topic, options.category);
    
    // Log tracing status
    if (tracing.isEnabled) {
      console.log(`LangSmith tracing enabled. Dashboard: ${tracing.getDashboardUrl()}`);
    }
    
    // Create LLM client
    const llmClient = new LlmClient(provider);
    
    // Create prompt manager
    const promptManager = new PromptManager();
    
    // Get the blog post template for context
    const blogTemplate = promptManager.getPostTemplate();
    
    // Generate blog post content
    console.log("Generating blog post content...");
    const blogContent = await llmClient.generateBlogPost(inputData, false, blogTemplate);
    
    if (!blogContent) {
      console.error("Failed to generate blog post");
      process.exit(1);
    }
    
    console.log("Successfully generated blog post, saving...");
    
    // Generate a filename from the topic
    const topicSlug = options.topic
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '-');
    
    // Save blog post
    const outputDir = config.getOutputDir();
    const date = new Date();
    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = `${formattedDate}-${topicSlug}.md`;
    const filePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(filePath, blogContent);
    
    console.log(`Blog post saved to: ${filePath}`);
    console.log("Blog post generation complete!");
    
  } catch (error) {
    ErrorHandler.handleError(error, 'Main process', true);
  }
}

// Run the main function
main();