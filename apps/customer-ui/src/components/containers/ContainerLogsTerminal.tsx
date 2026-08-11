/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { RefreshCw, Pause, Play } from 'lucide-react';
import { hostingAPI } from '../../services/hosting-api';
import { SpinForgeContainer } from './ContainerSlideoutPanel';

interface ContainerLogsTerminalProps {
  container: SpinForgeContainer;
}

export function ContainerLogsTerminal({ container }: ContainerLogsTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon>(new FitAddon());
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal with iTerm2-like styling for logs
    const terminal = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#e6edf3',
        selection: '#264f78',
        black: '#0d1117',
        red: '#f85149',
        green: '#7ee787',
        yellow: '#f9dc72',
        blue: '#79c0ff',
        magenta: '#d2a8ff',
        cyan: '#a5f3fc',
        white: '#e6edf3',
        brightBlack: '#6e7681',
        brightRed: '#f85149',
        brightGreen: '#7ee787',
        brightYellow: '#f9dc72',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#a5f3fc',
        brightWhite: '#ffffff'
      },
      fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 1.4,
      cursorBlink: false,
      scrollback: 50000,
      tabStopWidth: 4,
      allowTransparency: true,
      disableStdin: true // Read-only for logs
    });

    // Add addons
    terminal.loadAddon(fitAddon.current);
    terminal.loadAddon(new WebLinksAddon());

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.current.fit();

    // Store terminal instance
    terminalInstance.current = terminal;

    // Show header
    terminal.writeln('\x1b[36m╭─────────────────────────────────────────╮\x1b[0m');
    terminal.writeln('\x1b[36m│\x1b[0m \x1b[1;33mContainer Logs\x1b[0m                      \x1b[36m│\x1b[0m');
    terminal.writeln('\x1b[36m│\x1b[0m \x1b[32mContainer:\x1b[0m ' + container.domain.padEnd(22) + ' \x1b[36m│\x1b[0m');
    terminal.writeln('\x1b[36m╰─────────────────────────────────────────╯\x1b[0m');
    terminal.writeln('');

    // Load initial logs
    fetchLogs();

    // Handle resize
    const handleResize = () => {
      fitAddon.current.fit();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      terminal.dispose();
    };
  }, [container.domain]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchLogs(true); // Append mode
      }, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const fetchLogs = async (append = false) => {
    if (!terminalInstance.current) return;
    
    const terminal = terminalInstance.current;
    setIsStreaming(true);
    
    try {
      // Show loading indicator
      if (!append) {
        terminal.writeln('\x1b[90m[Loading logs...]\x1b[0m');
      }
      
      const logs = await hostingAPI.getContainerLogs(container.domain, { 
        tail: append ? 100 : 1000 
      });
      
      if (!append) {
        // Clear previous logs content (but keep header)
        terminal.clear();
        terminal.writeln('\x1b[36m╭─────────────────────────────────────────╮\x1b[0m');
        terminal.writeln('\x1b[36m│\x1b[0m \x1b[1;33mContainer Logs\x1b[0m                      \x1b[36m│\x1b[0m');
        terminal.writeln('\x1b[36m│\x1b[0m \x1b[32mContainer:\x1b[0m ' + container.domain.padEnd(22) + ' \x1b[36m│\x1b[0m');
        terminal.writeln('\x1b[36m╰─────────────────────────────────────────╯\x1b[0m');
        terminal.writeln('');
      }
      
      if (logs) {
        const lines = logs.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            // Parse log levels and add colors
            const coloredLine = colorizeLogLine(line);
            terminal.writeln(coloredLine);
          }
        });
      } else {
        terminal.writeln('\x1b[90m[No logs available]\x1b[0m');
      }
      
      setLastUpdate(new Date());
      
    } catch (error: any) {
      terminal.writeln(`\x1b[31m[Error fetching logs: ${error.message}]\x1b[0m`);
    } finally {
      setIsStreaming(false);
    }
  };

  const colorizeLogLine = (line: string): string => {
    // Add timestamp color if line starts with timestamp
    if (line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      line = line.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)/, '\x1b[90m$1\x1b[0m');
    }
    
    // Color log levels
    if (line.includes('ERROR') || line.includes('[ERROR]')) {
      return line.replace(/(ERROR|\[ERROR\])/g, '\x1b[31m$1\x1b[0m');
    } else if (line.includes('WARN') || line.includes('[WARN]')) {
      return line.replace(/(WARN|\[WARN\])/g, '\x1b[33m$1\x1b[0m');
    } else if (line.includes('INFO') || line.includes('[INFO]')) {
      return line.replace(/(INFO|\[INFO\])/g, '\x1b[36m$1\x1b[0m');
    } else if (line.includes('DEBUG') || line.includes('[DEBUG]')) {
      return line.replace(/(DEBUG|\[DEBUG\])/g, '\x1b[90m$1\x1b[0m');
    } else if (line.includes('TRACE') || line.includes('[TRACE]')) {
      return line.replace(/(TRACE|\[TRACE\])/g, '\x1b[35m$1\x1b[0m');
    }
    
    // Color HTTP status codes
    line = line.replace(/\b([1-3]\d{2})\b/g, '\x1b[32m$1\x1b[0m'); // 1xx, 2xx, 3xx
    line = line.replace(/\b(4\d{2})\b/g, '\x1b[33m$1\x1b[0m'); // 4xx
    line = line.replace(/\b(5\d{2})\b/g, '\x1b[31m$1\x1b[0m'); // 5xx
    
    // Color IP addresses
    line = line.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, '\x1b[34m$1\x1b[0m');
    
    return line;
  };

  const clearLogs = () => {
    if (!terminalInstance.current) return;
    
    const terminal = terminalInstance.current;
    terminal.clear();
    terminal.writeln('\x1b[36m╭─────────────────────────────────────────╮\x1b[0m');
    terminal.writeln('\x1b[36m│\x1b[0m \x1b[1;33mContainer Logs\x1b[0m                      \x1b[36m│\x1b[0m');
    terminal.writeln('\x1b[36m│\x1b[0m \x1b[32mContainer:\x1b[0m ' + container.domain.padEnd(22) + ' \x1b[36m│\x1b[0m');
    terminal.writeln('\x1b[36m╰─────────────────────────────────────────╯\x1b[0m');
    terminal.writeln('');
    terminal.writeln('\x1b[90m[Logs cleared]\x1b[0m');
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Logs Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm text-gray-300 font-mono">
            {container.domain} — logs
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 p-2" />

      {/* Controls */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchLogs()}
              disabled={isStreaming}
              className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isStreaming ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded ${
                autoRefresh 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{autoRefresh ? 'Stop Auto' : 'Auto Refresh'}</span>
            </button>
            
            <button
              onClick={clearLogs}
              className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
            >
              Clear
            </button>
          </div>
          
          <div className="flex items-center space-x-4 text-xs text-gray-400">
            <span>Showing last 1000 lines</span>
            {autoRefresh && <span className="text-green-400">Auto-refresh: 5s</span>}
          </div>
        </div>
      </div>
    </div>
  );
}