/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hostingAPI, VHost } from "../services/hosting-api";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { useDebounce } from "../hooks/useDebounce";
import ApplicationDrawer from "../components/ApplicationDrawer";
import {
  Globe,
  Package,
  Trash2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Settings,
  Server,
  Plus,
  FolderOpen,
  Network,
  Search,
  LayoutGrid,
  List,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link as LinkIcon,
  Container,
  Activity,
  Grid3X3,
  Upload,
  LayoutDashboard,
  BarChart3,
  X,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } else if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return "Just now";
  }
}

function getSSLIcon(vhost: VHost) {
  const hasSSL = vhost.ssl_enabled || false;

  if (hasSSL) {
    return (
      <div
        className="flex items-center space-x-1"
        title="SSL Certificate Active"
      >
        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
        <span className="text-xs text-green-600 font-medium">HTTPS</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center space-x-1" title="No SSL Certificate">
        <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
        <span className="text-xs text-gray-500">HTTP</span>
      </div>
    );
  }
}

export default function Applications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVhost, setSelectedVhost] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [vhostToDelete, setVhostToDelete] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Debounce search term for API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Get all vhosts for customer list
  const { data: allVhosts = [] } = useQuery({
    queryKey: ["all-vhosts"],
    queryFn: () => hostingAPI.listVHosts(),
    staleTime: 60000, // Cache for 1 minute
  });

  // Get unique customers from all vhosts
  const customers = Array.from(
    new Set(allVhosts.map((v) => v.customerId || "unknown"))
  );

  // Search vhosts with filters
  const {
    data: searchResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "vhosts-search",
      debouncedSearchTerm,
      selectedCustomer,
      selectedType,
    ],
    queryFn: () =>
      hostingAPI.searchVHosts({
        search: debouncedSearchTerm,
        customer: selectedCustomer,
        type: selectedType,
      }),
    refetchInterval: 30000,
  });

  const vhosts = searchResponse?.data || [];
  const totalCount = searchResponse?.total || 0;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (domain: string) => hostingAPI.deleteVHost(domain),
    onSuccess: () => {
      toast.success("Site deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["vhosts"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete site: ${error.message}`);
    },
  });

  const handleDeleteClick = (vhost: VHost) => {
    setVhostToDelete(vhost);
    setDeleteConfirmation("");
    setDeleteError("");
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (!vhostToDelete) return;

    const expectedDomain = vhostToDelete.domain;
    if (deleteConfirmation !== expectedDomain) {
      setDeleteError("Please type the domain name exactly as shown");
      return;
    }

    deleteMutation.mutate(vhostToDelete.domain);
    setDeleteModalOpen(false);
    setVhostToDelete(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "static":
        return FolderOpen;
      case "proxy":
        return Network;
      case "container":
        return Package;
      case "loadbalancer":
        return Server;
      default:
        return Globe;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "static":
        return "text-blue-600 bg-blue-50";
      case "proxy":
        return "text-green-600 bg-green-50";
      case "container":
        return "text-purple-600 bg-purple-50";
      case "loadbalancer":
        return "text-orange-600 bg-orange-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getSiteUrl = (vhost: any) => {
    return vhost.domain ? `http://${vhost.domain}` : null;
  };

  const getStatusIcon = (vhost: any) => {
    if (vhost.type === "static" && vhost.files_exist === false) {
      return (
        <span title="Files missing">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </span>
      );
    }
    if (vhost.enabled === false) {
      return (
        <span title="Disabled">
          <XCircle className="h-4 w-4 text-gray-400" />
        </span>
      );
    }
    return (
      <span title="Active">
        <CheckCircle className="h-4 w-4 text-green-500" />
      </span>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            Failed to load applications
          </h2>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
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
                  <Grid3X3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Applications
                  </h1>
                  <p className="text-sm text-gray-500">
                    {vhosts.length}{" "}
                    {totalCount > vhosts.length ? `of ${totalCount}` : ""} sites
                    {searchTerm && ` matching "${searchTerm}"`}
                    {vhosts.reduce(
                      (count, v) => count + (v.aliases?.length || 0),
                      0
                    ) > 0 && (
                      <span className="ml-2">
                        •{" "}
                        {vhosts.reduce(
                          (count, v) => count + (v.aliases?.length || 0),
                          0
                        )}{" "}
                        aliases
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Enhanced Dashboard Navigation */}
              <div className="hidden lg:flex items-center space-x-2">
                {/* Primary Dashboard Tabs */}
                <div className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1 border border-white/20 shadow-lg">
                  <Link
                    to="/"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden xl:inline">Dashboard</span>
                  </Link>
                  <Link
                    to="/applications"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg"></div>
                    <Package className="w-4 h-4 relative z-10" />
                    <span className="hidden xl:inline relative z-10">Apps</span>
                  </Link>
                  <Link
                    to="/deploy"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden xl:inline">Deploy</span>
                  </Link>
                  <Link
                    to="/hosting"
                    className="group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="hidden xl:inline">Hosting</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/deploy")}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Deploy New</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Content */}
      <div className="px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Search and Controls Bar */}
          <motion.div
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by domain, site ID, or customer..."
                    className="pl-12 pr-4 py-3 w-full bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 ${
                    showFilters
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                      : "bg-white/60 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span className="font-medium">Filters</span>
                  {(selectedCustomer || selectedType) && (
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                      {[selectedCustomer, selectedType].filter(Boolean).length}
                    </span>
                  )}
                </button>

                {/* View Mode Toggle */}
                <div className="flex bg-white/60 rounded-xl p-1 border border-gray-200">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2.5 rounded-lg transition-all duration-200 ${
                      viewMode === "list"
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md"
                        : "hover:bg-gray-100"
                    }`}
                    title="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2.5 rounded-lg transition-all duration-200 ${
                      viewMode === "grid"
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md"
                        : "hover:bg-gray-100"
                    }`}
                    title="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>

                {/* Refresh */}
                <button
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="p-3 bg-white/60 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* Filters (collapsible) */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer
                    </label>
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">
                        All Customers ({customers.length})
                      </option>
                      {customers.map((customer) => (
                        <option key={customer} value={customer}>
                          {customer} (
                          {
                            allVhosts.filter((v) => v.customerId === customer)
                              .length
                          }
                          )
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">All Types</option>
                      <option value="static">
                        Static (
                        {allVhosts.filter((v) => v.type === "static").length})
                      </option>
                      <option value="proxy">
                        Proxy (
                        {allVhosts.filter((v) => v.type === "proxy").length})
                      </option>
                      <option value="container">
                        Container (
                        {allVhosts.filter((v) => v.type === "container").length}
                        )
                      </option>
                      <option value="loadbalancer">
                        Load Balancer (
                        {
                          allVhosts.filter((v) => v.type === "loadbalancer")
                            .length
                        }
                        )
                      </option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : vhosts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
              <div className="text-center">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No applications found
                </h3>
                <p className="text-gray-600">
                  {searchTerm || selectedCustomer || selectedType
                    ? "Try adjusting your filters"
                    : "Deploy your first application to get started"}
                </p>
              </div>
            </div>
          ) : viewMode === "list" ? (
            // List View
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SSL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vhosts.map((vhost) => {
                    const Icon = getTypeIcon(vhost.type);
                    return (
                      <tr key={vhost.domain} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap flex gap-2 items-center">
                          {getStatusIcon(vhost)}
                             <Link className="text-xs font-medium text-gray-900 ml-2" to={'/applications/' + vhost.domain}>
                          Open
                        </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {vhost.domain || (
                              <span className="text-gray-500 italic">
                                No domain configured
                              </span>
                            )}
                          </div>
                          {vhost.aliases && vhost.aliases.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-gray-500">
                                Aliases:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {vhost.aliases.map(
                                  (alias: string, index: number) => (
                                    <span
                                      key={index}
                                      className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                                    >
                                      {alias}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                          {vhost.id && vhost.id !== vhost.domain && (
                            <div className="text-xs text-gray-500">
                              ID: {vhost.id}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Icon
                              className={`h-4 w-4 mr-2 ${
                                getTypeColor(vhost.type).split(" ")[0]
                              }`}
                            />
                            <span className="text-sm text-gray-900">
                              {vhost.type}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {vhost.customerId || "Unknown"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getSSLIcon(vhost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(vhost.created_at || vhost.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {getSiteUrl(vhost) ? (
                              <a
                                href={getSiteUrl(vhost)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-900"
                                title="Visit site"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <span
                                className="text-gray-400"
                                title="No domain configured"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </span>
                            )}
                            {(vhost.type === "container" ||
                              vhost.type === "compose") && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/dashboard/containers/${vhost.domain}`
                                  )
                                }
                                className="text-purple-600 hover:text-purple-900"
                                title="Container Monitor"
                              >
                                <Activity className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedVhost(vhost);
                                setDrawerOpen(true);
                              }}
                              className="text-gray-600 hover:text-gray-900"
                              title="View Details"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(vhost as VHost)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            // Grid View (Compact Cards)
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {vhosts.map((vhost) => {
                const Icon = getTypeIcon(vhost.type);
                return (
                  <div
                    key={vhost.domain}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded ${
                            getTypeColor(vhost.type).split(" ")[1]
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 ${
                              getTypeColor(vhost.type).split(" ")[0]
                            }`}
                          />
                        </div>
                        {getStatusIcon(vhost)}
                                              </div>
                      <span className="text-xs text-gray-500">
                        {formatDate(vhost.created_at || vhost.createdAt)}
                      </span>
                    </div>

                    <div className="mb-3">
                      <h3
                        className="font-medium text-gray-900 truncate"
                        title={vhost.domain || "No domain"}
                      >
                        {vhost.domain || (
                          <span className="text-gray-500 italic text-sm">
                            No domain configured
                          </span>
                        )}
                      </h3>
                      {vhost.aliases && vhost.aliases.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Link className="h-3 w-3 text-gray-400" />
                          <div className="flex flex-wrap gap-1">
                            {vhost.aliases
                              .slice(0, 2)
                              .map((alias: string, index: number) => (
                                <span
                                  key={index}
                                  className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[120px]"
                                  title={alias}
                                >
                                  {alias}
                                </span>
                              ))}
                            {vhost.aliases.length > 2 && (
                              <span className="text-xs text-gray-500">
                                +{vhost.aliases.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {vhost.id && vhost.id !== vhost.domain && (
                        <p className="text-xs text-gray-500">ID: {vhost.id}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="capitalize">{vhost.type}</span>
                        {getSSLIcon(vhost)}
                      </div>
                      <span className="text-gray-500">
                        {vhost.customerId || "Unknown"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      {getSiteUrl(vhost) ? (
                        <a
                          href={getSiteUrl(vhost)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="Visit site"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span
                          className="text-gray-400"
                          title="No domain configured"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      )}
                      {(vhost.type === "container" ||
                        vhost.type === "compose") && (
                        <button
                          onClick={() =>
                            navigate(`/dashboard/containers/${vhost.domain}`)
                          }
                          className="text-purple-600 hover:text-purple-800"
                          title="Container Monitor"
                        >
                          <Activity className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedVhost(vhost);
                          setDrawerOpen(true);
                        }}
                        className="text-gray-600 hover:text-gray-800"
                        title="View Details"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(vhost as VHost)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Application Details Drawer */}
          <ApplicationDrawer
            vhost={selectedVhost}
            isOpen={drawerOpen}
            onClose={() => {
              setDrawerOpen(false);
              setSelectedVhost(null);
            }}
            onRefresh={() => refetch()}
          />

          {/* Delete Confirmation Modal - Custom Tailwind Implementation */}
          <AnimatePresence>
            {deleteModalOpen && (
              <>
                <motion.div
                  className="fixed inset-0 bg-gray-500 bg-opacity-75 z-[60]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setDeleteModalOpen(false)}
                />
                <motion.div
                  className="fixed inset-0 z-[61] overflow-y-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex min-h-full items-center justify-center p-4">
                    <motion.div
                      className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                          <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="ml-4 flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Delete Application
                          </h3>
                          <div className="mt-4">
                            <p className="text-sm text-gray-500">
                              This action cannot be undone. This will
                              permanently delete the application and all
                              associated data.
                            </p>
                            <p className="mt-4 text-sm font-medium text-gray-700">
                              Please type{" "}
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                {vhostToDelete?.domain}
                              </span>{" "}
                              to confirm:
                            </p>
                            <input
                              type="text"
                              value={deleteConfirmation}
                              onChange={(e) => {
                                setDeleteConfirmation(e.target.value);
                                if (deleteError) setDeleteError("");
                              }}
                              placeholder="Type the domain name"
                              className={`mt-3 w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
                                deleteError
                                  ? "border-red-300"
                                  : "border-gray-300"
                              }`}
                            />
                            {deleteError && (
                              <p className="text-sm text-red-600 mt-2">
                                {deleteError}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-row-reverse gap-3">
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={
                            deleteMutation.isPending || !deleteConfirmation
                          }
                          className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteModalOpen(false);
                            setVhostToDelete(null);
                            setDeleteConfirmation("");
                            setDeleteError("");
                          }}
                          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
