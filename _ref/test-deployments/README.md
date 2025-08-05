# SpinForge Deployment Test Suite

This directory contains comprehensive test cases for all supported deployment methods and frameworks in SpinForge.

## Test Matrix

### Frameworks
- React
- Next.js
- Remix
- NestJS
- Node.js
- Deno
- Flutter

### Deployment Methods
1. **ZIP Upload**: Pre-built applications uploaded as ZIP files
2. **Source Compilation via API**: Source code sent to API for compilation
3. **Build Utility**: Using the SpinForge build utility
4. **Git Repository**: Direct deployment from Git repositories

## Directory Structure

```
test-deployments/
├── frameworks/           # Sample apps for each framework
│   ├── react/
│   ├── nextjs/
│   ├── remix/
│   ├── nestjs/
│   ├── node/
│   ├── deno/
│   └── flutter/
├── test-cases/          # Test scenarios
│   ├── zip-deployment/
│   ├── api-compilation/
│   ├── build-utility/
│   └── git-deployment/
├── scripts/             # Test automation scripts
└── results/            # Test results and logs
```

## Running Tests

```bash
# Run all tests
./scripts/run-all-tests.sh

# Run specific deployment method tests
./scripts/test-zip-deployment.sh
./scripts/test-api-compilation.sh
./scripts/test-build-utility.sh
./scripts/test-git-deployment.sh

# Run specific framework tests
./scripts/test-framework.sh react
./scripts/test-framework.sh nextjs
```

## Test Results

Results are stored in `results/` directory with timestamps and detailed logs.