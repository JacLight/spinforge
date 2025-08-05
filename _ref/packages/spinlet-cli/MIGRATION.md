# SpinForge CLI Configuration Migration Guide

## Breaking Changes

SpinForge CLI now requires explicit configuration with no fallback values. If configuration is missing, the CLI will fail with clear error messages.

## Configuration Methods

### 1. Environment Variables

Set these environment variables before running any SpinForge CLI commands:

```bash
# Required for all commands
export SPINFORGE_API_URL=https://api.spinforge.dev
export SPINFORGE_WEB_URL=https://spinforge.dev

# Required for deployment commands
export SPINFORGE_DEPLOYMENTS=/spinforge/deployments

# Required for commands that use Redis
export REDIS_HOST=localhost
export REDIS_PORT=16378
export REDIS_DB=0

# Optional
export REDIS_PASSWORD=your-redis-password
export SPINFORGE_TOKEN=your-api-token
```

### 2. Project Configuration File

Create a `spinforge.config.json` file in your project directory:

```json
{
  "apiUrl": "https://api.spinforge.dev",
  "webUrl": "https://spinforge.dev",
  "deploymentPath": "/spinforge/deployments",
  "redisHost": "localhost",
  "redisPort": 16378,
  "redisDb": 0
}
```

Environment variables take precedence over the config file.

## What Changed

### Before
- CLI had hardcoded fallback values (localhost:8080, etc.)
- Commands would attempt to work with default values
- Could lead to unexpected behavior in production

### After
- All configuration must be explicit
- No hardcoded fallbacks
- Clear error messages when configuration is missing
- Supports both environment variables and config files

## Migration Steps

1. **Identify your environment** - development, staging, or production
2. **Set environment variables** or create `spinforge.config.json`
3. **Test your commands** - they will fail with clear messages if configuration is missing
4. **Update your deployment scripts** to include necessary environment variables

## Error Messages

If configuration is missing, you'll see clear error messages like:
- `SPINFORGE_API_URL environment variable is not set`
- `apiUrl is not configured. Set it in spinforge.config.json or via environment variables.`

## Benefits

- **Explicit configuration** - no surprises
- **Environment isolation** - dev/staging/prod configs are separate
- **Security** - no accidental connections to wrong environments
- **Flexibility** - use environment variables or config files