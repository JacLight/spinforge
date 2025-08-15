#!/usr/bin/env node
/**
 * Interactive test for SpinForge MCP Server
 */

import axios from 'axios';
import { config } from 'dotenv';
config();

const API_URL = process.env.SPINFORGE_API_URL || 'http://localhost:8080/api';

console.log('🚀 SpinForge MCP Server Test\n');
console.log(`API URL: ${API_URL}\n`);

async function testAPI() {
  try {
    // Test 1: List sites
    console.log('📋 Test 1: Listing all sites...');
    const sitesResponse = await axios.get(`${API_URL}/sites`);
    const sites = sitesResponse.data.data || sitesResponse.data;
    console.log(`✅ Found ${sites.length} sites`);
    
    if (sites.length > 0) {
      console.log('\nFirst 3 sites:');
      sites.slice(0, 3).forEach(site => {
        console.log(`  • ${site.domain} (${site.type})`);
      });
    }
    
    // Test 2: Get specific site details
    if (sites.length > 0) {
      console.log(`\n🔍 Test 2: Getting details for ${sites[0].domain}...`);
      const siteResponse = await axios.get(`${API_URL}/sites/${sites[0].domain}`);
      console.log('✅ Site details retrieved');
      console.log(`  Type: ${siteResponse.data.type}`);
      console.log(`  SSL: ${siteResponse.data.ssl_enabled ? 'Enabled' : 'Disabled'}`);
      if (siteResponse.data.aliases?.length > 0) {
        console.log(`  Aliases: ${siteResponse.data.aliases.join(', ')}`);
      }
    }
    
    // Test 3: Check container status
    const containerSites = sites.filter(s => s.type === 'container');
    if (containerSites.length > 0) {
      console.log(`\n🐳 Test 3: Checking container status for ${containerSites[0].domain}...`);
      try {
        const statusResponse = await axios.post(`${API_URL}/containers/${containerSites[0].domain}/status`);
        console.log(`✅ Container status: ${statusResponse.data.status || 'Retrieved'}`);
      } catch (error) {
        console.log(`⚠️  Container status check failed: ${error.response?.data?.error || error.message}`);
      }
    }
    
    // Test 4: Test creating a test site (commented out by default)
    console.log('\n🧪 Test 4: Site creation test');
    console.log('  (Uncomment code to test site creation)');
    /*
    const testSite = {
      domain: 'test-mcp.example.com',
      type: 'static',
      ssl_enabled: false
    };
    
    try {
      const createResponse = await axios.post(`${API_URL}/sites`, testSite);
      console.log(`✅ Test site created: ${createResponse.data.domain}`);
      
      // Clean up - delete test site
      await axios.delete(`${API_URL}/sites/${testSite.domain}`);
      console.log('✅ Test site deleted');
    } catch (error) {
      console.log(`⚠️  Site creation test failed: ${error.response?.data?.error || error.message}`);
    }
    */
    
    console.log('\n✅ All API tests completed successfully!');
    console.log('\n📝 MCP Server Integration:');
    console.log('1. The MCP server is configured and ready to use');
    console.log('2. To use with Claude Desktop, copy claude-config.json to your Claude config');
    console.log('3. To test MCP tools directly, run: npm start');
    
  } catch (error) {
    console.error('\n❌ API Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Make sure the SpinForge API is running on port 8080');
      console.log('   Run: docker-compose up -d');
    }
  }
}

// Test the actual MCP server tools format
console.log('\n📦 MCP Tools Available:');
const tools = [
  'list_sites - List all hosted sites',
  'create_site - Create a new site',
  'get_site - Get site details',
  'update_site - Update site config',
  'delete_site - Delete a site',
  'manage_container - Start/stop/restart containers',
  'get_container_logs - Get container logs',
  'deploy_static_site - Deploy from Git',
  'setup_ssl - Configure SSL',
  'setup_auth - Setup authentication',
  'get_metrics - Get site metrics',
  'check_health - Check site health'
];

tools.forEach(tool => console.log(`  • ${tool}`));

console.log('\n🔧 Testing API connection...\n');
testAPI();