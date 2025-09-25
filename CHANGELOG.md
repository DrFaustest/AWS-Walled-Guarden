# Changelog

All notable changes to the AWS Walled Garden extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-09-25

### Added
- Initial release of AWS Walled Garden
- Local AWS service mocking for development
- Support for S3, DynamoDB, Lambda, SQS, SNS services
- Intelligent auto-configuration from codebase analysis
- Rich IntelliSense for `.aws-mock.json` configuration files
- GUI Configuration Editor for visual configuration
- Proxy server for intercepting AWS API calls
- Comprehensive test suite with 50+ tests
- Status bar integration for extension state
- Command palette integration with 11 commands
- Real-time configuration validation
- Logging and error handling system

### Features
- Zero-cost local AWS development environment
- No AWS credentials required for development
- Automatic mock generation from AWS SDK usage
- Schema-based JSON validation
- Context-aware auto-completion
- Visual configuration interface
- One-click enable/disable functionality
- Comprehensive logging and troubleshooting

### Technical
- Built with TypeScript for VS Code extension API
- Uses Express.js for proxy server
- http-proxy for request interception
- Mocha test framework with comprehensive coverage
- ESLint for code quality
- VSCE for packaging and publishing

### Documentation
- Complete README with installation and usage instructions
- Configuration examples and guides
- Troubleshooting section
- API documentation for all features