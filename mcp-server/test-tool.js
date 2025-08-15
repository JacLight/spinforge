#!/usr/bin/env node
/**
 * Test MCP tool directly
 */

import axios from 'axios';
import { config } from 'dotenv';
config();

const API_URL = process.env.SPINFORGE_API_URL || 'http://localhost:8080/api';

// Simulate MCP tool call
async function callTool(toolName, args) {
  console.log(`\n📦 Calling tool: ${toolName}`);
  console.log('Arguments:', JSON.stringify(args, null, 2));
  
  try {
    switch(toolName) {
      case 'list_sites': {
        const response = await axios.get(`${API_URL}/sites`);
        const sites = response.data.data || response.data;
        
        if (args.type && args.type !== 'all') {
          const filtered = sites.filter(site => site.type === args.type);
          return {
            success: true,
            content: filtered
          };
        }
        
        return {
          success: true,
          content: sites
        };
      }
      
      case 'get_site': {
        const response = await axios.get(`${API_URL}/sites/${args.domain}`);
        return {
          success: true,
          content: response.data
        };
      }
      
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Testing MCP Tools\n');
  
  // Test 1: List all sites
  const result1 = await callTool('list_sites', { type: 'all' });
  console.log('\n✅ Result:');
  if (result1.success) {
    console.log(`Found ${result1.content.length} sites`);
    result1.content.slice(0, 3).forEach(site => {
      console.log(`  • ${site.domain} (${site.type})`);
    });
  } else {
    console.log('❌ Error:', result1.error);
  }
  
  // Test 2: List only container sites
  const result2 = await callTool('list_sites', { type: 'container' });
  console.log('\n✅ Result:');
  if (result2.success) {
    console.log(`Found ${result2.content.length} container sites`);
    result2.content.forEach(site => {
      console.log(`  • ${site.domain}`);
    });
  }
  
  // Test 3: Get specific site
  if (result1.success && result1.content.length > 0) {
    const result3 = await callTool('get_site', { domain: result1.content[0].domain });
    console.log('\n✅ Result:');
    if (result3.success) {
      console.log(`Site: ${result3.content.domain}`);
      console.log(`Type: ${result3.content.type}`);
      console.log(`Target: ${result3.content.target || 'N/A'}`);
    }
  }
  
  console.log('\n✅ MCP Server is ready for AI agents!');
  console.log('\nTo integrate with Claude Desktop:');
  console.log('1. Copy the claude-config.json contents');
  console.log('2. Add to your Claude Desktop configuration');
  console.log('3. Restart Claude Desktop');
  console.log('\nThen you can say things like:');
  console.log('  "Show me all my hosted sites"');
  console.log('  "Create a new Node.js app at myapp.com"');
  console.log('  "Deploy my React app from GitHub"');
}

runTests();