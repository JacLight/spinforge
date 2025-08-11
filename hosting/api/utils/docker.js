/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Execute command in container with proper TTY and environment
async function execInContainer(containerName, command) {
  // Set up proper environment variables for terminal support
  const envVars = [
    'TERM=xterm-256color',
    'LANG=C.UTF-8',
    'LC_ALL=C.UTF-8',
    'DEBIAN_FRONTEND=noninteractive',
    'HOME=/root'
  ].map(env => `-e ${env}`).join(' ');
  
  // Check if this is an apt command and fix common issues
  let finalCommand = command;
  if (command.trim().startsWith('apt') || command.includes('apt-get')) {
    // First, ensure apt directories exist with proper permissions
    const setupCmd = 'mkdir -p /var/lib/apt/lists/partial && chmod -R 755 /var/lib/apt/lists && ';
    finalCommand = setupCmd + command;
  }
  
  // Use -i flag for interactive mode to ensure proper stdin/stdout handling
  return execAsync(`docker exec -i ${envVars} ${containerName} /bin/sh -c "${finalCommand.replace(/"/g, '\\"')}"`);
}

module.exports = {
  execAsync,
  execInContainer
};