import Redis from 'ioredis';
import { CustomerService } from './services/CustomerService';

async function testCustomerService() {
  const redis = new Redis({
    host: 'localhost',
    port: 9000,
    password: 'changeThisStrongPassword123'
  });

  const customerService = new CustomerService(redis);
  
  try {
    console.log('Testing CustomerService.getAllCustomers()...\n');
    
    const result = await customerService.getAllCustomers();
    console.log(`Total customers found: ${result.total}`);
    console.log('\nCustomers:');
    
    result.customers.forEach((customer, index) => {
      console.log(`\n${index + 1}. ${customer.name} (${customer.id})`);
      console.log(`   Email: ${customer.email}`);
      console.log(`   Created: ${customer.createdAt}`);
      console.log(`   Metadata:`, customer.metadata);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redis.quit();
  }
}

testCustomerService();