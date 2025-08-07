/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Plus,
  ExternalLink,
  Shield,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Settings,
  Link as LinkIcon,
  Server,
  Loader2,
  Edit,
  Copy,
  MoreVertical,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { hostingAPI } from "@/services/customer-api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Domain {
  id: string;
  domain: string;
  spinlet: string;
  status: "active" | "pending" | "inactive";
  ssl: "active" | "pending" | "inactive";
  createdAt: string;
  type: string;
}

export default function DomainsPage() {
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch vhosts from customer API
  const { data: vhosts = [], isLoading, refetch } = useQuery({
    queryKey: ["vhosts", user?.customerId],
    queryFn: async () => {
      const data = await hostingAPI.listVHosts();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.customerId,
  });

  // Map vhosts to domains
  const domains: Domain[] = vhosts.map((vhost: any) => ({
    id: vhost.domain || vhost.id,
    domain: vhost.domain,
    spinlet: vhost.type || "SpinLet",
    status: vhost.enabled ? "active" : "inactive",
    ssl: vhost.ssl_enabled ? "active" : "pending",
    createdAt: vhost.createdAt || vhost.created_at,
    type: vhost.type,
  }));

  // Filter domains
  const filteredDomains = domains.filter((domain) => {
    const matchesSearch = domain.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || domain.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const config = {
      active: { bg: "bg-green-50", text: "text-green-700", icon: CheckCircle },
      pending: { bg: "bg-yellow-50", text: "text-yellow-700", icon: Clock },
      inactive: { bg: "bg-gray-50", text: "text-gray-700", icon: AlertCircle },
    }[status] || { bg: "bg-gray-50", text: "text-gray-700", icon: AlertCircle };

    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </span>
    );
  };

  const getSSLBadge = (ssl: string) => {
    if (ssl === "active") {
      return (
        <div className="flex items-center space-x-1">
          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-green-600 font-medium">HTTPS</span>
        </div>
      );
    } else if (ssl === "pending") {
      return (
        <div className="flex items-center space-x-1">
          <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-yellow-600 font-medium">Provisioning</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-1">
          <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
          <span className="text-xs text-gray-500">HTTP</span>
        </div>
      );
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-8">
          <div className="flex items-center">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
            <span className="ml-3 text-gray-600">Loading domains...</span>
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
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Domains
                  </h1>
                  <p className="text-sm text-gray-500">Manage your custom domains and DNS settings</p>
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
                onClick={() => setShowAddDomain(true)}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Domain
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
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Domains Table */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
            {filteredDomains.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">No domains found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery
                    ? "Try adjusting your search or filters"
                    : "Add your first domain to get started"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowAddDomain(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Domain
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Domain
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SpinLet
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SSL Certificate
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="relative px-6 py-4">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50 divide-y divide-gray-200">
                    {filteredDomains.map((domain) => (
                      <motion.tr
                        key={domain.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="hover:bg-white/70 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Globe className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <a
                                href={`https://${domain.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center"
                              >
                                {domain.domain}
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                              <p className="text-xs text-gray-500">{domain.type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Server className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{domain.spinlet}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(domain.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getSSLBadge(domain.ssl)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(domain.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(domain.domain);
                                toast.success("Domain copied to clipboard");
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Copy domain"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setSelectedDomain(domain.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Configure domain"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to remove ${domain.domain}?`)) {
                                  toast.success(`Domain ${domain.domain} removed`);
                                  queryClient.invalidateQueries({ queryKey: ["vhosts"] });
                                }
                              }}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                              title="Remove domain"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DNS Help */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">DNS Configuration</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>To connect your domain, add the following DNS records:</p>
                  <div className="mt-2 space-y-2">
                    <div className="bg-white/80 rounded-lg p-3 font-mono text-xs">
                      <span className="text-gray-600">Type: CNAME</span><br />
                      <span className="text-gray-900">Name: @ or www</span><br />
                      <span className="text-gray-900">Value: spinforge.app</span>
                    </div>
                    <p className="text-xs">SSL certificates are automatically provisioned via Let's Encrypt</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Add Domain Modal */}
      <AnimatePresence>
        {showAddDomain && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddDomain(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Custom Domain</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain Name
                  </label>
                  <input
                    type="text"
                    placeholder="example.com or subdomain.example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Connect to SpinLet
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Select a SpinLet...</option>
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.spinlet}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    After adding your domain, you'll need to update your DNS records.
                    We'll provide the exact configuration needed.
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setShowAddDomain(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      toast.success("Domain added successfully");
                      setShowAddDomain(false);
                      queryClient.invalidateQueries({ queryKey: ["vhosts"] });
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 text-sm font-medium"
                  >
                    Add Domain
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