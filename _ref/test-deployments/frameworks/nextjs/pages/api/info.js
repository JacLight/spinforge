export default function handler(req, res) {
  res.status(200).json({ 
    framework: 'nextjs',
    version: process.env.npm_package_version || 'unknown',
    node: process.version,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      DEPLOY_METHOD: process.env.DEPLOY_METHOD
    },
    server: {
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime()
    }
  });
}