#!/bin/sh
set -e

# Every env the agent needs is injected by Nomad from DispatchService.
# We don't validate here; the agent itself fails-loud on missing vars.
exec node /app/agent.js
