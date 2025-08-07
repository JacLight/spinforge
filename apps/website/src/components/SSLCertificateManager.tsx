/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useEffect } from 'react';
import { Shield, Upload, RefreshCw, CheckCircle, AlertCircle, Info, Lock, Globe, Calendar, User, FileText, Loader, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Get auth headers from cookies/localStorage
function getAuthHeaders() {
  const token = localStorage.getItem('auth-token') || '';
  const customerId = localStorage.getItem('customer-id') || '';
  
  return {
    'Authorization': `Bearer ${token}`,
    'X-Customer-ID': customerId,
    'X-Auth-Token': token,
  };
}

// Customer-specific API calls
const customerCertAPI = {
  async getCertificate(domain: string) {
    const response = await axios.get(`${API_BASE_URL}/_api/customer/sites/${domain}/certificate`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },
  
  async generateLetsEncryptCertificate(domain: string, applicationId: string, email: string) {
    const response = await axios.post(
      `${API_BASE_URL}/_api/customer/sites/${domain}/certificate/letsencrypt`,
      { email, applicationId },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
  
  async uploadCertificate(domain: string, data: any) {
    const response = await axios.post(
      `${API_BASE_URL}/_api/customer/sites/${domain}/certificate/upload`,
      data,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
  
  async renewCertificate(domain: string) {
    const response = await axios.post(
      `${API_BASE_URL}/_api/customer/sites/${domain}/certificate/renew`,
      {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
  
  async deleteCertificate(domain: string) {
    const response = await axios.delete(
      `${API_BASE_URL}/_api/customer/sites/${domain}/certificate`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
  
  async updateCertificateSettings(domain: string, settings: any) {
    const response = await axios.put(
      `${API_BASE_URL}/_api/customer/sites/${domain}/certificate/settings`,
      settings,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
  
  async getCurrentCustomer() {
    try {
      const response = await axios.get(`${API_BASE_URL}/_api/customer/profile`, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      return null;
    }
  },
  
  async updateSite(domain: string, data: any) {
    const response = await axios.put(
      `${API_BASE_URL}/_api/customer/sites/${domain}`,
      data,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
  
  async getSite(domain: string) {
    const response = await axios.get(
      `${API_BASE_URL}/_api/customer/sites/${domain}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  }
};

interface Certificate {
  id: string;
  domain: string;
  type: 'manual' | 'letsencrypt';
  status: 'active' | 'pending' | 'expired' | 'error';
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  autoRenew?: boolean;
  lastRenewal?: string;
  nextRenewal?: string;
  error?: string;
}

interface SSLCertificateManagerProps {
  domain: string;
  applicationId: string;
}

export default function SSLCertificateManager({ domain, applicationId }: SSLCertificateManagerProps) {
  const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('auto');
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sslEnabled, setSslEnabled] = useState(false);
  const [sslRedirect, setSslRedirect] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Manual certificate upload
  const [manualCert, setManualCert] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [manualChain, setManualChain] = useState('');

  useEffect(() => {
    fetchCertificate();
    fetchSiteConfig();
    fetchCurrentCustomer();
  }, [domain]);

  const fetchCurrentCustomer = async () => {
    try {
      const customer = await customerCertAPI.getCurrentCustomer();
      if (customer && customer.email) {
        setRegistrationEmail(customer.email);
      }
    } catch (error) {
      console.error('Failed to fetch current customer:', error);
    }
  };

  const fetchCertificate = async () => {
    try {
      setLoading(true);
      const cert = await customerCertAPI.getCertificate(domain);
      setCertificate(cert);
      if (cert && cert.type === 'manual') {
        setActiveTab('manual');
      }
    } catch (error) {
      console.error('Failed to fetch certificate:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSiteConfig = async () => {
    try {
      const response = await customerCertAPI.getSite(domain);
      if (response) {
        setSslEnabled(response.ssl_enabled || false);
        if (response.config && response.config.sslRedirect !== undefined) {
          setSslRedirect(response.config.sslRedirect);
        }
      }
    } catch (error) {
      console.error('Failed to fetch site config:', error);
    }
  };

  const updateSSLEnabled = async (enabled: boolean) => {
    try {
      await customerCertAPI.updateSite(domain, {
        ssl_enabled: enabled
      });
      toast.success('SSL setting updated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update SSL setting');
      throw error;
    }
  };

  const updateSSLRedirect = async (enabled: boolean) => {
    try {
      await customerCertAPI.updateSite(domain, {
        config: { sslRedirect: enabled }
      });
      toast.success('SSL redirect setting updated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update SSL redirect');
      throw error;
    }
  };

  const generateLetsEncryptCert = async () => {
    if (!registrationEmail || !registrationEmail.includes('@')) {
      setCertError('Please enter a valid email address for Let\'s Encrypt registration.');
      return;
    }
    
    try {
      setGenerating(true);
      setCertError(null);
      await customerCertAPI.generateLetsEncryptCertificate(domain, applicationId, registrationEmail);
      toast.success('Certificate generation started. This may take a few minutes.');
      
      // Poll for certificate status
      const pollInterval = setInterval(async () => {
        const cert = await customerCertAPI.getCertificate(domain);
        if (cert && cert.status !== 'pending') {
          clearInterval(pollInterval);
          setCertificate(cert);
          setGenerating(false);
          
          if (cert.status === 'active') {
            toast.success('SSL certificate generated successfully!');
            setCertError(null);
          } else if (cert.status === 'error') {
            setCertError(cert.error || 'Certificate generation failed');
          }
        }
      }, 5000);
      
      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setGenerating(false);
      }, 300000);
    } catch (error: any) {
      setGenerating(false);
      const errorMessage = error.response?.data?.error || 'Failed to generate certificate';
      setCertError(errorMessage);
      // Still show a brief toast for immediate feedback
      toast.error('Certificate generation failed. See details below.');
    }
  };

  const uploadManualCertificate = async () => {
    if (!manualCert || !manualKey) {
      toast.error('Certificate and private key are required');
      return;
    }

    try {
      await customerCertAPI.uploadCertificate(domain, {
        certificate: manualCert,
        privateKey: manualKey,
        chain: manualChain,
      });
      toast.success('Certificate uploaded successfully');
      fetchCertificate();
      
      // Clear form
      setManualCert('');
      setManualKey('');
      setManualChain('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload certificate');
    }
  };

  const renewCertificate = async () => {
    try {
      setGenerating(true);
      await customerCertAPI.renewCertificate(domain);
      toast.success('Certificate renewal started');
      
      // Poll for renewal status
      setTimeout(() => {
        fetchCertificate();
        setGenerating(false);
      }, 10000);
    } catch (error: any) {
      setGenerating(false);
      toast.error(error.response?.data?.error || 'Failed to renew certificate');
    }
  };

  const deleteCertificate = async () => {
    if (deleteConfirmation !== domain) {
      setDeleteError('Please type the exact domain name to confirm');
      return;
    }
    
    setDeleting(true);
    try {
      await customerCertAPI.deleteCertificate(domain);
      toast.success('Certificate deleted successfully');
      setCertificate(null);
      setShowDeleteModal(false);
      setDeleteConfirmation('');
      setDeleteError('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete certificate');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SSL Configuration Options */}
      <div className="space-y-4">
        {/* Enable SSL Option */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                Enable SSL/HTTPS
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Serve your website over HTTPS using SSL certificate
              </p>
            </div>
            <button
              onClick={async () => {
                const newValue = !sslEnabled;
                setSslEnabled(newValue);
                try {
                  await updateSSLEnabled(newValue);
                  // If disabling SSL, also disable redirect
                  if (!newValue && sslRedirect) {
                    setSslRedirect(false);
                    await updateSSLRedirect(false);
                  }
                } catch (error) {
                  setSslEnabled(!newValue); // Revert on error
                }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                sslEnabled ? 'bg-green-600' : 'bg-gray-300'
              } cursor-pointer`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  sslEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* SSL Redirect Option */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                Force HTTPS Redirect
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Automatically redirect all HTTP traffic to HTTPS
              </p>
            </div>
            <button
              onClick={async () => {
                const newValue = !sslRedirect;
                setSslRedirect(newValue);
                try {
                  await updateSSLRedirect(newValue);
                } catch (error) {
                  setSslRedirect(!newValue); // Revert on error
                }
              }}
              disabled={!sslEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                sslRedirect && sslEnabled
                  ? 'bg-green-600'
                  : 'bg-gray-300'
              } ${!sslEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  sslRedirect ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {!sslEnabled && (
            <p className="text-xs text-yellow-600 mt-2">
              SSL must be enabled to use HTTPS redirect
            </p>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('auto')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'auto'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Let's Encrypt (Automatic)</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'manual'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Manual Certificate</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Current Certificate Status */}
      {certificate && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Lock className="w-5 h-5 mr-2 text-green-500" />
              Current SSL Certificate
            </h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              certificate.status === 'active' ? 'bg-green-100 text-green-700' :
              certificate.status === 'expired' ? 'bg-red-100 text-red-700' :
              certificate.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {certificate.status === 'active' ? 'Active' :
               certificate.status === 'expired' ? 'Expired' :
               certificate.status === 'pending' ? 'Pending' :
               'Error'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Domain</p>
              <p className="font-medium flex items-center">
                <Globe className="w-4 h-4 mr-1" />
                {certificate.domain}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium">
                {certificate.type === 'letsencrypt' ? "Let's Encrypt" : 'Manual'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Issuer</p>
              <p className="font-medium flex items-center">
                <User className="w-4 h-4 mr-1" />
                {certificate.issuer || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Valid From</p>
              <p className="font-medium flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {formatDate(certificate.validFrom)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Valid Until</p>
              <p className="font-medium flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {formatDate(certificate.validTo)}
                {certificate.validTo && (
                  <span className={`ml-2 text-sm ${
                    getDaysUntilExpiry(certificate.validTo)! > 30 ? 'text-green-600' :
                    getDaysUntilExpiry(certificate.validTo)! > 7 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    ({getDaysUntilExpiry(certificate.validTo)} days)
                  </span>
                )}
              </p>
            </div>
            {certificate.type === 'letsencrypt' && (
              <div>
                <p className="text-sm text-gray-500">Auto-Renewal</p>
                <p className="font-medium">
                  {certificate.autoRenew ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Enabled
                    </span>
                  ) : (
                    <span className="flex items-center text-gray-500">
                      <X className="w-4 h-4 mr-1" />
                      Disabled
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {certificate.error && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{certificate.error}</p>
            </div>
          )}

          <div className="mt-6 flex items-center space-x-3">
            {certificate.type === 'letsencrypt' && certificate.status === 'active' && (
              <button
                onClick={renewCertificate}
                disabled={generating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {generating ? (
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Renew Certificate
              </button>
            )}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
            >
              Delete Certificate
            </button>
          </div>
        </motion.div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'auto' ? (
          <motion.div
            key="auto"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Let's Encrypt Information */}
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">About Let's Encrypt</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Free SSL/TLS certificates</li>
                    <li>• Automatic renewal every 90 days</li>
                    <li>• Domain validation required</li>
                    <li>• Supports wildcard certificates</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Generate Certificate Button */}
            {!certificate || certificate.type !== 'letsencrypt' ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Generate Let's Encrypt Certificate</h3>
                <p className="text-gray-600 mb-4">
                  Automatically generate a free SSL certificate for <code className="bg-gray-100 px-1 rounded">{domain}</code>.
                </p>
                
                {/* Prerequisites Notice */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start">
                    <Info className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium mb-1">Before generating a certificate:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Ensure the domain DNS points to this server's IP</li>
                        <li>Port 80 must be accessible from the internet</li>
                        <li>The domain must be publicly accessible (not local/internal)</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Email Registration Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Email *
                  </label>
                  <input
                    type="email"
                    value={registrationEmail}
                    onChange={(e) => {
                      setRegistrationEmail(e.target.value);
                      setCertError(null);
                    }}
                    placeholder="your-email@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Let's Encrypt requires a valid email address for account registration.
                    Certificate expiration notices will be sent to this address.
                  </p>
                </div>
                
                {/* Error Display */}
                {certError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-red-800 mb-1">Certificate Generation Failed</h4>
                        <p className="text-sm text-red-700 whitespace-pre-wrap">{certError}</p>
                        {certError.includes('Some challenges have failed') && (
                          <div className="mt-3 text-sm text-red-600 space-y-2">
                            <p className="font-medium">Common causes and solutions:</p>
                            <ul className="list-disc list-inside space-y-1 text-red-600">
                              <li>Domain not pointing to this server - Check DNS settings</li>
                              <li>Port 80 not accessible - Ensure firewall allows HTTP traffic</li>
                              <li>Domain recently changed - Wait for DNS propagation (up to 48 hours)</li>
                              <li>Using a local/internal domain - Let's Encrypt requires public domains</li>
                            </ul>
                            <p className="mt-2">
                              <strong>To verify:</strong> Visit <code className="bg-red-100 px-1 rounded">http://{domain}/.well-known/acme-challenge/test</code>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={generateLetsEncryptCert}
                  disabled={generating || !registrationEmail}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {generating ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Generating Certificate...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5 mr-2" />
                      Generate Certificate
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Certificate Management</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Automatic Renewal</p>
                      <p className="text-sm text-gray-600">
                        Certificate will be automatically renewed 30 days before expiration
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={certificate.autoRenew}
                        onChange={async (e) => {
                          try {
                            await customerCertAPI.updateCertificateSettings(domain, { autoRenew: e.target.checked });
                            fetchCertificate();
                            toast.success('Auto-renewal settings updated');
                          } catch (error) {
                            toast.error('Failed to update settings');
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  {certificate.nextRenewal && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>Next renewal:</strong> {formatDate(certificate.nextRenewal)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="manual"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Manual Certificate Upload */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">Upload Manual Certificate</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate (PEM format) *
                  </label>
                  <textarea
                    value={manualCert}
                    onChange={(e) => setManualCert(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Private Key (PEM format) *
                  </label>
                  <textarea
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certificate Chain (optional)
                  </label>
                  <textarea
                    value={manualChain}
                    onChange={(e) => setManualChain(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-700">
                      <p className="font-medium mb-1">Important Notes:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Certificate must be valid for domain: {domain}</li>
                        <li>Files must be in PEM format</li>
                        <li>Private key will be encrypted and stored securely</li>
                        <li>You'll need to manually renew before expiration</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={uploadManualCertificate}
                  disabled={!manualCert || !manualKey}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Certificate
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 z-[70]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation('');
                setDeleteError('');
              }}
            />
            <motion.div
              className="fixed inset-0 z-[71] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Delete SSL Certificate
                    </h3>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">
                        This action cannot be undone. This will permanently delete the SSL certificate
                        and disable HTTPS for this domain.
                      </p>
                      <p className="mt-4 text-sm font-medium text-gray-700">
                        Please type <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {domain}
                        </span> to confirm:
                      </p>
                      <input
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => {
                          setDeleteConfirmation(e.target.value);
                          setDeleteError('');
                        }}
                        placeholder="Type the domain name"
                        className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      {deleteError && (
                        <p className="mt-2 text-sm text-red-600">{deleteError}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-row-reverse gap-3">
                  <button
                    onClick={deleteCertificate}
                    disabled={deleting}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Delete Certificate'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteConfirmation('');
                      setDeleteError('');
                    }}
                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}