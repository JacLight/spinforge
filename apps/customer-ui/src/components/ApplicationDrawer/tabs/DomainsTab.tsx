import React, { useState } from 'react';
import { Globe, Plus, Trash2, ExternalLink } from 'lucide-react';

interface DomainsTabProps {
  vhost: any;
  isEditing: boolean;
  formData: any;
  setFormData: (data: any) => void;
}

export default function DomainsTab({ vhost, isEditing, formData, setFormData }: DomainsTabProps) {
  const [newDomain, setNewDomain] = useState('');
  const domains = vhost.domains || [vhost.domain];

  const addDomain = () => {
    if (newDomain && !domains.includes(newDomain)) {
      const updatedDomains = [...domains, newDomain];
      setFormData({ ...formData, domains: updatedDomains });
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    if (domain !== vhost.domain) { // Can't remove primary domain
      const updatedDomains = domains.filter((d: string) => d !== domain);
      setFormData({ ...formData, domains: updatedDomains });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Domain Configuration</h2>
      
      {/* Primary Domain */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Primary Domain</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-blue-500" />
            <code className="text-lg font-mono">{vhost.domain}</code>
          </div>
          <a
            href={`https://${vhost.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
          >
            Visit Site
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Additional Domains */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900">Additional Domains</h3>
          {isEditing && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              />
              <button
                onClick={addDomain}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        
        {domains.length > 1 ? (
          <div className="space-y-2">
            {domains.slice(1).map((domain: string) => (
              <div key={domain} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <code className="text-sm">{domain}</code>
                </div>
                {isEditing && (
                  <button
                    onClick={() => removeDomain(domain)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No additional domains configured</p>
        )}
      </div>

      {/* DNS Settings */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-4">DNS Configuration</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Required DNS Records</label>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-2">
              <div>
                <span className="text-gray-500">A Record:</span>
                <br />
                <span className="text-gray-900">{vhost.domain} → Your Server IP</span>
              </div>
              <div>
                <span className="text-gray-500">CNAME Record (for www):</span>
                <br />
                <span className="text-gray-900">www.{vhost.domain} → {vhost.domain}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}