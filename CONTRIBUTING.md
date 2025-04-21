# Contributing to Vulnerability Post Generator

Thank you for considering contributing to this project! This document outlines the process for contributing and guidelines to follow.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

If you've found a bug, please create an issue using the bug report template. Be sure to include:

- A clear description of the bug
- Steps to reproduce it
- Expected and actual behavior
- Environment details (OS, Node.js version, etc.)
- Any relevant logs or screenshots

### Suggesting Features

For feature requests, please create an issue using the feature request template. Include:

- A clear description of the feature
- The problem it solves
- A proposed implementation approach
- Any alternative approaches you've considered

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Run tests to ensure they pass
5. Commit your changes with clear commit messages
6. Push to your branch (`git push origin feature/your-feature-name`)
7. Open a pull request

#### Pull Request Guidelines

- Include the purpose of your PR in the title
- Provide a detailed description of the changes
- Reference any related issues
- Update documentation if needed
- Ensure all tests pass
- Maintain code style consistency

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy the environment file: `cp .env.sample .env`
4. Configure your environment variables
5. Run tests: `npm run test-models` and `npm run test:sources`

## Documentation

Please update documentation as needed when making changes:

- README.md for general usage and features
- API_KEYS.md for API key information
- WORKFLOW_GUIDE.md for process documentation
- GITHUB_ACTIONS_README.md for CI/CD documentation

## Testing

Before submitting a PR, please run:

```bash
npm run test-models
npm run test:sources
```

## Licensing

By contributing to this project, you agree that your contributions will be licensed under the project's MIT license.