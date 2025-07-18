import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, Route } from '../services/api';
import { toast } from 'sonner';
import { AppmintForm } from '@appmint/form';
import { 
  Upload, 
  Globe, 
  Server, 
  Code2, 
  Settings,
  ArrowLeft,
  Rocket
} from 'lucide-react';

const deploySchema = {
  fields: [
    {
      name: 'domain',
      label: 'Domain',
      type: 'text',
      required: true,
      placeholder: 'myapp.example.com',
      description: 'The domain name for your application',
      validation: {
        pattern: /^[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,}$/,
        message: 'Please enter a valid domain name'
      }
    },
    {
      name: 'customerId',
      label: 'Customer ID',
      type: 'text',
      required: true,
      placeholder: 'customer-123',
      description: 'Unique identifier for the customer'
    },
    {
      name: 'buildPath',
      label: 'Build Path',
      type: 'text',
      required: true,
      placeholder: '/path/to/your/app',
      description: 'Absolute path to your application directory'
    },
    {
      name: 'framework',
      label: 'Framework',
      type: 'select',
      required: true,
      options: [
        { value: 'remix', label: 'Remix' },
        { value: 'nextjs', label: 'Next.js' },
        { value: 'express', label: 'Express' },
        { value: 'static', label: 'Static Files' }
      ],
      defaultValue: 'express'
    },
    {
      name: 'memory',
      label: 'Memory Limit',
      type: 'text',
      placeholder: '512MB',
      defaultValue: '512MB',
      description: 'Memory allocation for the application'
    },
    {
      name: 'cpu',
      label: 'CPU Limit',
      type: 'text',
      placeholder: '0.5',
      defaultValue: '0.5',
      description: 'CPU allocation (e.g., 0.5 = 50% of one core)'
    },
    {
      name: 'env',
      label: 'Environment Variables',
      type: 'textarea',
      placeholder: 'KEY=value\nANOTHER_KEY=another_value',
      description: 'One per line in KEY=value format',
      rows: 4
    }
  ],
  submit: {
    text: 'Deploy Application',
    icon: Upload
  }
};

export default function DeployForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<any>({});
  const [isDeploying, setIsDeploying] = useState(false);

  const deployMutation = useMutation({
    mutationFn: (data: Route) => api.createRoute(data),
    onSuccess: () => {
      toast.success('Application deployed successfully!');
      setTimeout(() => navigate('/applications'), 1500);
    },
    onError: (error: Error) => {
      toast.error(`Deployment failed: ${error.message}`);
      setIsDeploying(false);
    }
  });

  const handleFormChange = (path: string, value: any, data: any) => {
    setFormData(data);
  };

  const handleSubmit = () => {
    setIsDeploying(true);
    
    const envVars = formData.env
      ? formData.env.split('\n').reduce((acc, line) => {
          const [key, value] = line.split('=');
          if (key && value) acc[key.trim()] = value.trim();
          return acc;
        }, {} as Record<string, string>)
      : undefined;

    deployMutation.mutate({
      domain: formData.domain,
      customerId: formData.customerId,
      spinletId: `spin-${Date.now()}`,
      buildPath: formData.buildPath,
      framework: formData.framework,
      config: {
        memory: formData.memory,
        cpu: formData.cpu,
        env: envVars,
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/applications')}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applications
          </button>
        </div>
        
        <div className="flex items-center">
          <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl mr-4">
            <Rocket className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deploy New Application</h1>
            <p className="mt-1 text-sm text-gray-600">
              Configure and deploy your application to the SpinForge platform
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-full">
              <Globe className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Step 1</p>
              <p className="text-xs text-gray-500">Basic Configuration</p>
            </div>
          </div>
          
          <div className="h-0.5 w-16 bg-gray-200"></div>
          
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-gray-200 text-gray-400 rounded-full">
              <Server className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-400">Step 2</p>
              <p className="text-xs text-gray-400">Resource Allocation</p>
            </div>
          </div>
          
          <div className="h-0.5 w-16 bg-gray-200"></div>
          
          <div className="flex items-center">
            <div className="flex items-center justify-center w-10 h-10 bg-gray-200 text-gray-400 rounded-full">
              <Settings className="h-5 w-5" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-400">Step 3</p>
              <p className="text-xs text-gray-400">Environment Setup</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className={isDeploying ? 'pointer-events-none opacity-50' : ''}>
          <AppmintForm 
            schema={deploySchema}
            id="deploy-form"
            data={formData}
            onChange={handleFormChange}
          />
          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/applications')}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isDeploying || !formData.domain || !formData.customerId || !formData.buildPath}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? 'Deploying...' : 'Deploy Application'}
            </button>
          </div>
        </div>
        
        {isDeploying && (
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mr-3"></div>
              <p className="text-sm font-medium text-indigo-900">
                Deploying your application... This may take a few moments.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Deployment Tips</h3>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• Ensure your domain points to the SpinForge cluster</li>
          <li>• Build path should contain a valid package.json or Dockerfile</li>
          <li>• Start with minimal resources and scale up as needed</li>
          <li>• Environment variables are encrypted at rest</li>
        </ul>
      </div>
    </div>
  );
}