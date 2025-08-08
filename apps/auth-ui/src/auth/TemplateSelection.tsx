import  { useState } from 'react';
import { IconRenderer } from '@/ui/icons/icon-renderer';

interface TemplateOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'business' | 'marketing' | 'automation' | 'development';
  color: string;
  popular?: boolean;
  comingSoon?: boolean;
}

const templateOptions: TemplateOption[] = [
  {
    id: 'website',
    title: 'Website',
    description: 'Professional websites that convert visitors into customers',
    icon: 'Globe',
    category: 'business',
    color: 'from-blue-500 to-blue-600',
    popular: true,
  },
  {
    id: 'ecommerce',
    title: 'Ecommerce Store',
    description: 'Complete online stores with payment processing',
    icon: 'ShoppingCart',
    category: 'business',
    color: 'from-green-500 to-green-600',
    popular: true,
  },
  {
    id: 'email-campaign',
    title: 'Email Marketing',
    description: 'Automated email campaigns that drive sales',
    icon: 'Mail',
    category: 'marketing',
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'chatbot',
    title: 'AI Chat Bot',
    description: 'Smart chatbots that handle customer support 24/7',
    icon: 'MessageCircle',
    category: 'automation',
    color: 'from-indigo-500 to-indigo-600',
    popular: true,
  },
  {
    id: 'customer-support',
    title: 'Help Desk',
    description: 'Complete customer support and ticketing system',
    icon: 'Headphones',
    category: 'business',
    color: 'from-orange-500 to-orange-600',
  },
  {
    id: 'form',
    title: 'Smart Forms',
    description: 'Dynamic forms with conditional logic and integrations',
    icon: 'FileText',
    category: 'business',
    color: 'from-teal-500 to-teal-600',
  },
  {
    id: 'reservation',
    title: 'Booking System',
    description: 'Appointment scheduling with calendar sync',
    icon: 'Calendar',
    category: 'business',
    color: 'from-pink-500 to-pink-600',
  },
  {
    id: 'mobile-api',
    title: 'Backend API',
    description: 'Backend APIs for mobile and web applications',
    icon: 'Smartphone',
    category: 'development',
    color: 'from-gray-500 to-gray-600',
  },
  {
    id: 'lead-prospecting',
    title: 'Lead Generation',
    description: 'Automated lead finding and outreach campaigns',
    icon: 'Target',
    category: 'marketing',
    color: 'from-red-500 to-red-600',
  },
  {
    id: 'social-media',
    title: 'Social Manager',
    description: 'Schedule and manage all your social media posts',
    icon: 'Share2',
    category: 'marketing',
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    id: 'queue-management',
    title: 'Queue Management',
    description: 'Manage customer queues and waiting lists efficiently',
    icon: 'Users',
    category: 'business',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    id: 'centralized-social',
    title: 'Centralized Social',
    description: 'Unified dashboard for all your social media accounts',
    icon: 'Network',
    category: 'marketing',
    color: 'from-violet-500 to-violet-600',
    popular: true,
  },
  {
    id: 'ads-management',
    title: 'Ads Management',
    description: 'Create and manage advertising campaigns across platforms',
    icon: 'TrendingUp',
    category: 'marketing',
    color: 'from-amber-500 to-amber-600',
  },
  {
    id: 'workflow-automation',
    title: 'Workflow Automation',
    description: 'Automate business processes and workflows',
    icon: 'Zap',
    category: 'automation',
    color: 'from-lime-500 to-lime-600',
  },
  {
    id: 'dashboard-analytics',
    title: 'Analytics Dashboard',
    description: 'Business intelligence and data visualization',
    icon: 'BarChart3',
    category: 'business',
    color: 'from-sky-500 to-sky-600',
  },
];

const categories = {
  business: { name: 'Business', color: 'text-blue-600', icon: 'Building' },
  marketing: { name: 'Marketing', color: 'text-purple-600', icon: 'TrendingUp' },
  automation: { name: 'Automation', color: 'text-green-600', icon: 'Zap' },
  development: { name: 'Development', color: 'text-gray-600', icon: 'Code' },
};

interface TemplateSelectionProps {
  onSelect: (templateId: string) => void;
  onBack: () => void;
}

export function TemplateSelection({ onSelect, onBack }: TemplateSelectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const filteredOptions = selectedCategory === 'all' ? templateOptions : templateOptions.filter(option => option.category === selectedCategory);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    onSelect(templateId);
  };

  return (
    <div className="template-selection w-full">
      {/* Compact Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          What would you like to <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">build?</span>
        </h1>
        <p className="text-gray-600">Choose a template to get started quickly</p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${selectedCategory === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <IconRenderer icon="Grid" className="w-3 h-3 mr-1 inline" />
          All
        </button>
        {Object.entries(categories).map(([key, category]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${selectedCategory === key ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <IconRenderer icon={category.icon} className="w-3 h-3 mr-1 inline" />
            {category.name}
          </button>
        ))}
      </div>

      {/* Templates Grid - Bigger Cards */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 overflow-auto">
        <div className="flex flow-row gap-5">
          {filteredOptions.map(option => (
            <div
              key={option.id}
              onClick={() => handleTemplateSelect(option.id)}
              className={`group relative bg-white rounded-xl flex-shrink-0 border-2 cursor-pointer transition-all duration-300 w-64 hover:shadow-lg hover:-translate-y-1 ${
                selectedTemplate === option.id ? 'border-purple-500 shadow-lg shadow-purple-500/25' : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center shadow-lg`}>
                    <IconRenderer icon={option.icon} className="w-6 h-6 text-white" />
                  </div>
                  {option.popular && (
                    <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                      <IconRenderer icon="Star" className="w-3 h-3 mr-1" />
                      Hot
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">{option.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{option.description}</p>

                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-3 py-1 rounded-full bg-gray-100 ${categories[option.category].color}`}>{categories[option.category].name}</span>
                  <IconRenderer icon="ArrowRight" className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button onClick={onBack} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm">
          <IconRenderer icon="ArrowLeft" className="w-4 h-4 mr-1 inline" />
          Back
        </button>
        <button onClick={() => handleTemplateSelect('custom')} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm">
          <IconRenderer icon="Zap" className="w-4 h-4 mr-1 inline" />
          Skip for Now
        </button>
        {selectedTemplate && (
          <button onClick={() => handleTemplateSelect(selectedTemplate)} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm">
            Continue with {templateOptions.find(t => t.id === selectedTemplate)?.title}
            <IconRenderer icon="ArrowRight" className="w-4 h-4 ml-1 inline" />
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="text-center mt-4">
        <p className="text-gray-500 text-sm">You can always change your template or add more features later.</p>
      </div>
    </div>
  );
}
