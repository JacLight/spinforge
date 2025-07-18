const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const { createRequestHandler } = require('@remix-run/express');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(compression());
app.use(morgan('tiny'));

// Health check endpoint for SpinForge
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    spinletId: process.env.SPINLET_ID,
    customerId: process.env.CUSTOMER_ID,
    uptime: process.uptime()
  });
});

// Serve static files
app.use(express.static('public'));

// Remix request handler
const BUILD_DIR = './build';
app.all('*', createRequestHandler({
  build: require(BUILD_DIR),
  mode: process.env.NODE_ENV
}));

// Handle shutdown signal from SpinForge
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    console.log('Received shutdown signal from SpinForge');
    process.exit(0);
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Remix app running on port ${PORT}`);
  console.log(`Spinlet ID: ${process.env.SPINLET_ID}`);
  console.log(`Customer ID: ${process.env.CUSTOMER_ID}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});