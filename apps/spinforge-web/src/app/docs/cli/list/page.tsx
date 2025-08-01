import { Terminal, List, Clock, Globe, CheckCircle } from "lucide-react";

export default function CLIListPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">list</h1>
      <p className="text-lg text-gray-600 mb-8">
        List all your deployments with their status, URLs, and other details. The list command 
        provides a quick overview of your deployed applications.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Basic Usage</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code>{`# List all deployments
spinforge-cli list

# Output as JSON
spinforge-cli list --json

# Show only active deployments
spinforge-cli list --status active

# Limit results
spinforge-cli list --limit 10`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Example Output</h2>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-sm text-gray-700"><code>{`┌─────────────────┬──────────────┬─────────┬────────────────────────────────────┬─────────────┐
│ Name            │ Status       │ Region  │ URL                                │ Created     │
├─────────────────┼──────────────┼─────────┼────────────────────────────────────┼─────────────┤
│ my-app-prod     │ ✅ Active    │ Global  │ https://my-app-prod.spinforge.app  │ 2 hours ago │
│ staging-site    │ ✅ Active    │ US-East │ https://staging-site.spinforge.app │ 1 day ago   │
│ old-version     │ ⏸️  Inactive │ Global  │ https://old-version.spinforge.app  │ 5 days ago  │
│ test-deploy     │ ❌ Failed    │ EU-West │ -                                  │ 1 week ago  │
└─────────────────┴──────────────┴─────────┴────────────────────────────────────┴─────────────┘

Total: 4 deployments (2 active, 1 inactive, 1 failed)`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Options</h2>

      <div className="overflow-x-auto mb-8">
        <table className="min-w-full divide-y divide-gray-200 not-prose">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Option
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Example
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --json
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Output as JSON for scripting
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                spinforge-cli list --json
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --status
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Filter by status (active, inactive, failed)
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                --status active
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --limit
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Number of deployments to show
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                --limit 20
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --sort
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Sort by field (created, name, status)
              </td>
              <td className="px-6 py-4 text-sm font-mono text-gray-500">
                --sort created
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Deployment Statuses</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            Active
          </h4>
          <p className="text-green-800 text-sm">
            Deployment is live and serving traffic
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-2 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Building
          </h4>
          <p className="text-yellow-800 text-sm">
            Deployment is being processed
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">
            ⏸️ Inactive
          </h4>
          <p className="text-gray-700 text-sm">
            Deployment is paused or scaled to zero
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 mb-2">
            ❌ Failed
          </h4>
          <p className="text-red-800 text-sm">
            Deployment failed during creation
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">JSON Output</h2>

      <p className="mb-4">Use <code className="bg-gray-100 px-2 py-1 rounded">--json</code> for scripting and automation:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`$ spinforge-cli list --json | jq '.[0]'

{
  "id": "dep_abc123",
  "name": "my-app-prod",
  "status": "active",
  "url": "https://my-app-prod.spinforge.app",
  "region": "global",
  "framework": "nextjs",
  "created": "2024-01-15T10:30:00Z",
  "updated": "2024-01-15T10:31:00Z",
  "customDomains": ["www.example.com"],
  "environment": "production"
}`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Common Usage Patterns</h2>

      <div className="space-y-6 not-prose">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Find Deployment by Name</h3>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Using grep
spinforge-cli list | grep "my-app"

# Using JSON output with jq
spinforge-cli list --json | jq '.[] | select(.name | contains("my-app"))'`}</code></pre>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Get Latest Deployment</h3>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Show only the most recent deployment
spinforge-cli list --limit 1 --sort created

# Get URL of latest deployment
spinforge-cli list --json --limit 1 | jq -r '.[0].url'`}</code></pre>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Monitor Active Deployments</h3>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Count active deployments
spinforge-cli list --status active --json | jq 'length'

# List URLs of all active deployments
spinforge-cli list --status active --json | jq -r '.[].url'`}</code></pre>
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose mt-8">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">Next Steps</h3>
        <p className="text-indigo-700 mb-4">
          After listing your deployments, you might want to:
        </p>
        <ul className="space-y-2 text-indigo-700">
          <li className="flex items-center">
            <Globe className="h-4 w-4 mr-2" />
            View logs with <code className="bg-indigo-100 px-2 py-1 rounded text-sm">spinforge-cli logs &lt;deployment-id&gt;</code>
          </li>
          <li className="flex items-center">
            <Globe className="h-4 w-4 mr-2" />
            Delete old deployments from the dashboard
          </li>
          <li className="flex items-center">
            <Globe className="h-4 w-4 mr-2" />
            Update deployment settings in the web interface
          </li>
        </ul>
      </div>
    </div>
  );
}