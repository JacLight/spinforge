declare module 'pidusage' {
  interface PidUsage {
    (pid: number, callback: (err: Error | null, stats: Stats) => void): void;
    (pid: number): Promise<Stats>;
  }

  interface Stats {
    cpu: number;
    memory: number;
    ppid: number;
    pid: number;
    ctime: number;
    elapsed: number;
    timestamp: number;
  }

  const pidusage: PidUsage;
  export = pidusage;
}