/**
 * MCP Server Implementation for SpinForge
 * Provides direct HTTP/SSE endpoint for MCP clients
 */

const express = require('express');
const router = express.Router();
const { Readable } = require('stream');

// SSE helper for streaming responses
function createSSEStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  return {
    send: (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    close: () => {
      res.end();
    }
  };
}

// MCP protocol handler
router.post('/', async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;
  
  // Basic JSONRPC validation
  if (jsonrpc !== '2.0') {
    return res.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: id || null
    });
  }
  
  try {
    let result;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'spinforge',
            version: '1.0.0'
          }
        };
        break;
        
      case 'tools/list':
        result = {
          tools: [
            {
              name: 'list_sites',
              description: 'List all hosted sites/applications',
              inputSchema: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['all', 'static', 'proxy', 'container', 'loadbalancer'],
                    description: 'Filter sites by type'
                  }
                }
              }
            },
            {
              name: 'create_site',
              description: 'Create a new site/application',
              inputSchema: {
                type: 'object',
                properties: {
                  domain: { type: 'string', description: 'Domain name' },
                  type: { type: 'string', enum: ['static', 'proxy', 'container'] },
                  config: { type: 'object', description: 'Site configuration' }
                },
                required: ['domain', 'type']
              }
            },
            {
              name: 'get_site',
              description: 'Get site details',
              inputSchema: {
                type: 'object',
                properties: {
                  domain: { type: 'string', description: 'Domain name' }
                },
                required: ['domain']
              }
            },
            {
              name: 'manage_container',
              description: 'Manage container operations',
              inputSchema: {
                type: 'object',
                properties: {
                  domain: { type: 'string' },
                  action: { type: 'string', enum: ['start', 'stop', 'restart', 'rebuild'] }
                },
                required: ['domain', 'action']
              }
            }
          ]
        };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        
        // Import the actual API handlers
        const axios = require('axios');
        const apiUrl = process.env.SPINFORGE_API_URL || 'http://localhost:8080/api';
        
        switch (name) {
          case 'list_sites':
            const sitesRes = await axios.get(`${apiUrl}/sites`);
            const sites = sitesRes.data.data || sitesRes.data;
            
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(sites.filter(s => 
                    !args.type || args.type === 'all' || s.type === args.type
                  ), null, 2)
                }
              ]
            };
            break;
            
          case 'get_site':
            const siteRes = await axios.get(`${apiUrl}/sites/${args.domain}`);
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(siteRes.data, null, 2)
                }
              ]
            };
            break;
            
          case 'create_site':
            const createRes = await axios.post(`${apiUrl}/sites`, {
              domain: args.domain,
              type: args.type,
              ...args.config
            });
            result = {
              content: [
                {
                  type: 'text',
                  text: `Site created: ${JSON.stringify(createRes.data, null, 2)}`
                }
              ]
            };
            break;
            
          case 'manage_container':
            const containerRes = await axios.post(
              `${apiUrl}/containers/${args.domain}/${args.action}`
            );
            result = {
              content: [
                {
                  type: 'text',
                  text: `Container ${args.action}: ${JSON.stringify(containerRes.data, null, 2)}`
                }
              ]
            };
            break;
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        break;
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    
    res.json({
      jsonrpc: '2.0',
      result,
      id
    });
    
  } catch (error) {
    res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id
    });
  }
});

// SSE endpoint for streaming connections
router.get('/sse', (req, res) => {
  const stream = createSSEStream(res);
  
  // Send initial connection message
  stream.send({
    type: 'connection',
    status: 'connected',
    server: 'spinforge-mcp'
  });
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    stream.send({ type: 'ping' });
  }, 30000);
  
  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    stream.close();
  });
});

module.exports = router;