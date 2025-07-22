export default function handler(req, res) {
  const { message = 'No message provided' } = req.query;
  
  res.status(200).json({ 
    echo: message,
    timestamp: new Date().toISOString(),
    method: req.method,
    query: req.query,
    body: req.body
  });
}