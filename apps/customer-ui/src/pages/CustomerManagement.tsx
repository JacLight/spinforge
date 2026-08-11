/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Users, CheckCircle, XCircle, Grid3X3, Package,
  Upload, LayoutDashboard, Globe, RefreshCw,
} from 'lucide-react';
import { api, Customer } from '../services/api';
import CustomerDrawer from '../components/customer/CustomerDrawer';

interface CustomerWithStats extends Customer {
  stats?: {
    totalSpinlets: number;
    activeSpinlets: number;
    totalDomains: number;
    totalMemoryUsed: number;
    limits: any;
  };
}

export default function CustomerManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'new' | 'edit'>('edit');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.getAllCustomers(),
  });

  const customers: CustomerWithStats[] = (data?.customers as CustomerWithStats[]) || [];
  const total = data?.total ?? 0;

  const filtered = useMemo(
    () => customers.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
    [customers, searchTerm],
  );

  function openNew() {
    setSelectedCustomer(null);
    setDrawerMode('new');
    setDrawerOpen(true);
  }
  function openEdit(c: CustomerWithStats) {
    setSelectedCustomer(c);
    setDrawerMode('edit');
    setDrawerOpen(true);
  }
  function handleDrawerSaved() {
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Customer Management
                  </h1>
                  <p className="text-sm text-gray-500">
                    {total} customers · click a row to edit identity, policy, secrets, or sites
                  </p>
                </div>
              </div>

              <div className="hidden lg:flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-2xl p-1 border border-white/20 shadow-lg">
                  <Link to="/" className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70">
                    <LayoutDashboard className="w-4 h-4" /><span className="hidden xl:inline">Dashboard</span>
                  </Link>
                  <Link to="/applications" className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70">
                    <Package className="w-4 h-4" /><span className="hidden xl:inline">Apps</span>
                  </Link>
                  <Link to="/deploy" className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70">
                    <Upload className="w-4 h-4" /><span className="hidden xl:inline">Deploy</span>
                  </Link>
                  <Link to="/hosting" className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70">
                    <Globe className="w-4 h-4" /><span className="hidden xl:inline">Hosting</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => refetch()}
                disabled={isRefetching}
                className="p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50 shadow"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 ${isRefetching ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={openNew}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New Customer</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search customers by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <Th>Customer</Th>
                    <Th>Status</Th>
                    <Th>Resources</Th>
                    <Th>Limits</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => openEdit(customer)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.email}</div>
                          <div className="text-xs text-gray-400 mt-1 font-mono">{customer.id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          customer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {customer.isActive ? (<><CheckCircle className="h-3 w-3 mr-1" /> Active</>) : (<><XCircle className="h-3 w-3 mr-1" /> Inactive</>)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.stats ? (
                          <div>
                            <div>Spinlets: {customer.stats.activeSpinlets}/{customer.stats.totalSpinlets}</div>
                            <div>Domains: {customer.stats.totalDomains}</div>
                            <div>Memory: {customer.stats.totalMemoryUsed}MB</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.limits?.maxSpinlets && <div>Max Spinlets: {customer.limits.maxSpinlets}</div>}
                        {customer.limits?.maxMemory && <div>Max Memory: {customer.limits.maxMemory}</div>}
                        {customer.limits?.maxDomains && <div>Max Domains: {customer.limits.maxDomains}</div>}
                        {!customer.limits?.maxSpinlets && !customer.limits?.maxMemory && !customer.limits?.maxDomains && (
                          <span className="text-gray-400">No limits</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search' : 'Get started by creating a new customer'}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>

      <CustomerDrawer
        customer={selectedCustomer}
        isNew={drawerMode === 'new'}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleDrawerSaved}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      {children}
    </th>
  );
}
