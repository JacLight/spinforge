import React, { useState, useEffect, useRef } from 'react';
import { IconRenderer } from '../icons/icon-renderer';
import { useShallow } from 'zustand/react/shallow';
import { useSiteStore } from '../../store/site-store';
import { createPortal } from 'react-dom';
import { classNames } from '../../utils/helpers';

const calculatePosition = (position, size) => {
  const { x, y } = position;

  if (x === 'center') {
    return { x: (window.innerWidth - size.width) / 2, y };
  }
  if (y === 'center') {
    return { x, y: (window.innerHeight - size.height) / 2 };
  }
  if (x === 'right') {
    return { x: window.innerWidth - size.width, y };
  }
  if (y === 'bottom') {
    return { x, y: window.innerHeight - size.height };
  }
  if (x === 'left') {
    return { x: 0, y };
  }
  if (y === 'top') {
    return { x, y: 0 };
  }
  return { x, y };
};

// Helper function to constrain position to viewport
const constrainToViewport = (pos, boxSize) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const titleBarHeight = 40;

  return {
    x: Math.min(Math.max(0, pos.x), viewportWidth - boxSize.width),
    y: Math.min(Math.max(0, pos.y), viewportHeight - titleBarHeight),
  };
};

const ViewManager = ({
  id,
  children,
  title = '',
  defaultPosition = { x: 'center', y: 'center' },
  defaultSize = { width: 800, height: 600 },
  onClose = () => {},
  isResizable = true,
  compact = false,
  isModal = false,
  canDock = true,
  canMaximize = true,
  docked = false,
  closeOnOutsideClick = false,
  usePortal = false,
  savePosition = true,
  overflow = '',
  zIndex = 1000,
}) => {
  // No need for external store references

  function getStoredValue(key, defaultValue) {
    if (!id || isModal || !savePosition) return defaultValue;
    const stored = localStorage.getItem(`float-box-${id}-${key}`);
    return stored ? JSON.parse(stored) : defaultValue;
  }

  // Get initial position and ensure it's within viewport
  const initialPosition = getStoredValue('position', defaultPosition);
  const initialSize = getStoredValue('size', defaultSize);

  // Check if there's no size defined in props and no size in localStorage
  const effectiveSize = id && localStorage.getItem(`float-box-${id}-size`) ? initialSize : defaultSize;

  // Calculate initial position within viewport
  const calculatedPosition = calculatePosition(initialPosition, effectiveSize);
  const constrainedPosition = constrainToViewport(calculatedPosition, effectiveSize);

  const [position, setPosition] = useState(constrainedPosition);
  const [size, setSize] = useState(effectiveSize);
  const [dockedHeight, setDockedHeight] = useState(getStoredValue('dockedHeight', 600));
  const [windowState, setWindowState] = useState(getStoredValue('windowState', docked ? 'docked' : 'normal'));
  const [stateHistory, setStateHistory] = useState({
    normal: { position: calculatePosition(defaultPosition, defaultSize), size: defaultSize },
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState(null);

  const boxRef: any = useRef(null);
  const dragRef: any = useRef(null);
  const resizeRef: any = useRef(null);
  const menuRef: any = useRef(null);

  const { statusHeight = 0, statusView = '' } = useSiteStore(useShallow(state => ({ statusHeight: state.statusHeight, statusView: state.statusView })));
  const { setStateItem, getStateItem } = useSiteStore.getState();
  const refDocument = window.parent?.document || document;

  // Create portal container if it doesn't exist
  useEffect(() => {
    if (usePortal && typeof document !== 'undefined') {
      // Check if portal container already exists
      let container = refDocument.getElementById('view-manager-portal-container');

      if (!container) {
        // Create portal container if it doesn't exist
        container = refDocument.createElement('div');
        container.id = 'view-manager-portal-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        // The container itself should be transparent to pointer events
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';
        refDocument.body.appendChild(container);
      }

      setPortalContainer(container);
      return () => {
        // Only remove the container if this is the last portal using it
        if (container && container.childElementCount <= 1) {
          refDocument.body.removeChild(container);
        }
      };
    }
  }, [usePortal]);

  // Handle outside clicks for modal and menu
  useEffect(() => {
    const handleClickOutside = event => {
      // Handle menu close
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
      // Handle modal close
      if (isModal && closeOnOutsideClick && boxRef.current && !boxRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    refDocument.addEventListener('mousedown', handleClickOutside);
    return () => refDocument.removeEventListener('mousedown', handleClickOutside);
  }, [isModal, closeOnOutsideClick, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isModal) {
      refDocument.body.style.overflow = 'hidden';
      return () => {
        refDocument.body.style.overflow = 'unset';
      };
    }
  }, [isModal]);

  // Save state to localStorage
  useEffect(() => {
    if (id) {
      const thisWindow = { id, title, content: null, onRestore: restoreToNormal, onClose };
      const minimizedWindows = (getStateItem('minimizedWindows') || []).filter(win => win.id !== id);
      const dockedWindows = (getStateItem('dockedWindows') || []).filter(win => win.id !== id);

      if (windowState === 'minimized') {
        minimizedWindows.push(thisWindow);
      } else if (windowState === 'docked') {
        dockedWindows.push(thisWindow);
      }
      setStateItem({ minimizedWindows, dockedWindows });

      return () => {
        setStateItem({
          minimizedWindows: (getStateItem('minimizedWindows') || []).filter(win => win.id !== id),
          dockedWindows: (getStateItem('dockedWindows') || []).filter(win => win.id !== id),
        });
      };
    }
  }, [windowState]);

  // Save state to localStorage
  useEffect(() => {
    if (id) {
      // Save position and size only when in normal state
      if (windowState === 'normal') {
        localStorage.setItem(`float-box-${id}-position`, JSON.stringify(position));
        localStorage.setItem(`float-box-${id}-size`, JSON.stringify(size));
      }

      // Save window state for normal and docked states, but not for minimized
      if (windowState !== 'minimized') {
        localStorage.setItem(`float-box-${id}-windowState`, JSON.stringify(windowState));
      }

      // Save docked height
      if (windowState === 'docked') {
        localStorage.setItem(`float-box-${id}-dockedHeight`, JSON.stringify(dockedHeight));
      }
    }
  }, [id, position, size, windowState, dockedHeight]);

  // Monitor docked window resize
  useEffect(() => {
    if (windowState === 'docked' && boxRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const newHeight = entry.contentRect.height;
          if (newHeight !== dockedHeight && newHeight >= 400) {
            setDockedHeight(newHeight);
          }
        }
      });

      resizeObserver.observe(boxRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [windowState, dockedHeight]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (windowState === 'normal') {
        setPosition(prev => constrainToViewport(prev, size));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size, windowState]);

  // Dragging and resizing logic
  useEffect(() => {
    const handleMouseMove = e => {
      if (isDragging && windowState === 'normal') {
        const newPosition = {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        };
        setPosition(constrainToViewport(newPosition, size));

        // Prevent default to avoid text selection during drag
        e.preventDefault();
      }

      if (isResizing && windowState === 'normal') {
        const box = boxRef.current.getBoundingClientRect();
        const newWidth = Math.max(200, Math.min(window.innerWidth, e.clientX - box.left));
        const newHeight = Math.max(100, Math.min(window.innerHeight, e.clientY - box.top));
        setSize({ width: newWidth, height: newHeight });
        setPosition(prev => constrainToViewport(prev, { width: newWidth, height: newHeight }));

        // Prevent default to avoid text selection during resize
        e.preventDefault();
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        setStateHistory(prev => ({
          ...prev,
          normal: { position, size },
        }));
      }

      // Remove overlay if it exists
      const overlay = refDocument.getElementById('view-manager-drag-overlay');
      if (overlay) {
        refDocument.body.removeChild(overlay);
      }

      setIsDragging(false);
      setIsResizing(false);

      // Re-enable pointer events on iframes
      const iframes = refDocument.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        iframe.style.pointerEvents = 'auto';
      });
    };

    if (isDragging || isResizing) {
      // Create a full-screen overlay to capture all mouse events
      if (!refDocument.getElementById('view-manager-drag-overlay')) {
        const overlay = refDocument.createElement('div');
        overlay.id = 'view-manager-drag-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.zIndex = '9999';
        overlay.style.cursor = isDragging ? 'move' : 'se-resize';
        // Make it transparent to mouse events but still capture them
        overlay.style.backgroundColor = 'transparent';
        refDocument.body.appendChild(overlay);
      }

      // Disable pointer events on iframes to prevent them from capturing mouse events
      const iframes = refDocument.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        iframe.style.pointerEvents = 'none';
      });

      refDocument.addEventListener('mousemove', handleMouseMove);
      refDocument.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      refDocument.removeEventListener('mousemove', handleMouseMove);
      refDocument.removeEventListener('mouseup', handleMouseUp);

      // Clean up overlay if component unmounts during drag/resize
      const overlay = refDocument.getElementById('view-manager-drag-overlay');
      if (overlay) {
        refDocument.body.removeChild(overlay);
      }

      // Re-enable pointer events on iframes if component unmounts during drag/resize
      const iframes = refDocument.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        iframe.style.pointerEvents = 'auto';
      });
    };
  }, [isDragging, isResizing, dragOffset, windowState, position, size]);

  const handleMouseDown = e => {
    if ((e.target === dragRef.current || e.target.parentElement === dragRef.current) && windowState === 'normal' && !isModal) {
      // Prevent default to avoid text selection and other browser behaviors
      e.preventDefault();
      // Stop propagation to prevent other elements from capturing the event
      e.stopPropagation();

      setIsDragging(true);
      const box = boxRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - box.left,
        y: e.clientY - box.top,
      });
    }
  };

  const handleResizeMouseDown = e => {
    if (isResizable && windowState === 'normal' && !isModal) {
      // Prevent default to avoid text selection and other browser behaviors
      e.preventDefault();
      // Stop propagation to prevent other elements from capturing the event
      e.stopPropagation();

      setIsResizing(true);
    }
  };

  const saveCurrentState = () => {
    setStateHistory(prev => ({
      ...prev,
      [windowState]: { position, size },
    }));
  };

  const restoreToNormal = () => {
    const normalState = stateHistory.normal;
    setPosition(normalState.position);
    setSize(normalState.size);

    // If we're restoring from a minimized state, we need to restore to the previously saved state
    // or default to 'normal' if no previous state was saved
    if (windowState === 'minimized') {
      const savedState = getStoredValue('windowState', 'normal');
      // Only restore to 'normal' or 'docked' states, not 'maximized' or 'minimized'
      setWindowState(savedState === 'normal' || savedState === 'docked' ? savedState : 'normal');
    } else {
      setWindowState('normal');
    }

    setIsMenuOpen(false);
  };

  const toggleMinimize = () => {
    if (windowState === 'docked') {
      // When docked, minimize within the docked container
      saveCurrentState();
      setWindowState('docked-minimized');
    } else if (windowState === 'docked-minimized') {
      // Restore from docked-minimized back to docked
      setWindowState('docked');
    } else if (windowState !== 'minimized') {
      // Normal minimize behavior for non-docked windows
      saveCurrentState();
      setWindowState('minimized');
    } else {
      // Restore from minimized
      restoreToNormal();
    }
    setIsMenuOpen(false);
  };

  const toggleMaximize = () => {
    if (windowState !== 'maximized') {
      saveCurrentState();
      setWindowState('maximized');
    } else {
      // When un-maximizing, restore to the previously saved state (normal or docked)
      const savedState = getStoredValue('windowState', 'normal');
      const normalState = stateHistory.normal;

      setPosition(normalState.position);
      setSize(normalState.size);

      // Only restore to 'normal' or 'docked' states
      setWindowState(savedState === 'normal' || savedState === 'docked' ? savedState : 'normal');
    }
    setIsMenuOpen(false);
  };

  const toggleDock = () => {
    if (windowState !== 'docked') {
      saveCurrentState();
      setWindowState('docked');
    } else {
      // When un-docking, restore to normal state
      const normalState = stateHistory.normal;
      setPosition(normalState.position);
      setSize(normalState.size);
      setWindowState('normal');
    }
    setIsMenuOpen(false);
  };

  const resetSize = () => {
    const newSize = defaultSize;
    setSize(newSize);
    setPosition(constrainToViewport(position, newSize));
    setStateHistory(prev => ({
      ...prev,
      normal: { position, size: newSize },
    }));
    setIsMenuOpen(false);
  };

  const getBoxStyle = (): any => {
    // Helper function to ensure valid numeric values
    const ensureValidNumber = (value: any, fallback: number = 0): number => {
      const num = typeof value === 'number' ? value : parseFloat(value);
      return isNaN(num) || !isFinite(num) ? fallback : num;
    };

    // Ensure position and size values are valid
    const safePosition = {
      x: ensureValidNumber(position?.x, 100),
      y: ensureValidNumber(position?.y, 100),
    };
    const safeSize = {
      width: ensureValidNumber(size?.width, 800),
      height: ensureValidNumber(size?.height, 600),
    };

    if (isModal) {
      const viewportWidth = window.innerWidth || 1200;
      const viewportHeight = window.innerHeight || 800;
      const modalTop = Math.max(0, (viewportHeight - safeSize.height) / 2);
      const modalLeft = Math.max(0, (viewportWidth - safeSize.width) / 2);

      return {
        position: 'fixed',
        top: `${modalTop}px`,
        left: `${modalLeft}px`,
        width: `${safeSize.width}px`,
        height: `${safeSize.height}px`,
        zIndex: zIndex + 100,
      };
    }

    switch (windowState) {
      case 'minimized':
        return {
          position: 'absolute',
          top: '0px',
          left: `${safePosition.x}px`,
          width: '300px',
          height: '30px',
          zIndex: zIndex,
        };
      case 'maximized':
        return {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: zIndex,
        };
      case 'docked':
        return {
          position: 'relative',
          width: '100%',
          minHeight: '400px',
          height: `${ensureValidNumber(dockedHeight, 600)}px`,
          marginBottom: '8px',
          zIndex: zIndex,
          flexShrink: 0,
          resize: 'vertical',
          overflow: 'hidden',
        };
      case 'docked-minimized':
        return {
          position: 'relative',
          width: '100%',
          height: '40px',
          marginBottom: '8px',
          zIndex: zIndex,
        };
      default:
        return {
          position: 'fixed',
          top: `${safePosition.y}px`,
          left: `${safePosition.x}px`,
          width: `${safeSize.width}px`,
          height: `${safeSize.height}px`,
          zIndex: zIndex,
        };
    }
  };

  const MenuControls = () => (
    <div className="flex items-center space-x-1 bg-white/10 ">
      {!isModal && (
        <>
          <button onClick={toggleMinimize} className="p-1 hover:bg-gray-200 rounded " title={windowState === 'minimized' || windowState === 'docked-minimized' ? 'Restore' : 'Minimize'}>
            {windowState === 'minimized' || windowState === 'docked-minimized' ? <IconRenderer icon="ChevronUp" size={16} /> : <IconRenderer icon="ChevronDown" size={16} />}
          </button>
          {canMaximize && (
            <button onClick={toggleMaximize} className="p-1 hover:bg-gray-200 rounded" title={windowState === 'maximized' ? 'Restore' : 'Maximize'}>
              {windowState === 'maximized' ? <IconRenderer icon="Minimize" size={16} /> : <IconRenderer icon="Maximize" size={16} />}
            </button>
          )}
          {canDock && (
            <button onClick={toggleDock} className="p-1 hover:bg-gray-200 rounded " title={windowState === 'docked' || windowState === 'docked-minimized' ? 'Restore' : 'Dock'}>
              {windowState === 'docked' || windowState === 'docked-minimized' ? <IconRenderer icon="PanelLeftOpen" size={16} /> : <IconRenderer icon="PanelRightOpen" size={16} />}
            </button>
          )}
          {windowState === 'normal' && (
            <button onClick={resetSize} className="p-1 hover:bg-gray-200 rounded" title="Reset Size">
              <IconRenderer icon="RotateCcw" size={16} />
            </button>
          )}
        </>
      )}
      {(isModal || onClose) && (
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
          <IconRenderer icon="X" size={16} />
        </button>
      )}
    </div>
  );

  const CompactMenu = () => (
    <div ref={menuRef} className="absolute top-2 right-2 z-50">
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 hover:bg-gray-200 rounded-full  shadow-sm">
        <IconRenderer icon="ArrowUpDown" size={16} />
      </button>

      {isMenuOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white/80 rounded-lg shadow-lg overflow-hidden border-t-2 border-t-purple-600">
          {title && <div className="px-4 py-1 border-b border-gray-300 font-semibold">{title}</div>}
          <div className="px-2 py-1">
            <MenuControls />
          </div>
        </div>
      )}
    </div>
  );

  // Don't render the component when it's minimized (it will be rendered in the MinimizedContainer)
  if (windowState === 'minimized') {
    return null;
  }

  const content: any = (
    <div style={{ pointerEvents: usePortal ? 'auto' : 'inherit' }}>
      {isModal && <div className="fixed inset-0 bg-black bg-opacity-50" style={{ zIndex: 1050 }} />}
      <div ref={boxRef} style={getBoxStyle()} className={classNames('rounded-lg bg-white/95 shadow-lg flex flex-col overflow-hidden', isModal ? 'shadow-xl' : '', overflow)}>
        {compact && !isModal ? (
          <>
            <div ref={dragRef} onMouseDown={handleMouseDown} className="h-8 cursor-move" />
            <CompactMenu />
          </>
        ) : (
          <div ref={dragRef} onMouseDown={handleMouseDown} className={`bg-white/10 flex items-center border-t-2 border-t-purple-600 justify-between ${isModal ? '' : 'cursor-move'} select-none`}>
            <span className="text-sm pl-2 truncate">{title}</span>
            <MenuControls />
          </div>
        )}

        {/* Content area - hide when docked-minimized */}
        {windowState !== 'docked-minimized' && <div className={classNames('flex-1 overflow-auto relative', compact ? 'pt-2' : '', overflow)}>{children}</div>}

        {/* Resize handle for normal windows */}
        {isResizable && windowState === 'normal' && !isModal && (
          <div ref={resizeRef} onMouseDown={handleResizeMouseDown} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50">
            <div className="absolute bottom-1 right-1 w-2 h-2 bg-gray-400 rounded" />
          </div>
        )}

        {/* Resize handle for docked windows */}
        {windowState === 'docked' && (
          <div
            className="h-2 bg-gray-100 border-t border-gray-200 cursor-ns-resize flex items-center justify-center"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();

              const startY = e.clientY;
              const startHeight = dockedHeight;

              const handleMouseMove = moveEvent => {
                const deltaY = moveEvent.clientY - startY;
                const newHeight = Math.max(400, startHeight + deltaY);
                setDockedHeight(newHeight);
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="w-8 h-1 bg-gray-400 rounded"></div>
          </div>
        )}
      </div>
    </div>
  );

  if (windowState === 'docked' || windowState === 'docked-minimized') {
    // Render docked content in the docked container
    const dockedContainer = document.getElementById('docked-windows-container');
    if (dockedContainer) {
      return createPortal(content, dockedContainer);
    }
    return null;
  }

  // Use portal if requested and available
  if (usePortal && portalContainer && typeof refDocument !== 'undefined') {
    return createPortal(content, portalContainer);
  }

  // Otherwise render normally
  return content;
};

export default ViewManager;
