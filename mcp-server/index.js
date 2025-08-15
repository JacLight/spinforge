#!/usr/bin/env node
/**
 * SpinForge MCP Server
 * AI-Native Hosting Platform Integration via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

// Configuration
const SPINFORGE_API_URL = process.env.SPINFORGE_API_URL || 'http://localhost:5020/api';
const SPINFORGE_API_KEY = process.env.SPINFORGE_API_KEY || '';

// Create axios instance with default config
const api = axios.create({
  baseURL: SPINFORGE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(SPINFORGE_API_KEY && { 'X-API-Key': SPINFORGE_API_KEY })
  }
});

// Server instance
const server = new Server(
  {
    name: 'spinforge-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const TOOLS = [
  // Site Management Tools
  {
    name: 'list_sites',
    description: 'List all hosted sites/applications',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'static', 'proxy', 'container', 'loadbalancer'],
          description: 'Filter sites by type',
          default: 'all'
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
        domain: {
          type: 'string',
          description: 'Domain name for the site (e.g., example.com)'
        },
        type: {
          type: 'string',
          enum: ['static', 'proxy', 'container', 'loadbalancer'],
          description: 'Type of site to create'
        },
        config: {
          type: 'object',
          description: 'Configuration based on site type',
          properties: {
            // For proxy
            target: { type: 'string', description: 'Target URL for proxy sites' },
            // For container
            image: { type: 'string', description: 'Docker image for container sites' },
            port: { type: 'number', description: 'Container port' },
            env: { type: 'array', items: { type: 'object' }, description: 'Environment variables' },
            // For static
            gitUrl: { type: 'string', description: 'Git repository URL for static sites' },
            buildCommand: { type: 'string', description: 'Build command for static sites' },
            // For loadbalancer
            backends: { type: 'array', items: { type: 'string' }, description: 'Backend URLs for load balancer' }
          }
        },
        aliases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Domain aliases'
        }
      },
      required: ['domain', 'type']
    }
  },
  {
    name: 'get_site',
    description: 'Get details of a specific site',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name of the site'
        }
      },
      required: ['domain']
    }
  },
  {
    name: 'update_site',
    description: 'Update site configuration',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name of the site to update'
        },
        updates: {
          type: 'object',
          description: 'Configuration updates to apply'
        }
      },
      required: ['domain', 'updates']
    }
  },
  {
    name: 'delete_site',
    description: 'Delete a site/application',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name of the site to delete'
        }
      },
      required: ['domain']
    }
  },
  
  // Container Management Tools
  {
    name: 'manage_container',
    description: 'Manage container operations (start, stop, restart, rebuild)',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name of the container site'
        },
        action: {
          type: 'string',
          enum: ['start', 'stop', 'restart', 'rebuild', 'status'],
          description: 'Container action to perform'
        }
      },
      required: ['domain', 'action']
    }
  },
  {
    name: 'get_container_logs',
    description: 'Get container logs',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name of the container site'
        },
        lines: {
          type: 'number',
          description: 'Number of log lines to retrieve',
          default: 100
        }
      },
      required: ['domain']
    }
  },
  
  // Deployment Tools
  {
    name: 'deploy_static_site',
    description: 'Deploy or update a static site from Git',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name for the site'
        },
        gitUrl: {
          type: 'string',
          description: 'Git repository URL'
        },
        branch: {
          type: 'string',
          description: 'Git branch to deploy',
          default: 'main'
        },
        buildCommand: {
          type: 'string',
          description: 'Build command (e.g., npm run build)'
        },
        outputDir: {
          type: 'string',
          description: 'Output directory after build',
          default: 'dist'
        }
      },
      required: ['domain', 'gitUrl']
    }
  },
  
  // SSL/Security Tools
  {
    name: 'setup_ssl',
    description: 'Setup SSL certificate for a domain',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name to setup SSL for'
        },
        provider: {
          type: 'string',
          enum: ['letsencrypt', 'cloudflare', 'custom'],
          description: 'SSL provider',
          default: 'letsencrypt'
        }
      },
      required: ['domain']
    }
  },
  {
    name: 'setup_auth',
    description: 'Setup authentication/protected routes for a site',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name to protect'
        },
        authType: {
          type: 'string',
          enum: ['basic', 'oauth', 'custom', 'apiKey'],
          description: 'Type of authentication'
        },
        routes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'Route pattern (e.g., /admin/*)' },
              authType: { type: 'string' },
              redirectUrl: { type: 'string' }
            }
          },
          description: 'Protected route configurations'
        }
      },
      required: ['domain', 'authType']
    }
  },
  
  // Monitoring Tools
  {
    name: 'get_metrics',
    description: 'Get site metrics and analytics',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name to get metrics for'
        },
        period: {
          type: 'string',
          enum: ['1h', '24h', '7d', '30d'],
          description: 'Time period for metrics',
          default: '24h'
        }
      },
      required: ['domain']
    }
  },
  {
    name: 'check_health',
    description: 'Check health status of a site',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain name to check'
        }
      },
      required: ['domain']
    }
  }
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'list_sites': {
        const response = await api.get('/sites');
        const sites = response.data;
        
        if (args.type && args.type !== 'all') {
          const filtered = sites.filter(site => site.type === args.type);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(filtered, null, 2)
              }
            ]
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sites, null, 2)
            }
          ]
        };
      }
      
      case 'create_site': {
        const siteConfig = {
          domain: args.domain,
          type: args.type,
          aliases: args.aliases || [],
          ssl_enabled: false,
          ...args.config
        };
        
        // Configure based on type
        if (args.type === 'container' && args.config) {
          siteConfig.containerConfig = {
            image: args.config.image,
            port: args.config.port || 3000,
            env: args.config.env || []
          };
        } else if (args.type === 'proxy' && args.config) {
          siteConfig.target = args.config.target;
        } else if (args.type === 'static' && args.config) {
          siteConfig.git_url = args.config.gitUrl;
          siteConfig.build_command = args.config.buildCommand;
        } else if (args.type === 'loadbalancer' && args.config) {
          siteConfig.backends = args.config.backends;
        }
        
        const response = await api.post('/sites', siteConfig);
        return {
          content: [
            {
              type: 'text',
              text: `Site created successfully: ${JSON.stringify(response.data, null, 2)}`
            }
          ]
        };
      }
      
      case 'get_site': {
        const response = await api.get(`/sites/${args.domain}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }
      
      case 'update_site': {
        const response = await api.put(`/sites/${args.domain}`, args.updates);
        return {
          content: [
            {
              type: 'text',
              text: `Site updated successfully: ${JSON.stringify(response.data, null, 2)}`
            }
          ]
        };
      }
      
      case 'delete_site': {
        await api.delete(`/sites/${args.domain}`);
        return {
          content: [
            {
              type: 'text',
              text: `Site ${args.domain} deleted successfully`
            }
          ]
        };
      }
      
      case 'manage_container': {
        const response = await api.post(`/containers/${args.domain}/${args.action}`);
        return {
          content: [
            {
              type: 'text',
              text: `Container ${args.action} completed: ${JSON.stringify(response.data, null, 2)}`
            }
          ]
        };
      }
      
      case 'get_container_logs': {
        const response = await api.get(`/containers/${args.domain}/logs`, {
          params: { lines: args.lines || 100 }
        });
        return {
          content: [
            {
              type: 'text',
              text: response.data
            }
          ]
        };
      }
      
      case 'deploy_static_site': {
        const deployConfig = {
          domain: args.domain,
          type: 'static',
          git_url: args.gitUrl,
          branch: args.branch || 'main',
          build_command: args.buildCommand,
          output_dir: args.outputDir || 'dist'
        };
        
        // Create or update site
        let response;
        try {
          response = await api.post('/sites', deployConfig);
        } catch (error) {
          if (error.response?.status === 409) {
            // Site exists, update it
            response = await api.put(`/sites/${args.domain}`, deployConfig);
          } else {
            throw error;
          }
        }
        
        // Trigger deployment
        const deployResponse = await api.post(`/deploy/${args.domain}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `Deployment initiated: ${JSON.stringify(deployResponse.data, null, 2)}`
            }
          ]
        };
      }
      
      case 'setup_ssl': {
        const response = await api.post(`/ssl/${args.domain}/setup`, {
          provider: args.provider || 'letsencrypt'
        });
        return {
          content: [
            {
              type: 'text',
              text: `SSL setup completed: ${JSON.stringify(response.data, null, 2)}`
            }
          ]
        };
      }
      
      case 'setup_auth': {
        const authConfig = {
          enabled: true,
          routes: args.routes || [{
            pattern: '/*',
            authType: args.authType
          }]
        };
        
        const response = await api.post(`/auth/${args.domain}/setup`, authConfig);
        return {
          content: [
            {
              type: 'text',
              text: `Authentication setup completed: ${JSON.stringify(response.data, null, 2)}`
            }
          ]
        };
      }
      
      case 'get_metrics': {
        const response = await api.get(`/metrics/${args.domain}`, {
          params: { period: args.period || '24h' }
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }
      
      case 'check_health': {
        const response = await api.get(`/health/${args.domain}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}\n${error.response?.data ? JSON.stringify(error.response.data, null, 2) : ''}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SpinForge MCP Server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});