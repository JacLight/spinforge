import Redis from 'ioredis';
import { PortRange } from './types';
export declare class PortAllocator {
    private redis;
    private portRange;
    private localAllocated;
    constructor(redis: Redis, portRange?: PortRange);
    initialize(): Promise<void>;
    allocate(spinletId: string): Promise<number>;
    release(port: number): Promise<void>;
    isAllocated(port: number): Promise<boolean>;
    getAllocatedPorts(): Promise<Map<number, string>>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=PortAllocator.d.ts.map