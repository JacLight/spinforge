# SpinForge Hot Deployment

SpinForge supports automatic hot deployment of applications by monitoring a deployment folder, similar to Apache Tomcat's WAR deployment.

## How It Works

1. **Drop your application** into the deployment folder (`/spinforge/deployments` by default)
2. **Include a deployment config** file (`deploy.yaml` or `deploy.json`)
3. **SpinForge automatically deploys** your application

## Deployment Methods

### 1. Folder Deployment
Drop a folder containing your application and a `deploy.yaml`:
```
/spinforge/deployments/
  └── my-app/
      ├── deploy.yaml
      ├── package.json
      ├── server.js
      └── public/
```

### 2. Archive Deployment
Drop a zip/tar.gz file with your application:
```
/spinforge/deployments/
  └── my-app.zip  (contains deploy.yaml and app files)
```

### 3. Git Repository (via deploy.yaml)
Specify a Git URL in your deploy.yaml:
```yaml
gitUrl: https://github.com/username/my-app.git
branch: main
```

## Configuration Files

### deploy.yaml Example
```yaml
name: my-express-app
version: 1.0.0
domain: app.example.com
customerId: customer-123

framework: express
runtime: node
nodeVersion: "20"

build:
  command: npm install && npm run build
  outputDir: dist

resources:
  memory: 512MB
  cpu: 0.5

env:
  NODE_ENV: production
  API_KEY: ${SECRET_API_KEY}  # Pulled from environment
```

### deploy.json Example
```json
{
  "name": "my-static-site",
  "version": "1.0.0",
  "domain": ["www.example.com", "example.com"],
  "customerId": "customer-456",
  "framework": "static",
  "build": {
    "command": "npm run build",
    "outputDir": "public"
  },
  "resources": {
    "memory": "128MB",
    "cpu": 0.1
  }
}
```

## Deployment Status

After deployment, SpinForge creates marker files:
- `.deployed` - Successful deployment with timestamp
- `.failed` - Failed deployment with error details

## Environment Variables

Set the deployment folder path:
```bash
HOT_DEPLOYMENT_PATH=/custom/deployment/path
```

## Supported Frameworks

- `express` - Express.js applications
- `nextjs` - Next.js applications
- `remix` - Remix applications
- `static` - Static HTML/CSS/JS sites
- `custom` - Custom applications with start command

## Advanced Features

### Multi-Domain Deployment
```yaml
domain:
  - api.example.com
  - api-v2.example.com
  - api.staging.example.com
```

### Build Hooks
```yaml
hooks:
  preDeploy:
    - npm run test
    - npm run lint
  postDeploy:
    - curl https://notify.example.com/deployed
```

### Resource Scaling
```yaml
scaling:
  min: 2
  max: 10
  targetCPU: 70
```

### Health Checks
```yaml
start:
  healthCheck:
    path: /health
    interval: 30
    timeout: 5
```

## Docker Deployment

To use hot deployment in Docker:

```bash
docker run -v /local/deployments:/spinforge/deployments spinforge/hub
```

## Security Notes

- Deployment folder should have restricted access
- Use environment variables for secrets
- Validate deployment configs before processing
- Monitor deployment logs for security events

## Troubleshooting

1. **Deployment not detected**
   - Check folder permissions
   - Verify deploy.yaml/deploy.json exists
   - Check SpinHub logs

2. **Build failures**
   - Check build command output in logs
   - Ensure dependencies are available
   - Verify Node.js version compatibility

3. **Runtime errors**
   - Check application logs: `docker logs spinforge-<app-name>`
   - Verify environment variables
   - Check resource limits