// Configuration management for vulnerability post generator
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize environment variables
dotenv.config();

// Directory setup (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

/**
 * Configuration management for the vulnerability post generator
 */
class Config {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'openai';
    this.enabledSources = this.initializeEnabledSources();
    this.outputDir = process.env.OUTPUT_DIR || path.join(ROOT_DIR, '../../src/posts/');
  }

  /**
   * Initialize enabled data sources from environment variables
   */
  initializeEnabledSources() {
    return {
      mitre: process.env.MITRE_API_ENABLED !== 'false',
      exploitDb: process.env.EXPLOIT_DB_ENABLED !== 'false',
      sansIsc: process.env.SANS_ISC_ENABLED !== 'false',
      zdi: process.env.ZDI_ENABLED !== 'false',
      certCc: process.env.CERT_CC_ENABLED !== 'false',
      vuldb: process.env.VULDB_ENABLED !== 'false',
      cisaKev: process.env.CISA_KEV_ENABLED !== 'false',
      alienvaultOtx: process.env.ALIENVAULT_OTX_ENABLED !== 'false',
      epss: process.env.EPSS_ENABLED !== 'false'
    };
  }

  /**
   * Get the configured LLM provider
   */
  getLlmProvider() {
    return process.env.LLM_PROVIDER || 'openai';
  }

  /**
   * Get the API key for the specified provider
   */
  getApiKey(provider = null) {
    const targetProvider = provider || this.provider;
    
    switch (targetProvider.toLowerCase()) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'claude':
      case 'anthropic':
        return process.env.CLAUDE_API_KEY;
      case 'gemini':
      case 'google':
        return process.env.GOOGLE_API_KEY;
      default:
        throw new Error(`Unknown LLM provider: ${targetProvider}`);
    }
  }

  /**
   * Get the model name for the specified provider
   */
  getModelName(provider = null) {
    const targetProvider = provider || this.provider;
    const useEfficientModel = process.env.USE_EFFICIENT_MODEL === 'true';
    
    switch (targetProvider.toLowerCase()) {
      case 'openai':
        return useEfficientModel ? 'gpt-3.5-turbo' : 'gpt-4';
      case 'claude':
      case 'anthropic':
        return useEfficientModel ? 'claude-3-haiku-20240307' : 'claude-3-opus-20240229';
      case 'gemini':
      case 'google':
        return useEfficientModel ? 'gemini-pro' : 'gemini-pro';
      default:
        throw new Error(`Unknown LLM provider: ${targetProvider}`);
    }
  }

  /**
   * Get the NVD API key
   */
  getNvdApiKey() {
    return process.env.NVD_API_KEY;
  }

  /**
   * Get the AlienVault OTX API key
   */
  getAlienVaultApiKey() {
    return process.env.ALIENVAULT_OTX_API_KEY;
  }

  /**
   * Get the User Agent for VulDB requests
   */
  getVulDbUserAgent() {
    return process.env.VULDB_USER_AGENT || 'Vulnerability Blog Generator';
  }

  /**
   * Get the User Agent for MITRE requests
   */
  getMitreUserAgent() {
    return process.env.MITRE_USER_AGENT || 'Vulnerability Blog Generator';
  }

  /**
   * Get the output directory for blog posts
   */
  getOutputDir() {
    return this.outputDir;
  }

  /**
   * Set the output directory for blog posts
   */
  setOutputDir(dir) {
    this.outputDir = dir;
  }

  /**
   * Check if a data source is enabled
   */
  isSourceEnabled(source) {
    return this.enabledSources[source] === true;
  }

  /**
   * Get the root directory of the project
   */
  getRootDir() {
    return ROOT_DIR;
  }

  /**
   * Get the prompts directory
   */
  getPromptsDir() {
    return path.join(ROOT_DIR, 'prompts');
  }
}

// Export a singleton instance
export default new Config();