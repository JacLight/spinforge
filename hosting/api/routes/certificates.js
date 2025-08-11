/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const express = require('express');
const router = express.Router();
const CertificateService = require('../services/CertificateService');
const redisClient = require('../utils/redis');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const certificateService = new CertificateService(redisClient);

// Get certificate information for a domain
router.get('/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    
    const certificate = await certificateService.getCertificate(domain);
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    res.json(certificate);
  } catch (error) {
    console.error('Error getting certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test ACME challenge path
router.get('/:domain/test-acme', async (req, res) => {
  try {
    const { domain } = req.params;
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = `SpinForge ACME test for ${domain}`;
    const acmeDir = '/var/www/certbot/.well-known/acme-challenge';
    const testFilePath = path.join(acmeDir, testFileName);
    
    // Create test file
    await fs.mkdir(acmeDir, { recursive: true });
    await fs.writeFile(testFilePath, testContent);
    
    // Return the test URL
    const testUrl = `http://${domain}/.well-known/acme-challenge/${testFileName}`;
    
    // Clean up after 30 seconds
    setTimeout(async () => {
      try {
        await fs.unlink(testFilePath);
      } catch (error) {
        console.error('Error cleaning up test file:', error);
      }
    }, 30000);
    
    res.json({
      success: true,
      testUrl,
      message: 'Test file created. Visit the URL to verify ACME challenge is working.',
      note: 'The test file will be automatically deleted in 30 seconds.'
    });
  } catch (error) {
    console.error('Error creating ACME test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate Let's Encrypt certificate
router.post('/letsencrypt', async (req, res) => {
  try {
    const { domain, applicationId, email, staging } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    
    // Check if domain already has a certificate
    const existingCert = await certificateService.getCertificate(domain);
    if (existingCert && existingCert.status === 'active') {
      return res.status(400).json({ error: 'Certificate already exists for this domain' });
    }
    
    // Start certificate generation (async)
    certificateService.generateLetsEncryptCertificate(domain, email, staging)
      .then(cert => {
        console.log('Certificate generated successfully:', domain);
        // Update nginx configuration
        updateNginxForSSL(domain);
      })
      .catch(error => {
        console.error('Certificate generation failed:', domain, error);
      });
    
    res.json({ 
      message: 'Certificate generation started',
      domain,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error starting certificate generation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload manual certificate
router.post('/:domain/manual', async (req, res) => {
  try {
    const { domain } = req.params;
    const { certificate, privateKey, chain } = req.body;
    
    if (!certificate || !privateKey) {
      return res.status(400).json({ error: 'Certificate and private key are required' });
    }
    
    const cert = await certificateService.uploadManualCertificate(domain, {
      certificate,
      privateKey,
      chain
    });
    
    // Update nginx configuration
    updateNginxForSSL(domain);
    
    res.json(cert);
  } catch (error) {
    console.error('Error uploading certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Renew certificate
router.post('/:domain/renew', async (req, res) => {
  try {
    const { domain } = req.params;
    
    const certificate = await certificateService.getCertificate(domain);
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    if (certificate.type !== 'letsencrypt') {
      return res.status(400).json({ error: 'Only Let\'s Encrypt certificates can be renewed automatically' });
    }
    
    // Get the email from the existing certificate or use a default
    const email = certificate.email || 'admin@spinforge.local';
    
    // Start renewal (async)
    certificateService.renewCertificate(domain, email)
      .then(cert => {
        console.log('Certificate renewed successfully:', domain);
        updateNginxForSSL(domain);
      })
      .catch(error => {
        console.error('Certificate renewal failed:', domain, error);
      });
    
    res.json({ 
      message: 'Certificate renewal started',
      domain,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error renewing certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete certificate
router.delete('/:domain', async (req, res) => {
  try {
    const { domain } = req.params;
    
    await certificateService.deleteCertificate(domain);
    
    // Reload nginx to remove SSL configuration
    reloadNginx();
    
    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update certificate settings
router.put('/:domain/settings', async (req, res) => {
  try {
    const { domain } = req.params;
    const { autoRenew } = req.body;
    
    const certificate = await certificateService.updateCertificateSettings(domain, { autoRenew });
    
    res.json(certificate);
  } catch (error) {
    console.error('Error updating certificate settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to update nginx configuration for SSL
function updateNginxForSSL(domain) {
  try {
    // For now, just reload nginx
    // In production, you might want to update specific server blocks
    reloadNginx();
  } catch (error) {
    console.error('Error updating nginx for SSL:', error);
  }
}

// Helper function to reload nginx
function reloadNginx() {
  try {
    execSync('docker exec spinforge-openresty openresty -s reload', { stdio: 'pipe' });
    console.log('Nginx reloaded successfully');
  } catch (error) {
    console.error('Error reloading nginx:', error);
  }
}

module.exports = router;