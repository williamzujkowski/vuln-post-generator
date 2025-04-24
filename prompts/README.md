# Blog Post Prompts

This directory contains prompt templates for generating blog posts, including vulnerability analysis posts and general technical content.

## Directory Structure

```
prompts/
├── threat-blog-post.prompt         # Standard vulnerability blog post prompt template
├── threat-blog-post-rag.prompt     # RAG-enhanced vulnerability blog post prompt template
├── templates/                      # General blog post templates
│   ├── blogpost.prompt             # General technical blog post prompt template
│   └── post-template.md            # Basic blog post structure template with frontmatter
└── guidelines/                     # Style and content guidelines
    └── blog-guidelines.md          # General blog post writing guidelines
```

## Prompt Types

### Vulnerability Blog Posts

- **threat-blog-post.prompt**: Standard template for generating detailed vulnerability analysis posts.
- **threat-blog-post-rag.prompt**: Enhanced template that incorporates RAG (Retrieval Augmented Generation) to provide historical context by referencing similar vulnerabilities.

### General Blog Posts

- **templates/blogpost.prompt**: Template for generating general technical blog posts on various topics.
- **templates/post-template.md**: Basic structure template that includes frontmatter and standard sections.

## Guidelines

- **guidelines/blog-guidelines.md**: Comprehensive guidelines for blog post writing, including content structure, formatting, image requirements, and best practices.

## Usage

These prompts are used by the LLM client in `src/llm/client.js` and managed by the `PromptManager` class in `src/llm/prompt-manager.js`.

To generate a blog post:

```javascript
// Import the prompt manager
import PromptManager from "../llm/prompt-manager.js";

// Create a new instance
const promptManager = new PromptManager();

// Generate a vulnerability blog post prompt
const prompt = await promptManager.createVulnerabilityPrompt(inputData);

// Or with RAG enabled:
const ragPrompt = await promptManager.createVulnerabilityPrompt(inputData, true);
```

## Adding New Prompts

When adding new prompts:

1. Place the prompt template in the appropriate directory
2. Update `PromptManager` in `src/llm/prompt-manager.js` to load and use the new template
3. Document the new prompt in this README

## Prompt Format

Prompts should follow consistent formatting:

1. Begin with a clear introduction of the task
2. Define input parameters with descriptions
3. Provide detailed guidelines for content generation
4. Specify the expected output format
5. Include example sections or templates where appropriate