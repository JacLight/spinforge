/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useRef } from 'react';
import { FileCode, Upload, AlertCircle, Database, Globe, Server, Shield, HardDrive } from 'lucide-react';
import * as yaml from 'js-yaml';

interface AdvancedContainerConfigProps {
  composeYaml: string;
  onComposeYamlChange: (value: string) => void;
  onImportCompose?: (compose: any) => void;
}

const COMPOSE_TEMPLATE = `version: '3.8'

services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./html:/usr/share/nginx/html
    environment:
      - NGINX_HOST=example.com
    depends_on:
      - api
    restart: unless-stopped

  api:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./api:/app
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:pass@db:5432/myapp
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=myapp
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  db_data:`;

export default function AdvancedContainerConfig({
  composeYaml,
  onComposeYamlChange,
  onImportCompose,
}: AdvancedContainerConfigProps) {
  const [importError, setImportError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      
      // Validate YAML
      try {
        const parsed = yaml.load(text);
        if (typeof parsed !== 'object' || !parsed) {
          throw new Error('Invalid YAML structure');
        }
        
        // Check if it's a valid docker-compose file
        if (!('services' in parsed)) {
          throw new Error('Missing "services" section in docker-compose file');
        }
        
        onComposeYamlChange(text);
        setImportError('');
        
        // If there's an import handler, call it with the parsed data
        if (onImportCompose) {
          onImportCompose(parsed);
        }
      } catch (yamlError: any) {
        setImportError(`Invalid YAML: ${yamlError.message}`);
      }
    } catch (error: any) {
      setImportError(`Failed to read file: ${error.message}`);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadTemplate = () => {
    onComposeYamlChange(COMPOSE_TEMPLATE);
    setImportError('');
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Upload className="h-4 w-4 mr-2" />
          Import docker-compose.yml
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yml,.yaml"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <button
          type="button"
          onClick={loadTemplate}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Load template
        </button>
      </div>

      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <div className="ml-2 text-sm text-red-700">
              <p className="font-medium">Import Error</p>
              <p className="text-xs mt-1">{importError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Docker Compose YAML Editor */}
      <div>
        <label htmlFor="composeYaml" className="block text-sm font-medium text-gray-700 mb-2">
          Docker Compose Configuration <span className="text-red-500">*</span>
        </label>
        <textarea
          id="composeYaml"
          value={composeYaml}
          onChange={(e) => onComposeYamlChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-3 px-4 text-sm font-mono bg-gray-50"
          rows={20}
          placeholder="Paste your docker-compose.yml content here..."
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Define your complete application stack with services, networks, volumes, and dependencies
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <Server className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <h5 className="text-sm font-medium text-gray-900">Multi-Service</h5>
          <p className="text-xs text-gray-600 mt-1">Web, API, Workers</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <Database className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <h5 className="text-sm font-medium text-gray-900">Databases</h5>
          <p className="text-xs text-gray-600 mt-1">PostgreSQL, MySQL, MongoDB</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <HardDrive className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <h5 className="text-sm font-medium text-gray-900">Volumes</h5>
          <p className="text-xs text-gray-600 mt-1">Persistent storage</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <Shield className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <h5 className="text-sm font-medium text-gray-900">Networks</h5>
          <p className="text-xs text-gray-600 mt-1">Isolated networking</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-start">
          <FileCode className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-indigo-900">Full Stack Deployment</h4>
            <p className="text-sm text-indigo-700 mt-1">
              Deploy complete applications with multiple services, databases, caching layers, and more.
              Perfect for production-ready applications with complex requirements.
            </p>
            <div className="mt-2 text-xs text-indigo-600">
              <p>• Service discovery and networking</p>
              <p>• Environment-specific configurations</p>
              <p>• Health checks and dependencies</p>
              <p>• Volume management and backups</p>
              <p>• Resource limits and scaling</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}