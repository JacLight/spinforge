import { activeSession, getHeaders } from './appengine';

interface QueueItem<T = any> {
  id: string;
  request: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retries: number;
}

export class RequestQueue {
  private queue: QueueItem[] = [];
  private running = 0;
  private maxConcurrency: number;
  private maxRetries = 3;
  private retryDelay: number;

  constructor(options: { concurrency?: number; retryDelay?: number } = {}) {
    this.maxConcurrency = options.concurrency || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Add a request to the queue
   */
  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem<T> = {
        id: this.generateId(),
        request,
        resolve,
        reject,
        retries: 0,
      };

      this.queue.push(item);
      this.process();
    });
  }

  /**
   * Process queue items
   */
  private async process(): Promise<void> {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;

    try {
      const result = await item.request();
      item.resolve(result);
    } catch (error) {
      if (item.retries < this.maxRetries) {
        item.retries++;
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, item.retries - 1);
        await this.delay(delay);
        this.queue.unshift(item); // Add back to front of queue
      } else {
        item.reject(error);
      }
    } finally {
      this.running--;
      this.process(); // Process next item
    }
  }

  /**
   * Process data with the queue (compatibility method)
   */
  async processData(
    url: string,
    data?: any,
    options?: any
  ): Promise<{ data: any }> {
    const axios = (await import('axios')).default;
    return this.add(async () => {
      try {
        const response = await axios({
          method: options?.method || 'GET',
          url: url,
          data: data,
          ...getHeaders(),
          ...options
        });
        
        return response.data;
      } catch (error) {
        console.error('Request failed:', error);
        throw error;
      }
    });
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export a default instance
export const requestQueue = new RequestQueue({
  concurrency: 3,
  retryDelay: 1000,
});

// Export as default and as requestQueueInstance for compatibility
export default requestQueue;
const requestQueueInstance = requestQueue;
export { requestQueueInstance };

// Export a factory function for creating custom queues
export const createRequestQueue = (options?: {
  concurrency?: number;
  retryDelay?: number;
}) => new RequestQueue(options);