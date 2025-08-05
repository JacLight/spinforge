import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class SpinletMonitor extends EventEmitter {
  private spinletId: string;
  private process: ChildProcess;
  private healthCheckInterval?: NodeJS.Timeout;
  private isHealthy: boolean = true;
  private consecutiveFailures: number = 0;

  constructor(spinletId: string, process: ChildProcess) {
    super();
    this.spinletId = spinletId;
    this.process = process;
    this.startHealthCheck();
  }

  private startHealthCheck(): void {
    // Monitor process health every 10 seconds
    this.healthCheckInterval = setInterval(() => {
      if (this.process.killed || !this.process.pid) {
        this.emit('unhealthy', { spinletId: this.spinletId, reason: 'process_dead' });
        this.stop();
        return;
      }

      // Check if process is responsive
      try {
        process.kill(this.process.pid, 0); // Signal 0 = check if process exists
        this.consecutiveFailures = 0;
        
        if (!this.isHealthy) {
          this.isHealthy = true;
          this.emit('healthy', { spinletId: this.spinletId });
        }
      } catch (error) {
        this.consecutiveFailures++;
        
        if (this.consecutiveFailures >= 3) {
          this.isHealthy = false;
          this.emit('unhealthy', { 
            spinletId: this.spinletId, 
            reason: 'unresponsive',
            failures: this.consecutiveFailures 
          });
        }
      }
    }, 10000);
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  isProcessHealthy(): boolean {
    return this.isHealthy;
  }

  getMetrics(): { healthy: boolean; failures: number } {
    return {
      healthy: this.isHealthy,
      failures: this.consecutiveFailures
    };
  }
}