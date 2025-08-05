/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useRef } from 'react';
import { FolderOpen, Upload, FileArchive, CheckCircle } from 'lucide-react';

interface StaticSiteConfigProps {
  indexFile: string;
  errorFile: string;
  domain: string;
  zipFile?: File | null;
  onIndexFileChange: (value: string) => void;
  onErrorFileChange: (value: string) => void;
  onZipFileChange?: (file: File | null) => void;
}

export default function StaticSiteConfig({
  indexFile,
  errorFile,
  domain,
  zipFile,
  onIndexFileChange,
  onErrorFileChange,
  onZipFileChange,
}: StaticSiteConfigProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file && file.type === 'application/zip' || file.name.endsWith('.zip')) {
      // Check file size
      if (file.size > 100 * 1024 * 1024) {
        alert('File size exceeds 100MB limit. Please use a smaller file.');
        return;
      }
      onZipFileChange?.(file);
    } else {
      alert('Please select a valid ZIP file');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="indexFile" className="block text-sm font-medium text-gray-700 mb-2">
          Index File
        </label>
        <input
          type="text"
          id="indexFile"
          value={indexFile}
          onChange={(e) => onIndexFileChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
          placeholder="index.html"
        />
        <p className="mt-1 text-xs text-gray-500">
          The default file to serve when accessing a directory
        </p>
      </div>

      <div>
        <label htmlFor="errorFile" className="block text-sm font-medium text-gray-700 mb-2">
          Error File
        </label>
        <input
          type="text"
          id="errorFile"
          value={errorFile}
          onChange={(e) => onErrorFileChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
          placeholder="404.html"
        />
        <p className="mt-1 text-xs text-gray-500">
          The file to serve for 404 errors
        </p>
      </div>

      {/* ZIP Upload Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Site Files
        </label>
        <div
          className={`relative rounded-lg border-2 border-dashed transition-colors ${
            isDragging 
              ? 'border-blue-400 bg-blue-50' 
              : zipFile 
                ? 'border-green-400 bg-green-50' 
                : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="p-8 text-center">
            {zipFile ? (
              <div className="space-y-3">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{zipFile.name}</p>
                  <p className={`text-xs ${zipFile.size > 50 * 1024 * 1024 ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                    {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                    {zipFile.size > 50 * 1024 * 1024 && ' (Large file)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZipFileChange?.(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <FileArchive className={`h-12 w-12 mx-auto ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Drop your ZIP file here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum file size: 100MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Upload a ZIP file containing your website files. The contents will be extracted and deployed automatically.
        </p>
      </div>

      {/* Static Site Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <FolderOpen className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-900">Static File Hosting</h4>
            <p className="text-sm text-blue-700 mt-1">
              Upload your static files (HTML, CSS, JS, images) and they'll be served directly.
              Perfect for SPAs, documentation sites, and landing pages.
            </p>
            <div className="mt-2 text-xs text-blue-600">
              <p>• Automatic HTTPS with SSL certificates</p>
              <p>• Global CDN for fast delivery</p>
              <p>• Custom error pages support</p>
            </div>
            {domain && (
              <>
                <p className="text-xs text-blue-700 mt-3">
                  Files will be stored at:
                </p>
                <code className="block mt-2 text-xs bg-blue-100 px-2 py-1 rounded">
                  /hosting/data/static/{domain.replace(/[^a-z0-9.-]/g, '-')}/
                </code>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}