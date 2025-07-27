import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Customer } from '../services/api';
import { Plus, Edit2, Trash2, Search, Users, CheckCircle, XCircle } from 'lucide-react';

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
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithStats | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    limits: {
      maxSpinlets: '',
      maxMemory: '',
      maxDomains: '',
    },
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const result = await api.getAllCustomers();
      setCustomers(result.customers);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const customerData = {
        name: formData.name,
        email: formData.email,
        limits: {
          maxSpinlets: formData.limits.maxSpinlets ? parseInt(formData.limits.maxSpinlets) : undefined,
          maxMemory: formData.limits.maxMemory || undefined,
          maxDomains: formData.limits.maxDomains ? parseInt(formData.limits.maxDomains) : undefined,
        },
      };

      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, customerData);
      } else {
        await api.createCustomer(customerData);
      }
      
      setShowModal(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      console.error('Failed to save customer:', error);
      alert('Failed to save customer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    try {
      await api.deleteCustomer(id);
      fetchCustomers();
    } catch (error) {
      console.error('Failed to delete customer:', error);
      alert('Failed to delete customer');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      limits: {
        maxSpinlets: '',
        maxMemory: '',
        maxDomains: '',
      },
    });
    setEditingCustomer(null);
  };

  const openEditModal = (customer: CustomerWithStats) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      limits: {
        maxSpinlets: customer.limits?.maxSpinlets?.toString() || '',
        maxMemory: customer.limits?.maxMemory || '',
        maxDomains: customer.limits?.maxDomains?.toString() || '',
      },
    });
    setShowModal(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Management</h1>
        <p className="text-gray-600">Manage your SpinForge customers and their resource limits</p>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Customer
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resources
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Limits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500">{customer.email}</div>
                      <div className="text-xs text-gray-400 mt-1">ID: {customer.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      customer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {customer.isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
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
                      <span className="text-gray-400">Loading...</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      {customer.limits?.maxSpinlets && <div>Max Spinlets: {customer.limits.maxSpinlets}</div>}
                      {customer.limits?.maxMemory && <div>Max Memory: {customer.limits.maxMemory}</div>}
                      {customer.limits?.maxDomains && <div>Max Domains: {customer.limits.maxDomains}</div>}
                      {!customer.limits?.maxSpinlets && !customer.limits?.maxMemory && !customer.limits?.maxDomains && (
                        <span className="text-gray-400">No limits</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(customer)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search' : 'Get started by creating a new customer'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-medium mb-4">
              {editingCustomer ? 'Edit Customer' : 'New Customer'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingCustomer}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Resource Limits (Optional)</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Max Spinlets
                      </label>
                      <input
                        type="number"
                        value={formData.limits.maxSpinlets}
                        onChange={(e) => setFormData({
                          ...formData,
                          limits: { ...formData.limits, maxSpinlets: e.target.value }
                        })}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Max Memory (e.g., 4GB)
                      </label>
                      <input
                        type="text"
                        value={formData.limits.maxMemory}
                        onChange={(e) => setFormData({
                          ...formData,
                          limits: { ...formData.limits, maxMemory: e.target.value }
                        })}
                        placeholder="4GB"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Max Domains
                      </label>
                      <input
                        type="number"
                        value={formData.limits.maxDomains}
                        onChange={(e) => setFormData({
                          ...formData,
                          limits: { ...formData.limits, maxDomains: e.target.value }
                        })}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingCustomer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}