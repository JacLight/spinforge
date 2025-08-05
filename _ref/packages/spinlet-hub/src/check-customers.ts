import Redis from 'ioredis';

async function checkCustomers() {
  const redis = new Redis({
    host: 'localhost',
    port: 9000,
    password: 'changeThisStrongPassword123'
  });

  try {
    console.log('Checking customers in Redis...\n');
    
    // Get all customer IDs
    const customerIds = await redis.smembers('customers');
    console.log(`Found ${customerIds.length} customer IDs in set:`, customerIds);
    
    // Get customer details
    for (const id of customerIds) {
      const customerData = await redis.get(`customer:${id}`);
      if (customerData) {
        const customer = JSON.parse(customerData);
        console.log(`\nCustomer ${id}:`, {
          name: customer.name,
          email: customer.email,
          isActive: customer.isActive
        });
      }
    }
    
    // Check for email mappings
    console.log('\nChecking email mappings...');
    const emailKeys = await redis.keys('customer:email:*');
    for (const key of emailKeys) {
      const customerId = await redis.get(key);
      console.log(`${key} -> ${customerId}`);
    }
    
    // Check routes with customer IDs
    console.log('\nChecking routes with customer IDs...');
    const routeKeys = await redis.keys('route:*');
    const customerIdsFromRoutes = new Set<string>();
    for (const key of routeKeys) {
      const routeData = await redis.get(key);
      if (routeData) {
        const route = JSON.parse(routeData);
        if (route.customerId) {
          customerIdsFromRoutes.add(route.customerId);
        }
      }
    }
    console.log('Unique customer IDs found in routes:', Array.from(customerIdsFromRoutes));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redis.quit();
  }
}

checkCustomers();