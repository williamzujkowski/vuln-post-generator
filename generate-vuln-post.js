// Main function
async function main() {
  try {
    if (options.cve) {
      // Generate a blog post for a specific CVE
      console.log(`Generating blog post for ${options.cve}...`);
      const inputData = await createInputData(options.cve);
      if (!inputData) {
        console.error("Failed to get any vulnerability data, even fallback data");
        process.exit(1);
      }

      console.log("Successfully created input data, generating blog post...");
      
      // Create optimizedInputData if it's not already defined (for fallback/minimal data cases)
      const optimizedData = {...inputData};
      
      const blogContent = await generateBlogPost({...inputData, optimizedInputData: optimizedData});
      if (!blogContent) {
        console.error("Failed to generate blog post");
        process.exit(1);
      }

      console.log("Successfully generated blog post, saving...");
      // Use original inputData for frontmatter to preserve all metadata
      saveBlogPost(blogContent, options.cve, inputData);
      
      // Output token usage statistics
      if (global.tokenUsage && global.tokenUsage.input) {
        console.log(`\nToken Usage Summary:`);
        console.log(`Provider: ${global.tokenUsage.provider}`);
        console.log(`Model: ${global.tokenUsage.model}`);
        console.log(`Input tokens: ${global.tokenUsage.input}${global.tokenUsage.estimated ? " (estimated)" : ""}`);
        console.log(`Output tokens: ${global.tokenUsage.output}${global.tokenUsage.estimated ? " (estimated)" : ""}`);
        console.log(`Total tokens: ${global.tokenUsage.input + global.tokenUsage.output}${global.tokenUsage.estimated ? " (estimated)" : ""}`);
      }
      
      console.log("Blog post generation complete!");
    } else if (options.latest) {
      console.log("Searching for latest critical vulnerabilities...");

      // Find the latest critical vulnerability
      const latestCveId = await findLatestCriticalCVE();