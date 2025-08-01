import { useState, useEffect, useCallback, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hostingAPI, VHost } from "../services/hosting-api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "../hooks/useDebounce";
import ApplicationDrawerV2 from "../components/ApplicationDrawerV2";
import { Dialog, Transition } from "@headlessui/react";
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
  Link,
} from "lucide-react";

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown';
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

export default function Applications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
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
  const customers = Array.from(new Set(allVhosts.map(v => v.customerId || 'unknown')));

  // Search vhosts with filters
  const {
    data: searchResponse,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ["vhosts-search", debouncedSearchTerm, selectedCustomer, selectedType],
    queryFn: () => hostingAPI.searchVHosts({
      search: debouncedSearchTerm,
      customer: selectedCustomer,
      type: selectedType
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
      case 'static':
        return FolderOpen;
      case 'proxy':
        return Network;
      case 'container':
        return Package;
      case 'loadbalancer':
        return Server;
      default:
        return Globe;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'static':
        return 'text-blue-600 bg-blue-50';
      case 'proxy':
        return 'text-green-600 bg-green-50';
      case 'container':
        return 'text-purple-600 bg-purple-50';
      case 'loadbalancer':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getSiteUrl = (vhost: any) => {
    return vhost.domain ? `http://${vhost.domain}` : null;
  };

  const getStatusIcon = (vhost: any) => {
    if (vhost.type === 'static' && vhost.files_exist === false) {
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
          <h2 className="text-xl font-semibold mb-2">Failed to load applications</h2>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : 'Unknown error'}
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-600">
            {vhosts.length} {totalCount > vhosts.length ? `of ${totalCount}` : ''} sites
            {searchTerm && ` matching "${searchTerm}"`}
            {vhosts.reduce((count, v) => count + (v.aliases?.length || 0), 0) > 0 && (
              <span className="ml-2">
                • {vhosts.reduce((count, v) => count + (v.aliases?.length || 0), 0)} aliases
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate("/deploy")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Deploy New Site
        </button>
      </div>

      {/* Search and Controls Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by domain, site ID, or customer..."
                className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-md ${
                showFilters ? 'bg-gray-100 border-gray-300' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {(selectedCustomer || selectedType) && (
                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {[selectedCustomer, selectedType].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 rounded-md">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters (collapsible) */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Customers ({customers.length})</option>
                {customers.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer} ({allVhosts.filter(v => v.customerId === customer).length})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="static">Static ({allVhosts.filter(v => v.type === 'static').length})</option>
                <option value="proxy">Proxy ({allVhosts.filter(v => v.type === 'proxy').length})</option>
                <option value="container">Container ({allVhosts.filter(v => v.type === 'container').length})</option>
                <option value="loadbalancer">Load Balancer ({allVhosts.filter(v => v.type === 'loadbalancer').length})</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : vhosts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No applications found</h3>
            <p className="text-gray-600">
              {searchTerm || selectedCustomer || selectedType
                ? "Try adjusting your filters"
                : "Deploy your first application to get started"}
            </p>
          </div>
        </div>
      ) : viewMode === 'list' ? (
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusIcon(vhost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {vhost.domain || (
                          <span className="text-gray-500 italic">No domain configured</span>
                        )}
                      </div>
                      {vhost.aliases && vhost.aliases.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-gray-500">Aliases:</span>
                          <div className="flex flex-wrap gap-1">
                            {vhost.aliases.map((alias: string, index: number) => (
                              <span key={index} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {alias}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {vhost.id && vhost.id !== vhost.domain && (
                        <div className="text-xs text-gray-500">ID: {vhost.id}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Icon className={`h-4 w-4 mr-2 ${getTypeColor(vhost.type).split(' ')[0]}`} />
                        <span className="text-sm text-gray-900">{vhost.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vhost.customerId || 'Unknown'}
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
                          <span className="text-gray-400" title="No domain configured">
                            <ExternalLink className="h-4 w-4" />
                          </span>
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
                    <div className={`p-1.5 rounded ${getTypeColor(vhost.type).split(' ')[1]}`}>
                      <Icon className={`h-4 w-4 ${getTypeColor(vhost.type).split(' ')[0]}`} />
                    </div>
                    {getStatusIcon(vhost)}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(vhost.created_at || vhost.createdAt)}
                  </span>
                </div>

                <div className="mb-3">
                  <h3 className="font-medium text-gray-900 truncate" title={vhost.domain || 'No domain'}>
                    {vhost.domain || (
                      <span className="text-gray-500 italic text-sm">No domain configured</span>
                    )}
                  </h3>
                  {vhost.aliases && vhost.aliases.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Link className="h-3 w-3 text-gray-400" />
                      <div className="flex flex-wrap gap-1">
                        {vhost.aliases.slice(0, 2).map((alias: string, index: number) => (
                          <span key={index} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={alias}>
                            {alias}
                          </span>
                        ))}
                        {vhost.aliases.length > 2 && (
                          <span className="text-xs text-gray-500">+{vhost.aliases.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}
                  {vhost.id && vhost.id !== vhost.domain && (
                    <p className="text-xs text-gray-500">ID: {vhost.id}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                  <span>{vhost.type}</span>
                  <span className="truncate ml-2" title={vhost.customerId}>
                    {vhost.customerId || 'Unknown'}
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
                    <span className="text-gray-400" title="No domain configured">
                      <ExternalLink className="h-4 w-4" />
                    </span>
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
                    onClick={() => handleDeleteClick(vhost.id)}
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
      <ApplicationDrawerV2
        vhost={selectedVhost}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedVhost(null);
        }}
        onRefresh={() => refetch()}
      />

      {/* Delete Confirmation Modal */}
      <Transition.Root show={deleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setDeleteModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Delete Application
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          This action cannot be undone. This will permanently delete the application and all associated data.
                        </p>
                        <p className="mt-3 text-sm font-medium text-gray-700">
                          Please type <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">
                            {vhostToDelete?.domain}
                          </span> to confirm:
                        </p>
                        <input
                          type="text"
                          value={deleteConfirmation}
                          onChange={(e) => {
                            setDeleteConfirmation(e.target.value);
                            if (deleteError) setDeleteError("");
                          }}
                          placeholder="Type the domain name"
                          className={`mt-2 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                            deleteError ? "border-red-300" : "border-gray-300"
                          }`}
                        />
                        {deleteError && (
                          <p className="text-sm text-red-600 mt-1">{deleteError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending || !deleteConfirmation}
                      className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
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
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}