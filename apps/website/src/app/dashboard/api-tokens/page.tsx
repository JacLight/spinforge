/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle,
  Code,
  Terminal,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

interface ApiToken {
  id: string;
  name: string;
  token?: string;
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
  permissions?: string[];
}

export default function ApiTokensPage() {
  const [showNewToken, setShowNewToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenExpiry, setNewTokenExpiry] = useState("never");
  const [generatedToken, setGeneratedToken] = useState("");
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch API tokens
  const { data: tokens = [], isLoading, refetch } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: async () => {
      const response = await axios.get("/api/tokens");
      return response.data;
    },
  });

  // Generate token mutation
  const generateMutation = useMutation({
    mutationFn: async (data: { name: string; expiry: string }) => {
      const response = await axios.post("/api/tokens/generate", data);
      return response.data;
    },
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      setNewTokenName("");
      setShowNewToken(false);
      toast.success("API token generated successfully!");
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to generate token");
    },
  });

  // Delete token mutation
  const deleteMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      await axios.delete(`/api/tokens/${tokenId}`);
    },
    onSuccess: () => {
      toast.success("API token deleted");
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete token");
    },
  });

  const handleGenerateToken = () => {
    if (!newTokenName.trim()) {
      toast.error("Please enter a token name");
      return;
    }
    generateMutation.mutate({ name: newTokenName, expiry: newTokenExpiry });
  };

  const copyToClipboard = (text: string, message: string = "Copied to clipboard") => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const filteredTokens = tokens.filter((token: ApiToken) =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-8">
          <div className="flex items-center">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
            <span className="ml-3 text-gray-600">Loading API tokens...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    API Tokens
                  </h1>
                  <p className="text-sm text-gray-500">Manage API access tokens for your SpinLets</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => refetch()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="h-5 w-5 text-gray-600" />
              </button>
              <button
                onClick={() => setShowNewToken(true)}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Token
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Generated Token Alert */}
          {generatedToken && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border border-green-200 rounded-xl p-4"
            >
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-green-800">
                    New API Token Generated
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    Save this token securely. It won't be shown again.
                  </p>
                  <div className="mt-3 flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-white rounded-lg border border-green-300 text-sm font-mono text-gray-900">
                      {generatedToken}
                    </code>
                    <button
                      onClick={() => {
                        copyToClipboard(generatedToken, "Token copied to clipboard");
                        setGeneratedToken("");
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      Copy & Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>

          {/* Tokens List */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
            {filteredTokens.length === 0 ? (
              <div className="text-center py-12">
                <Key className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No API tokens</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Generate your first API token to get started
                </p>
                <button
                  onClick={() => setShowNewToken(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Your First Token
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredTokens.map((token: ApiToken) => (
                  <motion.div
                    key={token.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-6 hover:bg-white/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Key className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{token.name}</h3>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-xs text-gray-500">
                              Created {formatDate(token.createdAt)}
                            </p>
                            {token.lastUsed && (
                              <p className="text-xs text-gray-500">
                                Last used {formatDate(token.lastUsed)}
                              </p>
                            )}
                            {token.expiresAt && (
                              <p className="text-xs text-orange-600">
                                Expires {formatDate(token.expiresAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShowToken({ ...showToken, [token.id]: !showToken[token.id] })}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Toggle visibility"
                        >
                          {showToken[token.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(token.token || token.id, "Token ID copied")}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy token"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${token.name}"?`)) {
                              deleteMutation.mutate(token.id);
                            }
                          }}
                          className="p-2 text-red-400 hover:text-red-600 transition-colors"
                          title="Delete token"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {showToken[token.id] && token.token && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <code className="text-xs font-mono text-gray-700 break-all">
                          {token.token}
                        </code>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Usage Examples */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Terminal className="h-5 w-5 text-gray-600" />
                <h3 className="text-sm font-medium text-gray-900">Using with cURL</h3>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  https://api.spinforge.com/v1/spinlets`}
              </pre>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Code className="h-5 w-5 text-gray-600" />
                <h3 className="text-sm font-medium text-gray-900">Using with JavaScript</h3>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
{`const response = await fetch('https://api.spinforge.com/v1/spinlets', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
});`}
              </pre>
            </div>
          </div>

          {/* Security Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex">
              <Shield className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Security Best Practices</h3>
                <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li>Never share your API tokens or commit them to version control</li>
                  <li>Use environment variables to store tokens in your applications</li>
                  <li>Rotate tokens regularly and delete unused ones</li>
                  <li>Set expiration dates for temporary access tokens</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* New Token Modal */}
      <AnimatePresence>
        {showNewToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowNewToken(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate API Token</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="Production API, CI/CD Pipeline, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration
                  </label>
                  <select
                    value={newTokenExpiry}
                    onChange={(e) => setNewTokenExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="never">Never expires</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                    <option value="90d">90 days</option>
                    <option value="1y">1 year</option>
                  </select>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    This token will have full access to your SpinLets and resources.
                    Keep it secure and don't share it publicly.
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={() => {
                      setShowNewToken(false);
                      setNewTokenName("");
                      setNewTokenExpiry("never");
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateToken}
                    disabled={generateMutation.isPending}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 text-sm font-medium disabled:opacity-50"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Generate Token"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}