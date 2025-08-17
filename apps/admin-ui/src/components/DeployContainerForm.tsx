import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Container, 
  FileCode, 
  Upload, 
  Wand2, 
  ArrowRight, 
  ArrowLeft,
  Check,
  AlertCircle,
  Globe,
  Network,
  Settings,
  Plus,
  Trash2,
  Copy,
  FileText,
  Terminal,
  Database,
  Server,
  Cloud,
  Package,
  Loader2,
  Sparkles,
  Cpu,
  HardDrive,
  Zap,
  Shield,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { hostingAPI } from '../services/hosting-api';
import yaml from 'js-yaml';

interface ServiceConfig {
  name: string;
  image: string;
  ports: string[];
  environment: Record<string, string>;
  volumes: string[];
  subdomain: string;
  icon?: React.ReactNode;
}

interface DeployContainerFormProps {
  onClose?: () => void;
}

export default function DeployContainerForm({ onClose }: DeployContainerFormProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [deployMethod, setDeployMethod] = useState<'wizard' | 'compose'>('wizard');
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  
  // Wizard state
  const [wizardData, setWizardData] = useState({
    appType: '',
    domain: '',
    customerEmail: '',
    appName: '',
    databaseType: '',
    enableCache: false,
    enableCdn: false,
    resourceLimit: 'small'
  });
  
  // Compose state
  const [composeContent, setComposeContent] = useState('');
  const [parsedServices, setParsedServices] = useState<ServiceConfig[]>([]);
  const [mainDomain, setMainDomain] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [enableSSL, setEnableSSL] = useState(false);
  
  // App type templates for wizard with gradient colors
  const appTemplates = [
    { 
      id: 'wordpress', 
      name: 'WordPress', 
      icon: <Globe className="h-6 w-6" />,
      description: 'Blog & CMS platform',
      gradient: 'from-blue-500 to-indigo-600',
      services: ['wordpress', 'mysql'],
      requiresDb: true
    },
    { 
      id: 'nodejs', 
      name: 'Node.js', 
      icon: <Terminal className="h-6 w-6" />,
      description: 'Express, NestJS',
      gradient: 'from-green-500 to-emerald-600',
      services: ['app'],
      requiresDb: false
    },
    { 
      id: 'nextjs', 
      name: 'Next.js', 
      icon: <Zap className="h-6 w-6" />,
      description: 'React framework',
      gradient: 'from-gray-700 to-gray-900',
      services: ['app'],
      requiresDb: false
    },
    { 
      id: 'django', 
      name: 'Django', 
      icon: <Server className="h-6 w-6" />,
      description: 'Python framework',
      gradient: 'from-emerald-500 to-teal-600',
      services: ['app', 'postgres'],
      requiresDb: true
    },
    { 
      id: 'rails', 
      name: 'Rails', 
      icon: <Database className="h-6 w-6" />,
      description: 'Ruby framework',
      gradient: 'from-red-500 to-rose-600',
      services: ['app', 'postgres', 'redis'],
      requiresDb: true
    },
    { 
      id: 'custom', 
      name: 'Custom', 
      icon: <Package className="h-6 w-6" />,
      description: 'Build your own',
      gradient: 'from-purple-500 to-pink-600',
      services: [],
      requiresDb: false
    }
  ];

  // Resource presets with modern icons
  const resourcePresets = [
    { id: 'small', name: 'Starter', cpu: '0.5', memory: '512MB', icon: <Zap className="h-5 w-5" />, color: 'text-green-600' },
    { id: 'medium', name: 'Standard', cpu: '1', memory: '1GB', icon: <Cpu className="h-5 w-5" />, color: 'text-blue-600' },
    { id: 'large', name: 'Performance', cpu: '2', memory: '2GB', icon: <Server className="h-5 w-5" />, color: 'text-purple-600' },
    { id: 'xlarge', name: 'Enterprise', cpu: '4', memory: '4GB', icon: <Shield className="h-5 w-5" />, color: 'text-orange-600' }
  ];

  // Parse docker-compose content
  const parseDockerCompose = (content: string) => {
    try {
      const compose = yaml.load(content) as any;
      const services: ServiceConfig[] = [];
      
      if (compose.services) {
        Object.entries(compose.services).forEach(([name, config]: [string, any]) => {
          const service: ServiceConfig = {
            name,
            image: config.image || 'custom-build',
            ports: [],
            environment: {},
            volumes: [],
            subdomain: name.toLowerCase()
          };
          
          // Extract ports
          if (config.ports) {
            service.ports = config.ports.map((p: string) => {
              const port = p.split(':').pop() || p;
              return port.split('/')[0];
            });
          }
          
          // Extract environment
          if (config.environment) {
            if (Array.isArray(config.environment)) {
              config.environment.forEach((env: string) => {
                const [key, value] = env.split('=');
                if (key) service.environment[key] = value || '';
              });
            } else {
              service.environment = config.environment;
            }
          }
          
          // Extract volumes
          if (config.volumes) {
            service.volumes = config.volumes;
          }
          
          // Assign icon based on common service names
          if (name.includes('mysql') || name.includes('mariadb')) {
            service.icon = <Database className="h-5 w-5" />;
          } else if (name.includes('postgres')) {
            service.icon = <Database className="h-5 w-5" />;
          } else if (name.includes('redis')) {
            service.icon = <Server className="h-5 w-5" />;
          } else if (name.includes('nginx')) {
            service.icon = <Globe className="h-5 w-5" />;
          } else {
            service.icon = <Container className="h-5 w-5" />;
          }
          
          services.push(service);
        });
      }
      
      setParsedServices(services);
      return true;
    } catch (error) {
      console.error('Failed to parse docker-compose:', error);
      toast.error('Invalid docker-compose format');
      return false;
    }
  };

  // Generate docker-compose from wizard
  const generateComposeFromWizard = () => {
    const template = appTemplates.find(t => t.id === wizardData.appType);
    if (!template) return null;

    const compose: any = {
      version: '3.8',
      services: {}
    };

    // Add main app service
    if (wizardData.appType === 'wordpress') {
      compose.services.wordpress = {
        image: 'wordpress:latest',
        ports: ['80'],
        environment: {
          WORDPRESS_DB_HOST: 'mysql',
          WORDPRESS_DB_NAME: 'wordpress',
          WORDPRESS_DB_USER: 'wordpress',
          WORDPRESS_DB_PASSWORD: generatePassword()
        },
        volumes: ['wordpress_data:/var/www/html']
      };
      
      compose.services.mysql = {
        image: 'mysql:8.0',
        ports: ['3306'],
        environment: {
          MYSQL_DATABASE: 'wordpress',
          MYSQL_USER: 'wordpress',
          MYSQL_PASSWORD: generatePassword(),
          MYSQL_ROOT_PASSWORD: generatePassword()
        },
        volumes: ['mysql_data:/var/lib/mysql']
      };
      
      compose.volumes = {
        wordpress_data: {},
        mysql_data: {}
      };
    } else if (wizardData.appType === 'nodejs') {
      compose.services.app = {
        image: 'node:18-alpine',
        working_dir: '/app',
        command: 'npm start',
        ports: ['3000'],
        environment: {
          NODE_ENV: 'production'
        },
        volumes: ['./app:/app']
      };
    } else if (wizardData.appType === 'nextjs') {
      compose.services.app = {
        image: 'node:18-alpine',
        working_dir: '/app',
        command: 'npm run start',
        ports: ['3000'],
        environment: {
          NODE_ENV: 'production'
        },
        volumes: ['./app:/app']
      };
    }

    // Add database if selected
    if (wizardData.databaseType && wizardData.databaseType !== 'none') {
      if (wizardData.databaseType === 'mysql') {
        compose.services.mysql = {
          image: 'mysql:8.0',
          ports: ['3306'],
          environment: {
            MYSQL_DATABASE: wizardData.appName || 'app',
            MYSQL_USER: 'appuser',
            MYSQL_PASSWORD: generatePassword(),
            MYSQL_ROOT_PASSWORD: generatePassword()
          },
          volumes: ['mysql_data:/var/lib/mysql']
        };
      } else if (wizardData.databaseType === 'postgres') {
        compose.services.postgres = {
          image: 'postgres:15',
          ports: ['5432'],
          environment: {
            POSTGRES_DB: wizardData.appName || 'app',
            POSTGRES_USER: 'appuser',
            POSTGRES_PASSWORD: generatePassword()
          },
          volumes: ['postgres_data:/var/lib/postgresql/data']
        };
      }
    }

    // Add Redis if cache enabled
    if (wizardData.enableCache) {
      compose.services.redis = {
        image: 'redis:alpine',
        ports: ['6379']
      };
    }

    return yaml.dump(compose);
  };

  // Generate random password
  const generatePassword = () => {
    return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setComposeContent(content);
        parseDockerCompose(content);
      };
      reader.readAsText(file);
    }
  };

  // Handle deployment
  const handleDeploy = async () => {
    setIsDeploying(true);
    
    try {
      let composeYaml = '';
      let domain = '';
      let email = '';
      
      if (deployMethod === 'wizard') {
        composeYaml = generateComposeFromWizard() || '';
        domain = wizardData.domain;
        email = wizardData.customerEmail;
      } else {
        composeYaml = composeContent;
        domain = mainDomain;
        email = customerEmail;
      }
      
      if (!composeYaml || !domain || !email) {
        toast.error('Please fill in all required fields');
        setIsDeploying(false);
        return;
      }
      
      // Create properly structured payload for /api/sites endpoint
      const payload = {
        domain: domain,
        type: 'compose' as const,
        compose: composeYaml,  // The docker-compose.yml content as string
        customerId: email,
        enabled: true,
        ssl_enabled: enableSSL,  // Use the SSL toggle state
      };
      
      // Deploy using the standard /api/sites endpoint
      const response = await hostingAPI.createVHost(payload as any);
      
      toast.success('Docker Compose deployment started successfully!');
      
      // Optional: Check readiness after deployment
      setTimeout(async () => {
        try {
          const readiness = await hostingAPI.checkReadiness(domain);
          if (readiness.ready) {
            toast.success(`Application is ready at ${domain}!`);
          }
        } catch (e) {
          // Ignore readiness check errors
        }
      }, 5000);
      
      navigate('/applications');
    } catch (error: any) {
      console.error('Deployment failed:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to deploy application');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50/50 to-purple-50/50 z-50 overflow-y-auto">
      {/* Glassmorphic Background Overlay */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-xl" />
      
      {/* Content Container */}
      <div className="relative min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          {/* Modern Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onClose ? onClose() : navigate(-1)}
                  className="p-2.5 bg-white/80 backdrop-blur-xl rounded-xl hover:bg-white/90 transition-all border border-white/20 shadow-lg"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-700" />
                </button>
                
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Container Deployment Wizard
                  </h1>
                  <p className="text-gray-600 mt-1">Deploy containerized applications with ease</p>
                </div>
              </div>
              
              <button
                onClick={() => onClose ? onClose() : navigate(-1)}
                className="p-2.5 bg-white/80 backdrop-blur-xl rounded-xl hover:bg-white/90 transition-all border border-white/20 shadow-lg"
              >
                <X className="h-5 w-5 text-gray-700" />
              </button>
            </div>
          </motion.div>

          {/* Deployment Method Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid md:grid-cols-2 gap-6 mb-8"
          >
            <button
              onClick={() => setDeployMethod('wizard')}
              className={`group relative p-8 rounded-3xl backdrop-blur-xl border-2 transition-all duration-300 ${
                deployMethod === 'wizard'
                  ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/50 shadow-2xl scale-[1.02]'
                  : 'bg-white/60 border-white/20 hover:bg-white/80 hover:border-gray-200 hover:shadow-xl'
              }`}
            >
              {deployMethod === 'wizard' && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl" />
              )}
              
              <div className="relative z-10">
                <div className={`w-16 h-16 mb-4 rounded-2xl flex items-center justify-center ${
                  deployMethod === 'wizard' 
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <Wand2 className="h-8 w-8" />
                </div>
                
                <h3 className="text-xl font-bold mb-2 text-gray-900">Guided Wizard</h3>
                <p className="text-gray-600">Step-by-step deployment for popular stacks</p>
                
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <span className="text-gray-500">Recommended for beginners</span>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setDeployMethod('compose')}
              className={`group relative p-8 rounded-3xl backdrop-blur-xl border-2 transition-all duration-300 ${
                deployMethod === 'compose'
                  ? 'bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/50 shadow-2xl scale-[1.02]'
                  : 'bg-white/60 border-white/20 hover:bg-white/80 hover:border-gray-200 hover:shadow-xl'
              }`}
            >
              {deployMethod === 'compose' && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-3xl" />
              )}
              
              <div className="relative z-10">
                <div className={`w-16 h-16 mb-4 rounded-2xl flex items-center justify-center ${
                  deployMethod === 'compose' 
                    ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <FileCode className="h-8 w-8" />
                </div>
                
                <h3 className="text-xl font-bold mb-2 text-gray-900">Docker Compose</h3>
                <p className="text-gray-600">Upload or paste your compose file</p>
                
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="text-gray-500">For advanced users</span>
                </div>
              </div>
            </button>
          </motion.div>

          {/* Wizard Mode */}
          {deployMethod === 'wizard' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8"
            >
              {/* Modern Progress Steps */}
              <div className="mb-8">
                <div className="flex items-center justify-between relative">
                  {/* Progress Line */}
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                      style={{ width: `${(currentStep - 1) * 33.33}%` }}
                    />
                  </div>
                  
                  {/* Step Indicators */}
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="relative z-10">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: currentStep >= step ? 1 : 0.8 }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                          currentStep > step
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                            : currentStep === step
                            ? 'bg-white border-2 border-blue-500 text-blue-600 shadow-lg'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {currentStep > step ? <Check className="h-5 w-5" /> : step}
                      </motion.div>
                      <p className={`text-xs mt-2 font-medium ${
                        currentStep >= step ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {step === 1 && 'Application'}
                        {step === 2 && 'Configuration'}
                        {step === 3 && 'Services'}
                        {step === 4 && 'Review'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {/* Step 1: Choose Application */}
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h3 className="text-2xl font-bold mb-6 text-gray-900">Choose Your Application</h3>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      {appTemplates.map((template) => (
                        <motion.button
                          key={template.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setWizardData({ ...wizardData, appType: template.id });
                            setTimeout(() => setCurrentStep(2), 300);
                          }}
                          className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 ${
                            wizardData.appType === template.id
                              ? 'bg-gradient-to-br from-white to-gray-50 border-blue-500 shadow-xl'
                              : 'bg-white/60 border-gray-200 hover:border-gray-300 hover:shadow-lg'
                          }`}
                        >
                          <div className={`w-14 h-14 mb-4 rounded-xl bg-gradient-to-br ${template.gradient} flex items-center justify-center text-white shadow-lg`}>
                            {template.icon}
                          </div>
                          
                          <h4 className="font-bold text-gray-900 mb-1">{template.name}</h4>
                          <p className="text-sm text-gray-600">{template.description}</p>
                          
                          {wizardData.appType === template.id && (
                            <div className="absolute top-3 right-3">
                              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Basic Configuration */}
                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-2xl font-bold text-gray-900">Basic Configuration</h3>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Domain Name
                        </label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <input
                            type="text"
                            value={wizardData.domain}
                            onChange={(e) => setWizardData({ ...wizardData, domain: e.target.value })}
                            placeholder="myapp.example.com"
                            className="w-full pl-10 pr-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Customer Email
                        </label>
                        <input
                          type="email"
                          value={wizardData.customerEmail}
                          onChange={(e) => setWizardData({ ...wizardData, customerEmail: e.target.value })}
                          placeholder="customer@example.com"
                          className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Application Name
                        </label>
                        <input
                          type="text"
                          value={wizardData.appName}
                          onChange={(e) => setWizardData({ ...wizardData, appName: e.target.value })}
                          placeholder="My Awesome App"
                          className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setCurrentStep(3)}
                        disabled={!wizardData.domain || !wizardData.customerEmail}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
                      >
                        Continue
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Additional Services */}
                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-2xl font-bold text-gray-900">Additional Services</h3>
                    
                    <div className="space-y-6">
                      {/* Database Selection */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Database
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {['none', 'mysql', 'postgres', 'mongodb'].map((db) => (
                            <button
                              key={db}
                              onClick={() => setWizardData({ ...wizardData, databaseType: db })}
                              className={`p-3 rounded-xl border-2 font-medium transition-all ${
                                wizardData.databaseType === db
                                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-transparent'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {db === 'none' ? 'No Database' : db.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Additional Features */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          wizardData.enableCache 
                            ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={wizardData.enableCache}
                            onChange={(e) => setWizardData({ ...wizardData, enableCache: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                            wizardData.enableCache ? 'bg-red-500' : 'bg-gray-200'
                          }`}>
                            {wizardData.enableCache && <Check className="h-4 w-4 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Redis Cache</p>
                            <p className="text-sm text-gray-600">Speed up your application</p>
                          </div>
                        </label>
                        
                        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          wizardData.enableCdn 
                            ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}>
                          <input
                            type="checkbox"
                            checked={wizardData.enableCdn}
                            onChange={(e) => setWizardData({ ...wizardData, enableCdn: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                            wizardData.enableCdn ? 'bg-blue-500' : 'bg-gray-200'
                          }`}>
                            {wizardData.enableCdn && <Check className="h-4 w-4 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">CDN</p>
                            <p className="text-sm text-gray-600">Global content delivery</p>
                          </div>
                        </label>
                      </div>
                      
                      {/* Resource Allocation */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Resource Allocation
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {resourcePresets.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => setWizardData({ ...wizardData, resourceLimit: preset.id })}
                              className={`p-4 rounded-xl border-2 transition-all ${
                                wizardData.resourceLimit === preset.id
                                  ? 'bg-gradient-to-br from-white to-gray-50 border-blue-500 shadow-lg'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className={`mb-2 ${preset.color}`}>
                                {preset.icon}
                              </div>
                              <p className="font-semibold text-gray-900">{preset.name}</p>
                              <p className="text-xs text-gray-600">{preset.cpu} CPU</p>
                              <p className="text-xs text-gray-600">{preset.memory} RAM</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          const compose = generateComposeFromWizard();
                          if (compose) {
                            setComposeContent(compose);
                            parseDockerCompose(compose);
                            setCurrentStep(4);
                          }
                        }}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg font-medium transition-all"
                      >
                        Review Deployment
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Review & Deploy */}
                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-2xl font-bold text-gray-900">Review & Deploy</h3>
                    
                    {/* Configuration Summary */}
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
                      <h4 className="font-semibold text-gray-900 mb-4">Configuration Summary</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Application</p>
                          <p className="font-semibold text-gray-900">
                            {appTemplates.find(t => t.id === wizardData.appType)?.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Domain</p>
                          <p className="font-semibold text-gray-900">{wizardData.domain}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Resources</p>
                          <p className="font-semibold text-gray-900">
                            {resourcePresets.find(p => p.id === wizardData.resourceLimit)?.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Database</p>
                          <p className="font-semibold text-gray-900">
                            {wizardData.databaseType === 'none' ? 'None' : wizardData.databaseType?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Services to Deploy */}
                    {parsedServices.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Services to Deploy</h4>
                        <div className="space-y-3">
                          {parsedServices.map((service, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center text-gray-600">
                                  {service.icon}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{service.name}</p>
                                  <p className="text-sm text-gray-600">{service.image}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">
                                  {service.subdomain === 'main' || service.subdomain === 'app'
                                    ? wizardData.domain
                                    : `${service.subdomain}.${wizardData.domain}`}
                                </p>
                                {service.ports.length > 0 && (
                                  <p className="text-xs text-gray-500">Port: {service.ports[0]}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => setCurrentStep(3)}
                        className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleDeploy}
                        disabled={isDeploying}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center gap-2"
                      >
                        {isDeploying ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Deploying...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5" />
                            Deploy Application
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Compose Mode */}
          {deployMethod === 'compose' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8 space-y-6"
            >
              <h3 className="text-2xl font-bold text-gray-900">Docker Compose Configuration</h3>
              
              {/* Domain and Email */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Main Domain
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={mainDomain}
                      onChange={(e) => setMainDomain(e.target.value)}
                      placeholder="myapp.example.com"
                      className="w-full pl-10 pr-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              
              {/* SSL Configuration */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">Enable SSL (HTTPS)</p>
                    <p className="text-sm text-gray-600">Secure your application with Let's Encrypt SSL certificate</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableSSL(!enableSSL)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enableSSL ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enableSSL ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              {/* Upload or Paste Compose */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Docker Compose File
                </label>
                
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-xl hover:from-purple-200 hover:to-pink-200 font-medium transition-all flex items-center gap-2"
                  >
                    <Upload className="h-5 w-5" />
                    Upload File
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".yml,.yaml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  {composeContent && (
                    <button
                      onClick={() => {
                        setComposeContent('');
                        setParsedServices([]);
                      }}
                      className="px-6 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                <textarea
                  value={composeContent}
                  onChange={(e) => {
                    setComposeContent(e.target.value);
                    parseDockerCompose(e.target.value);
                  }}
                  placeholder="Paste your docker-compose.yml content here..."
                  className="w-full h-64 px-4 py-3 bg-white/80 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              
              {/* Parsed Services */}
              {parsedServices.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Network className="h-5 w-5 text-purple-600" />
                    Detected Services
                  </h4>
                  
                  <div className="space-y-3">
                    {parsedServices.map((service, idx) => (
                      <div key={idx} className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center text-purple-600">
                              {service.icon}
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900">{service.name}</h5>
                              <p className="text-sm text-gray-600">{service.image}</p>
                            </div>
                          </div>
                          {service.ports.length > 0 && (
                            <div className="text-sm text-gray-600">
                              Ports: {service.ports.join(', ')}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-600">Subdomain:</label>
                          <input
                            type="text"
                            value={service.subdomain}
                            onChange={(e) => {
                              const updated = [...parsedServices];
                              updated[idx].subdomain = e.target.value;
                              setParsedServices(updated);
                            }}
                            className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                            placeholder="subdomain"
                          />
                          <span className="text-sm text-gray-600">.{mainDomain || 'yourdomain.com'}</span>
                        </div>
                        
                        {service.subdomain === 'main' || service.subdomain === 'app' ? (
                          <p className="text-xs text-blue-600 mt-2">
                            This service will be accessible at {mainDomain || 'yourdomain.com'}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-2">
                            Will be accessible at {service.subdomain}.{mainDomain || 'yourdomain.com'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Each service will be deployed with its own subdomain for easy access and management.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Deploy Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleDeploy}
                  disabled={!composeContent || !mainDomain || !customerEmail || isDeploying}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center gap-2"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Container className="h-5 w-5" />
                      Deploy with Docker Compose
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}