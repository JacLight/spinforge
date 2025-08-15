#!/usr/bin/env node
/**
 * HTTP-to-MCP Bridge for SpinForge
 * Allows remote MCP connections via HTTP
 */

import express from 'express';
import axios from 'axios';
import { config } from 'dotenv';
config();

const app = express();
app.use(express.json());

const PORT = process.env.MCP_BRIDGE_PORT || 3002;
const API_URL = process.env.SPINFORGE_API_URL || 'http://localhost:8080/api';

// CORS for browser-based clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// MCP tool implementations
const tools = {
  list_sites: async (args) => {
    const response = await axios.get(`${API_URL}/sites`);
    const sites = response.data.data || response.data;
    
    if (args.type && args.type !== 'all') {
      return sites.filter(site => site.type === args.type);
    }
    return sites;
  },
  
  get_site: async (args) => {
    const response = await axios.get(`${API_URL}/sites/${args.domain}`);
    return response.data;
  },
  
  create_site: async (args) => {
    const siteConfig = {
      domain: args.domain,
      type: args.type,
      ...args.config
    };
    const response = await axios.post(`${API_URL}/sites`, siteConfig);
    return response.data;
  },
  
  update_site: async (args) => {
    const response = await axios.put(`${API_URL}/sites/${args.domain}`, args.updates);
    return response.data;
  },
  
  delete_site: async (args) => {
    await axios.delete(`${API_URL}/sites/${args.domain}`);
    return { success: true, message: `Site ${args.domain} deleted` };
  },
  
  manage_container: async (args) => {
    const response = await axios.post(`${API_URL}/containers/${args.domain}/${args.action}`);
    return response.data;
  }
};

// MCP-compatible endpoints
app.post('/mcp/tools', (req, res) => {
  res.json({
    tools: Object.keys(tools).map(name => ({
      name,
      description: `SpinForge ${name} tool`,
      inputSchema: { type: 'object' }
    }))
  });
});

app.post('/mcp/call', async (req, res) => {
  const { tool, arguments: args } = req.body;
  
  try {
    if (!tools[tool]) {
      return res.status(404).json({ error: `Unknown tool: ${tool}` });
    }
    
    const result = await tools[tool](args || {});
    res.json({
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mcp-http-bridge' });
});

app.listen(PORT, () => {
  console.log(`🌉 SpinForge MCP HTTP Bridge running on port ${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/mcp/call`);
});