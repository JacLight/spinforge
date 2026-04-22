/**
 * Prometheus metrics for SpinBuild.
 *
 * Exposed at /metrics (no auth) for Prometheus to scrape. The `spinbuild_`
 * prefix keeps these in their own namespace alongside hosting's
 * `spinforge_*` series — Grafana queries both from the same datasource.
 *
 * Wiring points:
 *   - JobService: counters/histograms for job lifecycle + duration.
 *   - routes/jobs.js: policy rejection counter (inc'd when CustomerPolicyService
 *     returns allowed=false).
 */

const client = require('prom-client');

// Default process-level metrics (event loop lag, heap, GC, open FDs…) under
// the same prefix so operators can filter the whole service with one regex.
client.collectDefaultMetrics({ prefix: 'spinbuild_' });

const jobsTotal = new client.Counter({
  name: 'spinbuild_jobs_total',
  help: 'Jobs by platform and terminal status',
  labelNames: ['platform', 'status', 'runner_class'],
});

const jobDuration = new client.Histogram({
  name: 'spinbuild_job_duration_seconds',
  help: 'End-to-end job duration',
  labelNames: ['platform', 'status', 'runner_class'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600],
});

const jobQueueWait = new client.Histogram({
  name: 'spinbuild_job_queue_wait_seconds',
  help: 'Time from job.created to dispatch',
  labelNames: ['platform', 'runner_class'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
});

const queueDepth = new client.Gauge({
  name: 'spinbuild_queue_depth',
  help: 'Current pending/queued jobs by platform',
  labelNames: ['platform'],
});

const activeJobs = new client.Gauge({
  name: 'spinbuild_active_jobs',
  help: 'Current running jobs by platform',
  labelNames: ['platform'],
});

const runnerSlots = new client.Gauge({
  name: 'spinbuild_runner_slots',
  help: 'Runner slot state',
  labelNames: ['runner_id', 'runner_class', 'state'], // state: total, used, idle
});

const policyRejects = new client.Counter({
  name: 'spinbuild_policy_rejections_total',
  help: 'Job submissions rejected by policy',
  labelNames: ['error'], // platform_not_allowed, concurrent_jobs_exceeded, monthly_cpu_exceeded, etc.
});

const artifactBytes = new client.Counter({
  name: 'spinbuild_artifact_bytes_total',
  help: 'Total bytes of artifacts produced',
  labelNames: ['platform'],
});

module.exports = {
  registry: client.register,
  jobsTotal,
  jobDuration,
  jobQueueWait,
  queueDepth,
  activeJobs,
  runnerSlots,
  policyRejects,
  artifactBytes,
};
