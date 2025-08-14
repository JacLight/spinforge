/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Key, Plus, Trash2, Shield, Lock, AlertTriangle, Github } from "lucide-react";
import Link from "next/link";

export default function TokensAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Key className="h-8 w-8 text-red-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">API Tokens</h1>
      </div>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          Manage API tokens for programmatic access to SpinForge services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Base URL</h2>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code>Production: https://api.spinforge.app
Development: http://localhost:3000</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication</h2>
        <p className="text-gray-600 mb-4">All endpoints require authentication via:</p>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code></li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">X-Auth-Token: &lt;token&gt;</code></li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Cookie: auth-token=&lt;token&gt;</code></li>
        </ul>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Key className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">1. List API Tokens</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/tokens</code></h3>
        <p className="text-gray-600 mb-4">Retrieve all API tokens for the authenticated user.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "tokens": [
    {
      "id": "tok_abc123",
      "name": "CI/CD Pipeline Token",
      "lastUsed": "2025-01-15T14:30:00Z",
      "createdAt": "2025-01-10T10:00:00Z",
      "expiresAt": null,
      "permissions": ["deploy", "read", "write"]
    },
    {
      "id": "tok_xyz789",
      "name": "Development Token",
      "lastUsed": "2025-01-14T09:15:00Z",
      "createdAt": "2025-01-05T12:00:00Z",
      "expiresAt": "2025-02-05T12:00:00Z",
      "permissions": ["read"]
    }
  ]
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`import axios from 'axios';

const listApiTokens = async () => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.get('https://api.spinforge.app/api/tokens', {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    console.log(\`Found \${response.data.tokens.length} API tokens\`);
    return response.data.tokens;
  } catch (error) {
    console.error('Failed to fetch tokens:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Plus className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">2. Generate API Token</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/tokens/generate</code></h3>
        <p className="text-gray-600 mb-4">Generate a new API token.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "name": "Production API Token",
  "permissions": ["deploy", "read", "write"],
  "expiresIn": 2592000
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">name</code> (required): Descriptive name for the token</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">permissions</code> (optional): Array of permissions (<code>read</code>, <code>write</code>, <code>deploy</code>, <code>delete</code>)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">expiresIn</code> (optional): Expiration time in seconds (null for no expiration)</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (201 Created)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "id": "tok_new123",
  "name": "Production API Token",
  "token": "sf_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "createdAt": "2025-01-15T15:30:00Z",
  "expiresAt": "2025-02-14T15:30:00Z",
  "user": {
    "id": "user_123",
    "customerId": "cust_abc123",
    "email": "user@example.com"
  }
}`}</code></pre>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 not-prose mb-6">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
            <div>
              <p className="text-yellow-700 font-medium">Important</p>
              <p className="text-yellow-600 text-sm">The token value is only shown once. Store it securely.</p>
            </div>
          </div>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const generateApiToken = async (config) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.post('https://api.spinforge.app/api/tokens/generate', {
      name: config.name,
      permissions: config.permissions || ['read'],
      expiresIn: config.expiresIn || null
    }, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    // IMPORTANT: Save this token securely - it won't be shown again
    const apiToken = response.data.token;
    console.log('New API token generated:', response.data.name);
    console.log('Token:', apiToken);
    
    // Example: Copy to clipboard
    await navigator.clipboard.writeText(apiToken);
    console.log('Token copied to clipboard');
    
    return response.data;
  } catch (error) {
    console.error('Token generation failed:', error.response?.data?.error);
  }
};

// Usage
generateApiToken({
  name: 'GitHub Actions Token',
  permissions: ['deploy', 'read'],
  expiresIn: 30 * 24 * 60 * 60 // 30 days
});`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Trash2 className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">3. Revoke API Token</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">DELETE /api/tokens/[id]</code></h3>
        <p className="text-gray-600 mb-4">Revoke an API token immediately.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Path Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">id</code>: Token ID to revoke</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "message": "Token revoked successfully"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const revokeApiToken = async (tokenId) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.delete(\`https://api.spinforge.app/api/tokens/\${tokenId}\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    console.log('Token revoked successfully');
    return response.data;
  } catch (error) {
    console.error('Failed to revoke token:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Using API Tokens</h2>
        
        <p className="text-gray-600 mb-4">Once generated, use API tokens in the Authorization header for all API requests:</p>
        
        <div className="bg-gray-100 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-800 overflow-x-auto"><code>Authorization: Bearer sf_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Example: Deploy with API Token</h3>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Using cURL</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`# Using curl
curl -X POST https://api.spinforge.app/api/deployments \\
  -H "Authorization: Bearer sf_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-app",
    "type": "container",
    "domain": "my-app",
    "image": "node:18-alpine"
  }'`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Using Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`// Using axios
const deployWithApiToken = async () => {
  const apiToken = process.env.SPINFORGE_API_TOKEN;
  
  try {
    const response = await axios.post('https://api.spinforge.app/api/deployments', {
      name: 'my-app',
      type: 'container',
      domain: 'my-app',
      image: 'node:18-alpine'
    }, {
      headers: {
        'Authorization': \`Bearer \${apiToken}\`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Deployment created:', response.data.deployment);
  } catch (error) {
    console.error('Deployment failed:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Token Permissions</h2>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3">Available Permissions</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">read</code> - Read access to resources</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">write</code> - Create and update resources</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">deploy</code> - Deploy applications</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">delete</code> - Delete resources</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">admin</code> - Full administrative access</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Permission Matrix</h3>
        
        <div className="overflow-x-auto not-prose mb-6">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">read</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">write</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">deploy</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">delete</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">List deployments</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">View deployment details</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">Create deployment</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">Update deployment</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">Delete deployment</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">View metrics</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">Manage tokens</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-gray-400">-</td>
                <td className="px-6 py-4 text-center text-green-600">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Shield className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">Security Best Practices</h2>
        </div>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">1. Token Storage</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Never commit tokens to version control</li>
              <li>Use environment variables or secure secret management</li>
              <li>Rotate tokens regularly</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Token Naming</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Use descriptive names to identify token purpose</li>
              <li>Include environment in name (e.g., "Production CI/CD")</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">3. Permissions</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Grant minimum required permissions</li>
              <li>Use read-only tokens for monitoring</li>
              <li>Separate tokens for different environments</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Expiration</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Set expiration dates for temporary tokens</li>
              <li>Regularly review and revoke unused tokens</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">5. CI/CD Integration</h3>
            <div className="bg-gray-900 rounded-lg p-4 not-prose">
              <pre className="text-gray-100 overflow-x-auto"><code className="language-yaml">{`# GitHub Actions example
- name: Deploy to SpinForge
  env:
    SPINFORGE_TOKEN: \${{ secrets.SPINFORGE_API_TOKEN }}
  run: |
    curl -X POST https://api.spinforge.app/api/deployments \\
      -H "Authorization: Bearer $SPINFORGE_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d '{"name": "my-app", "type": "container"}'`}</code></pre>
            </div>
          </div>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Token Formats</h2>
        
        <p className="text-gray-600 mb-4">SpinForge API tokens follow a specific format:</p>
        
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><strong>Production</strong>: <code className="bg-gray-100 px-2 py-1 rounded text-sm">sf_live_[40 character alphanumeric string]</code></li>
          <li><strong>Development</strong>: <code className="bg-gray-100 px-2 py-1 rounded text-sm">sf_test_[40 character alphanumeric string]</code></li>
          <li><strong>Restricted</strong>: <code className="bg-gray-100 px-2 py-1 rounded text-sm">sf_restricted_[40 character alphanumeric string]</code></li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limiting</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li>Token generation: 10 per day per user</li>
          <li>Token listing: 60 requests per minute</li>
          <li>Token revocation: 20 per hour</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Codes</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">TOKEN_LIMIT_EXCEEDED</code> - Maximum token limit reached (50 tokens per user)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">INVALID_PERMISSIONS</code> - Invalid permission specified</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">TOKEN_NOT_FOUND</code> - Token ID not found</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">TOKEN_EXPIRED</code> - Token has expired</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">INVALID_TOKEN_FORMAT</code> - Token format is invalid</li>
        </ul>
      </section>
    </div>
  );
}