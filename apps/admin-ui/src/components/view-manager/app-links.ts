/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
// Define a type for dynamic imports
type DynamicImport = () => Promise<any>;

// Define a more flexible type for component imports
type ComponentImport = () => Promise<any>;

// Define a type for the app path map
interface AppPathMap {
  [key: string]: string | DynamicImport;
}

export const routeRegistry: Record<string, ComponentImport> = {
  // SpinForge Management Components
  'deploy-form': () => import('../../pages/DeployForm'),
  'app-details': () => import('../../pages/Applications'),
  'app-settings': () => import('../../pages/Settings'),
  'system-dashboard': () => import('../../pages/SystemDashboard'),
  
  // Example components (commented out)
  // '/build-studio': () => import('../../components/build-studio'),
  // '/page-templates': () => import('../../components/data-view/base-form/base-page-template'),
  // '/data-gallery-view': () => import('../../components/data-view/data-gallery-view'),
  // '/data-navigator': () => import('../../components/data-view/data-common-components'),
  // '/data-form-view': () => import('../../components/data-view/data-form-view'),
  // '/creative-studio': () => import('../../components/build-studio/creative/app'),
  // '/domain': () => import('../../components/domain/app'),
  // '/emoji': () => import('../icons/icon-picker'),
  // '/asset-selector': () => import('@/components/asset-selector/app'),
  // '/app-wizard': () => import('@/components/build-studio/app-wizard'),
  // '/section-selector': () => import('@/components/build-studio/section-selector-dialog'),

  // // Content section routes
  // '/document': () => import('@/components/content/file-manager/app'),

  // // Configuration section routes
  // '/show-notice': () => import('@/ui/notification/notice-viewer'),

  // // App root section routes
  // '/domains': () => import('@/components/domain/app'),

  // // Additional routes for components that exist in the codebase
  // '/code-editor': () => import('@/components/common/code-editor/monaco'),
  // '/timeline': () => import('../../components/build-studio/timeline/timeline-context'),
  // '/domain-name-management': () => import('@/components/domain'),
  // '/data-table-view': () => import('@/components/data-view/data-table-view'),
  // '/data-component-view': () => import('@/components/data-view/data-component-view'),

  // // UI Component Showcases
  // '/pagination-showcase': () => import('@/components/preset/web/components/basic/pagination/pagination-showcase'),

  // '/table-demo-1': () => import('@/components/appmint-form/examples/table-view-demo'),
  // '/table-demo-2': () => import('@/components/appmint-form/examples/standalone-tree-table-example'),
  // '/table-demo-3': () => import('@/components/appmint-form/examples/inline-edit-example'),

  // '/props-panel': () => import('@/components/property-panel/PropertyPanelWithErrorBoundary'),
};

export const appPathMap = routeRegistry;
