export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Test API endpoint working',
    method: req.method,
    timestamp: new Date().toISOString(),
    headers: {
      'user-agent': req.headers['user-agent'],
      'host': req.headers.host
    }
  });
}