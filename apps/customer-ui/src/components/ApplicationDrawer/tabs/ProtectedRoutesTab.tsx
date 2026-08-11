import React, { useState, useEffect } from 'react';
import { Shield, Key, Globe, ChevronRight, Trash2, Plus, Lock, Unlock, Copy, Check, AlertCircle, X, Info, Eye, EyeOff, Settings, Network, Zap, ArrowRight, ExternalLink, Users, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ProtectedRoutesTabProps {
  vhost: any;
  isEditing: boolean;
}

export default function ProtectedRoutesTab({ vhost, isEditing }: ProtectedRoutesTabProps) {
  const [isProtectionEnabled, setIsProtectionEnabled] = useState(false);
  const [pathRules, setPathRules] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<'apiKey' | 'oauth' | 'custom'>('apiKey');
  const [showKeyDetails, setShowKeyDetails] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [showCustomAuthModal, setShowCustomAuthModal] = useState(false);

  const [newRoute, setNewRoute] = useState({
    pattern: '/*',
    authType: 'apiKey',
    requiredKey: '',
    unauthorizedRedirect: '/login'
  });

  const [oauthConfig, setOauthConfig] = useState({
    enabled: false,
    authUrl: '',
    tokenUrl: '',
    clientId: '',
    clientSecret: '',
    redirectUri: `https://${vhost.domain}/_oauth/callback`,
    scope: 'openid email profile',
    unauthorizedRedirect: '/login',
    cookieSettings: {
      setAuthToken: true,
      tokenCookieName: 'auth_token',
      additionalClaims: [] as { claimName: string; cookieName: string }[],
      cookieExpiry: 3600,
      mapToEnvVars: false // For containers only - maps cookies to env vars
    }
  });

  const [customAuthConfig, setCustomAuthConfig] = useState({
    enabled: false,
    authUrl: '',
    method: 'POST',
    unauthorizedRedirect: '/login',
    responseMapping: {
      tokenField: 'token',
      userIdField: 'userId',
      additionalFields: [] as { responseField: string; cookieName: string }[]
    },
    cookieExpiry: 3600,
    mapToEnvVars: false // For containers only - maps cookies to env vars
  });

  // Load auth configuration
  useEffect(() => {
    loadAuthConfig();
  }, [vhost.domain]);

  const loadAuthConfig = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth`);
      if (response.ok) {
        const data = await response.json();
        setIsProtectionEnabled(data.enabled || false);
        setPathRules(data.authRules?.paths || []);
        setApiKeys(data.authRules?.apiKeys || []);
        
        // Load OAuth config if exists
        if (data.authRules?.oauth) {
          setOauthConfig({
            ...oauthConfig,
            ...data.authRules.oauth,
            enabled: true
          });
        }
        
        // Load Custom auth config if exists
        if (data.authRules?.customAuth) {
          setCustomAuthConfig({
            ...customAuthConfig,
            ...data.authRules.customAuth,
            enabled: true
          });
        }
      }
    } catch (error) {
      console.error('Failed to load auth config:', error);
    }
  };

  const toggleProtection = async () => {
    const newState = !isProtectionEnabled;
    setIsProtectionEnabled(newState);
    
    if (!newState) {
      setIsLoading(true);
      try {
        // Clear all auth rules
        for (const rule of pathRules) {
          await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/paths/${rule.id}`, {
            method: 'DELETE'
          });
        }
        
        for (const key of apiKeys) {
          await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/keys/${key.id}`, {
            method: 'DELETE'
          });
        }
        
        setPathRules([]);
        setApiKeys([]);
        toast.success('Protection disabled');
      } catch (error) {
        toast.error('Failed to disable protection');
        setIsProtectionEnabled(true);
      } finally {
        setIsLoading(false);
      }
    } else {
      toast.success('Protection enabled - configure your authentication');
    }
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'sk_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const addRoute = async () => {
    setIsLoading(true);
    try {
      // If API key auth and no keys exist, create one first
      if (newRoute.authType === 'apiKey' && apiKeys.length === 0) {
        const newKey = generateApiKey();
        const keyResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Auto-generated Key', key: newKey })
        });
        
        if (keyResponse.ok) {
          const keyData = await keyResponse.json();
          setApiKeys([...apiKeys, { ...keyData.keyInfo, key: newKey }]);
          toast.success(`API Key generated: ${newKey}`, { duration: 10000 });
        }
      }

      // Add the route
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/paths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute)
      });
      
      if (response.ok) {
        const data = await response.json();
        setPathRules([...pathRules, data.rule]);
        setShowAddRouteModal(false);
        setNewRoute({ pattern: '/*', authType: 'apiKey', requiredKey: '', unauthorizedRedirect: '/login' });
        toast.success('Route protection added');
      }
    } catch (error) {
      toast.error('Failed to add route');
    } finally {
      setIsLoading(false);
    }
  };

  const deletePathRule = async (ruleId: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/paths/${ruleId}`, {
        method: 'DELETE'
      });
      setPathRules(pathRules.filter(r => r.id !== ruleId));
      toast.success('Route removed');
    } catch (error) {
      toast.error('Failed to remove route');
    }
  };

  const createApiKey = async (name: string) => {
    setIsLoading(true);
    try {
      const keyValue = generateApiKey();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, key: keyValue })
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKeys([...apiKeys, { ...data.keyInfo, key: keyValue }]);
        setShowKeyDetails(keyValue);
        toast.success('API key created successfully');
      }
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/keys/${keyId}`, {
        method: 'DELETE'
      });
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
      toast.success('API key deleted');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('Copied to clipboard');
  };

  if (!isProtectionEnabled) {
    return (
      <div className="space-y-6">
        {/* Enable Protection Card */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-white rounded-2xl shadow-lg inline-block mb-4">
              <Shield className="h-12 w-12 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Route Protection</h2>
            <p className="text-gray-600 mb-6">
              Secure your application routes with API keys, OAuth, or custom authentication
            </p>
            <button
              onClick={toggleProtection}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              <Lock className="h-4 w-4 inline mr-2" />
              Enable Protection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Route Protection Active
            </h2>
            <p className="text-blue-100 mt-1">
              {pathRules.length} routes protected • {apiKeys.length} API keys
            </p>
          </div>
          <button
            onClick={toggleProtection}
            className="px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all"
          >
            <Unlock className="h-4 w-4 inline mr-2" />
            Disable
          </button>
        </div>
      </div>

      {/* Protected Routes */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Protected Routes</h3>
          <button
            onClick={() => setShowAddRouteModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Add Route
          </button>
        </div>

        {pathRules.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No protected routes yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pathRules.map((rule) => (
              <div key={rule.id} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-gray-500" />
                    <div>
                      <code className="text-sm font-medium">{rule.pattern}</code>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          rule.authType === 'apiKey' ? 'bg-blue-100 text-blue-700' :
                          rule.authType === 'oauth' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {rule.authType === 'apiKey' ? 'API Key' :
                           rule.authType === 'oauth' ? 'OAuth 2.0' : 'Custom'}
                        </span>
                        <span className="text-xs text-gray-500">→ {rule.unauthorizedRedirect}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deletePathRule(rule.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Authentication Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* API Keys */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Key className="h-4 w-4 text-blue-500" />
              API Keys
            </h4>
            <button
              onClick={() => createApiKey(`Key-${Date.now()}`)}
              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <p className="text-sm text-gray-500">No API keys</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div key={key.id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{key.name}</span>
                    <button
                      onClick={() => deleteApiKey(key.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {key.key && (
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-gray-500">sk_••••</code>
                      <button
                        onClick={() => copyToClipboard(key.key)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {copiedKey === key.key ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OAuth Configuration */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              OAuth 2.0
            </h4>
            {oauthConfig.enabled && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Configured
              </span>
            )}
          </div>
          
          {oauthConfig.enabled && (
            <div className="mb-3 space-y-1 text-xs">
              {oauthConfig.clientId && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Client ID:</span>
                  <code className="text-gray-900">{oauthConfig.clientId.substring(0, 10)}...</code>
                </div>
              )}
              {oauthConfig.authUrl && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Provider:</span>
                  <code className="text-gray-900">{new URL(oauthConfig.authUrl).hostname}</code>
                </div>
              )}
              {oauthConfig.cookieSettings?.additionalClaims?.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Claims:</span>
                  <span className="text-gray-900">{oauthConfig.cookieSettings.additionalClaims.length} mapped</span>
                </div>
              )}
              {vhost.type === 'container' && oauthConfig.cookieSettings?.mapToEnvVars && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Env Vars:</span>
                  <span className="text-purple-700 font-medium">✓ Enabled</span>
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => setShowOAuthModal(true)}
            className="w-full px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium"
          >
            {oauthConfig.enabled ? 'Edit Configuration' : 'Configure OAuth'}
          </button>
        </div>

        {/* Custom Auth */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Settings className="h-4 w-4 text-green-500" />
              Custom Auth
            </h4>
            {customAuthConfig.enabled && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Configured
              </span>
            )}
          </div>
          
          {customAuthConfig.enabled && (
            <div className="mb-3 space-y-1 text-xs">
              {customAuthConfig.authUrl && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Endpoint:</span>
                  <code className="text-gray-900 truncate" style={{ maxWidth: '120px' }}>
                    {new URL(customAuthConfig.authUrl).hostname}
                  </code>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Method:</span>
                <span className="text-gray-900">{customAuthConfig.method}</span>
              </div>
              {customAuthConfig.responseMapping?.additionalFields?.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Fields:</span>
                  <span className="text-gray-900">{customAuthConfig.responseMapping.additionalFields.length} mapped</span>
                </div>
              )}
              {vhost.type === 'container' && customAuthConfig.mapToEnvVars && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Env Vars:</span>
                  <span className="text-green-700 font-medium">✓ Enabled</span>
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => setShowCustomAuthModal(true)}
            className="w-full px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
          >
            {customAuthConfig.enabled ? 'Edit Configuration' : 'Configure Custom'}
          </button>
        </div>
      </div>

      {/* Add Route Modal */}
      {showAddRouteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold mb-4">Add Protected Route</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Path Pattern</label>
                <input
                  type="text"
                  value={newRoute.pattern}
                  onChange={(e) => setNewRoute({ ...newRoute, pattern: e.target.value })}
                  placeholder="/api/* or /admin/*"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Authentication Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {['apiKey', 'oauth', 'custom'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setNewRoute({ ...newRoute, authType: method })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        newRoute.authType === method
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {method === 'apiKey' && <Key className="h-5 w-5 mx-auto mb-1 text-blue-600" />}
                      {method === 'oauth' && <Users className="h-5 w-5 mx-auto mb-1 text-purple-600" />}
                      {method === 'custom' && <Settings className="h-5 w-5 mx-auto mb-1 text-green-600" />}
                      <span className="text-xs font-medium">
                        {method === 'apiKey' ? 'API Key' : method === 'oauth' ? 'OAuth' : 'Custom'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unauthorized Redirect</label>
                <input
                  type="text"
                  value={newRoute.unauthorizedRedirect}
                  onChange={(e) => setNewRoute({ ...newRoute, unauthorizedRedirect: e.target.value })}
                  placeholder="/login"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddRouteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={addRoute}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? 'Adding...' : 'Add Route'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Key Details Modal */}
      {showKeyDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4"
          >
            <div className="text-center">
              <div className="p-3 bg-green-100 rounded-full inline-block mb-4">
                <Sparkles className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">API Key Created!</h3>
              <p className="text-sm text-gray-600 mb-4">Save this key now - it won't be shown again</p>
              
              <div className="p-3 bg-gray-100 rounded-lg mb-4">
                <code className="text-sm break-all">{showKeyDetails}</code>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => copyToClipboard(showKeyDetails)}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Copy className="h-4 w-4 inline mr-2" />
                  Copy Key
                </button>
                <button
                  onClick={() => setShowKeyDetails(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* OAuth Configuration Modal */}
      {showOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 my-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-6 w-6 text-purple-500" />
                OAuth 2.0 Configuration
              </h3>
              <button
                onClick={() => setShowOAuthModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* OAuth URLs */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">OAuth Endpoints</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Authorization URL</label>
                  <input
                    type="url"
                    value={oauthConfig.authUrl}
                    onChange={(e) => setOauthConfig({ ...oauthConfig, authUrl: e.target.value })}
                    placeholder="https://auth.example.com/authorize"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token URL</label>
                  <input
                    type="url"
                    value={oauthConfig.tokenUrl}
                    onChange={(e) => setOauthConfig({ ...oauthConfig, tokenUrl: e.target.value })}
                    placeholder="https://auth.example.com/token"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* OAuth Credentials */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Credentials</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                    <input
                      type="text"
                      value={oauthConfig.clientId}
                      onChange={(e) => setOauthConfig({ ...oauthConfig, clientId: e.target.value })}
                      placeholder="your-client-id"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                    <input
                      type="password"
                      value={oauthConfig.clientSecret}
                      onChange={(e) => setOauthConfig({ ...oauthConfig, clientSecret: e.target.value })}
                      placeholder="your-client-secret"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URI</label>
                  <input
                    type="url"
                    value={oauthConfig.redirectUri}
                    onChange={(e) => setOauthConfig({ ...oauthConfig, redirectUri: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <input
                    type="text"
                    value={oauthConfig.scope}
                    onChange={(e) => setOauthConfig({ ...oauthConfig, scope: e.target.value })}
                    placeholder="openid email profile"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Redirect & Cookie Settings */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Advanced Settings</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unauthorized Redirect</label>
                  <input
                    type="text"
                    value={oauthConfig.unauthorizedRedirect}
                    onChange={(e) => setOauthConfig({ ...oauthConfig, unauthorizedRedirect: e.target.value })}
                    placeholder="/login"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Store Auth Token in Cookie</span>
                    <button
                      onClick={() => setOauthConfig({
                        ...oauthConfig,
                        cookieSettings: {
                          ...oauthConfig.cookieSettings,
                          setAuthToken: !oauthConfig.cookieSettings.setAuthToken
                        }
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        oauthConfig.cookieSettings.setAuthToken ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        oauthConfig.cookieSettings.setAuthToken ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {oauthConfig.cookieSettings.setAuthToken && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cookie Name</label>
                        <input
                          type="text"
                          value={oauthConfig.cookieSettings.tokenCookieName}
                          onChange={(e) => setOauthConfig({
                            ...oauthConfig,
                            cookieSettings: {
                              ...oauthConfig.cookieSettings,
                              tokenCookieName: e.target.value
                            }
                          })}
                          className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">Additional Claims to Store in Cookies</label>
                        <div className="space-y-2">
                          {oauthConfig.cookieSettings.additionalClaims.map((claim, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="text"
                                value={claim.claimName}
                                onChange={(e) => {
                                  const claims = [...oauthConfig.cookieSettings.additionalClaims];
                                  claims[idx] = { ...claims[idx], claimName: e.target.value };
                                  setOauthConfig({
                                    ...oauthConfig,
                                    cookieSettings: {
                                      ...oauthConfig.cookieSettings,
                                      additionalClaims: claims
                                    }
                                  });
                                }}
                                placeholder="Claim name (e.g., email)"
                                className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                              />
                              <input
                                type="text"
                                value={claim.cookieName}
                                onChange={(e) => {
                                  const claims = [...oauthConfig.cookieSettings.additionalClaims];
                                  claims[idx] = { ...claims[idx], cookieName: e.target.value };
                                  setOauthConfig({
                                    ...oauthConfig,
                                    cookieSettings: {
                                      ...oauthConfig.cookieSettings,
                                      additionalClaims: claims
                                    }
                                  });
                                }}
                                placeholder="Cookie name"
                                className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                              />
                              <button
                                onClick={() => {
                                  const claims = oauthConfig.cookieSettings.additionalClaims.filter((_, i) => i !== idx);
                                  setOauthConfig({
                                    ...oauthConfig,
                                    cookieSettings: {
                                      ...oauthConfig.cookieSettings,
                                      additionalClaims: claims
                                    }
                                  });
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setOauthConfig({
                                ...oauthConfig,
                                cookieSettings: {
                                  ...oauthConfig.cookieSettings,
                                  additionalClaims: [
                                    ...oauthConfig.cookieSettings.additionalClaims,
                                    { claimName: '', cookieName: '' }
                                  ]
                                }
                              });
                            }}
                            className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                          >
                            <Plus className="h-3 w-3 inline mr-1" />
                            Add Claim Mapping
                          </button>
                        </div>
                      </div>
                      
                      {/* Container Environment Variable Mapping */}
                      {vhost.type === 'container' && (
                        <div className="p-3 bg-purple-100 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-purple-900">Map to Container Env Variables</span>
                              <p className="text-xs text-purple-700 mt-1">
                                Automatically set cookies as environment variables in the container
                              </p>
                            </div>
                            <button
                              onClick={() => setOauthConfig({
                                ...oauthConfig,
                                cookieSettings: {
                                  ...oauthConfig.cookieSettings,
                                  mapToEnvVars: !oauthConfig.cookieSettings.mapToEnvVars
                                }
                              })}
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                                oauthConfig.cookieSettings.mapToEnvVars ? 'bg-purple-600' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                oauthConfig.cookieSettings.mapToEnvVars ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </button>
                          </div>
                          {oauthConfig.cookieSettings.mapToEnvVars && (
                            <div className="mt-2 p-2 bg-white/50 rounded text-xs text-purple-800">
                              <strong>⚠️ Container will restart on authentication to apply env variables</strong>
                              <ul className="mt-1 ml-4 list-disc">
                                <li>Cookie names → UPPERCASE env variables</li>
                                <li>Example: <code>auth_token</code> → <code>AUTH_TOKEN</code></li>
                                <li>Safe during login (no active session)</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cookie Expiry (seconds)</label>
                        <input
                          type="number"
                          value={oauthConfig.cookieSettings.cookieExpiry}
                          onChange={(e) => setOauthConfig({
                            ...oauthConfig,
                            cookieSettings: {
                              ...oauthConfig.cookieSettings,
                              cookieExpiry: parseInt(e.target.value)
                            }
                          })}
                          className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowOAuthModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/oauth`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...oauthConfig, enabled: true })
                      });
                      
                      if (response.ok) {
                        setOauthConfig({ ...oauthConfig, enabled: true });
                        setShowOAuthModal(false);
                        toast.success('OAuth configuration saved');
                      } else {
                        toast.error('Failed to save OAuth configuration');
                      }
                    } catch (error) {
                      toast.error('Failed to save OAuth configuration');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Auth Configuration Modal */}
      {showCustomAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 my-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Settings className="h-6 w-6 text-green-500" />
                Custom Authentication Configuration
              </h3>
              <button
                onClick={() => setShowCustomAuthModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Auth Endpoint */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Authentication Endpoint</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth URL</label>
                  <input
                    type="url"
                    value={customAuthConfig.authUrl}
                    onChange={(e) => setCustomAuthConfig({ ...customAuthConfig, authUrl: e.target.value })}
                    placeholder="https://api.example.com/auth/verify"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
                    <select
                      value={customAuthConfig.method}
                      onChange={(e) => setCustomAuthConfig({ ...customAuthConfig, method: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cookie Expiry (seconds)</label>
                    <input
                      type="number"
                      value={customAuthConfig.cookieExpiry}
                      onChange={(e) => setCustomAuthConfig({ ...customAuthConfig, cookieExpiry: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unauthorized Redirect</label>
                  <input
                    type="text"
                    value={customAuthConfig.unauthorizedRedirect}
                    onChange={(e) => setCustomAuthConfig({ ...customAuthConfig, unauthorizedRedirect: e.target.value })}
                    placeholder="/login"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Response Field Mapping */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Response Field Mapping</h4>
                <div className="p-4 bg-green-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Token Field</label>
                      <input
                        type="text"
                        value={customAuthConfig.responseMapping.tokenField}
                        onChange={(e) => setCustomAuthConfig({
                          ...customAuthConfig,
                          responseMapping: {
                            ...customAuthConfig.responseMapping,
                            tokenField: e.target.value
                          }
                        })}
                        placeholder="token"
                        className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">User ID Field</label>
                      <input
                        type="text"
                        value={customAuthConfig.responseMapping.userIdField}
                        onChange={(e) => setCustomAuthConfig({
                          ...customAuthConfig,
                          responseMapping: {
                            ...customAuthConfig.responseMapping,
                            userIdField: e.target.value
                          }
                        })}
                        placeholder="userId"
                        className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Additional Fields to Store in Cookies</label>
                    <div className="space-y-2">
                      {customAuthConfig.responseMapping.additionalFields.map((field, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={field.responseField}
                            onChange={(e) => {
                              const fields = [...customAuthConfig.responseMapping.additionalFields];
                              fields[idx] = { ...fields[idx], responseField: e.target.value };
                              setCustomAuthConfig({
                                ...customAuthConfig,
                                responseMapping: {
                                  ...customAuthConfig.responseMapping,
                                  additionalFields: fields
                                }
                              });
                            }}
                            placeholder="Response field name"
                            className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="text"
                            value={field.cookieName}
                            onChange={(e) => {
                              const fields = [...customAuthConfig.responseMapping.additionalFields];
                              fields[idx] = { ...fields[idx], cookieName: e.target.value };
                              setCustomAuthConfig({
                                ...customAuthConfig,
                                responseMapping: {
                                  ...customAuthConfig.responseMapping,
                                  additionalFields: fields
                                }
                              });
                            }}
                            placeholder="Cookie name"
                            className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => {
                              const fields = customAuthConfig.responseMapping.additionalFields.filter((_, i) => i !== idx);
                              setCustomAuthConfig({
                                ...customAuthConfig,
                                responseMapping: {
                                  ...customAuthConfig.responseMapping,
                                  additionalFields: fields
                                }
                              });
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setCustomAuthConfig({
                            ...customAuthConfig,
                            responseMapping: {
                              ...customAuthConfig.responseMapping,
                              additionalFields: [
                                ...customAuthConfig.responseMapping.additionalFields,
                                { responseField: '', cookieName: '' }
                              ]
                            }
                          });
                        }}
                        className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        <Plus className="h-3 w-3 inline mr-1" />
                        Add Field Mapping
                      </button>
                    </div>
                  </div>
                  
                  {/* Container Environment Variable Mapping */}
                  {vhost.type === 'container' && (
                    <div className="p-3 bg-green-100 rounded-lg mt-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-green-900">Map to Container Env Variables</span>
                          <p className="text-xs text-green-700 mt-1">
                            Automatically set response fields as environment variables in the container
                          </p>
                        </div>
                        <button
                          onClick={() => setCustomAuthConfig({
                            ...customAuthConfig,
                            mapToEnvVars: !customAuthConfig.mapToEnvVars
                          })}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                            customAuthConfig.mapToEnvVars ? 'bg-green-600' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            customAuthConfig.mapToEnvVars ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                      {customAuthConfig.mapToEnvVars && (
                        <div className="mt-2 p-2 bg-white/50 rounded text-xs text-green-800">
                          <strong>⚠️ Container will restart on authentication to apply env variables</strong>
                          <ul className="mt-1 ml-4 list-disc">
                            <li>Cookie names → UPPERCASE env variables</li>
                            <li>Example: <code>user_id</code> → <code>USER_ID</code></li>
                            <li>Safe during login (no active session)</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowCustomAuthModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/sites/${vhost.domain}/auth/custom`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...customAuthConfig, enabled: true })
                      });
                      
                      if (response.ok) {
                        setCustomAuthConfig({ ...customAuthConfig, enabled: true });
                        setShowCustomAuthModal(false);
                        toast.success('Custom auth configuration saved');
                      } else {
                        toast.error('Failed to save custom auth configuration');
                      }
                    } catch (error) {
                      toast.error('Failed to save custom auth configuration');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}