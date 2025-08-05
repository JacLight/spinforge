/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  Plus,
  ExternalLink,
  Shield,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import axios from "axios";

export default function DomainsPage() {
  const [showAddDomain, setShowAddDomain] = useState(false);
  const { user } = useAuth();

  // Fetch domains from deployments
  const { data: deployments = [], isLoading } = useQuery({
    queryKey: ["deployments", user?.customerId],
    queryFn: async () => {
      const response = await axios.get("/api/deployments");
      return response.data;
    },
    enabled: !!user?.customerId,
  });

  // Extract unique domains from deployments
  const domains = deployments.map((deployment: any) => ({
    id: deployment.id,
    domain: deployment.domain,
    deployment: deployment.name,
    status: deployment.status === "running" ? "active" : "inactive",
    ssl: "active", // Assuming SSL is always active
    createdAt: deployment.createdAt,
  }));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="p-6">
      {/* Description */}
      <p className="text-sm text-gray-500 mb-6">
        Manage your custom domains and DNS settings
      </p>

      {/* Add Domain Form */}
      {showAddDomain && (
        <div className="mb-6 bg-white shadow-sm rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add Custom Domain</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Domain Name
              </label>
              <input
                type="text"
                placeholder="example.com"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                After adding your domain, update your DNS records:
              </p>
              <div className="mt-2 font-mono text-xs bg-white rounded p-2">
                CNAME record: your-domain.com → spinforge.app
              </div>
            </div>
            <div className="flex space-x-3">
              <button className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                Add Domain
              </button>
              <button
                onClick={() => setShowAddDomain(false)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domains List */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:p-6">
          {domains.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No domains</h3>
              <p className="mt-1 text-sm text-gray-500">
                Deploy an application to get started with domains.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deployment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SSL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {domains.map((domain) => (
                    <tr key={domain.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Globe className="h-5 w-5 text-gray-400 mr-2" />
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            {domain.domain}
                            <ExternalLink className="inline-block ml-1 h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {domain.deployment}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(domain.status)}
                          <span className="ml-2 text-sm text-gray-700 capitalize">
                            {domain.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-sm text-gray-700">Active</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(domain.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-red-600 hover:text-red-900">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}