/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { 
  Save, 
  Key, 
  User,
  Bell,
  Mail,
  Lock,
  Globe,
  CheckCircle,
  Settings as SettingsIcon,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: any;
}

const settingSections: SettingSection[] = [
  { id: 'profile', title: 'Profile', description: 'Your account information', icon: User },
  { id: 'api-tokens', title: 'API Tokens', description: 'Manage API access tokens', icon: Key },
  { id: 'notifications', title: 'Notifications', description: 'Email and alert preferences', icon: Bell },
  { id: 'security', title: 'Security', description: 'Password and security settings', icon: Lock },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  
  // Check for section in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section && settingSections.some(s => s.id === section)) {
      setActiveSection(section);
    }
  }, []);
  const [saved, setSaved] = useState(false);
  
  // Profile settings
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [company, setCompany] = useState(user?.company || '');
  
  // API tokens
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [showNewToken, setShowNewToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  
  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [deploymentAlerts, setDeploymentAlerts] = useState(true);
  const [usageAlerts, setUsageAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  
  // Security settings
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    // Load user settings
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setCompany(user.company || '');
    }
    // Load API tokens
    fetchApiTokens();
  }, [user]);

  const fetchApiTokens = async () => {
    try {
      const response = await axios.get('/api/tokens');
      setApiTokens(response.data);
    } catch (error) {
      console.error('Failed to fetch API tokens:', error);
    }
  };

  const handleSave = async () => {
    try {
      // Save profile settings
      if (activeSection === 'profile') {
        await axios.put('/api/user/profile', {
          name,
          company,
        });
      }
      
      // Save notification settings
      if (activeSection === 'notifications') {
        await axios.put('/api/user/notifications', {
          emailNotifications,
          deploymentAlerts,
          usageAlerts,
          weeklyReports,
        });
      }
      
      toast.success('Settings saved successfully!');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const generateApiToken = async () => {
    if (!newTokenName.trim()) {
      toast.error('Please enter a token name');
      return;
    }

    try {
      const response = await axios.post('/api/tokens/generate', {
        name: newTokenName,
      });
      
      setGeneratedToken(response.data.token);
      setApiTokens([...apiTokens, response.data]);
      setNewTokenName('');
      toast.success('API token generated successfully!');
    } catch (error) {
      toast.error('Failed to generate API token');
    }
  };

  const deleteApiToken = async (tokenId: string) => {
    try {
      await axios.delete(`/api/tokens/${tokenId}`);
      setApiTokens(apiTokens.filter(t => t.id !== tokenId));
      toast.success('API token deleted');
    } catch (error) {
      toast.error('Failed to delete API token');
    }
  };

  const updatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      await axios.put('/api/user/password', {
        currentPassword,
        newPassword,
      });
      
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Failed to update password');
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="block w-full rounded-lg border-gray-300 bg-gray-50 shadow-sm sm:text-sm"
              />
              <p className="mt-1 text-sm text-gray-500">
                Email cannot be changed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Acme Inc."
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Customer ID</h3>
              <div className="flex items-center space-x-2">
                <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                  {user?.customerId}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user?.customerId || '');
                    toast.success('Copied to clipboard');
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        );

      case 'api-tokens':
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">API Tokens</h3>
                <button
                  onClick={() => setShowNewToken(true)}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Token
                </button>
              </div>

              {generatedToken && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 mb-2">
                    Your new API token (save it now, it won't be shown again):
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-white rounded border border-green-300 text-sm font-mono">
                      {generatedToken}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedToken);
                        toast.success('Copied to clipboard');
                        setGeneratedToken('');
                      }}
                      className="px-3 py-2 text-sm text-green-700 hover:text-green-800"
                    >
                      Copy & Close
                    </button>
                  </div>
                </div>
              )}

              {showNewToken && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-end space-x-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Token Name
                      </label>
                      <input
                        type="text"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Production API"
                      />
                    </div>
                    <button
                      onClick={generateApiToken}
                      className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Generate
                    </button>
                    <button
                      onClick={() => {
                        setShowNewToken(false);
                        setNewTokenName('');
                      }}
                      className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {apiTokens.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No API tokens yet. Create one to get started.
                  </p>
                ) : (
                  apiTokens.map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Key className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{token.name}</p>
                          <p className="text-xs text-gray-500">
                            Created {new Date(token.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShowToken({ ...showToken, [token.id]: !showToken[token.id] })}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {showToken[token.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => deleteApiToken(token.id)}
                          className="p-1 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Using API Tokens</h3>
              <p className="text-sm text-gray-600 mb-2">
                Include your API token in the Authorization header:
              </p>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer YOUR_API_TOKEN" \\
  https://api.spinforge.com/v1/deployments`}
              </pre>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Email Preferences</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-900">
                    Email notifications
                  </label>
                </div>

                <div className="ml-6 space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="deploymentAlerts"
                      checked={deploymentAlerts}
                      onChange={(e) => setDeploymentAlerts(e.target.checked)}
                      disabled={!emailNotifications}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="deploymentAlerts" className="ml-2 block text-sm text-gray-700">
                      Deployment status updates
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="usageAlerts"
                      checked={usageAlerts}
                      onChange={(e) => setUsageAlerts(e.target.checked)}
                      disabled={!emailNotifications}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="usageAlerts" className="ml-2 block text-sm text-gray-700">
                      Usage limit alerts
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="weeklyReports"
                      checked={weeklyReports}
                      onChange={(e) => setWeeklyReports(e.target.checked)}
                      disabled={!emailNotifications}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="weeklyReports" className="ml-2 block text-sm text-gray-700">
                      Weekly usage reports
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Notification Email</h3>
              <p className="text-sm text-gray-600">
                Notifications will be sent to: <span className="font-medium">{user?.email}</span>
              </p>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Change Password</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <button
                  onClick={updatePassword}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Update Password
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Login Sessions</h3>
              <p className="text-sm text-gray-600 mb-4">
                You're currently logged in from:
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Globe className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Session</p>
                      <p className="text-xs text-gray-500">Active now</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Description */}
        <p className="text-sm text-gray-500 mb-6">
          Manage your account settings and preferences
        </p>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {settingSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-start px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 border-l-4'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent border-l-4'
                    }`}
                  >
                    <Icon className={`flex-shrink-0 h-5 w-5 mr-3 ${
                      isActive ? 'text-indigo-600' : 'text-gray-400'
                    }`} />
                    <div className="text-left">
                      <div>{section.title}</div>
                      <div className={`text-xs ${
                        isActive ? 'text-indigo-600' : 'text-gray-500'
                      }`}>
                        {section.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-white shadow-sm rounded-lg p-6">
              {renderSectionContent()}
              
              {/* Save button for applicable sections */}
              {['profile', 'notifications'].includes(activeSection) && (
                <div className="mt-6 pt-6 border-t flex justify-end">
                  <button
                    onClick={handleSave}
                    className={`inline-flex items-center px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-white transition-all ${
                      saved 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {saved ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}