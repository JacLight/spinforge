import { Terminal, ScrollText, Activity, Filter, Clock } from "lucide-react";

export default function CLILogsPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">logs</h1>
      <p className="text-lg text-gray-600 mb-8">
        View real-time and historical logs from your deployments. The logs command helps you 
        debug issues, monitor application behavior, and track requests.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Basic Usage</h2>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <div className="flex items-center mb-4">
          <Terminal className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-400 text-sm">Terminal</span>
        </div>
        <pre className="text-gray-100 overflow-x-auto"><code>{`# View logs for a deployment
spinforge-cli logs my-app-prod

# Follow logs in real-time
spinforge-cli logs my-app-prod --follow

# View last 100 lines
spinforge-cli logs my-app-prod --tail 100

# Filter by log level
spinforge-cli logs my-app-prod --level error`}</code></pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Log Format</h2>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-sm text-gray-700 font-mono"><code>{`2024-01-15T10:30:45.123Z [INFO] Server started on port 3000
2024-01-15T10:30:46.456Z [INFO] Connected to database
2024-01-15T10:31:02.789Z [INFO] GET / 200 45ms
2024-01-15T10:31:15.234Z [WARN] Slow query detected (150ms)
2024-01-15T10:31:28.567Z [ERROR] Failed to fetch user: Connection timeout
2024-01-15T10:31:28.568Z [ERROR] Stack trace:
  at fetchUser (/app/src/api/users.js:45:15)
  at handleRequest (/app/src/server.js:123:20)`}</code></pre>
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
                Default
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --follow, -f
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Follow logs in real-time
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                false
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --tail, -n
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Number of lines to show
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                50
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --since
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Show logs since timestamp
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                -
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --level
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Filter by log level
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                all
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --search
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Search logs for text
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                -
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                --json
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Output as JSON
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                false
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Log Levels</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 not-prose mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl mb-1">ℹ️</div>
          <h4 className="font-semibold text-blue-900">INFO</h4>
          <p className="text-blue-800 text-xs mt-1">General information</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl mb-1">🐛</div>
          <h4 className="font-semibold text-green-900">DEBUG</h4>
          <p className="text-green-800 text-xs mt-1">Detailed debugging</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <div className="text-2xl mb-1">⚠️</div>
          <h4 className="font-semibold text-amber-900">WARN</h4>
          <p className="text-amber-800 text-xs mt-1">Warning messages</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-2xl mb-1">❌</div>
          <h4 className="font-semibold text-red-900">ERROR</h4>
          <p className="text-red-800 text-xs mt-1">Error messages</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Common Usage Examples</h2>

      <div className="space-y-6 not-prose">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Debug Application Errors</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Show only errors from the last hour
spinforge-cli logs my-app --level error --since 1h

# Search for specific error
spinforge-cli logs my-app --search "database connection" --level error`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            Filter logs to quickly find and diagnose errors in your application.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Monitor Live Traffic</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Follow logs and grep for HTTP requests
spinforge-cli logs my-app --follow | grep "GET\|POST"

# Watch for slow requests (>1000ms)
spinforge-cli logs my-app --follow --search "ms" | grep -E "[0-9]{4,}ms"`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            Use follow mode to monitor your application's behavior in real-time.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Export Logs for Analysis</h3>
          <div className="bg-gray-900 rounded-lg p-4 mb-3">
            <pre className="text-gray-100 overflow-x-auto"><code>{`# Export last 1000 lines as JSON
spinforge-cli logs my-app --tail 1000 --json > logs.json

# Get logs from specific time range
spinforge-cli logs my-app --since "2024-01-15T10:00:00Z" --json > today-logs.json`}</code></pre>
          </div>
          <p className="text-gray-600 text-sm">
            Export logs in JSON format for further analysis with other tools.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">Time Formats</h2>

      <p className="mb-4">The <code className="bg-gray-100 px-2 py-1 rounded">--since</code> option accepts various time formats:</p>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <ul className="space-y-2 text-sm">
          <li><code className="bg-white px-2 py-1 rounded font-mono">1h</code> - 1 hour ago</li>
          <li><code className="bg-white px-2 py-1 rounded font-mono">30m</code> - 30 minutes ago</li>
          <li><code className="bg-white px-2 py-1 rounded font-mono">1d</code> - 1 day ago</li>
          <li><code className="bg-white px-2 py-1 rounded font-mono">2024-01-15T10:00:00Z</code> - ISO 8601 timestamp</li>
          <li><code className="bg-white px-2 py-1 rounded font-mono">2024-01-15</code> - Date only (midnight UTC)</li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Structured Logging</h2>

      <p className="mb-4">
        SpinForge automatically parses JSON logs from your application:
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto text-sm"><code>{`// Your application logs this:
console.log(JSON.stringify({
  level: "info",
  message: "User login",
  userId: "user_123",
  ip: "192.168.1.1",
  timestamp: new Date().toISOString()
}));

// SpinForge displays it as:
2024-01-15T10:30:45.123Z [INFO] User login userId=user_123 ip=192.168.1.1`}</code></pre>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-amber-900 mb-2">Performance Tip</h3>
        <p className="text-amber-800">
          When following logs for high-traffic applications, use filters to reduce noise:
        </p>
        <div className="bg-amber-900 text-amber-100 p-4 rounded mt-3">
          <code className="text-sm">spinforge-cli logs my-app --follow --level warn</code>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose mt-8">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">Log Retention</h3>
        <p className="text-indigo-700">
          Log retention varies by plan:
        </p>
        <ul className="mt-3 space-y-1 text-indigo-700">
          <li>• <strong>Hobby:</strong> 24 hours</li>
          <li>• <strong>Pro:</strong> 7 days</li>
          <li>• <strong>Enterprise:</strong> 30 days (customizable)</li>
        </ul>
      </div>
    </div>
  );
}