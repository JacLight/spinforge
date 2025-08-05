/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Terminal, 
  FileText, 
  Cpu, 
  HardDrive, 
  Wifi, 
  MemoryStick, 
  Clock,
  Play,
  Square,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Database,
  X
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface ContainerStats {
  name: string;
  id: string;
  cpuPercent: string;
  memUsage: string;
  memPercent: string;
  memLimit: string;
  netIO: string;
  blockIO: string;
  pids: string;
}

interface ContainerService {
  name: string;
  domain: string;
  status: 'running' | 'stopped' | 'restarting' | 'unhealthy';
  stats?: ContainerStats;
  health?: {
    status: string;
    checks?: Array<{
      exitCode: number;
      output: string;
      start: string;
      end: string;
    }>;
  };
}

interface ContainerMonitorProps {
  domain: string;
  services: ContainerService[];
  onRefresh?: () => void;
}

export default function ContainerMonitor({ domain, services, onRefresh }: ContainerMonitorProps) {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metrics' | 'logs' | 'exec'>('metrics');
  const [logs, setLogs] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [commandOutput, setCommandOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logLines, setLogLines] = useState(100);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-refresh metrics
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      onRefresh?.();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  // Fetch logs when service is selected
  useEffect(() => {
    if (selectedService && activeTab === 'logs') {
      fetchLogs();
    }
  }, [selectedService, activeTab, logLines]);

  const fetchLogs = async () => {
    if (!selectedService) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/sites/${domain}/container/${selectedService}/logs?lines=${logLines}`);
      const data = await response.json();
      setLogs(data.logs || '');
      
      // Scroll to bottom of logs
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogs('Failed to fetch logs');
    }
  };

  const executeCommand = async () => {
    if (!selectedService || !command.trim()) return;
    
    setIsExecuting(true);
    setCommandOutput('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/sites/${domain}/container/${selectedService}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim() })
      });
      
      const data = await response.json();
      setCommandOutput(data.output || data.error || 'No output');
    } catch (error) {
      setCommandOutput(`Error: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const controlContainer = async (action: 'start' | 'stop' | 'restart', serviceName: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/sites/${domain}/container/${serviceName}/${action}`, {
        method: 'POST'
      });
      onRefresh?.();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-600';
      case 'stopped': return 'text-red-600';
      case 'restarting': return 'text-yellow-600';
      case 'unhealthy': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100';
      case 'stopped': return 'bg-red-100';
      case 'restarting': return 'bg-yellow-100';
      case 'unhealthy': return 'bg-orange-100';
      default: return 'bg-gray-100';
    }
  };

  const toggleServiceExpanded = (serviceName: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceName)) {
      newExpanded.delete(serviceName);
    } else {
      newExpanded.add(serviceName);
    }
    setExpandedServices(newExpanded);
  };

  const formatBytes = (bytes: string): string => {
    const match = bytes.match(/^([\d.]+)([KMGT]?)iB/);
    if (!match) return bytes;
    
    const value = parseFloat(match[1]);
    const unit = match[2] || '';
    
    return `${value.toFixed(1)} ${unit}B`;
  };

  const parseNetIO = (netIO: string): { rx: string; tx: string } => {
    const parts = netIO.split(' / ');
    return {
      rx: parts[0] || '0B',
      tx: parts[1] || '0B'
    };
  };

  return (
    <div className="space-y-6">
      {/* Services Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Container Services</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh
            </label>
            <button
              onClick={onRefresh}
              className="text-gray-600 hover:text-gray-900"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {services.map((service) => {
            const isExpanded = expandedServices.has(service.name);
            const netIO = service.stats ? parseNetIO(service.stats.netIO) : { rx: '0B', tx: '0B' };
            
            return (
              <div key={service.name}>
                <div 
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleServiceExpanded(service.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <div>
                        <h4 className="font-medium text-gray-900">{service.name}</h4>
                        <p className="text-sm text-gray-500">{service.domain}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBgColor(service.status)} ${getStatusColor(service.status)}`}>
                        {service.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      {service.stats && (
                        <>
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-gray-400" />
                            <span>{service.stats.cpuPercent}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MemoryStick className="h-4 w-4 text-gray-400" />
                            <span>{formatBytes(service.stats.memUsage)} / {formatBytes(service.stats.memLimit)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-gray-400" />
                            <span>↓ {formatBytes(netIO.rx)} ↑ {formatBytes(netIO.tx)}</span>
                          </div>
                        </>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            controlContainer('start', service.name);
                          }}
                          disabled={service.status === 'running'}
                          className="p-1 text-gray-600 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Start"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            controlContainer('stop', service.name);
                          }}
                          disabled={service.status === 'stopped'}
                          className="p-1 text-gray-600 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Stop"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            controlContainer('restart', service.name);
                          }}
                          className="p-1 text-gray-600 hover:text-yellow-600"
                          title="Restart"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {isExpanded && service.stats && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <Cpu className="h-4 w-4" />
                          <span>CPU Usage</span>
                        </div>
                        <p className="text-2xl font-semibold text-gray-900">{service.stats.cpuPercent}</p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <MemoryStick className="h-4 w-4" />
                          <span>Memory</span>
                        </div>
                        <p className="text-2xl font-semibold text-gray-900">{service.stats.memPercent}</p>
                        <p className="text-xs text-gray-500">{formatBytes(service.stats.memUsage)} / {formatBytes(service.stats.memLimit)}</p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <HardDrive className="h-4 w-4" />
                          <span>Disk I/O</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{service.stats.blockIO}</p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <Zap className="h-4 w-4" />
                          <span>PIDs</span>
                        </div>
                        <p className="text-2xl font-semibold text-gray-900">{service.stats.pids}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedService(service.name);
                          setActiveTab('logs');
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        View Logs
                      </button>
                      <button
                        onClick={() => {
                          setSelectedService(service.name);
                          setActiveTab('exec');
                        }}
                        className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        Execute Command
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail View */}
      {selectedService && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-6 py-3">
              <h3 className="text-lg font-medium text-gray-900">{selectedService}</h3>
              <button
                onClick={() => setSelectedService(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex">
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'metrics'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Metrics
                </div>
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'logs'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Logs
                </div>
              </button>
              <button
                onClick={() => setActiveTab('exec')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'exec'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Execute
                </div>
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'metrics' && (
              <div className="text-center text-gray-500 py-12">
                <Activity className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>Detailed metrics charts coming soon...</p>
              </div>
            )}

            {activeTab === 'logs' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <select
                    value={logLines}
                    onChange={(e) => setLogLines(Number(e.target.value))}
                    className="rounded-md border border-gray-300 py-1.5 px-3 text-sm"
                  >
                    <option value={50}>Last 50 lines</option>
                    <option value={100}>Last 100 lines</option>
                    <option value={500}>Last 500 lines</option>
                    <option value={1000}>Last 1000 lines</option>
                  </select>
                  <button
                    onClick={fetchLogs}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Refresh
                  </button>
                </div>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{logs || 'No logs available'}</pre>
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {activeTab === 'exec' && (
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Command
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
                      placeholder="Enter command (e.g., ls -la, ps aux, env)"
                      className="flex-1 rounded-md border border-gray-300 py-2 px-3 text-sm font-mono"
                      disabled={isExecuting}
                    />
                    <button
                      onClick={executeCommand}
                      disabled={isExecuting || !command.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExecuting ? 'Executing...' : 'Execute'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Commands are executed inside the container with /bin/sh -c
                  </p>
                </div>
                
                {commandOutput && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Output:</h4>
                    <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{commandOutput}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}