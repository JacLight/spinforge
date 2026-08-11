/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React from 'react';
import { useSiteStore } from '../../store/site-store';
import { IconRenderer } from '../icons/icon-renderer';

export const MinimizedContainer: React.FC = () => {
  const minimizedWindows = useSiteStore(state => state.minimizedWindows);

  if (minimizedWindows.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex items-center gap-2 p-2 overflow-x-auto">
        {minimizedWindows.map(window => (
          <button
            key={window.id}
            onClick={window.onRestore}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-fit"
          >
            <IconRenderer icon="Window" size={16} />
            <span className="text-sm font-medium truncate max-w-[200px]">
              {window.title || 'Untitled'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.onClose();
              }}
              className="ml-2 p-1 hover:bg-gray-300 rounded"
            >
              <IconRenderer icon="X" size={14} />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MinimizedContainer;