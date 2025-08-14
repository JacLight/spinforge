/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield, Users, Rocket, Globe, BarChart, Key, Terminal, Code, Github, ArrowRight } from "lucide-react";
import Link from "next/link";
import { DocsPageWrapper } from "@/components/docs/DocsPageWrapper";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CodeTabs } from "@/components/docs/CodeTabs";
import { Alert } from "@/components/docs/Alert";

// Icons for framework tabs
const NodeIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
  </svg>
);

const CurlIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
  </svg>
);

const PythonIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
  </svg>
);

export default function APIDocsPage() {
  return (
    <DocsPageWrapper>
      <div className="prose prose-gray max-w-none">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">API Reference</h1>
        
        <p className="text-lg text-gray-600 mb-8">
          SpinForge provides a comprehensive REST API for managing your deployments, domains, and infrastructure programmatically.
        </p>

        <Alert type="info" title="Base URL">
          <div className="font-mono text-sm">
            <div>Production: https://api.spinforge.app</div>
            <div>Development: http://localhost:3000</div>
          </div>
        </Alert>

        <h2 id="authentication" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Authentication</h2>
        
        <p className="text-gray-600 mb-4">
          All API requests require authentication using JWT tokens. Include your token in the Authorization header:
        </p>

        <CodeBlock 
          code="Authorization: Bearer <your-token>"
          language="http"
          filename="headers"
        />

        <h2 id="quick-start" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Quick Start</h2>
        
        <h3 id="get-token" className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Get Your API Token</h3>
        
        <CodeTabs 
          tabs={[
            {
              label: "Node.js",
              value: "nodejs",
              icon: <NodeIcon />,
              language: "javascript",
              filename: "auth.js",
              code: `const response = await fetch('https://api.spinforge.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'your@email.com',
    password: 'your-password'
  })
});

const { token } = await response.json();
console.log('Token:', token);`
            },
            {
              label: "cURL",
              value: "curl",
              icon: <CurlIcon />,
              language: "bash",
              filename: "terminal",
              code: `curl -X POST https://api.spinforge.app/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "your@email.com",
    "password": "your-password"
  }'`
            },
            {
              label: "Python",
              value: "python",
              icon: <PythonIcon />,
              language: "python",
              filename: "auth.py",
              code: `import requests

response = requests.post(
    'https://api.spinforge.app/api/auth/login',
    json={
        'email': 'your@email.com',
        'password': 'your-password'
    }
)

token = response.json()['token']
print(f'Token: {token}')`
            }
          ]}
          defaultTab="nodejs"
        />

        <h3 id="first-call" className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Make Your First API Call</h3>
        
        <CodeTabs 
          tabs={[
            {
              label: "Node.js",
              value: "nodejs",
              icon: <NodeIcon />,
              language: "javascript",
              filename: "list-deployments.js",
              code: `// List your deployments
const deployments = await fetch('https://api.spinforge.app/api/deployments', {
  headers: {
    'Authorization': \`Bearer \${token}\`
  }
});

const data = await deployments.json();
console.log('Your deployments:', data);`
            },
            {
              label: "cURL",
              value: "curl",
              icon: <CurlIcon />,
              language: "bash",
              filename: "terminal",
              code: `curl https://api.spinforge.app/api/deployments \\
  -H "Authorization: Bearer YOUR_TOKEN"`
            },
            {
              label: "Python",
              value: "python",
              icon: <PythonIcon />,
              language: "python",
              filename: "list_deployments.py",
              code: `import requests

response = requests.get(
    'https://api.spinforge.app/api/deployments',
    headers={
        'Authorization': f'Bearer {token}'
    }
)

deployments = response.json()
print('Your deployments:', deployments)`
            }
          ]}
          defaultTab="nodejs"
        />

        <h2 id="api-endpoints" className="text-2xl font-semibold text-gray-900 mt-12 mb-6">API Endpoints</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-8">
          <Link href="/docs/api/authentication" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
            <div className="flex items-start">
              <Shield className="h-6 w-6 text-indigo-600 mr-3 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  Authentication
                  <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-gray-600 text-sm">
                  User login and signup, OAuth integration, token refresh, session management
                </p>
              </div>
            </div>
          </Link>

          <Link href="/docs/api/user-management" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
            <div className="flex items-start">
              <Users className="h-6 w-6 text-blue-600 mr-3 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  User Management
                  <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-gray-600 text-sm">
                  Profile management, password changes, notification preferences
                </p>
              </div>
            </div>
          </Link>

          <Link href="/docs/api/deployments" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
            <div className="flex items-start">
              <Rocket className="h-6 w-6 text-purple-600 mr-3 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  Deployments
                  <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-gray-600 text-sm">
                  Create and manage deployments, static sites, containers, build configuration
                </p>
              </div>
            </div>
          </Link>

          <Link href="/docs/api/domains" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
            <div className="flex items-start">
              <Globe className="h-6 w-6 text-green-600 mr-3 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  Domains & Routes
                  <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-gray-600 text-sm">
                  Custom domain management, SSL certificates, DNS configuration
                </p>
              </div>
            </div>
          </Link>

          <Link href="/docs/api/monitoring" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
            <div className="flex items-start">
              <BarChart className="h-6 w-6 text-orange-600 mr-3 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  Monitoring & Metrics
                  <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-gray-600 text-sm">
                  Real-time metrics, spinlet management, usage statistics, logs
                </p>
              </div>
            </div>
          </Link>

          <Link href="/docs/api/tokens" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all">
            <div className="flex items-start">
              <Key className="h-6 w-6 text-red-600 mr-3 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  API Tokens
                  <ArrowRight className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-gray-600 text-sm">
                  Generate API tokens, manage permissions, CI/CD integration
                </p>
              </div>
            </div>
          </Link>
        </div>

        <h2 id="common-patterns" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Common Patterns</h2>
        
        <h3 id="pagination" className="text-xl font-semibold text-gray-900 mt-8 mb-3">Pagination</h3>
        <p className="text-gray-600 mb-3">Most list endpoints support pagination:</p>
        
        <CodeBlock 
          code="GET /api/deployments?limit=20&offset=40"
          language="http"
        />

        <h3 id="filtering" className="text-xl font-semibold text-gray-900 mt-8 mb-3">Filtering</h3>
        <p className="text-gray-600 mb-3">Filter results using query parameters:</p>
        
        <CodeBlock 
          code="GET /api/deployments?status=active&type=container"
          language="http"
        />

        <h3 id="error-handling" className="text-xl font-semibold text-gray-900 mt-8 mb-3">Error Handling</h3>
        <p className="text-gray-600 mb-3">All errors follow a consistent format:</p>
        
        <CodeBlock 
          code={`{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}`}
          language="json"
          filename="error-response.json"
        />

        <h2 id="sdk-tools" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">SDK & Tools</h2>
        
        <div className="space-y-6 not-prose">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center mb-3">
              <Terminal className="h-5 w-5 text-gray-700 mr-2" />
              <h3 className="font-semibold text-gray-900">Official CLI</h3>
            </div>
            <p className="text-gray-600 mb-4">Install the SpinForge CLI for easy command-line management:</p>
            <CodeBlock
              code={`npm install -g @spinforge/cli
spinforge login
spinforge deploy`}
              language="bash"
            />
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
            <div className="flex items-center mb-3">
              <Code className="h-5 w-5 text-blue-700 mr-2" />
              <h3 className="font-semibold text-gray-900">Node.js SDK</h3>
            </div>
            <CodeBlock
              code={`import { SpinForge } from '@spinforge/sdk';

const client = new SpinForge({
  apiKey: 'sf_live_your_api_key'
});

const deployments = await client.deployments.list();`}
              language="javascript"
              filename="example.js"
            />
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
            <div className="flex items-center mb-3">
              <Github className="h-5 w-5 text-purple-700 mr-2" />
              <h3 className="font-semibold text-gray-900">GitHub Actions</h3>
            </div>
            <CodeBlock
              code={`- name: Deploy to SpinForge
  uses: spinforge/deploy-action@v1
  with:
    api-token: \${{ secrets.SPINFORGE_TOKEN }}
    deployment: my-app`}
              language="yaml"
              filename=".github/workflows/deploy.yml"
            />
          </div>
        </div>

        <h2 id="rate-limits" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Rate Limits</h2>
        
        <p className="text-gray-600 mb-4">API rate limits vary by endpoint and plan:</p>
        
        <div className="overflow-x-auto not-prose mb-6">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requests/min</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deployments/hour</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bandwidth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Free</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">60</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">5</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">10 GB/month</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Pro</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">300</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">20</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">100 GB/month</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Enterprise</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Unlimited</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Unlimited</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Unlimited</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Alert type="info" title="Rate Limit Headers">
          <ul className="space-y-1">
            <li><code className="bg-white px-2 py-0.5 rounded text-xs">X-RateLimit-Limit</code> - Maximum requests allowed</li>
            <li><code className="bg-white px-2 py-0.5 rounded text-xs">X-RateLimit-Remaining</code> - Requests remaining in current window</li>
            <li><code className="bg-white px-2 py-0.5 rounded text-xs">X-RateLimit-Reset</code> - Unix timestamp when the rate limit resets</li>
          </ul>
        </Alert>

        <h2 id="webhooks" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Webhooks</h2>
        
        <p className="text-gray-600 mb-4">Configure webhooks to receive real-time notifications:</p>
        
        <CodeBlock
          code={`POST /api/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["deployment.success", "deployment.failed"],
  "secret": "your-webhook-secret"
}`}
          language="json"
          filename="create-webhook.json"
        />

        <h3 id="webhook-events" className="text-xl font-semibold text-gray-900 mt-8 mb-3">Available Events</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 not-prose mb-6">
          {[
            'deployment.created',
            'deployment.success',
            'deployment.failed',
            'domain.verified',
            'ssl.renewed',
            'usage.limit.warning',
            'spinlet.error',
            'spinlet.restarted',
            'billing.payment.failed'
          ].map(event => (
            <code key={event} className="bg-gray-100 px-3 py-2 rounded text-sm text-center">
              {event}
            </code>
          ))}
        </div>

        <h2 id="status-codes" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Status Codes</h2>
        
        <div className="overflow-x-auto not-prose">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Common Causes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm font-mono text-gray-900">200</td>
                <td className="px-6 py-4 text-sm text-gray-600">Success</td>
                <td className="px-6 py-4 text-sm text-gray-500">Request completed successfully</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-900">201</td>
                <td className="px-6 py-4 text-sm text-gray-600">Created</td>
                <td className="px-6 py-4 text-sm text-gray-500">Resource created successfully</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-mono text-gray-900">400</td>
                <td className="px-6 py-4 text-sm text-gray-600">Bad Request</td>
                <td className="px-6 py-4 text-sm text-gray-500">Invalid parameters or request body</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-900">401</td>
                <td className="px-6 py-4 text-sm text-gray-600">Unauthorized</td>
                <td className="px-6 py-4 text-sm text-gray-500">Missing or invalid authentication token</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-mono text-gray-900">403</td>
                <td className="px-6 py-4 text-sm text-gray-600">Forbidden</td>
                <td className="px-6 py-4 text-sm text-gray-500">Insufficient permissions</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-900">404</td>
                <td className="px-6 py-4 text-sm text-gray-600">Not Found</td>
                <td className="px-6 py-4 text-sm text-gray-500">Resource does not exist</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm font-mono text-gray-900">429</td>
                <td className="px-6 py-4 text-sm text-gray-600">Too Many Requests</td>
                <td className="px-6 py-4 text-sm text-gray-500">Rate limit exceeded</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono text-gray-900">500</td>
                <td className="px-6 py-4 text-sm text-gray-600">Internal Server Error</td>
                <td className="px-6 py-4 text-sm text-gray-500">Server error, please retry</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="support" className="text-2xl font-semibold text-gray-900 mt-12 mb-4">Support</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 not-prose">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">📚 Documentation</h3>
            <ul className="space-y-1">
              <li><Link href="/docs" className="text-indigo-600 hover:text-indigo-800 text-sm">Main Documentation</Link></li>
              <li><Link href="/docs/api" className="text-indigo-600 hover:text-indigo-800 text-sm">API Reference</Link></li>
              <li><a href="https://github.com/spinforge/examples" className="text-indigo-600 hover:text-indigo-800 text-sm">Examples</a></li>
            </ul>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">💬 Community</h3>
            <ul className="space-y-1">
              <li><a href="https://discord.gg/spinforge" className="text-indigo-600 hover:text-indigo-800 text-sm">Discord</a></li>
              <li><a href="https://github.com/spinforge/spinforge/discussions" className="text-indigo-600 hover:text-indigo-800 text-sm">GitHub Discussions</a></li>
              <li><a href="https://stackoverflow.com/questions/tagged/spinforge" className="text-indigo-600 hover:text-indigo-800 text-sm">Stack Overflow</a></li>
            </ul>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">✉️ Contact</h3>
            <ul className="space-y-1">
              <li><a href="mailto:support@spinforge.app" className="text-indigo-600 hover:text-indigo-800 text-sm">support@spinforge.app</a></li>
              <li><a href="mailto:enterprise@spinforge.app" className="text-indigo-600 hover:text-indigo-800 text-sm">enterprise@spinforge.app</a></li>
            </ul>
          </div>
        </div>
      </div>
    </DocsPageWrapper>
  );
}