import { useEffect, useState } from 'react';
import { Database, Globe, FileText, BarChart3, X, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../services/axios-config';

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

const categoryIcons: Record<string, any> = {
  container: Database,
  proxy: Globe,
  static: FileText,
  loadbalancer: BarChart3,
};

const categoryColors: Record<string, string> = {
  container: 'bg-blue-100 text-blue-800 border-blue-200',
  proxy: 'bg-purple-100 text-purple-800 border-purple-200',
  static: 'bg-green-100 text-green-800 border-green-200',
  loadbalancer: 'bg-orange-100 text-orange-800 border-orange-200',
};

const categoryGradients: Record<string, string> = {
  container: 'from-blue-500 to-blue-600',
  proxy: 'from-purple-500 to-purple-600',
  static: 'from-green-500 to-green-600',
  loadbalancer: 'from-orange-500 to-orange-600',
};

function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDeployDialog, setOpenDeployDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deploymentVariables, setDeploymentVariables] = useState<Record<string, string>>({});
  const [deploymentData, setDeploymentData] = useState({ deployName: '', hostname: '' });
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data } = await apiClient.get('/_api/customer/templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDeployTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setDeploymentData({ deployName: '', hostname: '' });
    const initialVars: Record<string, string> = {};
    template.variables?.forEach((v) => {
      initialVars[v.name] = v.default || '';
    });
    setDeploymentVariables(initialVars);
    setOpenDeployDialog(true);
  };

  const handleDeploy = async () => {
    if (!selectedTemplate || !deploymentData.deployName) return;
    const customerId = localStorage.getItem('customerId') || 'customer';
    const domain =
      deploymentData.hostname ||
      `${deploymentData.deployName}.${customerId}.localhost`;
    setDeploying(true);
    try {
      await apiClient.post(
        `/_api/customer/templates/${selectedTemplate.id}/deploy`,
        {
          domain,
          deployName: deploymentData.deployName,
          variables: deploymentVariables,
        }
      );
      setOpenDeployDialog(false);
      toast.success(`Deployed ${selectedTemplate.name} to ${domain}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to deploy template');
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Deployment Templates</h1>
        <p className="text-gray-600 mt-1">
          Pre-configured stacks you can deploy to your account in one click.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No templates available yet. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const Icon = categoryIcons[template.category] || Database;
            return (
              <div
                key={template.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div
                        className={`p-3 rounded-lg bg-gradient-to-br ${
                          categoryGradients[template.category] || 'from-gray-500 to-gray-600'
                        } text-white`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="ml-4">
                        <h3 className="font-semibold text-lg text-gray-900">{template.name}</h3>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                            categoryColors[template.category] ||
                            'bg-gray-100 text-gray-800 border-gray-200'
                          } border`}
                        >
                          {template.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p
                    className="text-gray-600 text-sm mb-4 overflow-hidden"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {template.description || 'No description provided'}
                  </p>

                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {template.variables && template.variables.length > 0 && (
                    <p className="text-xs text-gray-500 mb-4">
                      {template.variables.length} configurable variable(s)
                    </p>
                  )}

                  <div className="flex items-center justify-end pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleDeployTemplate(template)}
                      className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm rounded-lg hover:from-green-600 hover:to-green-700 transition-all"
                    >
                      <Rocket className="w-4 h-4 mr-1" />
                      Deploy
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                  Deployment name *
                </label>
                <input
                  type="text"
                  value={deploymentData.deployName}
                  onChange={(e) =>
                    setDeploymentData({ ...deploymentData, deployName: e.target.value })
                  }
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
                  onChange={(e) =>
                    setDeploymentData({ ...deploymentData, hostname: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="my-app.example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to auto-generate from your account.
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
                    onChange={(e) =>
                      setDeploymentVariables({
                        ...deploymentVariables,
                        [variable.name]: e.target.value,
                      })
                    }
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
                disabled={!deploymentData.deployName || deploying}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deploying ? 'Deploying…' : 'Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Templates;
