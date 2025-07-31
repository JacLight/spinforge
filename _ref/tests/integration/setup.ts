import { beforeAll, afterAll } from '@jest/globals';

// Set longer timeout for integration tests
jest.setTimeout(60000);

beforeAll(() => {
  console.log('Starting SpinForge integration tests...');
  console.log('Make sure SpinHub is running with: docker-compose up');
});

afterAll(() => {
  console.log('Integration tests completed');
});