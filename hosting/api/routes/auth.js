/**
 * SpinForge - Customer Authentication Routes
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Helper to generate IDs
function generateId(prefix = '') {
  return prefix + crypto.randomBytes(16).toString('hex');
}

// Register new customer
router.post('/customer/register', async (req, res) => {
  try {
    const { email, password, name, company } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await redisClient.get(`user:email:${email}`);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Generate IDs
    const userId = generateId('user_');
    const customerId = generateId('cust_');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user object
    const user = {
      id: userId,
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      company,
      customerId,
      role: 'customer',
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store user in Redis
    await redisClient.set(`user:${userId}`, JSON.stringify(user));
    await redisClient.set(`user:email:${email}`, JSON.stringify(user));
    
    // Create customer record
    const customer = {
      id: customerId,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: true,
      metadata: {
        userId,
        company,
        role: 'customer'
      },
      limits: {}
    };
    
    await redisClient.set(`customer:${customerId}`, JSON.stringify(customer));
    await redisClient.sAdd('customers', customerId);
    await redisClient.set(`customer:email:${email}`, customerId);

    // Generate auth token
    const authToken = generateId('token_');
    const tokenData = {
      userId,
      customerId,
      email,
      token: authToken,
      createdAt: new Date().toISOString(),
    };
    
    await redisClient.setEx(`apitoken:${authToken}`, 7 * 24 * 60 * 60, JSON.stringify(tokenData));

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        customerId,
      },
      token: authToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login customer
router.post('/customer/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user by email
    const userData = await redisClient.get(`user:email:${email}`);
    if (!userData) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = JSON.parse(userData);

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate session token
    const sessionToken = generateId('session_');
    const session = {
      userId: user.id,
      customerId: user.customerId,
      email: user.email,
      role: user.role || 'customer',
      token: sessionToken,
    };

    // Save session (expire in 7 days)
    await redisClient.setEx(`session:${sessionToken}`, 7 * 24 * 60 * 60, JSON.stringify(session));

    // Generate auth token for API calls
    const authToken = generateId('token_');
    const tokenData = {
      userId: user.id,
      customerId: user.customerId,
      email: user.email,
      token: authToken,
      createdAt: new Date().toISOString(),
    };
    
    await redisClient.setEx(`apitoken:${authToken}`, 7 * 24 * 60 * 60, JSON.stringify(tokenData));

    res.json({
      success: true,
      token: sessionToken,
      refreshToken: sessionToken,
      user: {
        email: user.email,
        customerId: user.customerId,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify customer session
router.post('/customer/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const sessionData = await redisClient.get(`session:${token}`);
    if (!sessionData) {
      return res.status(401).json({ valid: false });
    }

    const session = JSON.parse(sessionData);
    
    res.json({
      valid: true,
      user: {
        userId: session.userId,
        customerId: session.customerId,
        email: session.email,
        role: session.role,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Customer logout
router.post('/customer/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    
    if (token) {
      await redisClient.del(`session:${token}`);
      await redisClient.del(`apitoken:${token}`);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get customer by email (for internal use)
router.get('/customer/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const userData = await redisClient.get(`user:email:${email}`);
    
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = JSON.parse(userData);
    // Don't send password
    delete user.password;
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;