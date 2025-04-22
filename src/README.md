# Modular Vulnerability Post Generator

This is a modular refactoring of the vulnerability post generator using LangChain.js.

## Directory Structure

```
src/
  ├── config/            # Configuration management
  │   └── index.js       # Configuration singleton
  ├── llm/               # LLM integration with LangChain
  │   ├── client.js      # Main LLM client
  │   ├── provider.js    # Provider factory for different LLMs
  │   └── prompt-manager.js # Prompt template management
  ├── data-sources/      # Integrations with vulnerability data sources
  │   ├── mitre.js       # MITRE CVE API
  │   ├── nvd.js         # NVD API
  │   └── ...
  ├── output/            # Output generation and saving
  │   └── blog-saver.js  # Blog post saving functionality
  └── utils/             # Utility functions
      └── error-handler.js # Centralized error handling
```

## Key Features

1. **Modular Architecture**
   - Clear separation of concerns
   - Well-defined interfaces between components
   - Improved maintainability and testability

2. **LangChain.js Integration**
   - Unified API for multiple LLM providers
   - Prompt templating
   - Token optimization

3. **Error Handling**
   - Centralized error handling
   - Consistent logging
   - Graceful degradation

4. **Configuration Management**
   - Environment-based configuration
   - Provider-specific settings
   - Override support via CLI

## Usage

See the main README.md file for usage instructions.

## Implementation Notes

This refactoring uses ES modules (import/export) instead of CommonJS (require).
LangChain.js is used to provide a consistent interface to different LLM providers.