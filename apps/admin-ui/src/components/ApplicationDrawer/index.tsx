import React, { useState, useEffect } from 'react';
import { X, Info, Globe, ChevronRight, Shield, Lock, Stethoscope, Key, Settings, Edit2, Save, Trash2, Power, Activity, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hostingAPI } from '../../services/hosting-api';
import { toast } from 'sonner';

// Import tab components
import OverviewTab from './tabs/OverviewTab';
import MetricsTab from './tabs/MetricsTab';
import DiagnosticsTab from './tabs/DiagnosticsTab';
import ProtectedRoutesTab from './tabs/ProtectedRoutesTabV2';
import AdvancedSettingsTab from './tabs/AdvancedSettingsTab';
import SSLCertificateManager from '../SSLCertificateManager';

interface ApplicationDrawerProps {
  vhost: any;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function ApplicationDrawer({ vhost, isOpen, onClose, onRefresh }: ApplicationDrawerProps) {
  const [activeSection, setActiveSection] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [formData, setFormData] = useState({
    enabled: vhost?.enabled !== false,
    target: vhost?.target || '',
    preserveHost: vhost?.preserveHost || false,
    customerId: vhost?.customerId || '',
    containerConfig: vhost?.containerConfig || {
      port: 3000,
      env: {},
      image: '',
      restartPolicy: 'always',
      cpuLimit: '1',
      memoryLimit: '512m',
      healthCheck: {}
    },
    backends: vhost?.backends || vhost?.backendConfigs || [],
    domains: vhost?.domains || [vhost?.domain],
    // Advanced settings
    requestTimeout: vhost?.requestTimeout || 60,
    maxRequestSize: vhost?.maxRequestSize || 100,
    gzipEnabled: vhost?.gzipEnabled !== false,
    websocketEnabled: vhost?.websocketEnabled || false,
    proxyHeaders: vhost?.proxyHeaders || {},
    bufferSize: vhost?.bufferSize || '4k',
    bufferCount: vhost?.bufferCount || 8,
    lbMethod: vhost?.lbMethod || 'round-robin',
    stickySessionDuration: vhost?.stickySessionDuration || 0,
    routingRules: vhost?.routingRules || [],
    indexFile: vhost?.indexFile || 'index.html',
    errorFile: vhost?.errorFile || '404.html',
    directoryListing: vhost?.directoryListing || false
  });

  const queryClient = useQueryClient();

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      return hostingAPI.updateVHost(vhost.domain, updates);
    },
    onSuccess: () => {
      toast.success('Configuration saved successfully');
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsEditing(false);
      if (onRefresh) onRefresh();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update configuration');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return hostingAPI.deleteVHost(vhost.domain);
    },
    onSuccess: () => {
      toast.success('Application deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete application');
    },
  });

  // Handle save
  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  // Handle delete
  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (deleteConfirmText === vhost.domain) {
      deleteMutation.mutate();
      setShowDeleteModal(false);
      setDeleteConfirmText('');
    }
  };

  // Reset form when vhost changes
  useEffect(() => {
    // Ensure containerConfig.env is a proper object, not an array
    let containerConfig = vhost?.containerConfig || {
      port: 3000,
      env: {},
      image: '',
      restartPolicy: 'always'
    };
    
    // Fix if env was accidentally saved as an array
    if (Array.isArray(containerConfig.env)) {
      const fixedEnv: Record<string, string> = {};
      containerConfig.env.forEach((item: any) => {
        if (typeof item === 'object' && item.key && item.value) {
          fixedEnv[item.key] = item.value;
        }
      });
      containerConfig.env = fixedEnv;
    }
    
    setFormData({
      enabled: vhost?.enabled !== false,
      target: vhost?.target || '',
      preserveHost: vhost?.preserveHost || false,
      customerId: vhost?.customerId || '',
      containerConfig,
      backends: vhost?.backends || [],
      domains: vhost?.domains || [vhost?.domain],
    });
  }, [vhost]);

  // Navigation tabs - streamlined for functionality
  const navigationTabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'metrics', label: 'Metrics', icon: Activity },
    { id: 'ssl', label: 'SSL', icon: Lock },
    { id: 'protected', label: 'Protected Routes', icon: Key },
    { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  ];

  if (!vhost) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-5xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 shadow-2xl z-50 flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            {/* Glassmorphic Header */}
            <div className="relative bg-white/70 backdrop-blur-2xl border-b border-white/50 shadow-lg">
              {/* Background Gradient Orbs */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl" />
              </div>
              
              <div className="relative px-8 py-6">
                {/* Top Row - Title and Main Controls */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {vhost.domain}
                      </h2>
                      <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        vhost.enabled !== false 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          vhost.enabled !== false ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        }`} />
                        {vhost.enabled !== false ? 'Active' : 'Disabled'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <div className="px-2 py-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-md text-xs font-medium text-gray-700">
                          {vhost.type}
                        </div>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(vhost.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Beautiful and Prominent */}
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <>
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => setIsEditing(false)}
                          className="group px-5 py-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          <span className="font-medium">Cancel</span>
                        </motion.button>
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={handleSave}
                          disabled={updateMutation.isPending}
                          className="group px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                          <Save className="h-4 w-4" />
                          <span className="font-medium">
                            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                          </span>
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setIsEditing(true)}
                          className="group px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 shadow-lg flex items-center gap-2"
                        >
                          <Edit2 className="h-4 w-4" />
                          <span className="font-medium">Edit</span>
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleDelete}
                          className="group px-5 py-2.5 bg-white/80 backdrop-blur-xl border border-red-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="font-medium">Delete</span>
                        </motion.button>
                      </>
                    )}
                    
                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-300 to-transparent mx-1" />
                    
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className="p-2.5 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <X className="h-5 w-5 text-gray-600" />
                    </motion.button>
                  </div>
                </div>

                {/* Navigation Tabs - Beautiful Pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {navigationTabs.map((tab, index) => (
                    <motion.button
                      key={tab.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setActiveSection(tab.id)}
                      className={`group px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${
                        activeSection === tab.id
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                          : 'bg-white/60 hover:bg-white/80 text-gray-600 hover:text-gray-900 hover:shadow-md'
                      }`}
                    >
                      <tab.icon className={`h-4 w-4 ${
                        activeSection === tab.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                      }`} />
                      <span>{tab.label}</span>
                      {activeSection === tab.id && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl -z-10"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Area with Beautiful Scroll */}
            <div className="flex-1 overflow-y-auto relative">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-[0.015]">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, rgb(99, 102, 241) 1px, transparent 1px)`,
                  backgroundSize: '32px 32px'
                }} />
              </div>
              
              <div className="relative px-8 py-8 pb-24">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Tab Content */}
                    {activeSection === 'overview' && (
                      <OverviewTab 
                        vhost={vhost} 
                        isEditing={isEditing}
                        formData={formData}
                        setFormData={setFormData}
                      />
                    )}
                    
                    {activeSection === 'settings' && (
                      <AdvancedSettingsTab
                        vhost={vhost}
                        isEditing={isEditing}
                        formData={formData}
                        setFormData={setFormData}
                      />
                    )}
                    
                    {activeSection === 'metrics' && (
                      <MetricsTab domain={vhost.domain} />
                    )}
                    
                    {activeSection === 'ssl' && (
                      <SSLCertificateManager
                        domain={vhost.domain}
                        applicationId={vhost.id || ''}
                      />
                    )}
                    
                    {activeSection === 'diagnostics' && (
                      <DiagnosticsTab vhost={vhost} />
                    )}
                    
                    {activeSection === 'protected' && (
                      <ProtectedRoutesTab vhost={vhost} isEditing={isEditing} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {showDeleteModal && (
              <>
                <motion.div
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                  }}
                />
                <motion.div
                  className="fixed inset-0 z-[61] flex items-center justify-center p-4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                    <div className="mb-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <Trash2 className="h-6 w-6 text-red-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Application</h3>
                      <p className="text-sm text-gray-600">
                        This action cannot be undone. This will permanently delete the application
                        <span className="font-semibold text-gray-900"> {vhost.domain}</span> and all its configurations.
                      </p>
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type <code className="bg-gray-100 px-2 py-1 rounded">{vhost.domain}</code> to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Enter domain name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowDeleteModal(false);
                          setDeleteConfirmText('');
                        }}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDelete}
                        disabled={deleteConfirmText !== vhost.domain || deleteMutation.isPending}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete Application'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}