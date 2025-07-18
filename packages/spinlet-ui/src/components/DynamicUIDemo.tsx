import { openApp, closeApp, toggleApp } from './view-manager/dialog-manager';
import { 
  Settings, 
  BarChart3, 
  Upload, 
  LayoutDashboard,
  ListChecks 
} from 'lucide-react';

export default function DynamicUIDemo() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dynamic UI Components</h2>
        <p className="text-gray-600 mt-2">
          Click buttons below to open components as dialogs or side panels
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Deploy Application
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Open the deployment form in a dialog
            </p>
          </div>
          <div className="px-6 pb-6">
            <button 
              onClick={() => openApp('deploy-form', { title: 'Deploy New App' })}
              className="w-full px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              Open Deploy Form
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              System Dashboard
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              View system metrics in a resizable window
            </p>
          </div>
          <div className="px-6 pb-6">
            <button 
              onClick={() => openApp('system-dashboard', { title: 'System Overview' })}
              className="w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-md hover:bg-gray-200 transition-colors"
            >
              Open Dashboard
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Metrics Panel
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Toggle metrics view (opens/closes)
            </p>
          </div>
          <div className="px-6 pb-6">
            <button 
              onClick={() => toggleApp('system-metrics', { title: 'System Metrics' })}
              className="w-full px-4 py-2 bg-white text-gray-900 rounded-md border hover:bg-gray-50 transition-colors"
            >
              Toggle Metrics
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Application List
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              View deployed applications
            </p>
          </div>
          <div className="px-6 pb-6">
            <button 
              onClick={() => openApp('app-details', { title: 'Applications' })}
              className="w-full px-4 py-2 bg-white text-gray-900 rounded-md border hover:bg-gray-50 transition-colors"
            >
              View Apps
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Settings
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Configure system settings
            </p>
          </div>
          <div className="px-6 pb-6">
            <button 
              onClick={() => openApp('app-settings', { title: 'Settings' })}
              className="w-full px-4 py-2 bg-white text-gray-900 rounded-md border hover:bg-gray-50 transition-colors"
            >
              Open Settings
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold mb-2">Usage Example:</h3>
        <pre className="text-sm">
{`import { openApp, closeApp, toggleApp } from './view-manager/dialog-manager';

// Open a component as a dialog
openApp('deploy-form', { title: 'Deploy New App' });

// Toggle a component (open if closed, close if open)
toggleApp('system-metrics', { title: 'Metrics' });

// Close a specific dialog
closeApp('deploy-form');`}
        </pre>
      </div>
    </div>
  );
}