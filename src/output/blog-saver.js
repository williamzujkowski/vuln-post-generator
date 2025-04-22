// Blog post saving functionality
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import config from '../config/index.js';
import ErrorHandler from '../utils/error-handler.js';

/**
 * Handles saving generated blog posts
 */
class BlogSaver {
  /**
   * Save a generated blog post to the file system
   * @param {string} content - The blog post content
   * @param {string} cveId - The CVE ID
   * @param {Object} metadata - Additional metadata for frontmatter
   * @returns {Object} - Information about the saved file
   */
  static saveBlogPost(content, cveId, metadata) {
    try {
      // Generate filename
      const date = format(new Date(), "yyyy-MM-dd");
      const slug = cveId.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const filename = `${date}-vulnerability-analysis-${slug}.md`;
      
      // Get output directory
      const outputDir = config.getOutputDir();
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filePath = path.join(outputDir, filename);
      
      // Generate tags based on the vulnerability data
      const tags = ["security", "vulnerability", cveId, "cloud-security"];
      
      // Add AWS tag if relevant
      if (metadata.AWS_IMPACT && metadata.AWS_IMPACT.includes("Direct impact")) {
        tags.push("aws");
      }
      
      // Create frontmatter for the blog post
      const frontmatter = this.generateFrontmatter(metadata, tags);
      
      // Replace image placeholder with actual image path
      const imagePath = 'blog/security-blog.jpg'; // Default security blog image
      let processedContent = content.replace(/\{IMAGE_PATH_PLACEHOLDER\}/g, imagePath);
      
      // Combine frontmatter and content
      const fullContent = frontmatter + processedContent;
      
      // Write the file
      fs.writeFileSync(filePath, fullContent, 'utf8');
      
      console.log(`Blog post saved to: ${filePath}`);
      
      return {
        path: filePath,
        filename,
        tags
      };
    } catch (error) {
      ErrorHandler.handleError(error, 'BlogSaver.saveBlogPost');
      throw error;
    }
  }
  
  /**
   * Generate frontmatter for the blog post
   * @param {Object} metadata - Metadata about the vulnerability
   * @param {Array<string>} tags - Tags for the blog post
   * @returns {string} - Formatted frontmatter
   */
  static generateFrontmatter(metadata, tags) {
    const title = `Vulnerability Analysis: ${metadata.CVE_ID || 'Unknown CVE'}`;
    const description = metadata.SUMMARY || `Analysis of ${metadata.CVE_ID} vulnerability with CVSS score ${metadata.CVSS_SCORE || 'N/A'}`;
    const date = format(new Date(), "yyyy-MM-dd");
    
    // Build tags string
    const tagsStr = tags.map(tag => `"${tag}"`).join(', ');
    
    // Generate featured image path
    const image = 'blog/security-blog.jpg';
    const topics = ['cybersecurity'];
    
    // Add appropriate topics based on metadata
    if (metadata.AFFECTED_PRODUCTS && metadata.AFFECTED_PRODUCTS.includes('cloud')) {
      topics.push('cloud-computing');
    }
    
    if (metadata.VULNERABILITY_TYPE) {
      const vulnType = metadata.VULNERABILITY_TYPE.toLowerCase();
      if (vulnType.includes('crypto') || vulnType.includes('encryption')) {
        topics.push('cryptography');
      }
    }
    
    // Format topics
    const topicsStr = topics.map(topic => `"${topic}"`).join(', ');
    
    return `---
layout: post
title: "${title}"
date: ${date}
description: "${description}"
image: ${image}
tags: [${tagsStr}]
topics: [${topicsStr}]
type: "vulnerability"
cvss_score: "${metadata.CVSS_SCORE || 'N/A'}"
cve_id: "${metadata.CVE_ID || 'Unknown'}"
cisa_kev: ${metadata.IS_KEV === 'Yes' || metadata.IS_KEV === true ? 'true' : 'false'}
---

`;
  }
}

export default BlogSaver;