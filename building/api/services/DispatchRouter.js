/**
 * DispatchRouter — thin wrapper over the Nomad dispatcher.
 *
 * Historically this routed between Nomad docker, Proxmox LXC, and the
 * Nomad-mac runner-registry pubsub path based on platform + customer
 * policy. We never ran a real Proxmox cluster; that branch was carried
 * as dead code under a "fast path" flag that was always false. Task 127
 * collapses it back to a single nomad.dispatch() call — Mac jobs still
 * flow through the same dispatcher (DispatchService internally fans out
 * to the Mac runner registry when platform is ios/macos).
 *
 * Kept as a class (not inlined into server.js) so:
 *   - routes/*.js still resolves `req.app.locals.dispatch.dispatch(...)`
 *     the same way.
 *   - Future routers (AWS CodeBuild, self-hosted Linux VMs, …) drop in
 *     at the same seam; dispatch() / cancel() are the stable surface.
 */

class DispatchRouter {
  constructor({ nomad, logger, events } = {}) {
    if (!nomad) throw new Error('DispatchRouter requires a nomad dispatcher');
    this.nomad = nomad;
    this.events = events || null;
    this.logger = logger || console;
  }

  async dispatch(job, _opts = {}) {
    return this.nomad.dispatch(job);
  }

  async cancel(job) {
    return this.nomad.cancel(job);
  }
}

module.exports = DispatchRouter;
