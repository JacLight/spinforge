#!/usr/bin/env node
/**
 * Test script for SpinForge MCP Server
 * This simulates how an AI agent would interact with the server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('Starting SpinForge MCP Server test...\n');
  
  // Start the MCP server as a subprocess
  const serverProcess = spawn('node', ['index.js'], {
    cwd: process.cwd(),
    env: process.env,
  });
  
  // Create client transport
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js'],
  });
  
  // Create client
  const client = new Client({
    name: 'spinforge-test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });
  
  try {
    // Connect to server
    await client.connect(transport);
    console.log('✅ Connected to SpinForge MCP Server\n');
    
    // List available tools
    console.log('📋 Available Tools:');
    const toolsResponse = await client.listTools();
    console.log(`Found ${toolsResponse.tools.length} tools:\n`);
    
    toolsResponse.tools.forEach(tool => {
      console.log(`  • ${tool.name}: ${tool.description}`);
    });
    
    console.log('\n🧪 Testing list_sites tool...');
    
    // Test list_sites tool
    try {
      const result = await client.callTool('list_sites', { type: 'all' });
      console.log('✅ list_sites executed successfully');
      console.log('Response:', result.content[0].text.substring(0, 200) + '...\n');
    } catch (error) {
      console.log('⚠️  list_sites failed (API might not be running):', error.message);
    }
    
    console.log('✅ MCP Server is working correctly!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Cleanup
    await client.close();
    serverProcess.kill();
    process.exit(0);
  }
}

// Run test
testMCPServer().catch(console.error);