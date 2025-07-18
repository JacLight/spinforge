import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Save, Key, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const [adminToken, setAdminToken] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken') || '';
    setAdminToken(token);
  }, []);

  const handleSave = () => {
    api.setAdminToken(adminToken);
    toast.success('Settings saved successfully!');
  };

  return (
    <div className="max-w-2xl">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Settings
          </h2>
        </div>
      </div>

      <div className="mt-8 bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="px-4 py-6 sm:p-8">
          <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8">
            <div>
              <label htmlFor="adminToken" className="block text-sm font-medium leading-6 text-gray-900">
                Admin Token
              </label>
              <div className="mt-2">
                <div className="flex rounded-md shadow-sm">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 px-3 text-gray-500 sm:text-sm">
                    <Key className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    name="adminToken"
                    id="adminToken"
                    value={adminToken}
                    onChange={(e) => setAdminToken(e.target.value)}
                    className="block w-full min-w-0 flex-1 rounded-none rounded-r-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="Enter your admin token"
                  />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                The admin token is required to access SpinForge admin APIs. You can find it in your .env file or Docker logs.
              </p>
            </div>

            {!adminToken && (
              <div className="rounded-md bg-yellow-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Admin token not set
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Without an admin token, you won't be able to:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>Deploy new applications</li>
                        <li>View application details</li>
                        <li>Delete applications</li>
                        <li>Access system metrics</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </button>
        </div>
      </div>

      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Start</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <strong>1. Find your admin token:</strong>
            <pre className="mt-1 bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
              docker logs spinforge-hub | grep "Admin token"
            </pre>
          </div>
          <div>
            <strong>2. Or check your .env file:</strong>
            <pre className="mt-1 bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
              cat .env | grep ADMIN_TOKEN
            </pre>
          </div>
          <div>
            <strong>3. Enter the token above and save</strong>
          </div>
        </div>
      </div>
    </div>
  );
}