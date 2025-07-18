import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, Route } from '../services/api';
import { toast } from 'sonner';
import { AppmintForm } from '@appmint/form';
import { Upload } from 'lucide-react';

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
        pattern: /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/,
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

  const deployMutation = useMutation({
    mutationFn: (data: Route) => api.createRoute(data),
    onSuccess: () => {
      toast.success('Application deployed successfully!');
      setTimeout(() => navigate('/applications'), 1500);
    },
    onError: (error: Error) => {
      toast.error(`Deployment failed: ${error.message}`);
    }
  });

  const handleFormChange = (data: any) => {
    setFormData(data);
  };

  const handleSubmit = () => {
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Deploy New Application</h2>
        <p className="mt-2 text-sm text-gray-600">
          Fill out the form below to deploy your application to SpinForge.
        </p>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
        <AppmintForm 
          schema={deploySchema}
          id="deploy-form"
          data={formData}
          onChange={handleFormChange}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/applications')}
          className="text-sm font-semibold text-gray-900 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}