/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { hostingAPI } from '@/services/customer-api';
import ApplicationDrawerV2 from '@/components/ApplicationDrawerV2';
import { Loader, AlertCircle } from 'lucide-react';

export default function ApplicationDetail() {
  const params = useParams();
  const domain = params.domain as string;
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // Fetch the vhost data
  const { data: vhost, isLoading, error, refetch } = useQuery({
    queryKey: ['vhost', domain],
    queryFn: () => domain ? hostingAPI.getVHost(domain) : null,
    enabled: !!domain,
  });

  // Handle drawer close - navigate back to applications list
  const handleClose = () => {
    setIsDrawerOpen(false);
    setTimeout(() => router.push('/dashboard/applications'), 300); // Allow animation to complete
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Show error state
  if (error || !vhost) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Not Found</h2>
          <p className="text-gray-600 mb-4">
            The application with domain "{domain}" could not be found.
          </p>
          <button
            onClick={() => router.push('/dashboard/applications')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Applications
          </button>
        </div>
      </div>
    );
  }

  return (
    <ApplicationDrawerV2
      vhost={vhost}
      isOpen={isDrawerOpen}
      onClose={handleClose}
      onRefresh={handleRefresh}
    />
  );
}