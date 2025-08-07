import React, { useState, useEffect } from 'react';
import { Shield, Key, Globe, Trash2, Plus, Lock, Unlock, Copy, Check, Settings, Users, Sparkles, Edit, X, AlertCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ProtectedRoutesTabProps {
  vhost: any;
  isEditing: boolean;
}

interface RouteConfig {
  id: string;
  pattern: string;
  authType: 'apiKey' | 'oauth' | 'custom';
  unauthorizedRedirect: string;
  // API Key specific
  apiKeyConfig?: {
    keyId?: string;
    headerName?: string; // X-API-Key, Authorization, etc.
  };
  // OAuth specific
  oauthConfig?: {
    clientId: string;
    clientSecret: string;
    authUrl: string;
    tokenUrl: string;
    scope: string;
    cookieMapping?: { claimName: string; cookieName: string }[];
    mapToEnvVars?: boolean; // Container only
  };
  // Custom Auth specific
  customAuthConfig?: {
    authUrl: string;
    method: 'GET' | 'POST';
    responseMapping?: { responseField: string; cookieName: string }[];
    mapToEnvVars?: boolean; // Container only
  };
}

export default function ProtectedRoutesTabV2({ vhost, isEditing }: ProtectedRoutesTabProps) {
  const [isProtectionEnabled, setIsProtectionEnabled] = useState(false);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteConfig | null>(null);
  const [showKeyDetails, setShowKeyDetails] = useState<string | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  const [newRoute, setNewRoute] = useState<RouteConfig>({
    id: '',
    pattern: '',
    authType: 'apiKey',
    unauthorizedRedirect: '/login'
  });

  // Load configuration
  useEffect(() => {
    loadAuthConfig();
  }, [vhost.domain]);

  const loadAuthConfig = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth`);
      if (response.ok) {
        const data = await response.json();
        setIsProtectionEnabled(data.enabled || false);
        setRoutes(data.routes || []);
        setApiKeys(data.apiKeys || []);
      }
    } catch (error) {
      console.error('Failed to load auth config:', error);
    }
  };

  const toggleProtection = async () => {
    const newState = !isProtectionEnabled;
    setIsProtectionEnabled(newState);
    
    if (!newState) {
      // Clear all routes
      try {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/clear`, {
          method: 'DELETE'
        });
        setRoutes([]);
        setApiKeys([]);
        toast.success('Protection disabled');
      } catch (error) {
        toast.error('Failed to disable protection');
      }
    } else {
      toast.success('Protection enabled - add routes to protect');
    }
  };

  const saveRoute = async () => {
    if (!newRoute.pattern) {
      toast.error('Please enter a route pattern');
      return;
    }

    setIsLoading(true);
    try {
      // If API Key auth and no key selected, create one
      if (newRoute.authType === 'apiKey' && !newRoute.apiKeyConfig?.keyId && apiKeys.length === 0) {
        const keyResponse = await createApiKey('Auto-generated Key');
        if (keyResponse) {
          newRoute.apiKeyConfig = { keyId: keyResponse.id };
        }
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/routes`, {
        method: editingRoute ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute)
      });

      if (response.ok) {
        await loadAuthConfig();
        setShowRouteModal(false);
        setEditingRoute(null);
        setNewRoute({ id: '', pattern: '', authType: 'apiKey', unauthorizedRedirect: '/login' });
        toast.success(editingRoute ? 'Route updated' : 'Route added');
      }
    } catch (error) {
      toast.error('Failed to save route');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRoute = async (routeId: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/routes/${routeId}`, {
        method: 'DELETE'
      });
      setRoutes(routes.filter(r => r.id !== routeId));
      toast.success('Route removed');
    } catch (error) {
      toast.error('Failed to remove route');
    }
  };

  const createApiKey = async (name: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'sk_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/auth/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, key })
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKeys([...apiKeys, { ...data.keyInfo, key }]);
        setShowKeyDetails(key);
        return data.keyInfo;
      }
    } catch (error) {
      toast.error('Failed to create API key');
    }
    return null;
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const openRouteModal = (route?: RouteConfig) => {
    if (route) {
      setEditingRoute(route);
      setNewRoute(route);
    } else {
      setEditingRoute(null);
      setNewRoute({ id: '', pattern: '', authType: 'apiKey', unauthorizedRedirect: '/login' });
    }
    setShowRouteModal(true);
  };

  if (!isProtectionEnabled) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-white rounded-2xl shadow-lg inline-block mb-4">
              <Shield className="h-12 w-12 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Route Protection</h2>
            <p className="text-gray-600 mb-6">
              Protect specific routes with authentication
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
              {routes.length} protected {routes.length === 1 ? 'route' : 'routes'}
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
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Protected Routes</h3>
          <button
            onClick={() => openRouteModal()}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Add Route
          </button>
        </div>

        {routes.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-2">No protected routes configured</p>
            <p className="text-sm text-gray-400">Add a route pattern to start protecting your application</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routes.map((route) => (
              <div key={route.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <div 
                  className="p-4 bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer"
                  onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${expandedRoute === route.id ? 'rotate-90' : ''}`} />
                      <Globe className="h-5 w-5 text-gray-500" />
                      <div>
                        <code className="text-sm font-semibold text-gray-900">{route.pattern}</code>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            route.authType === 'apiKey' ? 'bg-blue-100 text-blue-700' :
                            route.authType === 'oauth' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {route.authType === 'apiKey' ? 'API Key' :
                             route.authType === 'oauth' ? 'OAuth 2.0' : 'Custom Auth'}
                          </span>
                          <span className="text-xs text-gray-500">
                            Unauthorized → {route.unauthorizedRedirect}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openRouteModal(route);
                        }}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRoute(route.id);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Configuration Details */}
                <AnimatePresence>
                  {expandedRoute === route.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-200 bg-white"
                    >
                      <div className="p-4">
                        {route.authType === 'apiKey' && route.apiKeyConfig && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">API Key Configuration</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Key ID:</span>
                                <code className="text-gray-900">{route.apiKeyConfig.keyId || 'Any valid key'}</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Header:</span>
                                <code className="text-gray-900">{route.apiKeyConfig.headerName || 'X-API-Key'}</code>
                              </div>
                            </div>
                          </div>
                        )}

                        {route.authType === 'oauth' && route.oauthConfig && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">OAuth Configuration</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Provider:</span>
                                <code className="text-gray-900">{new URL(route.oauthConfig.authUrl).hostname}</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Client ID:</span>
                                <code className="text-gray-900">{route.oauthConfig.clientId.substring(0, 10)}...</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Scope:</span>
                                <code className="text-gray-900">{route.oauthConfig.scope}</code>
                              </div>
                              {vhost.type === 'container' && route.oauthConfig.mapToEnvVars && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Container Env Vars:</span>
                                  <span className="text-purple-700 font-medium">✓ Enabled</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {route.authType === 'custom' && route.customAuthConfig && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">Custom Auth Configuration</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Endpoint:</span>
                                <code className="text-gray-900">{route.customAuthConfig.authUrl}</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Method:</span>
                                <code className="text-gray-900">{route.customAuthConfig.method}</code>
                              </div>
                              {vhost.type === 'container' && route.customAuthConfig.mapToEnvVars && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Container Env Vars:</span>
                                  <span className="text-green-700 font-medium">✓ Enabled</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Keys Management */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-500" />
            API Keys
          </h3>
          <button
            onClick={() => createApiKey(`Key-${Date.now()}`)}
            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
          >
            <Plus className="h-3 w-3 inline mr-1" />
            Generate Key
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <p className="text-sm text-gray-500">No API keys generated yet</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{key.name}</p>
                  <code className="text-xs text-gray-500">ID: {key.id}</code>
                </div>
                {key.key && (
                  <button
                    onClick={() => copyToClipboard(key.key)}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Route Configuration Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                {editingRoute ? 'Edit Protected Route' : 'Add Protected Route'}
              </h3>
              <button
                onClick={() => setShowRouteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Route Pattern */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Route Pattern</label>
                <input
                  type="text"
                  value={newRoute.pattern}
                  onChange={(e) => setNewRoute({ ...newRoute, pattern: e.target.value })}
                  placeholder="/api/* or /admin/* or /protected/*"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use * for wildcard matching</p>
              </div>

              {/* Auth Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Authentication Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['apiKey', 'oauth', 'custom'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewRoute({ ...newRoute, authType: type })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        newRoute.authType === type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {type === 'apiKey' && <Key className="h-6 w-6 mx-auto mb-2 text-blue-600" />}
                      {type === 'oauth' && <Users className="h-6 w-6 mx-auto mb-2 text-purple-600" />}
                      {type === 'custom' && <Settings className="h-6 w-6 mx-auto mb-2 text-green-600" />}
                      <span className="text-sm font-medium">
                        {type === 'apiKey' ? 'API Key' : type === 'oauth' ? 'OAuth 2.0' : 'Custom Auth'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auth Configuration Based on Type */}
              {newRoute.authType === 'apiKey' && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-4">
                  <h4 className="font-medium text-gray-900">API Key Settings</h4>
                  
                  {apiKeys.length > 0 ? (
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Select API Key (optional)</label>
                      <select
                        value={newRoute.apiKeyConfig?.keyId || ''}
                        onChange={(e) => setNewRoute({
                          ...newRoute,
                          apiKeyConfig: { ...newRoute.apiKeyConfig, keyId: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Any valid API key</option>
                        {apiKeys.map(key => (
                          <option key={key.id} value={key.id}>{key.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        An API key will be generated automatically when you save this route
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Header Name</label>
                    <select
                      value={newRoute.apiKeyConfig?.headerName || 'X-API-Key'}
                      onChange={(e) => setNewRoute({
                        ...newRoute,
                        apiKeyConfig: { ...newRoute.apiKeyConfig, headerName: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="X-API-Key">X-API-Key</option>
                      <option value="Authorization">Authorization Bearer</option>
                      <option value="API-Key">API-Key</option>
                    </select>
                  </div>
                </div>
              )}

              {newRoute.authType === 'oauth' && (
                <div className="p-4 bg-purple-50 rounded-lg space-y-4">
                  <h4 className="font-medium text-gray-900">OAuth 2.0 Configuration</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Authorization URL</label>
                      <input
                        type="url"
                        value={newRoute.oauthConfig?.authUrl || ''}
                        onChange={(e) => setNewRoute({
                          ...newRoute,
                          oauthConfig: { ...newRoute.oauthConfig, authUrl: e.target.value }
                        })}
                        placeholder="https://auth.example.com/authorize"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Token URL</label>
                      <input
                        type="url"
                        value={newRoute.oauthConfig?.tokenUrl || ''}
                        onChange={(e) => setNewRoute({
                          ...newRoute,
                          oauthConfig: { ...newRoute.oauthConfig, tokenUrl: e.target.value }
                        })}
                        placeholder="https://auth.example.com/token"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Client ID</label>
                      <input
                        type="text"
                        value={newRoute.oauthConfig?.clientId || ''}
                        onChange={(e) => setNewRoute({
                          ...newRoute,
                          oauthConfig: { ...newRoute.oauthConfig, clientId: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Client Secret</label>
                      <input
                        type="password"
                        value={newRoute.oauthConfig?.clientSecret || ''}
                        onChange={(e) => setNewRoute({
                          ...newRoute,
                          oauthConfig: { ...newRoute.oauthConfig, clientSecret: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {vhost.type === 'container' && (
                    <div className="flex items-center justify-between p-3 bg-purple-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-purple-900">Map to Container Env Variables</p>
                        <p className="text-xs text-purple-700">Container will restart on auth</p>
                      </div>
                      <button
                        onClick={() => setNewRoute({
                          ...newRoute,
                          oauthConfig: { 
                            ...newRoute.oauthConfig, 
                            mapToEnvVars: !newRoute.oauthConfig?.mapToEnvVars 
                          }
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                          newRoute.oauthConfig?.mapToEnvVars ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          newRoute.oauthConfig?.mapToEnvVars ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {newRoute.authType === 'custom' && (
                <div className="p-4 bg-green-50 rounded-lg space-y-4">
                  <h4 className="font-medium text-gray-900">Custom Auth Configuration</h4>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Authentication Endpoint</label>
                    <input
                      type="url"
                      value={newRoute.customAuthConfig?.authUrl || ''}
                      onChange={(e) => setNewRoute({
                        ...newRoute,
                        customAuthConfig: { ...newRoute.customAuthConfig, authUrl: e.target.value }
                      })}
                      placeholder="https://api.example.com/auth/verify"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">HTTP Method</label>
                    <select
                      value={newRoute.customAuthConfig?.method || 'POST'}
                      onChange={(e) => setNewRoute({
                        ...newRoute,
                        customAuthConfig: { 
                          ...newRoute.customAuthConfig, 
                          method: e.target.value as 'GET' | 'POST' 
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                  </div>

                  {vhost.type === 'container' && (
                    <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-green-900">Map to Container Env Variables</p>
                        <p className="text-xs text-green-700">Container will restart on auth</p>
                      </div>
                      <button
                        onClick={() => setNewRoute({
                          ...newRoute,
                          customAuthConfig: { 
                            ...newRoute.customAuthConfig, 
                            mapToEnvVars: !newRoute.customAuthConfig?.mapToEnvVars 
                          }
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                          newRoute.customAuthConfig?.mapToEnvVars ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          newRoute.customAuthConfig?.mapToEnvVars ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Unauthorized Redirect */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Unauthorized Redirect</label>
                <input
                  type="text"
                  value={newRoute.unauthorizedRedirect}
                  onChange={(e) => setNewRoute({ ...newRoute, unauthorizedRedirect: e.target.value })}
                  placeholder="/login or /unauthorized"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowRouteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRoute}
                  disabled={isLoading || !newRoute.pattern}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : editingRoute ? 'Update Route' : 'Add Route'}
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
              <p className="text-sm text-gray-600 mb-4">Save this key - it won't be shown again</p>
              
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
    </div>
  );
}