import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';

const execAsync = promisify(exec);

describe('SpinForge Integration Tests', () => {
  const SPINHUB_URL = process.env.SPINHUB_URL || 'http://localhost:8080';
  const TEST_DOMAIN = 'test-app.local';
  const TEST_CUSTOMER = 'test-customer';
  let testSpinletId: string;

  beforeAll(async () => {
    // Ensure SpinHub is running
    try {
      const health = await axios.get(`${SPINHUB_URL}/_health`);
      expect(health.status).toBe(200);
    } catch (error) {
      throw new Error('SpinHub is not running. Please start it with docker-compose up');
    }
  }, 30000);

  describe('Health Checks', () => {
    test('SpinHub health endpoint returns OK', async () => {
      const response = await axios.get(`${SPINHUB_URL}/_health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('uptime');
    });

    test('Metrics endpoint returns system metrics', async () => {
      const response = await axios.get(`${SPINHUB_URL}/_metrics`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('activeSpinlets');
      expect(response.data).toHaveProperty('allocatedPorts');
      expect(response.data).toHaveProperty('uptime');
    });
  });

  describe('Route Management', () => {
    test('Can add a new route', async () => {
      const routeData = {
        domain: TEST_DOMAIN,
        customerId: TEST_CUSTOMER,
        spinletId: `spin-test-${Date.now()}`,
        buildPath: path.join(__dirname, '../../examples/remix-app'),
        framework: 'remix',
        config: {
          memory: '256MB',
          cpu: '0.25'
        }
      };

      const response = await axios.post(`${SPINHUB_URL}/_admin/routes`, routeData);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      
      testSpinletId = routeData.spinletId;
    });

    test('Cannot add duplicate route', async () => {
      const routeData = {
        domain: TEST_DOMAIN,
        customerId: TEST_CUSTOMER,
        spinletId: 'spin-duplicate',
        buildPath: path.join(__dirname, '../../examples/remix-app'),
        framework: 'remix'
      };

      try {
        await axios.post(`${SPINHUB_URL}/_admin/routes`, routeData);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toContain('already in use');
      }
    });

    test('Can get customer routes', async () => {
      const response = await axios.get(`${SPINHUB_URL}/_admin/customers/${TEST_CUSTOMER}/routes`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      
      const route = response.data.find((r: any) => r.domain === TEST_DOMAIN);
      expect(route).toBeDefined();
      expect(route.customerId).toBe(TEST_CUSTOMER);
    });
  });

  describe('Spinlet Lifecycle', () => {
    test('Spinlet starts on first request', async () => {
      // Make request to trigger spinlet start
      const response = await axios.get(SPINHUB_URL, {
        headers: { Host: TEST_DOMAIN },
        validateStatus: () => true
      });

      // Should get a response (might be 404 if app not fully configured)
      expect([200, 404, 502]).toContain(response.status);

      // Check spinlet status
      const statusResponse = await axios.get(`${SPINHUB_URL}/_admin/spinlets/${testSpinletId}`);
      expect(statusResponse.data).toHaveProperty('state');
      expect(['starting', 'running']).toContain(statusResponse.data.state);
    }, 30000);

    test('Can get spinlet status', async () => {
      const response = await axios.get(`${SPINHUB_URL}/_admin/spinlets/${testSpinletId}`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('spinletId', testSpinletId);
      expect(response.data).toHaveProperty('customerId', TEST_CUSTOMER);
      expect(response.data).toHaveProperty('port');
      expect(response.data).toHaveProperty('state');
    });

    test('Can stop a spinlet', async () => {
      const response = await axios.post(`${SPINHUB_URL}/_admin/spinlets/${testSpinletId}/stop`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      
      // Verify it's stopped
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await axios.get(`${SPINHUB_URL}/_admin/spinlets/${testSpinletId}`);
      expect(['stopping', 'stopped']).toContain(statusResponse.data.state);
    });
  });

  describe('Request Proxying', () => {
    let activeSpinletId: string;

    beforeAll(async () => {
      // Create a new route for proxy tests
      const routeData = {
        domain: 'proxy-test.local',
        customerId: TEST_CUSTOMER,
        spinletId: `spin-proxy-${Date.now()}`,
        buildPath: path.join(__dirname, '../../examples/remix-app'),
        framework: 'remix'
      };

      await axios.post(`${SPINHUB_URL}/_admin/routes`, routeData);
      activeSpinletId = routeData.spinletId;
    });

    test('Proxies requests with correct headers', async () => {
      const response = await axios.get(`${SPINHUB_URL}/health`, {
        headers: { 
          Host: 'proxy-test.local',
          'X-Test-Header': 'test-value'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('spinletId', activeSpinletId);
    });

    test('Returns 404 for unknown domain', async () => {
      try {
        await axios.get(SPINHUB_URL, {
          headers: { Host: 'unknown-domain.local' }
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toContain('No application configured');
      }
    });

    afterAll(async () => {
      // Clean up
      await axios.delete(`${SPINHUB_URL}/_admin/routes/proxy-test.local`);
    });
  });

  describe('Rate Limiting', () => {
    test('Global rate limit enforced', async () => {
      const requests = [];
      
      // Make many requests quickly
      for (let i = 0; i < 150; i++) {
        requests.push(
          axios.get(`${SPINHUB_URL}/_health`, {
            validateStatus: () => true
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      // Should have some rate limited requests
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  afterAll(async () => {
    // Clean up test routes
    try {
      await axios.delete(`${SPINHUB_URL}/_admin/routes/${TEST_DOMAIN}`);
    } catch {}
  });
});