# Docker Compose in SpinForge

## Deploy with Compose

```bash
POST /api/sites
```

```json
{
  "domain": "myapp.com",
  "type": "compose",
  "compose": "your docker-compose.yml content as string",
  "customerId": "user@example.com",
  "enabled": true,
  "ssl_enabled": false
}
```

That's it. Send your docker-compose.yml content in the `compose` field.

## Manage

```bash
POST /api/sites/:domain/compose/stop
POST /api/sites/:domain/compose/start
POST /api/sites/:domain/compose/restart
POST /api/sites/:domain/compose/logs
POST /api/sites/:domain/compose/down
```