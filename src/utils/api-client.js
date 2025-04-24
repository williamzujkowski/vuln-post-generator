/**
 * Enhanced API client with resilience features
 * - Exponential backoff and retries 
 * - Proper timeouts
 * - Response caching
 * - Detailed error handling
 * - Metrics tracking
 */
import axios from 'axios';
import axiosRetry from 'axios-retry';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import metricsLogger from './metrics-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, '../../.cache');
const CACHE_TTL = 1000 * 60 * 60; // 1 hour in milliseconds

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Create axios instance with default config
const apiClient = axios.create({
  timeout: 10000, // 10 second timeout
  headers: {
    'User-Agent': 'William Zujkowski Blog Vulnerability Analyzer',
  }
});

// Configure retries with exponential backoff
axiosRetry(apiClient, {
  retries: process.env.API_FETCH_RETRIES || 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors, 5xx responses, and rate limiting (429)
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && (error.response.status >= 500 || error.response.status === 429));
  },
  onRetry: (retryCount, error, requestConfig) => {
    // Log retry attempts
    const status = error.response ? error.response.status : 'network error';
    console.warn(`Retrying API request (${retryCount}/3) after error: ${status} - ${error.message}`);
    
    // Track retry metrics
    metricsLogger.logApiRetry({
      url: requestConfig.url,
      method: requestConfig.method,
      retryCount,
      errorCode: error.response ? error.response.status : 'network',
      errorMessage: error.message
    });
    
    // If this is a rate limit (429), add extra delay based on Retry-After header if present
    if (error.response && error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        const retryAfterMs = parseInt(retryAfter, 10) * 1000;
        console.log(`Rate limited. Waiting ${retryAfter} seconds before retry.`);
        return retryAfterMs;
      }
    }
    
    // Default to exponential backoff
    return axiosRetry.exponentialDelay(retryCount);
  }
});

// Request interceptor for API calls - add API keys and cache checking
apiClient.interceptors.request.use(async (config) => {
  // Track API call start time
  config.metadata = { startTime: new Date() };
  
  // Add API keys as needed
  if (config.url.includes('nvd.nist.gov') && process.env.NVD_API_KEY) {
    config.headers['apiKey'] = process.env.NVD_API_KEY;
  }
  
  // Check cache for GET requests if caching is enabled
  if (config.method === 'get' && !config.skipCache) {
    const cacheKey = getCacheKey(config.url, config.params);
    const cachedResponse = checkCache(cacheKey);
    
    if (cachedResponse) {
      // Cancel the request and return cached data
      const source = axios.CancelToken.source();
      config.cancelToken = source.token;
      source.cancel('Using cached response');
      config.cached = cachedResponse;
      console.log(`Using cached response for ${config.url}`);
    }
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for API calls - cache responses and log metrics
apiClient.interceptors.response.use((response) => {
  // Calculate request duration
  const endTime = new Date();
  const startTime = response.config.metadata.startTime;
  const duration = endTime - startTime;
  
  // Log API call metrics
  metricsLogger.logApiCall({
    url: response.config.url,
    method: response.config.method,
    status: response.status,
    duration,
    bytes: JSON.stringify(response.data).length,
    cached: false
  });
  
  // Cache successful GET responses
  if (response.config.method === 'get' && !response.config.skipCache) {
    const cacheKey = getCacheKey(response.config.url, response.config.params);
    cacheResponse(cacheKey, response.data);
  }
  
  return response;
}, async (error) => {
  if (axios.isCancel(error) && error.config && error.config.cached) {
    // Return cached response for canceled requests
    const duration = 0; // Effectively instant since we're using cache
    
    // Log cached API call metrics
    metricsLogger.logApiCall({
      url: error.config.url,
      method: error.config.method,
      status: 200,
      duration,
      bytes: JSON.stringify(error.config.cached).length,
      cached: true
    });
    
    // Create a response-like object with the cached data
    return {
      status: 200,
      statusText: 'OK (cached)',
      headers: {},
      data: error.config.cached,
      config: error.config,
      cached: true
    };
  }
  
  // Calculate request duration even for failed requests
  if (error.config && error.config.metadata) {
    const endTime = new Date();
    const startTime = error.config.metadata.startTime;
    const duration = endTime - startTime;
    
    // Log failed API call metrics
    metricsLogger.logApiCall({
      url: error.config.url,
      method: error.config.method,
      status: error.response ? error.response.status : 'network error',
      duration,
      error: error.message,
      cached: false
    });
  }
  
  return Promise.reject(error);
});

/**
 * Generate a cache key from URL and params
 */
function getCacheKey(url, params) {
  return `${url}-${JSON.stringify(params || {})}`;
}

/**
 * Check if a valid cached response exists
 */
function checkCache(cacheKey) {
  const cachePath = path.join(CACHE_DIR, Buffer.from(cacheKey).toString('base64'));
  
  try {
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const cacheTime = new Date(cacheData.timestamp);
      const now = new Date();
      
      // Check if cache is still valid
      if (now - cacheTime < CACHE_TTL) {
        return cacheData.data;
      } else {
        // Cache expired, delete it
        fs.unlinkSync(cachePath);
      }
    }
  } catch (error) {
    console.warn(`Cache read error: ${error.message}`);
  }
  
  return null;
}

/**
 * Save response to cache
 */
function cacheResponse(cacheKey, data) {
  const cachePath = path.join(CACHE_DIR, Buffer.from(cacheKey).toString('base64'));
  const cacheData = {
    timestamp: new Date().toISOString(),
    data
  };
  
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cacheData));
  } catch (error) {
    console.warn(`Cache write error: ${error.message}`);
  }
}

/**
 * Fetch data from NVD API for a specific CVE
 * @param {string} cveId - The CVE ID to fetch
 * @param {boolean} [useCache=true] - Whether to use cached response
 * @returns {Promise<Object>} - The vulnerability data
 */
async function fetchCveData(cveId, useCache = true) {
  try {
    console.log(`Fetching data for ${cveId} from NVD API...`);
    
    const response = await apiClient.get(
      `https://services.nvd.nist.gov/rest/json/cves/2.0`,
      {
        params: { cveId },
        skipCache: !useCache
      }
    );
    
    if (
      response.data &&
      response.data.vulnerabilities &&
      response.data.vulnerabilities.length > 0
    ) {
      return response.data.vulnerabilities[0].cve;
    }
    
    console.warn(`No vulnerability data found for ${cveId}`);
    return null;
  } catch (error) {
    console.error(`Error fetching CVE data for ${cveId}:`, error.message);
    throw error;
  }
}

/**
 * Fetch data from CISA Known Exploited Vulnerabilities (KEV) catalog
 * @param {boolean} [useCache=true] - Whether to use cached response
 * @returns {Promise<Array>} - The KEV vulnerability list
 */
async function fetchKevData(useCache = true) {
  try {
    console.log('Fetching data from CISA KEV catalog...');
    
    const response = await apiClient.get(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      { skipCache: !useCache }
    );
    
    if (response.data && response.data.vulnerabilities) {
      return response.data.vulnerabilities;
    }
    
    console.warn('No KEV data found');
    return [];
  } catch (error) {
    console.error('Error fetching KEV data:', error.message);
    throw error;
  }
}

/**
 * Check if a CVE is in the CISA KEV catalog
 * @param {string} cveId - The CVE ID to check
 * @returns {Promise<Object|null>} - KEV entry or null if not found
 */
async function checkKevStatus(cveId) {
  try {
    const kevList = await fetchKevData();
    const normalizedCveId = cveId.toUpperCase().trim();
    
    return kevList.find(vuln => {
      const kevId = vuln.cveID || '';
      return kevId.toUpperCase().trim() === normalizedCveId;
    }) || null;
  } catch (error) {
    console.warn(`Error checking KEV status for ${cveId}:`, error.message);
    return null;
  }
}

/**
 * Find recent critical vulnerabilities
 * @param {Object} options - Search options
 * @param {number} [options.daysBack=15] - How many days back to search
 * @param {string} [options.severity='CRITICAL'] - Severity level to search for
 * @param {number} [options.limit=10] - Maximum number of results
 * @returns {Promise<Array>} - List of vulnerabilities
 */
async function findRecentVulnerabilities(options = {}) {
  const {
    daysBack = 15,
    severity = 'CRITICAL',
    limit = 10
  } = options;
  
  try {
    // Calculate date from N days ago
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const pubStartDate = startDate.toISOString().split('T')[0];
    
    console.log(`Searching for ${severity} vulnerabilities published since ${pubStartDate}`);
    
    const response = await apiClient.get(
      'https://services.nvd.nist.gov/rest/json/cves/2.0',
      {
        params: {
          pubStartDate: `${pubStartDate}T00:00:00.000`,
          cvssV3Severity: severity,
          resultsPerPage: limit
        },
        skipCache: false // Use cache for this query
      }
    );
    
    if (
      response.data &&
      response.data.vulnerabilities &&
      response.data.vulnerabilities.length > 0
    ) {
      // Sort vulnerabilities by CVSS score (highest first)
      return response.data.vulnerabilities.sort((a, b) => {
        const scoreA = a.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0;
        const scoreB = b.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0;
        return scoreB - scoreA;
      });
    }
    
    console.log(`No ${severity} vulnerabilities found in the last ${daysBack} days`);
    return [];
  } catch (error) {
    console.error('Error finding recent vulnerabilities:', error.message);
    throw error;
  }
}

/**
 * Clear expired cache entries
 */
function cleanCache() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    const now = new Date();
    let cleared = 0;
    
    files.forEach(file => {
      const filePath = path.join(CACHE_DIR, file);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const timestamp = new Date(content.timestamp);
        
        if (now - timestamp > CACHE_TTL) {
          fs.unlinkSync(filePath);
          cleared++;
        }
      } catch (error) {
        // If the file can't be parsed, remove it
        fs.unlinkSync(filePath);
        cleared++;
      }
    });
    
    if (cleared > 0) {
      console.log(`Cleared ${cleared} expired cache entries`);
    }
  } catch (error) {
    console.warn(`Error cleaning cache: ${error.message}`);
  }
}

// Clear expired cache entries on module load
cleanCache();

export default {
  fetchCveData,
  fetchKevData,
  checkKevStatus,
  findRecentVulnerabilities,
  cleanCache
};