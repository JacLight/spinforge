/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useEffect } from 'react';
import { FolderOpen, FileText, ChevronRight, Home, RefreshCw } from 'lucide-react';
import { hostingAPI } from '../../services/hosting-api';
import { SpinForgeContainer } from './ContainerSlideoutPanel';

interface ContainerFilesTabProps {
  container: SpinForgeContainer;
}

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size?: string;
  permissions?: string;
  modified?: string;
}

export function ContainerFilesTab({ container }: ContainerFilesTabProps) {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pathHistory, setPathHistory] = useState<string[]>(['/']);

  const fetchFiles = async (path: string = '/') => {
    setIsLoading(true);
    try {
      const filesData = await hostingAPI.getContainerFiles(container.domain, path);
      setFiles(filesData || []);
      setCurrentPath(path);
    } catch (error) {
      setFiles([]);
      console.error('Failed to fetch files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToDirectory = (dirName: string) => {
    const newPath = currentPath === '/' ? `/${dirName}` : `${currentPath}/${dirName}`;
    setPathHistory(prev => [...prev, newPath]);
    fetchFiles(newPath);
  };

  const navigateToPath = (path: string) => {
    setPathHistory(prev => [...prev, path]);
    fetchFiles(path);
  };

  const goBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1);
      setPathHistory(newHistory);
      fetchFiles(newHistory[newHistory.length - 1]);
    }
  };

  const goHome = () => {
    setPathHistory(['/']);
    fetchFiles('/');
  };

  useEffect(() => {
    fetchFiles('/');
  }, [container.domain]);

  const formatFileSize = (size: string | undefined) => {
    if (!size || size === '-') return '-';
    const bytes = parseInt(size);
    if (isNaN(bytes)) return size;
    
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="h-full flex flex-col">
      {/* Navigation Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={goHome}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Go to root"
            >
              <Home className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={goBack}
              disabled={pathHistory.length <= 1}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              title="Go back"
            >
              <ChevronRight className="h-4 w-4 text-gray-600 rotate-180" />
            </button>
            <button
              onClick={() => fetchFiles(currentPath)}
              disabled={isLoading}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>Path:</span>
          <span className="font-mono bg-white px-2 py-1 rounded border">{currentPath}</span>
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Loading files...</p>
            </div>
          </div>
        ) : files.length > 0 ? (
          <div className="divide-y">
            {files.map((file, index) => (
              <div
                key={index}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${
                  file.type === 'directory' ? 'cursor-pointer' : 'cursor-default'
                }`}
                onClick={() => file.type === 'directory' && navigateToDirectory(file.name)}
              >
                <div className="flex items-center space-x-3 flex-1">
                  {file.type === 'directory' ? (
                    <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  )}
                  <span className="text-sm font-mono truncate">{file.name}</span>
                </div>
                
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  {file.permissions && (
                    <span className="font-mono">{file.permissions}</span>
                  )}
                  <span className="w-16 text-right">{formatFileSize(file.size)}</span>
                  {file.modified && (
                    <span className="w-24 text-right">{file.modified}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FolderOpen className="h-8 w-8 mx-auto mb-2" />
              <p>No files found</p>
              <p className="text-sm mt-1">This directory appears to be empty</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}