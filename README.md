# Vulnerability Blog Post Generator

A comprehensive system for generating high-quality, technical blog posts about security vulnerabilities with a focus on cloud security implications.

![Workflow diagram showing the vulnerability blog generation process](https://mermaid.ink/img/pako:eNqNVMFu2zAM_RWCpx60FshhPeVSrEVXYEAwtId2h8KgJTrWKoueJLtZkH8fFSdO3aXJLraw-Pi-RZF8jBqoQTpGb_cN16LVAiPG1OxBIVdS7OHOPAjS4H2Jqm4FfYSWVE2qFqSRdEkCvVRpXy2jKm6EVK9ixK8oQSu5A6M7z_QUf-hKKoRbJUYK9NdDK1qQaMwxOrN5Fa17YzWu5C7amwNIPE13LYkSVYYUXLQINwg5f0eBKuYZpZsxkLkE1VEFptAzNLPnOZ4WuOawsHfRQ9fBrLYLPrIHxzVJVXJ8DJkVw31D6pZSK1u0YwDJbFLXrW05Ru4kIRYN1c-Ukg8u5G2-KMSNkP0mvS__WZ6_Tc_P63xlnxmXLPLFfD41CyhE2_4U4l4Mc1_Z8lzbClPPjnlJrJMfUr6izDLdYXJUdDnb0FJXmWdY_2Kkq-qEUEkpXx_X-9Ux97R6MIdqLu8hdrU8jn3kK1zHPlLH_cP_0Oy47XhPi6jqjCmrBrpb78AJN7A-0CcT3VCH0QE7JG0LUn1wB4Wlr4WmAa2oBPQp3dQ2ZGzqKu7UmmAx9uJ5RbARjYJMVQ6aIX_eHLpGGHyZXzIWBdfohhbOXjpHn0PCFmY8TKd9XOehKZeSi3_dL_bMtJbK0D6Hw6IIUSL--n4JPd17eJ62Z8XLPLaOYjr9AYTPpFc?type=png)

## Overview

This system automates the generation of detailed vulnerability analysis blog posts by:

1. Collecting data from multiple security sources
2. Using Retrieval-Augmented Generation (RAG) for enhanced context
3. Generating content with multiple LLM providers (OpenAI, Google Gemini, Anthropic Claude)
4. Formatting posts with proper metadata for your website
5. Running in GitHub Actions workflows for continuous delivery

## Features

- **Multi-Source Data Collection**: Aggregates vulnerability data from NVD, MITRE, CERT/CC, ZDI, VulDB, and more
- **Multi-Model Support**: Works with OpenAI, Google Gemini, and Anthropic Claude
- **Retrieval-Augmented Generation**: Enhances prompts with historical vulnerability context
- **GitHub Actions Integration**: Runs in automated CI/CD workflows
- **Token Optimization**: Reduces API costs through efficient token usage
- **Secure Credential Management**: Handles API keys securely through GitHub Secrets
- **Comprehensive Documentation**: Full workflow guides, optimization strategies, and process documentation

## Getting Started

### Prerequisites

- Node.js 18+
- GitHub account for Actions workflows
- API keys for supported LLM providers (at least one)
- Optional: NVD API key for higher rate limits

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/vuln-post-generator.git
   cd vuln-post-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file template:
   ```bash
   cp .env.sample .env
   ```

4. Configure your environment variables in the `.env` file

### Configuring GitHub Secrets

For GitHub Actions to securely access API keys and configuration, you must set up GitHub Secrets:

1. Navigate to your GitHub repository
2. Go to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add the following secrets:

#### Required API Keys

| Secret Name | Description | Required | How to Obtain |
|-------------|-------------|----------|--------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 and other models | Yes | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `GOOGLE_API_KEY` | Google API key for Gemini models | Yes | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `CLAUDE_API_KEY` | Anthropic API key for Claude models | Yes | [Anthropic Console](https://console.anthropic.com/settings/keys) |

For complete details on all possible GitHub Secrets and how to obtain API keys, see [API_KEYS.md](./API_KEYS.md).

## Integration with Your Website

You can integrate this generator with your own website in several ways:

### Option 1: Git Submodule

Add this repository as a submodule in your website repository:

```bash
# In your website repository
git submodule add https://github.com/yourusername/vuln-post-generator.git tools/vuln-blog
git submodule update --init --recursive
```

Then update your GitHub Actions workflow to use the submodule:

```yaml
steps:
  - uses: actions/checkout@v4
    with:
      submodules: recursive
  
  - name: Generate Vulnerability Posts
    run: |
      cd tools/vuln-blog
      npm install
      node generate-vuln-post.js --latest
```

### Option 2: Direct Integration

Call the generator API directly from your website's build process:

```javascript
const { generateVulnerabilityPost } = require('vuln-post-generator');

// Generate a post for a specific CVE
await generateVulnerabilityPost({
  cve: 'CVE-2023-12345',
  provider: 'openai',
});
```

### Option 3: Output Directory

Configure the generator to output posts to your website's content directory:

```bash
node generate-vuln-post.js --latest --output-dir ../my-website/content/posts/
```

## Usage

### Local Usage

Run the generator with a specific CVE:
```bash
npm run generate -- --cve CVE-2023-44487
```

Generate a post for the latest critical vulnerability:
```bash
npm run generate -- --latest
```

Use a specific LLM provider:
```bash
npm run generate -- --latest --provider claude
```

### GitHub Actions Usage

#### Manual Trigger

1. Go to the "Actions" tab in your repository
2. Select "Generate Vulnerability Blog Posts"
3. Click "Run workflow"
4. (Optional) Provide a specific CVE ID and/or provider
5. Click "Run workflow"

#### Scheduled Runs

The workflow automatically runs daily at 06:00 UTC to:
- Update the vulnerability index
- Check for latest critical vulnerabilities
- Generate new blog posts as needed

#### Configuration Options

You can configure the workflow by editing the `.github/workflows/generate-vuln-posts.yml` file:

- Change the schedule by modifying the `cron` expression
- Adjust environment variables to enable/disable features
- Modify the matrix strategy to target specific providers

## Data Sources

This system integrates with multiple security data sources:

| Source | Description | API Key Required |
|--------|-------------|------------------|
| National Vulnerability Database (NVD) | NIST's comprehensive vulnerability database | Recommended |
| MITRE CVE Program | Authoritative CVE information | No |
| Zero Day Initiative (ZDI) | Security researcher vulnerability details | No |
| CERT/CC Vulnerability Notes | CERT Coordination Center analysis | No |
| VulDB | Vulnerability Database with detailed information | No |
| SANS Internet Storm Center | Security community analysis | No |
| Exploit-DB | Database of public exploits | No |
| CISA KEV Catalog | Known Exploited Vulnerabilities list | No |
| AlienVault OTX | Threat intelligence platform | Yes |

For detailed information about each data source and its implementation, see [DATA_SOURCES.md](./DATA_SOURCES.md).

## Retrieval-Augmented Generation

The system uses RAG to enhance LLM prompts with relevant historical vulnerabilities:

1. The `scripts/update-index.js` script builds a vulnerability knowledge base
2. Similar vulnerabilities are found based on CWE, product, or severity
3. This context is added to the prompt template
4. The LLM uses this context to create more insightful analyses

To enable or disable RAG:
```bash
# Enable RAG (default)
npm run generate -- --latest

# Disable RAG
npm run generate -- --latest --no-rag
```

## Token Optimization

To reduce API costs, the system implements several token optimization strategies:

- Concise system prompts
- Smart data source selection
- Automatic content truncation
- Reference URL deduplication and limiting
- Cost-efficient model selection

Configure token usage in `.env`:
```
# Set to true to use more cost-efficient models
USE_EFFICIENT_MODEL=true
```

For more details, see [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md).

## Security Best Practices

This system follows these security best practices:

1. **Secure API Key Storage**:
   - Store all API keys in GitHub Secrets, never in code
   - Keys are masked in logs using GitHub's `::add-mask::` feature
   - Local development uses `.env` files (not committed to the repository)

2. **Least Privilege Principle**:
   - Each API key should have only the permissions needed
   - Create dedicated API keys for this workflow, not shared keys

3. **Key Rotation**:
   - Regularly rotate API keys (every 30-90 days)
   - Update GitHub Secrets when keys are rotated

4. **Conditional Feature Enablement**:
   - Features that require API keys are only enabled when keys are present
   - The system gracefully handles missing keys

5. **Environment Isolation**:
   - Each workflow job runs in a clean environment
   - No credentials are shared between jobs

For more information on security best practices for API keys, see [API_KEYS.md](./API_KEYS.md).

## File Structure

```
/ (root)
├── .github/
│   └── workflows/
│       ├── generate-vuln-posts.yml     # Main GitHub Actions workflow
│       ├── test-llm-providers.yml      # Test workflow for LLM providers
│       └── vulnerability-posts.yml     # Website integration workflow
├── prompts/
│   ├── threat-blog-post.prompt         # Standard prompt template
│   └── threat-blog-post-rag.prompt     # RAG-enhanced prompt template
├── data/                               # RAG index and cached data
├── scripts/                            # Helper scripts
│   └── update-index.js                 # Vulnerability index updater
├── generate-vuln-post.js               # Main generator script
├── llm-providers.js                    # LLM provider integrations
├── test-data-sources.js                # Data source testing
├── test-models.js                      # LLM provider testing
├── test-vuldb.js                       # VulDB specific testing
├── API_KEYS.md                         # API key documentation
├── DATA_SOURCES.md                     # Data source documentation
├── OPTIMIZATION_GUIDE.md               # Token optimization guide
├── WORKFLOW_GUIDE.md                   # Process documentation
├── GITHUB_ACTIONS_README.md            # CI/CD documentation
└── package.json                        # Dependencies and scripts
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | Default LLM provider (openai, gemini, claude) | claude |
| `USE_EFFICIENT_MODEL` | Use cost-efficient models when available | true |
| `MITRE_API_ENABLED` | Enable MITRE CVE API | true |
| `ZDI_ENABLED` | Enable Zero Day Initiative data | true |
| `CERT_CC_ENABLED` | Enable CERT/CC data | true |
| `VULDB_ENABLED` | Enable VulDB data | true |
| `SANS_ISC_ENABLED` | Enable SANS ISC data | true |
| `EXPLOIT_DB_ENABLED` | Enable Exploit-DB data | true |
| `CISA_KEV_ENABLED` | Enable CISA KEV data | true |
| `ALIENVAULT_OTX_ENABLED` | Enable AlienVault OTX data | true |
| `MAX_VULNERABILITY_AGE_DAYS` | Maximum age for "latest" vulnerabilities | 30 |
| `MIN_CVSS_SCORE` | Minimum CVSS score for "latest" vulnerabilities | 9.0 |
| `RAG_ENABLED` | Enable Retrieval-Augmented Generation | true |
| `RAG_MAX_SIMILAR_VULNS` | Maximum similar vulnerabilities to include | 5 |
| `RAG_SIMILARITY_THRESHOLD` | Similarity threshold (0.0-1.0) | 0.75 |

### Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--cve` | Generate for a specific CVE | `--cve CVE-2023-44487` |
| `--latest` | Generate for the latest critical vulnerability | `--latest` |
| `--provider` | Specify LLM provider to use | `--provider claude` |
| `--no-rag` | Disable Retrieval-Augmented Generation | `--no-rag` |

## Troubleshooting

### Common Issues

1. **API Key Access Issues**
   - Check that your API keys are correctly set in environment variables or GitHub Secrets
   - Verify API key permissions and usage limits
   - For GitHub Actions, ensure secrets are correctly named
   - Check your key hasn't expired or been revoked

2. **Data Source Connectivity**
   - Run `npm run test:sources` to check data source connectivity
   - Some sources may be temporarily unavailable or have rate limits
   - Consider enabling more data sources for redundancy

3. **LLM Provider Errors**
   - Run `npm run test-models` to verify provider connectivity
   - Check for specific error messages in provider responses
   - Try a different provider if one is consistently failing

4. **Missing RAG Index**
   - Run `node scripts/update-index.js` to generate the vulnerability index
   - Verify the `data` directory exists and has appropriate permissions
   - Check for error messages during index generation

5. **GitHub Actions Workflow Issues**
   - Verify all required secrets are configured
   - Check workflow logs for detailed error messages
   - Ensure the workflow file has the correct syntax and structure

### Getting Help

If you encounter issues not covered in this documentation:

1. Check the detailed logs for error messages
2. Review the specific guide documents for your area of interest:
   - [API_KEYS.md](./API_KEYS.md) for API key configuration
   - [DATA_SOURCES.md](./DATA_SOURCES.md) for data source details
   - [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) for token usage issues
   - [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) for process questions
   - [GITHUB_ACTIONS_README.md](./GITHUB_ACTIONS_README.md) for CI/CD concerns
3. Open an issue on the GitHub repository with detailed information about your problem

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- This system uses data from multiple vulnerability databases and security resources
- Special thanks to all the organizations providing these valuable security data APIs
- The LLM providers (OpenAI, Google, Anthropic) for their powerful language models