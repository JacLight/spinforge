export default function handler(req, res) {
  res.status(200).json({ 
    status: 'healthy',
    framework: 'nextjs',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
}