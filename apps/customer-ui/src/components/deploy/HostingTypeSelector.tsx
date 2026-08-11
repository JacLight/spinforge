/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { Globe, Server, Package, FolderOpen } from 'lucide-react';

interface HostingType {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

interface HostingTypeSelectorProps {
  selectedType: string;
  onSelectType: (type: string) => void;
}

const hostingTypes: HostingType[] = [
  {
    id: "static",
    label: "Static Site",
    icon: FolderOpen,
    description: "HTML, CSS, JS files",
  },
  {
    id: "container",
    label: "Docker Container",
    icon: Package,
    description: "Deploy any Docker image",
    badge: "Popular",
  },
  {
    id: "proxy",
    label: "Reverse Proxy",
    icon: Server,
    description: "Forward to external URL",
  },
  {
    id: "loadbalancer",
    label: "Load Balancer",
    icon: Globe,
    description: "Distribute traffic",
  },
];

export default function HostingTypeSelector({ selectedType, onSelectType }: HostingTypeSelectorProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Hosting Type</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {hostingTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;
          
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onSelectType(type.id)}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {type.badge && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                  {type.badge}
                </span>
              )}
              <Icon className={`h-8 w-8 mb-3 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
              <h3 className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                {type.label}
              </h3>
              <p className={`text-sm mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                {type.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}