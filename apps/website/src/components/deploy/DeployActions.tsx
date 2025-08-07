/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DeployActionsProps {
  isSubmitting: boolean;
  onCancel?: () => void;
}

export default function DeployActions({ isSubmitting, onCancel }: DeployActionsProps) {
  const router = useRouter();
  
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/dashboard/applications');
    }
  };

  return (
    <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-200">
      <button
        type="button"
        onClick={handleCancel}
        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
            Deploying...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Deploy Application
          </>
        )}
      </button>
    </div>
  );
}