import { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  Lock,
  X,
  ChevronRight,
  Download,
  Trash2,
  Star,
  Info,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Certificate {
  domain: string;
  isWildcard?: boolean;
  status?: 'active' | 'pending' | 'expired' | 'error';
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  autoRenew?: boolean;
  dnsValidated?: boolean;
  alternativeNames?: string[];
  type?: 'standard' | 'wildcard';
}

interface CertificateDrawerProps {
  certificate: Certificate | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function CertificateDrawer({ certificate, isOpen, onClose, onRefresh }: CertificateDrawerProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [validationStep, setValidationStep] = useState<'form' | 'validation'>('form');
  const [dnsValidationData, setDnsValidationData] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [registrationType, setRegistrationType] = useState<'generate' | 'upload'>('generate');
  const [uploadData, setUploadData] = useState({
    domain: '',
    certificate: '',
    privateKey: '',
    chain: ''
  });
  const [formData, setFormData] = useState({
    domain: '',
    type: 'standard' as 'standard' | 'wildcard',
    email: '',
    autoRenew: true,
    validationMethod: 'manual' as 'manual' | 'automatic',
    dnsProvider: '' as '' | 'cloudflare' | 'route53' | 'digitalocean' | 'godaddy' | 'namecheap',
    apiKey: '',
    apiSecret: '',
    subdomains: [] as string[]
  });

  if (!isOpen) return null;

  const handleRegister = async () => {
    if (!certificate && !formData.domain) {
      toast.error('Domain is required');
      return;
    }

    // Validate provider credentials if automatic
    if (formData.type === 'wildcard' && formData.validationMethod === 'automatic') {
      if (!formData.dnsProvider) {
        toast.error('Please select a DNS provider');
        return;
      }
      if (!formData.apiKey) {
        toast.error('API credentials are required for automatic validation');
        return;
      }
    }

    setIsRegistering(true);
    try {
      const domain = certificate?.domain || formData.domain;
      const isWildcard = formData.type === 'wildcard';
      const finalDomain = isWildcard && !domain.startsWith('*.') ? `*.${domain}` : domain;
      
      // Build subdomains list for wildcard
      const subdomains = formData.type === 'wildcard' 
        ? ['*', ...formData.subdomains.filter(s => s.trim())]
        : [];

      const response = await fetch(`/api/ssl/certificates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: finalDomain,
          email: formData.email || 'admin@' + domain.replace('*.', ''),
          type: formData.type,
          validationMethod: formData.validationMethod,
          dnsProvider: formData.dnsProvider,
          apiKey: formData.apiKey,
          apiSecret: formData.apiSecret,
          subdomains
        })
      });

      if (!response.ok) throw new Error('Failed to register certificate');
      
      const data = await response.json();
      
      if (formData.type === 'wildcard' && formData.validationMethod === 'manual') {
        // Show DNS validation instructions
        setDnsValidationData(data);
        setValidationStep('validation');
        toast.info('Please complete DNS validation');
      } else {
        toast.success(`Certificate registration initiated for ${finalDomain}`);
        onRefresh();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUploadCertificate = async () => {
    if (!uploadData.domain || !uploadData.certificate || !uploadData.privateKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsRegistering(true);
    try {
      const response = await fetch('/api/ssl/certificates/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: uploadData.domain,
          certificate: uploadData.certificate,
          privateKey: uploadData.privateKey,
          chain: uploadData.chain
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload certificate');
      }

      toast.success(`Certificate uploaded successfully for ${uploadData.domain}`);
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleValidationComplete = async () => {
    setIsValidating(true);
    try {
      const domain = dnsValidationData?.baseDomain || formData.domain;
      const response = await fetch(`/api/ssl/certificates/${encodeURIComponent(domain)}/validate`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Validation failed');
      }
      
      toast.success('Certificate validated successfully!');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Validation failed. Please check your DNS records.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDelete = async () => {
    if (!certificate || !window.confirm(`Delete certificate for ${certificate.domain}?`)) return;

    try {
      const response = await fetch(`/api/ssl/certificates/${encodeURIComponent(certificate.domain)}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete certificate');
      
      toast.success('Certificate deleted successfully');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRenew = async () => {
    if (!certificate) return;

    try {
      const response = await fetch(`/api/ssl/certificates/${encodeURIComponent(certificate.domain)}/renew`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to renew certificate');
      
      toast.success('Certificate renewal initiated');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'expired': return 'text-red-600 bg-red-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'expired': return <AlertCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg text-white">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {certificate ? 'Certificate Details' : 'Register New Certificate'}
                  </h2>
                  {certificate && (
                    <p className="text-sm text-gray-500">
                      {certificate.domain}
                      {certificate.isWildcard && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          <Star className="w-3 h-3 mr-1" />
                          Wildcard
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {validationStep === 'validation' && dnsValidationData ? (
              // DNS Validation Instructions
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-yellow-900 font-medium mb-2">DNS Validation Required</h3>
                      <p className="text-yellow-700 text-sm">
                        To complete the wildcard certificate registration, you need to add a DNS TXT record.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Add this DNS record:</h4>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-sm">
                    <div className="space-y-2">
                      <div className="flex">
                        <span className="text-gray-500 w-20">Type:</span>
                        <span className="text-gray-900">TXT</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-500 w-20">Name:</span>
                        <span className="text-gray-900">_acme-challenge.{dnsValidationData.baseDomain || formData.domain}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-500 w-20">Value:</span>
                        <span className="text-gray-900 break-all">{dnsValidationData.validationToken || 'Will be provided by Let\'s Encrypt'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-gray-500 w-20">TTL:</span>
                        <span className="text-gray-900">300</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Instructions:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                    <li>Log in to your DNS provider's control panel</li>
                    <li>Navigate to DNS management for {dnsValidationData.baseDomain || formData.domain}</li>
                    <li>Add the TXT record shown above</li>
                    <li>Wait 5-10 minutes for DNS propagation</li>
                    <li>Click "Validate DNS" below to complete the process</li>
                  </ol>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleValidationComplete}
                    disabled={isValidating}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Validate DNS
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setValidationStep('form');
                      setDnsValidationData(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : certificate ? (
              <div className="space-y-6">
                {/* Status Section */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">Certificate Status</h3>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${getStatusColor(certificate.status)}`}>
                      {getStatusIcon(certificate.status)}
                      <span className="ml-1.5 capitalize">{certificate.status || 'Unknown'}</span>
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Domain</span>
                      <span className="text-gray-900 font-medium">{certificate.domain}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Type</span>
                      <span className="text-gray-900 font-medium">
                        {certificate.isWildcard ? 'Wildcard SSL' : 'Standard SSL'}
                      </span>
                    </div>

                    {certificate.issuer && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Issuer</span>
                        <span className="text-gray-900">{certificate.issuer}</span>
                      </div>
                    )}

                    {certificate.validFrom && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Valid From</span>
                        <span className="text-gray-900">
                          {format(new Date(certificate.validFrom), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    )}

                    {certificate.validTo && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Expires</span>
                        <span className="text-gray-900">
                          {format(new Date(certificate.validTo), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Auto-Renewal</span>
                      <span className={`font-medium ${certificate.autoRenew ? 'text-green-600' : 'text-gray-500'}`}>
                        {certificate.autoRenew ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alternative Names */}
                {certificate.alternativeNames && certificate.alternativeNames.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Alternative Names</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="space-y-2">
                        {certificate.alternativeNames.map((name, index) => (
                          <div key={index} className="flex items-center text-sm">
                            <Globe className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-gray-700">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={handleRenew}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Renew Certificate
                  </button>

                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center justify-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Certificate
                  </button>
                </div>
              </div>
            ) : (
              // Registration Form
              <div className="space-y-6">
                {/* Toggle between Generate and Upload */}
                <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setRegistrationType('generate')}
                    className={`flex-1 py-2 px-4 rounded-md transition-all ${
                      registrationType === 'generate'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Shield className="w-4 h-4 inline mr-2" />
                    Generate New Certificate
                  </button>
                  <button
                    onClick={() => setRegistrationType('upload')}
                    className={`flex-1 py-2 px-4 rounded-md transition-all ${
                      registrationType === 'upload'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Upload className="w-4 h-4 inline mr-2" />
                    Upload Existing Certificate
                  </button>
                </div>

                {registrationType === 'upload' ? (
                  // Upload Certificate Form
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Domain *
                      </label>
                      <input
                        type="text"
                        value={uploadData.domain}
                        onChange={(e) => setUploadData({ ...uploadData, domain: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="example.com or *.example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Certificate (PEM format) *
                      </label>
                      <textarea
                        value={uploadData.certificate}
                        onChange={(e) => setUploadData({ ...uploadData, certificate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows={6}
                        placeholder="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Private Key (PEM format) *
                      </label>
                      <textarea
                        value={uploadData.privateKey}
                        onChange={(e) => setUploadData({ ...uploadData, privateKey: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows={6}
                        placeholder="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Certificate Chain (optional)
                      </label>
                      <textarea
                        value={uploadData.chain}
                        onChange={(e) => setUploadData({ ...uploadData, chain: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        rows={6}
                        placeholder="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Include intermediate certificates if required
                      </p>
                    </div>

                    <button
                      onClick={handleUploadCertificate}
                      disabled={!uploadData.domain || !uploadData.certificate || !uploadData.privateKey || isRegistering}
                      className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRegistering ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Certificate
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  // Generate Certificate Form
                  <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain *
                  </label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    For wildcard certificates, enter the base domain (e.g., example.com)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certificate Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'standard' })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.type === 'standard'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Lock className="w-5 h-5 mb-2 mx-auto text-gray-700" />
                      <div className="text-sm font-medium">Standard SSL</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Single domain certificate
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'wildcard' })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.type === 'wildcard'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Star className="w-5 h-5 mb-2 mx-auto text-purple-600" />
                      <div className="text-sm font-medium">Wildcard SSL</div>
                      <div className="text-xs text-gray-500 mt-1">
                        *.domain.com coverage
                      </div>
                    </button>
                  </div>
                </div>

                {/* Only show email for automatic validation or standard certificates */}
                {(formData.type === 'standard' || formData.validationMethod === 'automatic') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email {formData.validationMethod === 'automatic' ? '*' : '(optional)'}
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="admin@example.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      For certificate expiration notifications
                    </p>
                  </div>
                )}

                {/* Only show auto-renewal for automatic validation or standard certificates */}
                {(formData.type === 'standard' || formData.validationMethod === 'automatic') && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoRenew"
                      checked={formData.autoRenew}
                      onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoRenew" className="ml-2 text-sm text-gray-700">
                      Enable automatic renewal (recommended)
                    </label>
                  </div>
                )}

                {formData.type === 'wildcard' && (
                  <>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex">
                        <Star className="w-5 h-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-purple-900 font-medium mb-1">Wildcard Certificate</p>
                          <p className="text-purple-700">
                            This will create a certificate for *.{formData.domain || 'example.com'} covering all subdomains.
                            DNS validation will be required.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Validation Method Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        DNS Validation Method
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, validationMethod: 'manual' })}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            formData.validationMethod === 'manual'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Info className="w-5 h-5 mb-2 mx-auto text-gray-700" />
                          <div className="text-sm font-medium">Manual DNS</div>
                          <div className="text-xs text-gray-500 mt-1">
                            I'll add DNS records manually
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, validationMethod: 'automatic' })}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            formData.validationMethod === 'automatic'
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <RefreshCw className="w-5 h-5 mb-2 mx-auto text-green-600" />
                          <div className="text-sm font-medium">Automatic DNS</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Use DNS provider API
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* DNS Provider Selection */}
                    {formData.validationMethod === 'automatic' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            DNS Provider
                          </label>
                          <select
                            value={formData.dnsProvider}
                            onChange={(e) => setFormData({ ...formData, dnsProvider: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select a provider</option>
                            <option value="cloudflare">Cloudflare</option>
                            <option value="route53">AWS Route 53</option>
                            <option value="digitalocean">DigitalOcean</option>
                            <option value="godaddy">GoDaddy</option>
                            <option value="namecheap">Namecheap</option>
                          </select>
                        </div>

                        {formData.dnsProvider && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                API Key / Token
                              </label>
                              <input
                                type="password"
                                value={formData.apiKey}
                                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={
                                  formData.dnsProvider === 'cloudflare' ? 'CF API Token' :
                                  formData.dnsProvider === 'route53' ? 'AWS Access Key' :
                                  'API Key'
                                }
                              />
                            </div>

                            {(formData.dnsProvider === 'route53' || formData.dnsProvider === 'godaddy') && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {formData.dnsProvider === 'route53' ? 'Secret Access Key' : 'API Secret'}
                                </label>
                                <input
                                  type="password"
                                  value={formData.apiSecret}
                                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder={formData.dnsProvider === 'route53' ? 'AWS Secret Key' : 'API Secret'}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* Additional Subdomains */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Subdomains (optional)
                      </label>
                      <textarea
                        value={formData.subdomains.join('\n')}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          subdomains: e.target.value.split('\n').filter(s => s.trim())
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="api&#10;www&#10;admin"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter one subdomain per line. The wildcard (*.{formData.domain || 'example.com'}) is included automatically.
                      </p>
                    </div>
                  </>
                )}

                <button
                  onClick={handleRegister}
                  disabled={!formData.domain || isRegistering}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRegistering ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Register Certificate
                    </>
                  )}
                </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CertificateManager() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'wildcard' | 'standard'>('all');

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const response = await fetch('/api/ssl/certificates');
      if (!response.ok) throw new Error('Failed to fetch certificates');
      const data = await response.json();
      
      // Transform the data to match our Certificate interface
      const transformedCerts = data.map((cert: any) => ({
        domain: cert.domain,
        isWildcard: cert.domain?.startsWith('*.'),
        status: cert.status || 'active',
        issuer: cert.issuer || 'Let\'s Encrypt',
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        autoRenew: cert.autoRenew !== false,
        type: cert.domain?.startsWith('*.') ? 'wildcard' : 'standard'
      }));
      
      setCertificates(transformedCerts);
    } catch (err: any) {
      toast.error('Failed to load certificates');
      // Use mock data for development
      setCertificates([
        {
          domain: '*.spinforge.com',
          isWildcard: true,
          status: 'active',
          issuer: 'Let\'s Encrypt',
          validFrom: '2025-01-01',
          validTo: '2025-04-01',
          autoRenew: true,
          type: 'wildcard'
        },
        {
          domain: 'api.spinforge.com',
          isWildcard: false,
          status: 'active',
          issuer: 'Let\'s Encrypt',
          validFrom: '2025-01-15',
          validTo: '2025-04-15',
          autoRenew: true,
          type: 'standard'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const openCertificateDrawer = (cert: Certificate | null = null) => {
    setSelectedCertificate(cert);
    setDrawerOpen(true);
  };

  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = cert.domain.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || 
      (filterType === 'wildcard' && cert.isWildcard) ||
      (filterType === 'standard' && !cert.isWildcard);
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    // Sort wildcard certificates to the top
    if (a.isWildcard && !b.isWildcard) return -1;
    if (!a.isWildcard && b.isWildcard) return 1;
    // Then sort by domain name
    return a.domain.localeCompare(b.domain);
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'expired': return 'text-red-600 bg-red-50 border-red-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'expired': return <AlertCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getDaysUntilExpiry = (validTo?: string) => {
    if (!validTo) return null;
    const expiry = new Date(validTo);
    const today = new Date();
    const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SSL Certificate Manager</h1>
            <p className="text-gray-600 mt-1">Manage and monitor all SSL certificates in one place</p>
          </div>
          <button
            onClick={() => openCertificateDrawer(null)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Register Certificate
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search certificates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterType === 'all'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All Certificates
          </button>
          <button
            onClick={() => setFilterType('wildcard')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterType === 'wildcard'
                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Star className="w-4 h-4 inline mr-1" />
            Wildcard
          </button>
          <button
            onClick={() => setFilterType('standard')}
            className={`px-4 py-2 rounded-lg transition-all ${
              filterType === 'standard'
                ? 'bg-gray-100 text-gray-700 border border-gray-400'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Standard
          </button>
        </div>
      </div>

      {/* Wildcard Certificates Section */}
      {filteredCertificates.filter(cert => cert.isWildcard).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Star className="w-5 h-5 text-purple-600 mr-2" />
            Wildcard Certificates
          </h2>
          <div className="grid gap-4">
            {filteredCertificates.filter(cert => cert.isWildcard).map((cert) => {
              const daysUntilExpiry = getDaysUntilExpiry(cert.validTo);
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30;
              
              return (
                <div
                  key={cert.domain}
                  onClick={() => openCertificateDrawer(cert)}
                  className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6 hover:shadow-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
                        <Star className="w-7 h-7" />
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xl font-bold text-gray-900">{cert.domain}</h3>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-600 text-white">
                            <Star className="w-3 h-3 mr-1" />
                            Wildcard SSL
                          </span>
                          {cert.autoRenew && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Auto-Renew
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mt-1">
                          Covers: {cert.domain.replace('*.', '')}, {cert.domain}, and all subdomains
                        </p>
                        
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {cert.validTo ? `Expires ${format(new Date(cert.validTo), 'MMM dd, yyyy')}` : 'No expiry date'}
                          </span>
                          
                          {daysUntilExpiry !== null && (
                            <span className={`flex items-center ${isExpiringSoon ? 'text-orange-600 font-medium' : ''}`}>
                              {isExpiringSoon && <AlertCircle className="w-4 h-4 mr-1" />}
                              {daysUntilExpiry} days remaining
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium border ${getStatusColor(cert.status)}`}>
                        {getStatusIcon(cert.status)}
                        <span className="ml-1.5 capitalize">{cert.status || 'Unknown'}</span>
                      </span>
                      
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Standard Certificates Section */}
      {filteredCertificates.filter(cert => !cert.isWildcard).length > 0 && (
        <div>
          {filteredCertificates.filter(cert => cert.isWildcard).length > 0 && (
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Lock className="w-5 h-5 text-green-600 mr-2" />
              Standard Certificates
            </h2>
          )}
          <div className="grid gap-4">
            {filteredCertificates.filter(cert => !cert.isWildcard).map((cert) => {
              const daysUntilExpiry = getDaysUntilExpiry(cert.validTo);
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30;
              
              return (
                <div
                  key={cert.domain}
                  onClick={() => openCertificateDrawer(cert)}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 rounded-lg bg-green-100">
                        <Lock className="w-6 h-6 text-green-600" />
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-gray-900">{cert.domain}</h3>
                          {cert.autoRenew && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Auto-Renew
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {cert.validTo ? `Expires ${format(new Date(cert.validTo), 'MMM dd, yyyy')}` : 'No expiry date'}
                          </span>
                          
                          {daysUntilExpiry !== null && (
                            <span className={`flex items-center ${isExpiringSoon ? 'text-orange-600 font-medium' : ''}`}>
                              {isExpiringSoon && <AlertCircle className="w-4 h-4 mr-1" />}
                              {daysUntilExpiry} days remaining
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium border ${getStatusColor(cert.status)}`}>
                        {getStatusIcon(cert.status)}
                        <span className="ml-1.5 capitalize">{cert.status || 'Unknown'}</span>
                      </span>
                      
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredCertificates.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No certificates found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'Try adjusting your search criteria' : 'Get started by registering your first SSL certificate'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => openCertificateDrawer(null)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Register Certificate
            </button>
          )}
        </div>
      )}

      {/* Certificate Drawer */}
      <CertificateDrawer
        certificate={selectedCertificate}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRefresh={fetchCertificates}
      />
    </div>
  );
}