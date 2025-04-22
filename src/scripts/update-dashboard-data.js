#!/usr/bin/env node

/**
 * Dashboard Data Update Script
 * 
 * This script fetches data from LangSmith and saves it for the website dashboard.
 * It should be run periodically to keep the dashboard data updated.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

// Directory setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Dynamic imports to avoid circular dependencies
async function main() {
  try {
    console.log("Starting dashboard data update...");
    
    // Import LangSmith API
    const { default: langSmithAPI } = await import('../api/langsmith-api.js');
    
    // Fetch dashboard data
    console.log("Fetching LangSmith dashboard data...");
    const dashboardData = await langSmithAPI.getDashboardData();
    
    console.log(`Fetched data for ${dashboardData.totalRuns} runs`);
    console.log(`Data saved to: ${path.resolve(langSmithAPI.cacheDir)}`);
    console.log("Dashboard data update complete!");
    
  } catch (error) {
    console.error("Error updating dashboard data:", error);
    process.exit(1);
  }
}

main();