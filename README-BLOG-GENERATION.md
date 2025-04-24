# Blog Post Generation Framework

This document explains how to use the consolidated blog post generation framework for creating both vulnerability analysis posts and general technical blog posts.

## Overview

The blog post generation framework now supports:

1. **Vulnerability Analysis Posts** - Detailed technical analysis of security vulnerabilities
2. **General Technical Blog Posts** - Posts on various technical topics like AI, cloud, quantum computing, etc.

## Directory Structure

The framework's important components:

```
tools/vuln-blog/
├── index.js                    # Main vulnerability post generator script
├── generate-blog-post.js       # General blog post generator script
├── prompts/                    # Prompt templates and guidelines
│   ├── threat-blog-post.prompt         # Vulnerability blog post prompt 
│   ├── threat-blog-post-rag.prompt     # RAG-enhanced vulnerability blog post prompt
│   ├── templates/                      # General blog post templates
│   │   ├── blogpost.prompt             # General technical blog post prompt
│   │   └── post-template.md            # Blog post structure template
│   └── guidelines/                     # Style and content guidelines
│       └── blog-guidelines.md          # Blog post writing guidelines
├── src/                        # Source code
│   ├── llm/                    # LLM integration
│   │   ├── client.js           # Main LLM client
│   │   ├── prompt-manager.js   # Manages prompt templates
│   │   └── provider.js         # LLM provider factory
│   └── output/                 # Output handling
│       └── blog-saver.js       # Saves generated blog posts
```

## Wrapper Scripts

For convenience, wrapper scripts are provided in the main repository:

```
scripts/wrapper/
├── generate-vuln-post-wrapper.js   # Wrapper for vulnerability post generation
└── generate-blog-post-wrapper.js   # Wrapper for general blog post generation
```

## Usage

### Generating Vulnerability Analysis Posts

Use the vulnerability post generator to create detailed vulnerability analysis:

```bash
# Using the wrapper script
node scripts/wrapper/generate-vuln-post-wrapper.js --cve CVE-2023-12345

# Direct usage (from tools/vuln-blog directory)
cd tools/vuln-blog
node index.js --cve CVE-2023-12345
```

Options:
- `--cve <id>` - Generate a post for a specific CVE ID
- `--latest` - Generate a post for the latest critical vulnerability
- `--provider <provider>` - Specify LLM provider (openai, claude, gemini)

### Generating General Blog Posts

Use the general blog post generator for creating posts on various technical topics:

```bash
# Using the wrapper script
node scripts/wrapper/generate-blog-post-wrapper.js --topic "Quantum Machine Learning" --category "quantum"

# Direct usage (from tools/vuln-blog directory)
cd tools/vuln-blog
node generate-blog-post.js --topic "Quantum Machine Learning" --category "quantum"
```

Options:
- `--topic <title>` - The topic of the blog post
- `--category <category>` - Category (ai, cloud, security, quantum, devops, programming, database)
- `--provider <provider>` - Specify LLM provider (openai, claude, gemini)

## Supported Categories

For general blog posts, the following categories are supported:

- `ai` - Artificial Intelligence and Machine Learning
- `cloud` - Cloud Computing and Infrastructure
- `security` - Cybersecurity and Information Security
- `quantum` - Quantum Computing and Quantum Technology
- `devops` - DevOps and Continuous Integration/Deployment
- `programming` - Programming and Software Development
- `database` - Database Systems and Data Management

## Customizing Prompts

To customize the prompts used for blog post generation:

1. Edit files in the `prompts/` directory
2. Update relevant templates based on your requirements
3. The PromptManager class will automatically load your changes

## Integration with GitHub Actions

The blog post generation is integrated with GitHub Actions workflows that can be scheduled to run automatically:

- Vulnerability posts can be generated on a weekly basis
- General blog posts can be triggered manually

## Troubleshooting

Common issues:

1. **API Key Issues**:
   - Ensure LLM API keys are correctly set in environment variables or GitHub Secrets
   - The system will automatically try fallback providers if a key is missing or invalid

2. **Prompt Issues**:
   - If the LLM fails to generate a proper post, check the prompts in the `prompts/` directory
   - Make sure prompt variables match the expected input data

3. **Output Directory Issues**:
   - Ensure the output directory exists and is writable
   - The default output directory is `src/posts/` in the main repository

## Adding New Prompt Templates

To add new prompt templates:

1. Add your template file to the appropriate subdirectory in `prompts/`
2. Update the `PromptManager` class in `src/llm/prompt-manager.js` to load your template
3. Add a new method to use your template if needed