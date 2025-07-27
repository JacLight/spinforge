# Changelog

## [0.2.0] - 2025-01-26

### Added
- Environment-aware configuration system
- Support for NODE_ENV (development, staging, production)
- Automatic URL detection based on environment
- Environment variable support for all configuration options

### Changed
- Removed dependency on local @spinforge/shared package
- Updated authentication to use environment-specific URLs
- Improved error messages and logging
- CLI now uses port 9006 by default (was 8080)

### Fixed
- TypeScript compilation errors
- Redis connection configuration
- Authentication flow for local development

## [0.1.0] - 2025-01-26

### Initial Release
- Core CLI functionality
- Deploy, status, logs, and stop commands
- Authentication system
- Hot deployment support
- Watch mode for auto-deployment