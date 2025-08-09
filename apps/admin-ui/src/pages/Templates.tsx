import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Database,
  Globe,
  FileText,
  BarChart3,
  X,
  Rocket
} from 'lucide-react';
import { toast } from 'sonner';

interface TemplateVariable {
  name: string;
  label?: string;
  type?: string;
  default?: string;
  required?: boolean;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  category: 'container' | 'proxy' | 'static' | 'loadbalancer';
  icon?: string;
  config: any;
  variables?: TemplateVariable[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

const categoryIcons = {
  container: Database,
  proxy: Globe,
  static: FileText,
  loadbalancer: BarChart3
};

const categoryColors = {
  container: 'bg-blue-100 text-blue-800 border-blue-200',
  proxy: 'bg-purple-100 text-purple-800 border-purple-200',
  static: 'bg-green-100 text-green-800 border-green-200',
  loadbalancer: 'bg-orange-100 text-orange-800 border-orange-200'
};

const categoryGradients = {
  container: 'from-blue-500 to-blue-600',
  proxy: 'from-purple-500 to-purple-600',
  static: 'from-green-500 to-green-600',
  loadbalancer: 'from-orange-500 to-orange-600'
};

function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeployDialog, setOpenDeployDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deploymentVariables, setDeploymentVariables] = useState<Record<string, string>>({});
  const [deploymentData, setDeploymentData] = useState({
    customerName: '',
    deployName: '',
    hostname: ''
  });
  const [formData, setFormData] = useState<Partial<Template>>({
    name: '',
    description: '',
    category: 'container',
    icon: '',
    config: {},
    variables: [],
    tags: []
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: 'container',
      icon: '',
      config: {},
      variables: [],
      tags: []
    });
    setOpenDialog(true);
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setFormData(template);
    setOpenDialog(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete template');
      
      toast.success('Template deleted successfully');
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const method = selectedTemplate ? 'PUT' : 'POST';
      const url = selectedTemplate 
        ? `/api/templates/${selectedTemplate.id}`
        : `/api/templates`;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Failed to save template');
      
      toast.success(`Template ${selectedTemplate ? 'updated' : 'created'} successfully`);
      setOpenDialog(false);
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeployTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setDeploymentData({
      customerName: '',
      deployName: '',
      hostname: ''
    });
    const initialVars: Record<string, string> = {};
    template.variables?.forEach(v => {
      initialVars[v.name] = v.default || '';
    });
    setDeploymentVariables(initialVars);
    setOpenDeployDialog(true);
  };

  const handleDeploy = async () => {
    if (!selectedTemplate) return;
    
    // Generate hostname if not provided
    const hostname = deploymentData.hostname || 
      `${deploymentData.deployName}.${deploymentData.customerName}.localhost`;
    
    try {
      const response = await fetch(`/api/templates/${selectedTemplate.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: hostname,
          customerName: deploymentData.customerName,
          deployName: deploymentData.deployName,
          variables: deploymentVariables
        })
      });
      
      if (!response.ok) throw new Error('Failed to deploy template');
      
      setOpenDeployDialog(false);
      toast.success(`Successfully deployed ${selectedTemplate.name} to ${hostname}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleInitDefaults = async () => {
    try {
      const response = await fetch('/api/templates/init-defaults', {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to initialize default templates');
      
      const data = await response.json();
      toast.success(data.message);
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deployment Templates</h1>
          <p className="text-gray-600 mt-1">Reusable configurations for quick deployments</p>
        </div>
        <div className="flex space-x-3">
          {templates.length === 0 && (
            <button
              onClick={handleInitDefaults}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Initialize Default Templates
            </button>
          )}
          <button
            onClick={handleCreateTemplate}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => {
          const Icon = categoryIcons[template.category] || Database; // Fallback to Database icon
          return (
            <div
              key={template.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="p-6">
                {/* Template Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${categoryGradients[template.category] || 'from-gray-500 to-gray-600'} text-white`}>
                      {Icon && <Icon className="w-6 h-6" />}
                    </div>
                    <div className="ml-4">
                      <h3 className="font-semibold text-lg text-gray-900">{template.name}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${categoryColors[template.category] || 'bg-gray-100 text-gray-800 border-gray-200'} border`}>
                        {template.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-4 overflow-hidden" style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {template.description || 'No description provided'}
                </p>

                {/* Tags */}
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Variables Info */}
                {template.variables && template.variables.length > 0 && (
                  <p className="text-xs text-gray-500 mb-4">
                    {template.variables.length} configurable variable(s)
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleDeployTemplate(template)}
                    className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm rounded-lg hover:from-green-600 hover:to-green-700 transition-all"
                  >
                    <Rocket className="w-4 h-4 mr-1" />
                    Deploy
                  </button>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      {openDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button
                onClick={() => setOpenDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MongoDB Database"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="NoSQL database for modern applications"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category || 'container'}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as Template['category'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="container">Container</option>
                  <option value="proxy">Proxy</option>
                  <option value="static">Static</option>
                  <option value="loadbalancer">Load Balancer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Configuration (JSON)
                </label>
                <textarea
                  value={JSON.stringify(formData.config || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      setFormData({ ...formData, config: JSON.parse(e.target.value) });
                    } catch (err) {
                      // Invalid JSON, don't update
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={10}
                  placeholder='{"type": "container", "containerConfig": {...}}'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="database, nosql, mongodb"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
              <button
                onClick={() => setOpenDialog(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
              >
                {selectedTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deploy Dialog */}
      {openDeployDialog && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Deploy {selectedTemplate.name}
              </h2>
              <button
                onClick={() => setOpenDeployDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={deploymentData.customerName}
                  onChange={(e) => setDeploymentData({ ...deploymentData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="acme-corp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deployment Name *
                </label>
                <input
                  type="text"
                  value={deploymentData.deployName}
                  onChange={(e) => setDeploymentData({ ...deploymentData, deployName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="mongodb-prod"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hostname (optional)
                </label>
                <input
                  type="text"
                  value={deploymentData.hostname}
                  onChange={(e) => setDeploymentData({ ...deploymentData, hostname: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`${deploymentData.deployName || 'deployname'}.${deploymentData.customerName || 'customer'}.localhost`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use: {deploymentData.deployName || 'deployname'}.{deploymentData.customerName || 'customer'}.localhost
                </p>
              </div>

              {selectedTemplate.variables?.map((variable) => (
                <div key={variable.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {variable.label || variable.name} {variable.required && '*'}
                  </label>
                  <input
                    type={variable.type || 'text'}
                    value={deploymentVariables[variable.name] || ''}
                    onChange={(e) => setDeploymentVariables({
                      ...deploymentVariables,
                      [variable.name]: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={variable.default}
                  />
                </div>
              ))}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
              <button
                onClick={() => setOpenDeployDialog(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeploy}
                disabled={!deploymentData.customerName || !deploymentData.deployName}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Deploy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Templates;