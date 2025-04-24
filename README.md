# Enhanced Vulnerability Post Generator

A robust tool for automatically generating high-quality blog posts about security vulnerabilities using LLMs.

## Features

- **Multi-provider LLM Support**: Use OpenAI (GPT-4o), Anthropic Claude, or Google Gemini
- **Resilient API Integration**: Automatic retries, backoff, caching, and error handling
- **Detailed Metrics Tracking**: Log usage patterns, token counts, API calls, and errors
- **Enhanced CLI**: Comprehensive command-line interface with sensible defaults
- **Workflow-based Generation**: Optional LangGraph-powered multi-stage generation workflow
- **Graceful Error Handling**: Comprehensive error categorization and recovery suggestions
- **GitHub Actions Integration**: Automated scheduled post generation with enhanced resilience

## Installation

```bash
# Clone repository
git clone https://github.com/williamzujkowski/vuln-post-generator.git
cd vuln-post-generator

# Install dependencies
npm install
```

## Configuration

Set up the required API keys as environment variables:

```bash
# LLM API keys - at least one is required
export OPENAI_API_KEY=your_openai_api_key
export ANTHROPIC_API_KEY=your_anthropic_api_key
export GOOGLE_API_KEY=your_google_api_key

# Optional but recommended
export NVD_API_KEY=your_nvd_api_key  # Higher rate limits for NVD API
```

For more advanced configuration, edit the `config.json` file.

## Usage

### Generate a post for a specific CVE

```bash
node index.js --cve CVE-2023-12345
```

### Generate a post for the latest critical vulnerability

```bash
node index.js --latest
```

### Specify LLM provider

```bash
node index.js --cve CVE-2023-12345 --provider claude
```

### Customize severity and time range for latest vulnerability search

```bash
node index.js --latest --severity HIGH --days-back 30
```

### Enable additional features

```bash
# Use experimental workflow-based generation
node index.js --cve CVE-2023-12345 --use-workflow

# Enable debug mode for more verbose logging
node index.js --cve CVE-2023-12345 --debug

# Enable LangSmith tracing (requires LANGCHAIN_API_KEY)
node index.js --cve CVE-2023-12345 --enable-tracing
```

### Show help

```bash
node index.js --help
```

## GitHub Actions Integration

The repository includes a GitHub Actions workflow that automatically generates vulnerability blog posts on a weekly schedule. The workflow can also be manually triggered with specific parameters.

### Manual Trigger

You can manually trigger the workflow from the GitHub Actions UI with these options:

- `cve_id`: Specific CVE ID to generate a post for (optional)
- `provider`: LLM provider to use (openai, claude, gemini)

### Scheduled Runs

The workflow runs automatically every Monday at 01:00 UTC. It will:

1. Find the latest critical vulnerability
2. Generate a detailed analysis blog post
3. Commit the post to the repository

## Error Handling and Resilience

The generator includes robust error handling with:

- Automatic retries for transient API failures
- Exponential backoff for rate limiting
- Caching of API responses to reduce calls
- Fallback mechanisms for unreliable services
- Detailed error logs with suggestions for resolution
- Multi-provider LLM fallbacks if primary provider fails

## Metrics and Logging

Comprehensive metrics are collected during operation:

- LLM token usage and costs
- API call patterns and performance
- Error rates and categories
- Generation time and success rates

Metrics are stored in JSON and JSONL formats for analysis and dashboard integration.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.