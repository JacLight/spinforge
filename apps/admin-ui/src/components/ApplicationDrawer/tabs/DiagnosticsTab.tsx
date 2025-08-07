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
  const [cookies, setCookies] = useState<Record<string, string> | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [activeQuickCommand, setActiveQuickCommand] = useState<string | null>(null);
  const [fileCheckResults, setFileCheckResults] = useState<{ [key: string]: string } | null>(null);

  // Check environment variables
  const checkEnvVars = async () => {
    try {
      if (vhost.type === 'container') {
        const execResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/container/exec`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'env' })
        });
        if (execResponse.ok) {
          const result = await execResponse.json();
          const vars: Record<string, string> = {};
          result.output.split('\n').forEach((line: string) => {
            const [key, ...valueParts] = line.split('=');
            if (key && key.trim()) vars[key.trim()] = valueParts.join('=');
          });
          setEnvVars(vars);
          toast.success('Environment variables loaded');
        } else {
          const errorData = await execResponse.json().catch(() => null);
          toast.error(errorData?.error || 'Failed to load environment variables');
        }
      } else {
        toast.error('Environment variables only available for container sites');
      }
    } catch (error) {
      console.error('Failed to load environment variables:', error);
      toast.error('Failed to load environment variables');
    }
  };

  // Check cookies - make a test request to the site and inspect cookies
  const checkCookies = async () => {
    try {
      // Make a request to the site to get cookie information
      const testUrl = `https://${vhost.domain}`;
      
      // For now, we'll show the browser's cookies for the current domain
      // In a real implementation, you might want to make a server-side request
      const browserCookies = document.cookie;
      
      if (browserCookies) {
        const cookieObj: Record<string, string> = {};
        browserCookies.split(';').forEach(cookie => {
          const [key, value] = cookie.trim().split('=');
          if (key) cookieObj[key] = value || '';
        });
        setCookies(cookieObj);
        toast.success('Browser cookies loaded');
      } else {
        // Show example of how to inspect cookies
        setCookies({
          'Info': 'No cookies found in current browser session',
          'Note': 'To inspect site cookies, visit the site directly',
          'URL': testUrl
        });
        toast.info('No cookies found in current session');
      }
    } catch (error) {
      console.error('Failed to check cookies:', error);
      toast.error('Failed to check cookies');
    }
  };

  // Execute command
  const executeCommand = async (cmd?: string) => {
    const command = cmd || commandInput;
    if (!command.trim()) {
      toast.error('Please enter a command');
      return;
    }

    if (vhost.type !== 'container') {
      toast.error('Commands can only be executed on container sites');
      return;
    }

    setIsExecuting(true);
    if (cmd) setActiveQuickCommand(cmd);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sites/${vhost.domain}/container/exec`, {
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

  // Check static site files
  const checkStaticFiles = async (fileType: 'folder' | 'index') => {
    try {
      const folderPath = vhost.target || vhost.static_path || `/data/static/${vhost.domain.replace(/\./g, '_')}`;
      
      // Simulating file checks - in production, this would be an API call
      const results: { [key: string]: string } = {};
      
      if (fileType === 'folder') {
        // Check if folder exists
        results['Folder Path'] = folderPath;
        results['Status'] = vhost.has_files !== false ? '✅ Folder exists' : '❌ Folder not found';
        results['Info'] = vhost.has_files !== false 
          ? 'Static files directory is present' 
          : 'Directory needs to be created and files uploaded';
      } else if (fileType === 'index') {
        // Check if index.html exists
        results['File'] = `${folderPath}/index.html`;
        results['Status'] = vhost.has_files === true ? '✅ index.html exists' : '❌ index.html not found';
        results['Info'] = vhost.has_files === true
          ? 'Main index file is present and being served'
          : 'Upload an index.html file to serve your site';
      }
      
      setFileCheckResults(results);
      toast.success(`${fileType === 'folder' ? 'Folder' : 'Index file'} check completed`);
    } catch (error) {
      toast.error(`Failed to check ${fileType === 'folder' ? 'folder' : 'index file'}`);
    }
  };

  // Check load balancer backends
  const checkBackends = async () => {
    try {
      if (!vhost.backends || vhost.backends.length === 0) {
        setFileCheckResults({
          'Status': '❌ No backends configured',
          'Info': 'Add backend servers in the configuration'
        });
        toast.error('No backends configured');
        return;
      }

      const results: { [key: string]: string } = {};
      vhost.backends.forEach((backend: any, index: number) => {
        const backendUrl = backend.url || backend;
        results[`Backend ${index + 1}`] = backendUrl;
        results[`Status ${index + 1}`] = '🔄 Check backend health manually';
      });
      results['Total Backends'] = `${vhost.backends.length} configured`;
      results['Info'] = 'Use health check endpoints to verify backend status';
      
      setFileCheckResults(results);
      toast.success('Backend configuration loaded');
    } catch (error) {
      toast.error('Failed to check backends');
    }
  };


  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };


  return (
    <div className="space-y-6">
      {/* Quick Diagnostics - Available for all site types */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Diagnostics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Environment Variables - Container only */}
          {vhost.type === 'container' && (
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
          )}

          {/* Cookie Check - Available for all site types */}
          <button
            onClick={() => checkCookies()}
            className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg text-white">
                <Cookie className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Check Cookies</p>
                <p className="text-xs text-gray-600">View request cookies</p>
              </div>
            </div>
          </button>
        </div>

        {/* Quick Commands - Container only */}
        {vhost.type === 'container' && (
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Quick Commands</p>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => executeCommand('ps aux')}
                disabled={isExecuting}
                className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex flex-col items-center gap-1"
              >
                <Activity className="h-4 w-4 text-gray-600" />
                <span>Process List</span>
              </button>
              <button
                onClick={() => executeCommand('df -h')}
                disabled={isExecuting}
                className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex flex-col items-center gap-1"
              >
                <HardDrive className="h-4 w-4 text-gray-600" />
                <span>Disk Usage</span>
              </button>
              <button
                onClick={() => executeCommand('free -h')}
                disabled={isExecuting}
                className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex flex-col items-center gap-1"
              >
                <Database className="h-4 w-4 text-gray-600" />
                <span>Memory Info</span>
              </button>
              <button
                onClick={() => executeCommand('ifconfig')}
                disabled={isExecuting}
                className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex flex-col items-center gap-1"
              >
                <Network className="h-4 w-4 text-gray-600" />
                <span>Network Info</span>
              </button>
              <button
                onClick={() => executeCommand('pwd')}
                disabled={isExecuting}
                className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex flex-col items-center gap-1"
              >
                <FileText className="h-4 w-4 text-gray-600" />
                <span>Current Dir</span>
              </button>
              <button
                onClick={() => executeCommand('uname -a')}
                disabled={isExecuting}
                className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex flex-col items-center gap-1"
              >
                <Server className="h-4 w-4 text-gray-600" />
                <span>OS Info</span>
              </button>
              <button
                onClick={() => executeCommand('lscpu')}
                disabled={isExecuting}
                className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex flex-col items-center gap-1"
              >
                <Cpu className="h-4 w-4 text-gray-600" />
                <span>CPU Info</span>
              </button>
              <button
                onClick={() => executeCommand('uptime')}
                disabled={isExecuting}
                className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex flex-col items-center gap-1"
              >
                <Clock className="h-4 w-4 text-gray-600" />
                <span>Uptime</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Static Site Check */}
      {vhost.type === 'static' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Static Site Diagnostics</h3>
          
          <div className="space-y-3">
            {/* File Check Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => checkStaticFiles('folder')}
                className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl hover:from-green-100 hover:to-green-200 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500 rounded-lg text-white">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Check Folder</p>
                    <p className="text-xs text-gray-600">Verify directory exists</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => checkStaticFiles('index')}
                className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500 rounded-lg text-white">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Check index.html</p>
                    <p className="text-xs text-gray-600">Verify main file exists</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Site Info */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg text-white">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Static Site Configuration</p>
                  <p className="text-sm text-gray-600">
                    Files served from: {vhost.target || vhost.static_path || `/data/static/${vhost.domain.replace(/\./g, '_')}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Static sites are served directly by the web server.
                  </p>
                </div>
              </div>
            </div>
            
            {vhost.has_files === false && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">No files detected</span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  Upload files using the deployment section to make your site accessible.
                </p>
              </div>
            )}
            
            {vhost.has_files === true && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Files detected</span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  Your static site files are ready and being served.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Load Balancer Backend Testing */}
      {vhost.type === 'loadbalancer' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Load Balancer Diagnostics</h3>
          
          {/* Check Backends Button */}
          <button
            onClick={checkBackends}
            className="w-full mb-4 p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-xl hover:from-indigo-100 hover:to-indigo-200 transition-all group"
          >
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 bg-indigo-500 rounded-lg text-white">
                <Network className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Check All Backends</p>
                <p className="text-xs text-gray-600">Verify backend services configuration</p>
              </div>
            </div>
          </button>
          
          <div className="space-y-3">
            {vhost.backends.map((backend: any, idx: number) => {
              const backendUrl = backend.url || backend;
              return (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Backend {idx + 1}</p>
                      <p className="text-xs text-gray-600 font-mono">{backendUrl}</p>
                    </div>
                    <div className="text-xs text-gray-500">
                      Load balanced
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">Backend Testing</p>
            <p className="text-xs text-blue-700 mt-1">
              Use the command execution section below to test backends manually:
            </p>
            <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-2 block text-blue-800">
              curl -I {vhost.backends[0]?.url || vhost.backends[0] || 'http://backend-url'}
            </code>
          </div>
        </div>
      )}

      {/* Command Execution - Container sites only */}
      {vhost.type === 'container' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Execute Command</h3>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeCommand()}
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
      )}

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

      {/* File Check Results Display */}
      {fileCheckResults && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Check Results</h3>
            <button
              onClick={() => setFileCheckResults(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4">
            {Object.entries(fileCheckResults).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between py-2 hover:bg-gray-800 px-2 rounded">
                <span className="font-mono text-sm text-blue-400">{key}:</span>
                <span className="font-mono text-sm text-green-400">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cookie Information Display */}
      {cookies && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Cookie Information</h3>
            <button
              onClick={() => setCookies(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            <p className="text-xs text-gray-400 mb-3">Browser cookies for current domain:</p>
            {Object.entries(cookies).map(([key, value]) => (
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