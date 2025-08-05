/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Terminal, Key, LogIn, LogOut, User } from "lucide-react";

export default function CLIAuthPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">auth</h1>
      <p className="text-lg text-gray-600 mb-8">
        Manage authentication with SpinForge. The auth command handles login, logout, and checking your current authentication status.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Commands</h2>

      <div className="space-y-8 not-prose">
        {/* Login */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start mb-4">
            <LogIn className="h-6 w-6 text-green-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900">auth login</h3>
              <p className="text-gray-600 mt-1">Authenticate with your SpinForge account</p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <pre className="text-gray-100 overflow-x-auto"><code>spinforge-cli auth login</code></pre>
          </div>

          <p className="text-gray-600 mb-4">
            This command opens your default browser for authentication. After successful login, 
            your authentication token is stored locally for future commands.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Options</h4>
            <ul className="space-y-2 text-blue-800">
              <li><code className="bg-blue-100 px-2 py-1 rounded">--token &lt;token&gt;</code> - Login with an API token instead of browser</li>
              <li><code className="bg-blue-100 px-2 py-1 rounded">--no-browser</code> - Display login URL instead of opening browser</li>
            </ul>
          </div>
        </div>

        {/* Logout */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start mb-4">
            <LogOut className="h-6 w-6 text-red-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900">auth logout</h3>
              <p className="text-gray-600 mt-1">Log out from SpinForge</p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <pre className="text-gray-100 overflow-x-auto"><code>spinforge-cli auth logout</code></pre>
          </div>

          <p className="text-gray-600">
            Removes your stored authentication token. You'll need to login again to use authenticated commands.
          </p>
        </div>

        {/* Whoami */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start mb-4">
            <User className="h-6 w-6 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-xl font-semibold text-gray-900">auth whoami</h3>
              <p className="text-gray-600 mt-1">Display the currently authenticated user</p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <pre className="text-gray-100 overflow-x-auto"><code>spinforge-cli auth whoami</code></pre>
          </div>

          <p className="text-gray-600 mb-4">Shows information about your current authentication:</p>

          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-700"><code>{`Email: user@example.com
Customer ID: cust_abc123
Plan: Pro
Authenticated: Yes`}</code></pre>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">Authentication Methods</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
          <h3 className="font-semibold text-indigo-900 mb-3">Browser Authentication</h3>
          <p className="text-indigo-800 text-sm mb-3">
            The default and recommended method. Opens your browser for secure authentication 
            with support for SSO and 2FA.
          </p>
          <code className="text-xs bg-indigo-100 px-2 py-1 rounded">spinforge-cli auth login</code>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-semibold text-amber-900 mb-3">Token Authentication</h3>
          <p className="text-amber-800 text-sm mb-3">
            Use an API token for CI/CD environments or automated deployments. Generate tokens 
            in your dashboard settings.
          </p>
          <code className="text-xs bg-amber-100 px-2 py-1 rounded">spinforge-cli auth login --token YOUR_TOKEN</code>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Token Storage</h2>

      <p className="mb-4">Authentication tokens are stored securely on your local machine:</p>

      <div className="overflow-x-auto mb-8">
        <table className="min-w-full divide-y divide-gray-200 not-prose">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                macOS/Linux
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                ~/.spinforge/auth.json
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                Windows
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                %USERPROFILE%\.spinforge\auth.json
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-red-900 mb-2">Security Note</h3>
        <p className="text-red-800">
          Never commit your authentication token to version control. If you suspect your token 
          has been compromised, revoke it immediately in your dashboard settings and generate a new one.
        </p>
      </div>
    </div>
  );
}