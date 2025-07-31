# SpinForge Web Root

This directory contains the production-ready files that are served by the OpenResty gateway.

## Directory Structure

```
web_root/
├── customer1/
│   ├── example-app/          # Static site files
│   │   ├── index.html
│   │   ├── css/
│   │   └── js/
│   └── nextjs-app/          # Next.js static export
│       ├── index.html
│       └── _next/
├── customer2/
│   └── my-site/
└── shared/                  # Shared assets across customers
    └── error-pages/
        ├── 404.html
        └── 50x.html
```

## How it works

1. **Deployment Process**: Apps are built in `/deployments` directory
2. **Build Output**: Build artifacts are copied to `/web_root/customerX/app-name/`
3. **OpenResty Serving**: Gateway serves files directly from this directory
4. **Domain Mapping**: `example.com` → `/web_root/customer1/example-app/`

## Important Notes

- This directory should contain ONLY production-ready files
- Source code and build artifacts stay in `/deployments`
- Static files are served directly by OpenResty
- Dynamic apps (Node.js) only have their static assets here

## DO NOT

- Put source code here
- Run builds in this directory
- Store sensitive files (`.env`, keys, etc.)