"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpinletMonitor = void 0;
const events_1 = require("events");
class SpinletMonitor extends events_1.EventEmitter {
    spinletId;
    process;
    healthCheckInterval;
    isHealthy = true;
    consecutiveFailures = 0;
    constructor(spinletId, process) {
        super();
        this.spinletId = spinletId;
        this.process = process;
        this.startHealthCheck();
    }
    startHealthCheck() {
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
            }
            catch (error) {
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
    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
    }
    isProcessHealthy() {
        return this.isHealthy;
    }
    getMetrics() {
        return {
            healthy: this.isHealthy,
            failures: this.consecutiveFailures
        };
    }
}
exports.SpinletMonitor = SpinletMonitor;
//# sourceMappingURL=SpinletMonitor.js.map