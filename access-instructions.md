# SpinForge Test Sites Access Instructions

## 🎉 Successfully Deployed 10 Test Websites!

All websites have been successfully created and deployed to SpinForge. Here's how the platform works:

### How SpinForge Works:

1. **Static Site Hosting**: SpinForge uses Caddy as a web server to serve static websites
2. **API-Based Deployment**: Sites are deployed through the REST API at port 8080
3. **Dynamic Configuration**: Each site gets its own Caddy configuration file
4. **Redis Storage**: Site metadata is stored in KeyDB (Redis-compatible database)

### Deployed Sites:

1. **test-portfolio** - Personal Portfolio
2. **test-blog** - Tech Blog  
3. **test-shop** - E-commerce Store
4. **test-landing** - Product Landing Page
5. **test-restaurant** - Restaurant Website
6. **test-agency** - Digital Agency
7. **test-photography** - Photography Portfolio
8. **test-fitness** - Fitness Studio
9. **test-education** - Online Course Platform
10. **test-startup** - Tech Startup

### To Access The Sites:

The sites are configured with the domain `*.spinforge.io`. To access them locally:

1. **Add to /etc/hosts file**:
```bash
sudo nano /etc/hosts
```

Add these lines:
```
127.0.0.1 test-portfolio.spinforge.io
127.0.0.1 test-blog.spinforge.io
127.0.0.1 test-shop.spinforge.io
127.0.0.1 test-landing.spinforge.io
127.0.0.1 test-restaurant.spinforge.io
127.0.0.1 test-agency.spinforge.io
127.0.0.1 test-photography.spinforge.io
127.0.0.1 test-fitness.spinforge.io
127.0.0.1 test-education.spinforge.io
127.0.0.1 test-startup.spinforge.io
```

2. **Visit in browser**:
- http://test-portfolio.spinforge.io
- http://test-blog.spinforge.io
- http://test-shop.spinforge.io
- etc...

### Test with curl:
```bash
curl -H "Host: test-portfolio.spinforge.io" http://localhost
```

### Site Features:

Each test site includes:
- Unique color scheme (randomly generated)
- Interactive JavaScript functionality
- Responsive design
- Click counter
- Dynamic timestamp display
- Smooth scroll navigation

### File Locations:

- **Site files**: `/Users/imzee/projects/spinforge/hosting/data/static/test-*`
- **Caddy configs**: Inside container at `/etc/caddy/sites/*.caddy`
- **Source files**: `/Users/imzee/projects/spinforge/test-sites/*`

### API Endpoints:

- **List all sites**: `curl http://localhost:8080/api/vhost`
- **Get site details**: `curl http://localhost:8080/api/vhost/test-portfolio`
- **Delete a site**: `curl -X DELETE http://localhost:8080/api/vhost/test-portfolio`

Enjoy exploring your SpinForge deployment platform! 🚀