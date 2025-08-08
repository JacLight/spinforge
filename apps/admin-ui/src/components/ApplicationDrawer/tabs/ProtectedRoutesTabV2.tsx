import React, { useState, useEffect } from 'react';
import { Shield, Key, Globe, Trash2, Plus, Lock, Unlock, Copy, Check, Settings, Users, Sparkles, Edit, X, AlertCircle, ChevronRight, Cookie, Info, Package } from 'lucide-react';
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
    redirectUri?: string;
    // Map claims to cookies and/or env vars
    claimMappings?: {
      claimPath: string; // e.g., "user.email", "roles[0]", "sub"
      cookieName?: string; // Store in cookie
      envVarName?: string; // Store in env var (container only)
    }[];
  };
  // Custom Auth specific
  customAuthConfig?: {
    authUrl: string;
    method: 'GET' | 'POST';
    headers?: { [key: string]: string };
    // Map response fields to cookies and/or env vars
    responseMappings?: {
      responsePath: string; // e.g., "data.user.id", "token"
      cookieName?: string; // Store in cookie
      envVarName?: string; // Store in env var (container only)
    }[];
  };
}

// OAuth Inline Configuration Component
function OAuthInlineConfig({ config, vhost, onChange }: { config: any; vhost: any; onChange: (config: any) => void }) {
  const [claimMapping, setClaimMapping] = useState({ claimPath: '', cookieName: '', envVarName: '' });

  const addClaimMapping = () => {
    if (claimMapping.claimPath && (claimMapping.cookieName || claimMapping.envVarName)) {
      const mappings = config.claimMappings || [];
      onChange({
        ...config,
        claimMappings: [...mappings, { ...claimMapping }]
      });
      setClaimMapping({ claimPath: '', cookieName: '', envVarName: '' });
    }
  };

  const removeClaimMapping = (index: number) => {
    const mappings = [...(config.claimMappings || [])];
    mappings.splice(index, 1);
    onChange({ ...config, claimMappings: mappings });
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500 rounded-lg">
          <Users className="h-5 w-5 text-white" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900">OAuth 2.0 Configuration</h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Authorization URL</label>
          <input
            type="url"
            value={config.authUrl || ''}
            onChange={(e) => onChange({ ...config, authUrl: e.target.value })}
            placeholder="https://auth.example.com/authorize"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Token URL</label>
          <input
            type="url"
            value={config.tokenUrl || ''}
            onChange={(e) => onChange({ ...config, tokenUrl: e.target.value })}
            placeholder="https://auth.example.com/token"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Client ID</label>
          <input
            type="text"
            value={config.clientId || ''}
            onChange={(e) => onChange({ ...config, clientId: e.target.value })}
            placeholder="your-client-id"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Client Secret</label>
          <input
            type="password"
            value={config.clientSecret || ''}
            onChange={(e) => onChange({ ...config, clientSecret: e.target.value })}
            placeholder="your-client-secret"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
          <input
            type="text"
            value={config.scope || ''}
            onChange={(e) => onChange({ ...config, scope: e.target.value })}
            placeholder="openid profile email"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Redirect URI (optional)</label>
          <input
            type="text"
            value={config.redirectUri || ''}
            onChange={(e) => onChange({ ...config, redirectUri: e.target.value })}
            placeholder="https://app.example.com/callback"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Claim Mappings */}
      <div className="border-t border-purple-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h5 className="text-base font-semibold text-gray-900">Token Claim Mappings</h5>
          <span className="text-sm text-gray-500">Map token fields to storage</span>
        </div>
        
        {/* Existing mappings */}
        <div className="space-y-2 mb-4">
          {config.claimMappings?.map((mapping: any, index: number) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200">
              <code className="flex-1 text-sm font-mono text-purple-700">{mapping.claimPath}</code>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <div className="flex items-center gap-2">
                {mapping.cookieName && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg">
                    <Cookie className="h-4 w-4" />
                    <span className="text-sm font-medium">{mapping.cookieName}</span>
                  </div>
                )}
                {mapping.envVarName && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Package className="h-4 w-4" />
                    <span className="text-sm font-medium">{mapping.envVarName}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeClaimMapping(index)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new mapping */}
        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Claim Path</label>
              <input
                type="text"
                value={claimMapping.claimPath}
                onChange={(e) => setClaimMapping({ ...claimMapping, claimPath: e.target.value })}
                placeholder="user.email or sub"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cookie Name (optional)</label>
              <input
                type="text"
                value={claimMapping.cookieName}
                onChange={(e) => setClaimMapping({ ...claimMapping, cookieName: e.target.value })}
                placeholder="user_email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            {vhost.type === 'container' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Env Variable (optional)</label>
                <input
                  type="text"
                  value={claimMapping.envVarName}
                  onChange={(e) => setClaimMapping({ ...claimMapping, envVarName: e.target.value })}
                  placeholder="USER_EMAIL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
          <button
            onClick={addClaimMapping}
            className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            Add Mapping
          </button>
        </div>
      </div>
    </div>
  );
}

// Custom Auth Inline Configuration Component
function CustomAuthInlineConfig({ config, vhost, onChange }: { config: any; vhost: any; onChange: (config: any) => void }) {
  const [responseMapping, setResponseMapping] = useState({ responsePath: '', cookieName: '', envVarName: '' });
  const [header, setHeader] = useState({ key: '', value: '' });

  const addResponseMapping = () => {
    if (responseMapping.responsePath && (responseMapping.cookieName || responseMapping.envVarName)) {
      const mappings = config.responseMappings || [];
      onChange({
        ...config,
        responseMappings: [...mappings, { ...responseMapping }]
      });
      setResponseMapping({ responsePath: '', cookieName: '', envVarName: '' });
    }
  };

  const removeResponseMapping = (index: number) => {
    const mappings = [...(config.responseMappings || [])];
    mappings.splice(index, 1);
    onChange({ ...config, responseMappings: mappings });
  };

  const addHeader = () => {
    if (header.key && header.value) {
      onChange({
        ...config,
        headers: { ...config.headers, [header.key]: header.value }
      });
      setHeader({ key: '', value: '' });
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-500 rounded-lg">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900">Custom Authentication</h4>
      </div>
      
      {/* Auth Flow Documentation */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h5 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <Info className="h-4 w-4" />
          How Authentication Works
        </h5>
        <ol className="text-sm text-amber-800 space-y-1.5 list-decimal list-inside">
          <li>User visits protected route → Redirected to your auth URL with <code className="bg-amber-100 px-1 rounded text-xs">?return_url=original_url</code></li>
          <li>Your auth service handles login (form, SSO, etc.)</li>
          <li>After success, redirect to: <code className="bg-amber-100 px-1 rounded text-xs">{`https://${vhost.domain}/_auth/callback`}</code></li>
          <li>Include user data as query params (they become cookies based on mappings below)</li>
        </ol>
        <div className="mt-3 p-2 bg-white rounded border border-amber-300">
          <p className="text-xs text-amber-900">
            <strong>Example callback:</strong><br/>
            <code className="text-xs break-all">{`${vhost.domain}/_auth/callback?return_url=/dashboard&user=john@example.com&orgid=org_123&role=admin`}</code>
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Authentication URL</label>
          <input
            type="url"
            value={config.authUrl || ''}
            onChange={(e) => onChange({ ...config, authUrl: e.target.value })}
            placeholder="https://auth.example.com/login"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
          <p className="mt-1 text-xs text-gray-500">Users redirected here with return_url param</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">HTTP Method</label>
          <select
            value={config.method || 'POST'}
            onChange={(e) => onChange({ ...config, method: e.target.value as 'GET' | 'POST' })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
        </div>
      </div>

      {/* Request Headers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-base font-semibold text-gray-900">Request Headers</h5>
          <span className="text-sm text-gray-500">Headers sent to auth endpoint</span>
        </div>
        
        <div className="space-y-2 mb-3">
          {Object.entries(config.headers || {}).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200">
              <code className="flex-1 text-sm font-mono">
                <span className="text-green-700">{key}:</span> <span className="text-gray-700">{value as string}</span>
              </code>
              <button
                onClick={() => {
                  const headers = { ...config.headers };
                  delete headers[key];
                  onChange({ ...config, headers });
                }}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
            </button>
            </div>
          ))}
        </div>
        
        <div className="flex gap-3">
          <input
            type="text"
            value={header.key}
            onChange={(e) => setHeader({ ...header, key: e.target.value })}
            placeholder="Header name (e.g., X-API-Key)"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <input
            type="text"
            value={header.value}
            onChange={(e) => setHeader({ ...header, value: e.target.value })}
            placeholder="Header value"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            onClick={addHeader}
            className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Add
          </button>
        </div>
      </div>

      {/* Response Mappings */}
      <div className="border-t border-green-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h5 className="text-base font-semibold text-gray-900">Response Field Mappings</h5>
          <span className="text-sm text-gray-500">Map response data to storage</span>
        </div>
        
        {/* Existing mappings */}
        <div className="space-y-2 mb-4">
          {config.responseMappings?.map((mapping: any, index: number) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200">
              <code className="flex-1 text-sm font-mono text-green-700">{mapping.responsePath}</code>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <div className="flex items-center gap-2">
                {mapping.cookieName && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg">
                    <Cookie className="h-4 w-4" />
                    <span className="text-sm font-medium">{mapping.cookieName}</span>
                  </div>
                )}
                {mapping.envVarName && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Package className="h-4 w-4" />
                    <span className="text-sm font-medium">{mapping.envVarName}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => removeResponseMapping(index)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new mapping */}
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Response Path</label>
              <input
                type="text"
                value={responseMapping.responsePath}
                onChange={(e) => setResponseMapping({ ...responseMapping, responsePath: e.target.value })}
                placeholder="data.userId or token"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cookie Name (optional)</label>
              <input
                type="text"
                value={responseMapping.cookieName}
                onChange={(e) => setResponseMapping({ ...responseMapping, cookieName: e.target.value })}
                placeholder="user_id"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            {vhost.type === 'container' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Env Variable (optional)</label>
                <input
                  type="text"
                  value={responseMapping.envVarName}
                  onChange={(e) => setResponseMapping({ ...responseMapping, envVarName: e.target.value })}
                  placeholder="USER_ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
          <button
            onClick={addResponseMapping}
            className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
          >
            Add Mapping
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedRoutesTab({ vhost, isEditing }: ProtectedRoutesTabProps) {
  const [isProtectionEnabled, setIsProtectionEnabled] = useState(false);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteConfig | null>(null);
  const [showKeyDetails, setShowKeyDetails] = useState<string | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  const [newRoute, setNewRoute] = useState<RouteConfig>({
    id: '',
    pattern: '',
    authType: 'apiKey',
    unauthorizedRedirect: '/login'
  });
  const [showInlineForm, setShowInlineForm] = useState(false);

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
        setShowInlineForm(false);
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
          {!showInlineForm && (
            <button
              onClick={() => {
                setShowInlineForm(true);
                setEditingRoute(null);
                setNewRoute({ id: '', pattern: '', authType: 'apiKey', unauthorizedRedirect: '/login' });
              }}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              <Plus className="h-4 w-4 inline mr-2" />
              Add Route
            </button>
          )}
        </div>

        {/* Inline Form */}
        {showInlineForm && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="space-y-4">
              {/* Route Pattern */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route Pattern</label>
                  <input
                    type="text"
                    value={newRoute.pattern}
                    onChange={(e) => setNewRoute({ ...newRoute, pattern: e.target.value })}
                    placeholder="/api/* or /admin/* or /protected/*"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unauthorized Redirect</label>
                  <input
                    type="text"
                    value={newRoute.unauthorizedRedirect}
                    onChange={(e) => setNewRoute({ ...newRoute, unauthorizedRedirect: e.target.value })}
                    placeholder="/login or /unauthorized"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Auth Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Authentication Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['apiKey', 'oauth', 'custom'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewRoute({ ...newRoute, authType: type })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        newRoute.authType === type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {type === 'apiKey' && <Key className="h-4 w-4 text-blue-600" />}
                        {type === 'oauth' && <Users className="h-4 w-4 text-purple-600" />}
                        {type === 'custom' && <Settings className="h-4 w-4 text-green-600" />}
                        <span className="text-sm font-medium">
                          {type === 'apiKey' ? 'API Key' : type === 'oauth' ? 'OAuth 2.0' : 'Custom Auth'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Configuration Based on Auth Type */}
              {newRoute.authType === 'apiKey' && (
                <div className="p-3 bg-blue-50 rounded-lg space-y-3">
                  <h4 className="font-medium text-gray-900">API Key Configuration</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Header Name</label>
                      <select
                        value={newRoute.apiKeyConfig?.headerName || 'X-API-Key'}
                        onChange={(e) => setNewRoute({
                          ...newRoute,
                          apiKeyConfig: { ...newRoute.apiKeyConfig, headerName: e.target.value }
                        })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="X-API-Key">X-API-Key</option>
                        <option value="Authorization">Authorization Bearer</option>
                        <option value="API-Key">API-Key</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1">Specific Key (optional)</label>
                      <select
                        value={newRoute.apiKeyConfig?.keyId || ''}
                        onChange={(e) => setNewRoute({
                          ...newRoute,
                          apiKeyConfig: { ...newRoute.apiKeyConfig, keyId: e.target.value }
                        })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Any valid API key</option>
                        {apiKeys.map(key => (
                          <option key={key.id} value={key.id}>{key.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {newRoute.authType === 'oauth' && (
                <OAuthInlineConfig 
                  config={newRoute.oauthConfig || {}}
                  vhost={vhost}
                  onChange={(config) => setNewRoute({ ...newRoute, oauthConfig: config })}
                />
              )}

              {newRoute.authType === 'custom' && (
                <CustomAuthInlineConfig
                  config={newRoute.customAuthConfig || {}}
                  vhost={vhost}
                  onChange={(config) => setNewRoute({ ...newRoute, customAuthConfig: config })}
                />
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveRoute}
                  disabled={isLoading || !newRoute.pattern}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
                >
                  {isLoading ? 'Saving...' : editingRoute ? 'Update Route' : 'Add Route'}
                </button>
                <button
                  onClick={() => {
                    setShowInlineForm(false);
                    setEditingRoute(null);
                    setNewRoute({ id: '', pattern: '', authType: 'apiKey', unauthorizedRedirect: '/login' });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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
                          setEditingRoute(route);
                          setNewRoute(route);
                          setShowInlineForm(true);
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
                                <code className="text-gray-900">{route.oauthConfig.authUrl ? new URL(route.oauthConfig.authUrl).hostname : 'Not set'}</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Client ID:</span>
                                <code className="text-gray-900">{route.oauthConfig.clientId ? route.oauthConfig.clientId.substring(0, 10) + '...' : 'Not set'}</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Scope:</span>
                                <code className="text-gray-900">{route.oauthConfig.scope || 'Not set'}</code>
                              </div>
                              {route.oauthConfig.claimMappings && route.oauthConfig.claimMappings.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-gray-600 text-xs">Mappings:</span>
                                  <div className="mt-1 space-y-1">
                                    {route.oauthConfig.claimMappings.map((m: any, i: number) => (
                                      <div key={i} className="text-xs">
                                        {m.cookieName && <span className="bg-orange-100 text-orange-700 px-1 rounded">🍪 {m.cookieName}</span>}
                                        {m.envVarName && <span className="bg-blue-100 text-blue-700 px-1 rounded ml-1">📦 {m.envVarName}</span>}
                                      </div>
                                    ))}
                                  </div>
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
                                <code className="text-gray-900">{route.customAuthConfig.authUrl || 'Not set'}</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Method:</span>
                                <code className="text-gray-900">{route.customAuthConfig.method || 'POST'}</code>
                              </div>
                              {route.customAuthConfig.responseMappings && route.customAuthConfig.responseMappings.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-gray-600 text-xs">Mappings:</span>
                                  <div className="mt-1 space-y-1">
                                    {route.customAuthConfig.responseMappings.map((m: any, i: number) => (
                                      <div key={i} className="text-xs">
                                        {m.cookieName && <span className="bg-orange-100 text-orange-700 px-1 rounded">🍪 {m.cookieName}</span>}
                                        {m.envVarName && <span className="bg-blue-100 text-blue-700 px-1 rounded ml-1">📦 {m.envVarName}</span>}
                                      </div>
                                    ))}
                                  </div>
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