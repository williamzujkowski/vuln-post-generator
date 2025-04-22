# LangGraph and LangSmith Integration

This document explains how to use the LangGraph workflow and LangSmith tracing features in the vulnerability post generator.

## Overview

The vulnerability post generator now supports advanced workflows using LangGraph and observability using LangSmith. These integrations provide:

1. **Structured Workflows** - Break down complex post generation into manageable steps
2. **Improved Quality** - Generate more coherent and comprehensive posts
3. **Observability** - Track and analyze LLM interactions for debugging and improvement
4. **Performance Monitoring** - Identify bottlenecks and optimize prompt execution

## Using LangGraph Workflows

LangGraph allows defining multi-step AI workflows with controlled flow between steps. The vulnerability post generator uses a 4-step workflow:

1. **analyze_vulnerability** - Initial CVE analysis and severity assessment
2. **generate_technical_details** - Deep dive into technical aspects of the vulnerability
3. **generate_mitigations** - Recommendations for remediation and detection
4. **compile_final_post** - Assemble the final blog post from all previous steps

### Enabling LangGraph

To enable LangGraph workflows:

```bash
# Via environment variable
export USE_WORKFLOW=true

# Or via command line
node index.js --cve CVE-2023-12345 --use-workflow true
```

### Benefits of Using LangGraph

- **Better Quality** - Breaking generation into logical steps improves coherence
- **Customizable Flow** - Easily modify the workflow or add new steps
- **Conditional Logic** - Handle errors and different scenarios gracefully
- **Reusable Components** - Build on established workflow patterns

## Using LangSmith Tracing

LangSmith provides observability for LLM applications. Our integration enables:

1. **Performance Tracking** - Monitor token usage, latency, and costs
2. **Debugging** - Inspect the inputs and outputs of each step
3. **Testing** - Create datasets and evaluate model performance
4. **Monitoring** - Track metrics over time to detect issues

### Enabling LangSmith

To enable LangSmith tracing:

1. Sign up for a LangSmith account at [smith.langchain.com](https://smith.langchain.com/)
2. Get your API key from the settings page
3. Set up the environment variables:

```bash
export ENABLE_TRACING=true
export LANGSMITH_API_KEY=your_api_key_here
export LANGSMITH_PROJECT=vuln-post-generator  # Optional project name
```

Or via command line:

```bash
node index.js --cve CVE-2023-12345 --enable-tracing true
```

### Viewing Traced Runs

After running the generator with tracing enabled:

1. Go to [smith.langchain.com](https://smith.langchain.com/)
2. Navigate to the project you specified (default: "vuln-post-generator")
3. View the traced runs, including:
   - Complete request and response history
   - Hierarchical view of the workflow steps
   - Token usage and latency metrics
   - Error traces and debugging information

## GitHub Actions Integration

When using the vulnerability post generator in GitHub Actions:

1. Add the following secrets to your repository:
   - `USE_WORKFLOW`: Set to `true` to enable LangGraph
   - `ENABLE_TRACING`: Set to `true` to enable LangSmith
   - `LANGSMITH_API_KEY`: Your LangSmith API key

2. The workflow will automatically use these settings when generating posts.

## Best Practices

1. **Start with Workflow Disabled** - Test basic functionality first
2. **Enable Tracing for Development** - Use tracing during development for debugging
3. **Customize the Workflow** - Modify steps in `src/workflow/vuln-post-workflow.js`
4. **Define Custom Metrics** - Add custom metadata to traced runs for analysis

## Troubleshooting

If you encounter issues:

1. **Check Environment Variables** - Ensure all required variables are set
2. **Review Traces** - Look at the LangSmith dashboard for error details
3. **Check Node Version** - Make sure you're using Node.js 16+ for compatibility
4. **Check Permissions** - Ensure the API keys have the necessary permissions

For more information on LangGraph, visit the [official documentation](https://langchain-ai.github.io/langgraphjs/).

For more information on LangSmith, visit the [official documentation](https://docs.smith.langchain.com/).