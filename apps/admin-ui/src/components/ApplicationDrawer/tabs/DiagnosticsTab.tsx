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
  Globe
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
      {/* Execute Command - Always show for all types */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Execute Command</h3>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
              placeholder={
                vhost.type === 'container' ? "Enter command (e.g., ls -la, ps aux, df -h)" :
                vhost.type === 'loadbalancer' ? "Enter command (e.g., nginx -t, curl backend-url)" :
                vhost.type === 'static' ? "Enter command (e.g., ls -la, find . -name '*.html')" :
                "Enter command"
              }
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

          {/* Context-specific Quick Commands */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Commands</p>
            <div className="grid grid-cols-4 gap-2">
              {vhost.type === 'container' && (
                <>
                  <button onClick={() => executeCommand('ps aux')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Process List</button>
                  <button onClick={() => executeCommand('df -h')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Disk Usage</button>
                  <button onClick={() => executeCommand('free -h')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Memory</button>
                  <button onClick={() => executeCommand('env')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Env Vars</button>
                  <button onClick={() => executeCommand('netstat -tulpn')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Ports</button>
                  <button onClick={() => executeCommand('tail -n 100 /var/log/app.log')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">App Logs</button>
                  <button onClick={() => executeCommand('npm list')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">NPM Packages</button>
                  <button onClick={() => executeCommand('node -v')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Node Version</button>
                </>
              )}
              
              {vhost.type === 'loadbalancer' && vhost.backends && (
                <>
                  <button onClick={() => checkNginxConfig()} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Nginx Config</button>
                  <button onClick={() => checkAccessLogs()} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Access Logs</button>
                  <button onClick={() => executeCommand('nginx -t')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Test Config</button>
                  <button onClick={() => executeCommand('systemctl status nginx')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Nginx Status</button>
                  {vhost.backends.slice(0, 4).map((backend: any, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => testBackend(backend.url)} 
                      disabled={isExecuting} 
                      className="p-2 text-xs bg-blue-100 hover:bg-blue-200 rounded-lg truncate"
                      title={`Test ${backend.url}`}
                    >
                      Test: {new URL(backend.url).hostname}
                    </button>
                  ))}
                </>
              )}
              
              {vhost.type === 'static' && (
                <>
                  <button onClick={() => executeCommand(`ls -la ${vhost.target || '/var/www/html'}`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">List Files</button>
                  <button onClick={() => executeCommand(`du -sh ${vhost.target || '/var/www/html'}`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Disk Usage</button>
                  <button onClick={() => executeCommand(`find ${vhost.target || '/var/www/html'} -type f -name "*.html" | head -20`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">HTML Files</button>
                  <button onClick={() => executeCommand(`find ${vhost.target || '/var/www/html'} -type f -mtime -1`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Recent Changes</button>
                  <button onClick={() => checkAccessLogs()} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Access Logs</button>
                  <button onClick={() => executeCommand(`tail -n 50 /var/log/nginx/error.log`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Error Logs</button>
                  <button onClick={() => executeCommand(`ls -la ${vhost.target || '/var/www/html'}/assets`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Assets</button>
                  <button onClick={() => executeCommand(`wc -l ${vhost.target || '/var/www/html'}/*.html`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Line Count</button>
                </>
              )}
              
              {vhost.type === 'proxy' && (
                <>
                  <button onClick={() => executeCommand(`curl -I ${vhost.target}`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Check Target</button>
                  <button onClick={() => executeCommand(`ping -c 4 ${new URL(vhost.target).hostname}`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Ping Target</button>
                  <button onClick={() => checkNginxConfig()} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Proxy Config</button>
                  <button onClick={() => checkAccessLogs()} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Access Logs</button>
                  <button onClick={() => executeCommand('netstat -an | grep ESTABLISHED')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Connections</button>
                  <button onClick={() => executeCommand(`curl -s -o /dev/null -w "%{http_code}" ${vhost.target}`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Status Code</button>
                  <button onClick={() => executeCommand('nginx -t')} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Test Config</button>
                  <button onClick={() => executeCommand(`traceroute ${new URL(vhost.target).hostname}`)} disabled={isExecuting} className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg">Traceroute</button>
                </>
              )}
            </div>
          </div>

          {/* Command Output */}
          {commandOutput && (
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96">
              <pre className="whitespace-pre-wrap">{commandOutput}</pre>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}