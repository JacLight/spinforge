import chalk from 'chalk';
import axios from 'axios';
import { getRequiredConfig } from '../lib/config';
import { getAuthHeaders } from '../lib/auth';

interface LogOptions {
  follow?: boolean;
  lines?: string;
}

export async function logsCommand(spinletId: string, options: LogOptions) {
  const apiUrl = getRequiredConfig('apiUrl');
  const lines = parseInt(options.lines || '100');
  const headers = getAuthHeaders();
  
  try {
    console.log(chalk.gray(`Fetching logs for ${spinletId}...\n`));

    // Get logs from API
    const response = await axios.get(`${apiUrl}/spinlets/${spinletId}/logs`, {
      headers,
      params: {
        lines
      }
    });
    
    const logs = response.data;

    if (!logs || logs.length === 0) {
      console.log(chalk.yellow('No logs found for this spinlet'));
      return;
    }

    // Display logs
    logs.forEach((log: any) => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const level = getLogLevel(log.level);
      
      console.log(
        chalk.gray(timestamp),
        level,
        log.message
      );
    });

    if (options.follow) {
      console.log(chalk.gray('\nFollowing logs... (press Ctrl+C to stop)\n'));
      
      // Poll for new logs
      let lastTimestamp = logs[logs.length - 1]?.timestamp || Date.now();
      
      const checkForNewLogs = async () => {
        try {
          const response = await axios.get(`${apiUrl}/spinlets/${spinletId}/logs`, {
            headers,
            params: {
              since: lastTimestamp
            }
          });
          
          const newLogs = response.data;
          
          if (newLogs && newLogs.length > 0) {
            newLogs.forEach((log: any) => {
              const timestamp = new Date(log.timestamp).toLocaleString();
              const level = getLogLevel(log.level);
              
              console.log(
                chalk.gray(timestamp),
                level,
                log.message
              );
            });
            
            lastTimestamp = newLogs[newLogs.length - 1].timestamp;
          }
        } catch (error) {
          // Silently ignore errors while following
        }
      };

      // Keep following logs
      const interval = setInterval(checkForNewLogs, 2000);
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(chalk.gray('\n\nStopped following logs'));
        process.exit(0);
      });
    }
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.error(chalk.red('Error:'), `Spinlet ${spinletId} not found`);
    } else {
      console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
  }
}

function getLogLevel(level: string): string {
  switch (level?.toLowerCase()) {
    case 'error':
      return chalk.red('[ERROR]');
    case 'warn':
      return chalk.yellow('[WARN] ');
    case 'info':
      return chalk.blue('[INFO] ');
    case 'debug':
      return chalk.gray('[DEBUG]');
    default:
      return chalk.white('[LOG]  ');
  }
}