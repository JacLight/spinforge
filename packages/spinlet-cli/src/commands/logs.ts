import chalk from 'chalk';
import { createRedisClient } from '@spinforge/shared';

interface LogOptions {
  follow?: boolean;
  lines?: string;
}

export async function logsCommand(spinletId: string, options: LogOptions) {
  const redis = createRedisClient();
  const lines = parseInt(options.lines || '100');
  
  try {
    console.log(chalk.gray(`Fetching logs for ${spinletId}...\n`));

    // Get recent audit events for this spinlet
    const events = await redis.xrevrange(
      'spinforge:audit',
      '+',
      '-',
      'COUNT',
      lines
    );

    // Filter events for this spinlet
    const spinletEvents = events.filter(([_, fields]) => {
      for (let i = 0; i < fields.length; i += 2) {
        if (fields[i] === 'spinletId' && fields[i + 1] === spinletId) {
          return true;
        }
      }
      return false;
    });

    if (spinletEvents.length === 0) {
      console.log(chalk.yellow('No logs found for this spinlet'));
      return;
    }

    // Display logs
    spinletEvents.reverse().forEach(([id, fields]) => {
      const event: any = {};
      for (let i = 0; i < fields.length; i += 2) {
        event[fields[i]] = fields[i + 1];
      }

      const timestamp = new Date(parseInt(event.timestamp)).toLocaleString();
      const level = getLogLevel(event.event);
      
      console.log(
        chalk.gray(timestamp),
        level,
        chalk.bold(event.event),
        event.data ? chalk.gray(event.data) : ''
      );
    });

    if (options.follow) {
      console.log(chalk.gray('\nFollowing logs... (press Ctrl+C to stop)\n'));
      
      // Subscribe to new events
      let lastId = spinletEvents[spinletEvents.length - 1]?.[0] || '$';
      
      const checkForNewLogs = async () => {
        const newEvents = await redis.xread(
          'BLOCK', '1000',
          'STREAMS', 'spinforge:audit', lastId
        );

        if (newEvents && newEvents.length > 0) {
          const [_, entries] = newEvents[0];
          
          entries.forEach(([id, fields]: [string, string[]]) => {
            const event: any = {};
            for (let i = 0; i < fields.length; i += 2) {
              event[fields[i]] = fields[i + 1];
            }

            if (event.spinletId === spinletId) {
              const timestamp = new Date(parseInt(event.timestamp)).toLocaleString();
              const level = getLogLevel(event.event);
              
              console.log(
                chalk.gray(timestamp),
                level,
                chalk.bold(event.event),
                event.data ? chalk.gray(event.data) : ''
              );
            }
            
            lastId = id;
          });
        }
      };

      // Keep following logs
      const interval = setInterval(checkForNewLogs, 1000);
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        clearInterval(interval);
        redis.quit();
        console.log(chalk.gray('\n\nStopped following logs'));
        process.exit(0);
      });
    } else {
      await redis.quit();
    }
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
    await redis.quit();
    process.exit(1);
  }
}

function getLogLevel(event: string): string {
  if (event.includes('error') || event.includes('crash')) {
    return chalk.red('[ERROR]');
  } else if (event.includes('start') || event.includes('stop')) {
    return chalk.yellow('[INFO] ');
  } else {
    return chalk.blue('[DEBUG]');
  }
}