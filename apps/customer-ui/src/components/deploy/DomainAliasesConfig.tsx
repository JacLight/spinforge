/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { X, Plus } from 'lucide-react';

interface DomainAliasesConfigProps {
  domain: string;
  aliases: string[];
  onDomainChange: (domain: string) => void;
  onAliasesChange: (aliases: string[]) => void;
}

export default function DomainAliasesConfig({
  domain,
  aliases,
  onDomainChange,
  onAliasesChange,
}: DomainAliasesConfigProps) {
  const addAlias = () => {
    onAliasesChange([...aliases, '']);
  };

  const updateAlias = (index: number, value: string) => {
    const newAliases = [...aliases];
    newAliases[index] = value;
    onAliasesChange(newAliases);
  };

  const removeAlias = (index: number) => {
    onAliasesChange(aliases.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Domain */}
      <div>
        <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
          Domain <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="domain"
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
          placeholder="example.com or app.localhost"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter your full domain (e.g., example.com, app.localhost, staging.mysite.com)
        </p>
      </div>

      {/* Aliases */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Domain Aliases (optional)
        </label>
        <div className="space-y-2">
          {aliases.map((alias, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={alias}
                onChange={(e) => updateAlias(index, e.target.value)}
                className="flex-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                placeholder="www.example.com or staging.localhost"
              />
              <button
                type="button"
                onClick={() => removeAlias(index)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAlias}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Add alias
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Additional domains that will point to the same site
        </p>
      </div>
    </div>
  );
}