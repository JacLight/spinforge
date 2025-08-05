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
import { hostingAPI } from '../../services/hosting-api';
import { SpinForgeContainer } from './ContainerSlideoutPanel';

interface ContainerTerminalProps {
  container: SpinForgeContainer;
}

export function ContainerTerminal({ container }: ContainerTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon>(new FitAddon());
  const [isConnected, setIsConnected] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const currentLine = useRef('');

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal with iTerm2-like styling
    const terminal = new Terminal({
      theme: {
        background: '#1d1f21',
        foreground: '#c5c8c6',
        cursor: '#c5c8c6',
        selection: '#373b41',
        black: '#1d1f21',
        red: '#cc6666',
        green: '#b5bd68',
        yellow: '#f0c674',
        blue: '#81a2be',
        magenta: '#b294bb',
        cyan: '#8abeb7',
        white: '#c5c8c6',
        brightBlack: '#969896',
        brightRed: '#cc6666',
        brightGreen: '#b5bd68',
        brightYellow: '#f0c674',
        brightBlue: '#81a2be',
        brightMagenta: '#b294bb',
        brightCyan: '#8abeb7',
        brightWhite: '#ffffff'
      },
      fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      tabStopWidth: 4,
      allowTransparency: true
    });

    // Add addons
    terminal.loadAddon(fitAddon.current);
    terminal.loadAddon(new WebLinksAddon());

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.current.fit();

    // Store terminal instance
    terminalInstance.current = terminal;

    // Welcome message
    terminal.writeln('\x1b[32m┌──────────────────────────────────────┐\x1b[0m');
    terminal.writeln('\x1b[32m│\x1b[0m \x1b[1;36mSpinForge Container Terminal\x1b[0m     \x1b[32m│\x1b[0m');
    terminal.writeln('\x1b[32m│\x1b[0m \x1b[33mContainer:\x1b[0m ' + container.domain.padEnd(20) + ' \x1b[32m│\x1b[0m');
    terminal.writeln('\x1b[32m└──────────────────────────────────────┘\x1b[0m');
    terminal.writeln('');
    terminal.writeln('\x1b[90mConnecting to container...\x1b[0m');
    
    // Show prompt
    setTimeout(() => {
      setIsConnected(true);
      terminal.writeln('\x1b[32mConnected! Type commands below:\x1b[0m');
      showPrompt();
    }, 1000);

    // Handle input
    terminal.onData((data) => {
      const char = data;

      if (char === '\r') {
        // Enter pressed
        const command = currentLine.current.trim();
        if (command) {
          terminal.writeln('');
          executeCommand(command);
        } else {
          terminal.writeln('');
          showPrompt();
        }
        currentLine.current = '';
      } else if (char === '\u007f') {
        // Backspace
        if (currentLine.current.length > 0) {
          currentLine.current = currentLine.current.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (char === '\u0003') {
        // Ctrl+C
        terminal.writeln('^C');
        currentLine.current = '';
        showPrompt();
      } else if (char.charCodeAt(0) >= 32) {
        // Printable character
        currentLine.current += char;
        terminal.write(char);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.current.fit();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [container.domain]);

  const showPrompt = () => {
    if (!terminalInstance.current) return;
    terminalInstance.current.write('\x1b[1;32mroot@' + container.domain.split('.')[0] + '\x1b[0m:\x1b[1;34m/\x1b[0m$ ');
  };

  const executeCommand = async (command: string) => {
    if (!terminalInstance.current) return;
    
    const terminal = terminalInstance.current;
    
    try {
      // Execute command via API
      const result = await hostingAPI.execInContainer(container.domain, command);
      
      // Display output
      if (result.stdout) {
        const lines = result.stdout.split('\n');
        lines.forEach(line => {
          terminal.writeln(line);
        });
      }
      
      // Display stderr if any
      if (result.stderr) {
        const lines = result.stderr.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            terminal.writeln(`\x1b[31m${line}\x1b[0m`);
          }
        });
      }
      
      // Handle special commands
      if (command === 'clear' || command === 'cls') {
        terminal.clear();
        terminal.writeln('\x1b[32m┌──────────────────────────────────────┐\x1b[0m');
        terminal.writeln('\x1b[32m│\x1b[0m \x1b[1;36mSpinForge Container Terminal\x1b[0m     \x1b[32m│\x1b[0m');
        terminal.writeln('\x1b[32m│\x1b[0m \x1b[33mContainer:\x1b[0m ' + container.domain.padEnd(20) + ' \x1b[32m│\x1b[0m');
        terminal.writeln('\x1b[32m└──────────────────────────────────────┘\x1b[0m');
        terminal.writeln('');
      }
      
    } catch (error: any) {
      terminal.writeln(`\x1b[31mError: ${error.message || 'Command failed'}\x1b[0m`);
      console.error('Terminal exec error:', error);
    }
    
    // Show new prompt
    showPrompt();
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm text-gray-300 font-mono">
            {container.domain} — terminal
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span className="text-xs text-gray-400">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 p-2" />

      {/* Terminal Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Press Ctrl+C to interrupt</span>
            <span>Type 'clear' to clear screen</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-mono">UTF-8</span>
          </div>
        </div>
      </div>
    </div>
  );
}