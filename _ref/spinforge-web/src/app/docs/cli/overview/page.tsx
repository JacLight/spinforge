import {
  Terminal,
  Book,
  Key,
  Rocket,
  List,
  ScrollText,
  Settings,
} from "lucide-react";
import Link from "next/link";

export default function CLIOverviewPage() {
  const commands = [
    {
      name: "auth",
      description: "Manage authentication",
      icon: Key,
      subcommands: [
        { name: "login", description: "Login to SpinForge" },
        { name: "logout", description: "Logout from SpinForge" },
        { name: "whoami", description: "Display current user" },
      ],
    },
    {
      name: "deploy",
      description: "Deploy applications",
      icon: Rocket,
      subcommands: [
        { name: "deploy", description: "Deploy current directory" },
        { name: "deploy --no-build", description: "Deploy without building" },
      ],
    },
    {
      name: "deploy-folder",
      description: "Deploy a specific folder",
      icon: Rocket,
      subcommands: [
        {
          name: "deploy-folder <path>",
          description: "Deploy specified folder",
        },
      ],
    },
    {
      name: "list",
      description: "List deployments",
      icon: List,
      subcommands: [
        { name: "list", description: "List all deployments" },
        { name: "list --json", description: "Output as JSON" },
      ],
    },
    {
      name: "logs",
      description: "View deployment logs",
      icon: ScrollText,
      subcommands: [
        {
          name: "logs <deployment-id>",
          description: "View logs for deployment",
        },
        {
          name: "logs <deployment-id> --follow",
          description: "Follow logs in real-time",
        },
      ],
    },
    {
      name: "config",
      description: "Manage configuration",
      icon: Settings,
      subcommands: [
        { name: "config get <key>", description: "Get config value" },
        { name: "config set <key> <value>", description: "Set config value" },
      ],
    },
  ];

  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">CLI Reference</h1>
      <p className="text-lg text-gray-600 mb-8">
        The SpinForge CLI provides a powerful command-line interface for
        deploying and managing your applications.
      </p>

      <div className="bg-gray-50 rounded-lg p-6 mb-8 not-prose">
        <h3 className="text-lg font-semibold mb-4">Quick Command Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded border border-gray-200">
            <code className="text-sm text-gray-800">
              spinforge-cli auth login
            </code>
            <p className="text-xs text-gray-600 mt-1">
              Authenticate with SpinForge
            </p>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <code className="text-sm text-gray-800">spinforge-cli deploy</code>
            <p className="text-xs text-gray-600 mt-1">
              Deploy current directory
            </p>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <code className="text-sm text-gray-800">spinforge-cli list</code>
            <p className="text-xs text-gray-600 mt-1">List all deployments</p>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <code className="text-sm text-gray-800">
              spinforge-cli logs &lt;id&gt;
            </code>
            <p className="text-xs text-gray-600 mt-1">View deployment logs</p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Global Options</h2>

      <p className="mb-4">These options can be used with any command:</p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto">
          <code>
            --help, -h Show help for command --version, -v Show CLI version
            --debug Enable debug output --json Output in JSON format (where
            applicable) --no-color Disable colored output
          </code>
        </pre>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Commands</h2>

      <div className="space-y-8 not-prose">
        {commands.map((cmd) => {
          const Icon = cmd.icon;
          return (
            <div
              key={cmd.name}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-start mb-4">
                <Icon className="h-6 w-6 text-indigo-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {cmd.name}
                  </h3>
                  <p className="text-gray-600 mt-1">{cmd.description}</p>
                </div>
              </div>

              <div className="ml-9 space-y-3">
                {cmd.subcommands.map((sub) => (
                  <div key={sub.name} className="bg-gray-50 rounded p-3">
                    <code className="text-sm font-mono text-gray-800">
                      spinforge-cli {sub.name}
                    </code>
                    <p className="text-sm text-gray-600 mt-1">
                      {sub.description}
                    </p>
                  </div>
                ))}
              </div>

              <Link
                href={`/docs/cli/${cmd.name}`}
                className="inline-flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium mt-4 ml-9"
              >
                View {cmd.name} documentation →
              </Link>
            </div>
          );
        })}
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-12">
        Environment Variables
      </h2>

      <p className="mb-4">
        The CLI respects the following environment variables:
      </p>

      <div className="overflow-x-auto mb-8">
        <table className="min-w-full divide-y divide-gray-200 not-prose">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Variable
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
                SPINHUB_API_URL
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                API endpoint URL
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                https://api.spinforge.com
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                SPINFORGE_TOKEN
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                API authentication token
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">-</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                SPINFORGE_CONFIG_DIR
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Config directory path
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">~/.spinforge</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                NO_COLOR
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Disable colored output
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">false</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Configuration File
      </h2>

      <p className="mb-4">
        The CLI stores configuration in{" "}
        <code className="bg-gray-100 px-2 py-1 rounded">
          ~/.spinforge/config.json
        </code>
        :
      </p>

      <div className="bg-gray-900 rounded-lg p-6 mb-8 not-prose">
        <pre className="text-gray-100 overflow-x-auto">
          <code>{`{
  "apiUrl": "https://api.spinforge.com",
  "token": "your-auth-token",
  "defaultRegion": "us-east-1",
  "analytics": true
}`}</code>
        </pre>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Need help?</h3>
        <p className="text-blue-800 mb-4">
          Get help for any command by adding the{" "}
          <code className="bg-blue-100 px-2 py-1 rounded">--help</code> flag.
        </p>
        <div className="bg-blue-900 text-blue-100 p-4 rounded">
          <code>spinforge-cli deploy --help</code>
        </div>
      </div>
    </div>
  );
}
