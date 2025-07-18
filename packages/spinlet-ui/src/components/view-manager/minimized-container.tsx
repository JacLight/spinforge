'use client';

import React from 'react';
import { IconRenderer } from '../icons/icon-renderer';
import { classNames } from '@/utils/helpers';
import { useSiteStore } from '@/store/site-store';
import { useShallow } from 'zustand/shallow';
import { isEmpty } from '@/utils/helpers';

const getContainerStyles = (position): string => {
  const baseStyles = 'view-manager-container z-[1050] bg-gray-100/90 border border-gray-300 shadow-md p-1';

  switch (position) {
    case 'top':
      return `${baseStyles} top-0 left-0 w-full flex flex-row flex-wrap gap-1`;
    case 'bottom':
      return `${baseStyles} bottom-0 left-0 w-full flex flex-row flex-wrap gap-1`;
    case 'left':
      return `${baseStyles} top-0 left-0 h-full flex flex-col flex-wrap gap-1`;
    case 'right':
      return `${baseStyles} top-0 right-0 h-full flex flex-col flex-wrap gap-1`;
    default:
      return `${baseStyles} bottom-0 left-0 w-full flex flex-row flex-wrap gap-1`;
  }
};

export const MinimizedContainer: React.FC<{ className?; position? }> = ({ className = '', position = 'top' }) => {
  const { minimizedWindows } = useSiteStore(
    useShallow(state => ({
      minimizedWindows: state.minimizedWindows,
    })),
  );

  // If no minimized windows, don't render
  if (isEmpty(minimizedWindows)) {
    return null;
  }

  const isHorizontal = position === 'top' || position === 'bottom';
  return (
    <div className={classNames(getContainerStyles(position), className)}>
      {minimizedWindows?.map(window => (
        <div
          key={window.id}
          className={`
            bg-white rounded-md shadow-sm border border-gray-200 flex items-center justify-between border-t-2 border-t-purple-700
            ${isHorizontal ? 'w-64 h-6' : 'w-48 h-6'}
          `}
        >
          <span className="text-sm px-2">{window.title}</span>
          <div className="flex items-center">
            <button onClick={window.onRestore} className="p-1 hover:bg-gray-200 rounded" title="Restore">
              <IconRenderer icon="Maximize" size={16} />
            </button>
            <button
              onClick={() => {
                window.onClose();
              }}
              className="p-1 hover:bg-gray-200 rounded"
              title="Close"
            >
              <IconRenderer icon="X" size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
