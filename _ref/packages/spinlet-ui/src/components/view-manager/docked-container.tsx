'use client';

import React, { useEffect, useState } from 'react';
import { classNames } from '@/utils/helpers';
import { useSiteStore } from '@/store/site-store';
import { useShallow } from 'zustand/shallow';

export const DockedContainer: React.FC<{ className? }> = ({ className = '' }) => {
  const { dockedWindows, isDockedOpen, setStateItem } = useSiteStore(
    useShallow(state => ({
      dockedWindows: state.dockedWindows,
      isDockedOpen: state.isDockedOpen,
      setStateItem: state.setStateItem,
    })),
  );

  const [hasDockedContent, setHasDockedContent] = useState(false);
  const [dockedCount, setDockedCount] = useState(0);

  // Monitor the docked container for content changes
  useEffect(() => {
    const container = document.getElementById('docked-windows-container');
    if (!container) return;

    const observer = new MutationObserver(() => {
      const count = container.children.length;
      const hasContent = count > 0;
      const previousHasContent = hasDockedContent;

      setHasDockedContent(hasContent);
      setDockedCount(count);

      // Only auto-show when content is first added (transition from no content to content)
      if (hasContent && !previousHasContent && !isDockedOpen) {
        setStateItem({ isDockedOpen: true });
      }
    });

    observer.observe(container, { childList: true, subtree: true });

    // Initial check
    const count = container.children.length;
    const hasContent = count > 0;
    setHasDockedContent(hasContent);
    setDockedCount(count);

    // Only auto-show on initial load if there's content and container is not open
    if (hasContent && !isDockedOpen) {
      setStateItem({ isDockedOpen: true });
    }

    return () => observer.disconnect();
  }, [setStateItem]);

  return (
    <div className={classNames('h-full w-[490px] flex-shrink-0 transition-all duration-300', hasDockedContent && isDockedOpen ? 'translate-x-0' : 'translate-x-full w-0')}>
      <div className={classNames('h-full w-full bg-white border-l border-gray-200 shadow-lg', className)}>
        <div className="flex-1 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto  h-full space-y-2 p-2" id="docked-windows-container">
            {/* ViewManager will render docked windows here automatically */}
          </div>
        </div>
      </div>
    </div>
  );
};
