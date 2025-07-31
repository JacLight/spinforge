# SpinForge Postman Collections

This directory contains Postman collections for testing SpinForge APIs.

## Collections

### 1. SpinForge-Deployment-API.postman_collection.json
Tests the deployment management endpoints including:
- List all deployments
- Scan deployment folder
- Retry failed deployments
- Cancel deployments
- Get deployment logs
- Delete deployments
- Trigger health checks

## Setup

1. Import the collection into Postman
2. Update the variables:
   - `baseUrl`: Default is `http://localhost:9004` (SpinHub port)
   - `adminToken`: Default is `changeMe123` (change if you modified ADMIN_TOKEN)
   - `deploymentName`: Name of deployment to test with
   - `domain`: Domain name for testing

## Testing Deployment Methods

### Method 1: Manual Copy
```bash
# Create deployment folder
mkdir -p deployments/test-manual

# Create deploy.yaml
cat > deployments/test-manual/deploy.yaml << EOF
name: test-manual
framework: static
domain: test-manual.localhost
customerId: customer1
config:
  memory: 128MB
  cpu: 0.1
EOF

# Add some content
echo "<h1>Manual Deploy Test</h1>" > deployments/test-manual/index.html
```

### Method 2: Using Deployment API
Use the Postman collection to:
1. GET `/_admin/deployments` - Check current deployments
2. POST `/_admin/deployments/scan` - Trigger scan
3. GET `/_admin/deployments/{name}/logs` - View logs

### Method 3: CLI Deploy (after installing CLI)
```bash
cd packages/spinlet-cli
npm install
npm link

# Now you can use spinforge command
spinforge login
spinforge deploy --domain test-cli.localhost
```

## Common Issues

1. **401 Unauthorized**: Check your adminToken in the collection variables
2. **502 Bad Gateway**: Make sure SpinHub is running (docker-compose up)
3. **404 Not Found**: Check the baseUrl is correct (should be port 9004)