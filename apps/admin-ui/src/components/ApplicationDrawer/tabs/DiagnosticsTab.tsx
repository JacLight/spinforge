import React, { useState } from 'react';
import { 
  Terminal, 
  Package, 
  Cookie, 
  Play, 
  HardDrive, 
  Cpu, 
  Network, 
  Clock,
  Activity,
  FileText,
  Database,
  Server,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Globe,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticsTabProps {
  vhost: any;
}

export default function DiagnosticsTab({ vhost }: DiagnosticsTabProps) {
  const [envVars, setEnvVars] = useState<Record<string, string> | null>(null);
  const [cookies, setCookies] = useState<any[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [activeQuickCommand, setActiveQuickCommand] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [backendStats, setBackendStats] = useState<any[]>([]);
  const [staticSiteStats, setStaticSiteStats] = useState<any>(null);

  // Check environment variables
  const checkEnvVars = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/env`);
      if (response.ok) {
        const data = await response.json();
        setEnvVars(data.env || {});
        toast.success('Environment variables loaded');
      } else {
        // Fallback for container type - execute env command
        if (vhost.type === 'container') {
          const execResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/exec`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'env' })
          });
          if (execResponse.ok) {
            const result = await execResponse.json();
            const vars: Record<string, string> = {};
            result.output.split('\n').forEach((line: string) => {
              const [key, ...valueParts] = line.split('=');
              if (key) vars[key] = valueParts.join('=');
            });
            setEnvVars(vars);
            toast.success('Environment variables loaded');
          } else {
            toast.error('Failed to load environment variables');
          }
        } else {
          toast.error('Environment variables not available for this site type');
        }
      }
    } catch (error) {
      console.error('Failed to load environment variables:', error);
      toast.error('Failed to load environment variables');
    }
  };

  // Check cookies
  const checkCookies = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/cookies`);
      if (response.ok) {
        const data = await response.json();
        setCookies(data.cookies || []);
        toast.success('Cookies loaded');
      } else {
        const errorData = await response.json().catch(() => null);
        toast.error(errorData?.error || 'Failed to load cookies');
      }
    } catch (error) {
      console.error('Failed to load cookies:', error);
      toast.error('Failed to load cookies');
    }
  };

  // Execute command
  const executeCommand = async (cmd?: string) => {
    const command = cmd || commandInput;
    if (!command.trim()) {
      toast.error('Please enter a command');
      return;
    }

    setIsExecuting(true);
    if (cmd) setActiveQuickCommand(cmd);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      if (response.ok) {
        const data = await response.json();
        setCommandOutput(`$ ${command}\n\n${data.output || 'Command executed successfully'}`);
        toast.success('Command executed');
      } else {
        const errorData = await response.json().catch(() => null);
        setCommandOutput(`$ ${command}\n\nError: ${errorData?.error || response.statusText || 'Failed to execute command'}`);
        toast.error(errorData?.error || 'Failed to execute command');
      }
    } catch (error) {
      console.error('Execute command error:', error);
      setCommandOutput(`$ ${command}\n\nError: ${error instanceof Error ? error.message : 'Failed to execute command'}`);
      toast.error('Failed to execute command');
    } finally {
      setIsExecuting(false);
      setActiveQuickCommand(null);
    }
  };

  // Test load balancer backends
  const testBackend = async (backendUrl: string) => {
    setIsExecuting(true);
    try {
      const testCommand = `curl -I -s -o /dev/null -w "%{http_code} - %{time_total}s" ${backendUrl}`;
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: testCommand })
      });

      if (response.ok) {
        const data = await response.json();
        setCommandOutput(`Testing backend: ${backendUrl}\n\n${data.output}`);
        toast.success('Backend tested');
      }
    } catch (error) {
      toast.error('Failed to test backend');
    } finally {
      setIsExecuting(false);
    }
  };

  // Check nginx config for load balancer
  const checkNginxConfig = async () => {
    setIsExecuting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `cat /etc/nginx/sites-enabled/${vhost.domain}.conf` })
      });

      if (response.ok) {
        const data = await response.json();
        setCommandOutput(`Nginx configuration for ${vhost.domain}:\n\n${data.output}`);
      }
    } catch (error) {
      toast.error('Failed to get nginx config');
    } finally {
      setIsExecuting(false);
    }
  };

  // Check access logs
  const checkAccessLogs = async () => {
    setIsExecuting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `tail -n 50 /var/log/nginx/${vhost.domain}-access.log` })
      });

      if (response.ok) {
        const data = await response.json();
        setCommandOutput(`Recent access logs:\n\n${data.output}`);
      }
    } catch (error) {
      toast.error('Failed to get access logs');
    } finally {
      setIsExecuting(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const quickCommands = [
    { label: 'Process List', cmd: 'ps aux', icon: Activity },
    { label: 'Disk Usage', cmd: 'df -h', icon: HardDrive },
    { label: 'Memory Info', cmd: 'free -h', icon: Database },
    { label: 'Network Info', cmd: 'ifconfig', icon: Network },
    { label: 'Current Dir', cmd: 'pwd', icon: FileText },
    { label: 'OS Info', cmd: 'uname -a', icon: Server },
    { label: 'CPU Info', cmd: 'lscpu', icon: Cpu },
    { label: 'Uptime', cmd: 'uptime', icon: Clock }
  ];

  return (
    <div className="space-y-6">
      {/* Container Quick Diagnostics */}
      {vhost.type === 'container' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Diagnostics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => checkEnvVars()}
              className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg text-white">
                  <Package className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Check Env Variables</p>
                  <p className="text-xs text-gray-600">View container environment</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => executeCommand('tail -n 100 /var/log/app.log')}
              className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500 rounded-lg text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Container Logs</p>
                  <p className="text-xs text-gray-600">View recent container logs</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Static Site Check */}
      {vhost.type === 'static' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Site Status</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => executeCommand(`test -d ${vhost.target || '/var/www/html'} && echo "✅ Directory exists: ${vhost.target || '/var/www/html'}" || echo "❌ Directory NOT FOUND: ${vhost.target || '/var/www/html'}"`)}
              className="w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-left"
            >
              Check if directory exists
            </button>
            <button
              onClick={() => executeCommand(`test -f ${vhost.target || '/var/www/html'}/index.html && echo "✅ index.html exists" || echo "❌ index.html NOT FOUND"`)}
              className="w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-left"
            >
              Check if index.html exists
            </button>
            <button
              onClick={() => executeCommand(`ls -la ${vhost.target || '/var/www/html'} | head -20`)}
              className="w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-left"
            >
              List files in directory
            </button>
          </div>
        </div>
      )}

      {/* Load Balancer Backend Testing */}
      {vhost.type === 'loadbalancer' && vhost.backends && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Backends</h3>
          
          <div className="space-y-2">
            {vhost.backends.map((backend: any, idx: number) => {
              const backendUrl = backend.url || backend;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    const testCmd = `echo "=== Testing backend ${idx + 1} ===" && echo "URL: ${backendUrl}" && echo "" && curl -w "Status: %{http_code}\\nTime: %{time_total}s\\nSize: %{size_download} bytes\\n" -o /dev/null -s ${backendUrl} && echo "✅ Backend is responding" || echo "❌ Backend is not responding"`;
                    executeCommand(testCmd);
                  }}
                  disabled={isExecuting}
                  className="w-full p-3 bg-blue-50 rounded-lg hover:bg-blue-100 text-left flex items-center justify-between group"
                >
                  <div>
                    <p className="font-medium text-sm">Backend {idx + 1}</p>
                    <p className="text-xs text-gray-600 font-mono">{backendUrl}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Command Execution - Always available */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Execute Command</h3>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
              placeholder="Enter command..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              disabled={isExecuting}
            />
            <button
              onClick={() => executeCommand()}
              disabled={isExecuting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Execute
            </button>
          </div>

          {/* Command Output */}
          {commandOutput && (
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96">
              <pre className="whitespace-pre-wrap">{commandOutput}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Environment Variables Display */}
      {envVars && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Environment Variables</h3>
            <button
              onClick={() => setEnvVars(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-1 hover:bg-gray-800 px-2 rounded group">
                <div className="font-mono text-sm">
                  <span className="text-blue-400">{key}</span>
                  <span className="text-gray-500">=</span>
                  <span className="text-green-400">{value}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(`${key}=${value}`, key)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded"
                >
                  {copiedText === key ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-gray-400" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}