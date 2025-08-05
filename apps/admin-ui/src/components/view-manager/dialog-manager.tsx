/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, lazy, Suspense, useEffect } from 'react';
import { appPathMap, routeRegistry } from './app-links';
import { toTitleCase } from '@/utils/helpers';
import { useShallow } from 'zustand/shallow';
import { useSiteStore } from '@/store/site-store';
import ErrorBoundary from '../ErrorBoundary';
import ViewManager from './ViewManager';

interface DialogController {
  openDialog: (id: string, componentNameOrComponent: string | React.ComponentType<any>, props?: Record<string, any>, allowMultiple?: boolean) => void;
  closeDialog: (id: string) => void;
  closeAll: () => void;
  isOpened: (id: string) => boolean;
}

const dialogController: DialogController = {
  openDialog: () => {
    throw new Error('DialogManager is not mounted yet!');
  },
  closeDialog: () => {
    throw new Error('DialogManager is not mounted yet!');
  },
  closeAll: () => {
    throw new Error('DialogManager is not mounted yet!');
  },
  isOpened: () => {
    throw new Error('DialogManager is not mounted yet!');
  },
};

export const showDataTable = (datatype, props?: any) => {};

export const showWidget = (title, widgetName: string, props?: any) => {};

export const openApp = (appName: string, props?: any, multiple = false, closeOpend = false) => {
  if (closeOpend) {
    dialogController.closeDialog(appName);
  }

  const pathOrImport = appPathMap[appName];
  if (pathOrImport) {
    if (typeof pathOrImport === 'function') {
      // It's a dynamic import function
      const ImportedComponent = React.lazy(pathOrImport);
      dialogController.openDialog(appName, ImportedComponent, props, multiple);
    } else {
      // It's a string path
      dialogController.openDialog(appName, pathOrImport, props, multiple);
    }
  } else {
    // Check if it's in the routeRegistry
    const routeImport = routeRegistry[appName];
    if (routeImport) {
      const ImportedComponent = React.lazy(routeImport);
      dialogController.openDialog(appName, ImportedComponent, props, multiple);
    } else {
      console.warn(`No component found for app: ${appName}`);
    }
  }
};

export const closeApp = (appName: string) => {
  dialogController.closeDialog(appName);
};

export const closeAllApps = () => {
  dialogController.closeAll();
};

export const toggleApp = (appName: string, props?: any, multiple = false) => {
  if (dialogController.isOpened(appName)) {
    dialogController.closeDialog(appName);
  } else {
    openApp(appName, props, multiple);
  }
};

// Docking functionality is handled by ViewManager internally
// These functions are kept for backward compatibility but delegate to ViewManager
export const dockWindow = (id: string) => {
  console.warn('dockWindow is deprecated. Use ViewManager dock controls instead.');
};

export const undockWindow = (id: string) => {
  console.warn('undockWindow is deprecated. Use ViewManager dock controls instead.');
};

export const toggleDockWindow = (id: string) => {
  console.warn('toggleDockWindow is deprecated. Use ViewManager dock controls instead.');
};

export const closeAllDockedWindows = () => {
  // Close all dialogs that are currently docked
  const { dockedWindows } = useSiteStore.getState();
  if (dockedWindows && dockedWindows.length > 0) {
    dockedWindows.forEach(window => {
      if (window.onClose) {
        window.onClose();
      }
    });
  }

  // Also close any dialogs that might be in docked state
  const dialogs = document.querySelectorAll('#docked-windows-container > div');
  dialogs.forEach(dialog => {
    const closeButton = dialog.querySelector('button[title="X"]');
    if (closeButton) {
      (closeButton as HTMLButtonElement).click();
    }
  });
};

export const getDialogController = () => dialogController;

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface DialogProps {
  id: string;
  Component: React.ComponentType<any>;
  props: Record<string, any>;
  onClose: () => void;
}

const Dialog: React.FC<DialogProps> = ({ id, Component, props, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const render = (
    <ErrorBoundary>
      <Suspense fallback={<div className="dialog-loading">Loading...</div>}>
        <Component {...props} inline={false} onClose={onClose} />
      </Suspense>
    </ErrorBoundary>
  );

  if (props.inline) {
    return render;
  }

  // ViewManager handles all docking logic internally
  return (
    <ViewManager id={id} defaultPosition={{ x: 'center', y: 'centre' as any }} onClose={onClose} title={props.title || toTitleCase(id)}>
      {render}
    </ViewManager>
  );
};

interface DialogInfo {
  id: string;
  Component: React.ComponentType<any>;
  props: Record<string, any>;
  allowMultiple: boolean;
}

export const DialogManager: React.FC = () => {
  const [dialogs, setDialogs] = useState<DialogInfo[]>([]);

  useEffect(() => {
    dialogController.openDialog = (id, componentNameOrComponent, props = {}, allowMultiple = true) => {
      setDialogs(prevDialogs => {
        if (!allowMultiple && prevDialogs.some(dialog => dialog.id === id)) {
          console.warn(`Dialog "${id}" is already open.`);
          return prevDialogs;
        }

        let Component: React.ComponentType<any>;

        // Check if componentNameOrComponent is already a component
        if (typeof componentNameOrComponent === 'function' || typeof componentNameOrComponent === 'object') {
          // It's already a component
          Component = componentNameOrComponent as React.ComponentType<any>;
        } else {
          // It's a string path, normalize it
          const componentName = componentNameOrComponent.startsWith('@') || componentNameOrComponent.startsWith('/') ? componentNameOrComponent : `@/components/${componentNameOrComponent}`;

          // Lazy load the component
          Component = lazy(() =>
            import(/* @vite-ignore */ componentName).catch(error => {
              console.error(`Failed to load component: ${componentName}`, error);
              return {
                default: () => (
                  <div>
                    <div>Error Loading {componentName}</div>
                    <div className="text-xs text-red-500">{error.message}</div>
                  </div>
                ),
              };
            }),
          );
        }

        return [...prevDialogs, { id, Component, props, allowMultiple }];
      });
    };

    dialogController.closeDialog = id => {
      setDialogs(prevDialogs => prevDialogs.filter(dialog => dialog.id !== id));
    };

    dialogController.closeAll = () => {
      setDialogs([]);
    };

    dialogController.isOpened = id => {
      return dialogs.some(dialog => dialog.id === id);
    };
  }, []);

  // Create a portal container if it doesn't exist
  useEffect(() => {
    if (!document.getElementById('dialog-container')) {
      const portalContainer = document.createElement('div');
      portalContainer.id = 'dialog-container';
      document.body.appendChild(portalContainer);

      return () => {
        document.body.removeChild(portalContainer);
      };
    }
  }, []);

  // Render dialogs directly in the component tree
  return (
    <>
      {dialogs.map(({ id, Component, props }) => (
        <Dialog key={id} id={id} Component={Component} props={props} onClose={() => dialogController.closeDialog(id)} />
      ))}
    </>
  );
};
