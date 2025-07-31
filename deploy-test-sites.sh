#!/bin/bash

# Script to deploy 10 different test websites to SpinForge
set -e

echo "🚀 SpinForge Test Deployment Script"
echo "==================================="
echo "Creating and deploying 10 test websites..."
echo ""

# Base directory for deployments
BASE_DIR="/Users/imzee/projects/spinforge/test-sites"
mkdir -p "$BASE_DIR"

# Array of test sites to create
SITES_NAMES="portfolio blog shop landing restaurant agency photography fitness education startup"
SITES_TITLES=(
    "Personal Portfolio"
    "Tech Blog"
    "E-commerce Store"
    "Product Landing Page"
    "Restaurant Website"
    "Digital Agency"
    "Photography Portfolio"
    "Fitness Studio"
    "Online Course Platform"
    "Tech Startup"
)

# Function to create a static website
create_static_site() {
    local name=$1
    local title=$2
    local dir="$BASE_DIR/$name"
    
    echo "📦 Creating $title site: $name"
    mkdir -p "$dir"
    
    # Create index.html with unique content
    cat > "$dir/index.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$title - SpinForge Test</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <nav>
            <div class="logo">$title</div>
            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#services">Services</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>
    
    <main>
        <section id="hero">
            <h1>Welcome to $title</h1>
            <p>This is a test deployment on SpinForge Platform</p>
            <p>Site ID: <strong>$name</strong></p>
            <p>Deployed at: <span id="timestamp"></span></p>
            <button onclick="showAlert()">Click Me!</button>
        </section>
        
        <section id="features">
            <h2>Features</h2>
            <div class="feature-grid">
                <div class="feature">
                    <h3>Fast Deployment</h3>
                    <p>Deployed in seconds with SpinForge</p>
                </div>
                <div class="feature">
                    <h3>Global CDN</h3>
                    <p>Served from edge locations worldwide</p>
                </div>
                <div class="feature">
                    <h3>SSL Enabled</h3>
                    <p>Secure by default with automatic SSL</p>
                </div>
            </div>
        </section>
        
        <section id="content">
            <h2>About This Test Site</h2>
            <p>This is a test deployment for <strong>$title</strong> on the SpinForge platform. 
            Each test site demonstrates different styling and content to showcase the platform's 
            flexibility in hosting various types of static websites.</p>
            <div id="dynamic-content"></div>
        </section>
    </main>
    
    <footer>
        <p>&copy; 2025 $title - Powered by SpinForge</p>
    </footer>
    
    <script src="script.js"></script>
</body>
</html>
EOF

    # Create unique CSS for each site with different color schemes
    local hue=$((RANDOM % 360))
    cat > "$dir/style.css" <<EOF
:root {
    --primary-color: hsl($hue, 70%, 50%);
    --secondary-color: hsl($((hue + 180) % 360), 70%, 50%);
    --bg-color: hsl($hue, 20%, 95%);
    --text-color: #333;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: var(--text-color);
    background-color: var(--bg-color);
}

header {
    background: var(--primary-color);
    color: white;
    padding: 1rem 0;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

nav {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2rem;
}

.logo {
    font-size: 1.5rem;
    font-weight: bold;
}

nav ul {
    list-style: none;
    display: flex;
    gap: 2rem;
}

nav a {
    color: white;
    text-decoration: none;
    transition: opacity 0.3s;
}

nav a:hover {
    opacity: 0.8;
}

main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

#hero {
    text-align: center;
    padding: 4rem 0;
    background: white;
    border-radius: 10px;
    margin-bottom: 2rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

#hero h1 {
    font-size: 2.5rem;
    color: var(--primary-color);
    margin-bottom: 1rem;
}

#hero p {
    font-size: 1.2rem;
    margin-bottom: 1rem;
}

button {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    font-size: 1rem;
    border-radius: 5px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}

.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
}

.feature {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
}

.feature h3 {
    color: var(--primary-color);
    margin-bottom: 1rem;
}

#content {
    background: white;
    padding: 3rem;
    border-radius: 10px;
    margin: 2rem 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

footer {
    background: var(--primary-color);
    color: white;
    text-align: center;
    padding: 2rem 0;
    margin-top: 4rem;
}

#dynamic-content {
    margin-top: 2rem;
    padding: 1rem;
    background: var(--bg-color);
    border-radius: 5px;
    min-height: 100px;
}
EOF

    # Create JavaScript file
    cat > "$dir/script.js" <<EOF
// Display current timestamp
document.getElementById('timestamp').textContent = new Date().toLocaleString();

// Button click handler
function showAlert() {
    alert('Hello from $title on SpinForge!');
    updateDynamicContent();
}

// Update dynamic content
function updateDynamicContent() {
    const content = document.getElementById('dynamic-content');
    const clicks = parseInt(content.dataset.clicks || '0') + 1;
    content.dataset.clicks = clicks;
    content.innerHTML = \`
        <h3>Dynamic Content</h3>
        <p>Button clicked: \${clicks} time\${clicks !== 1 ? 's' : ''}</p>
        <p>Last updated: \${new Date().toLocaleTimeString()}</p>
        <p>Site: $name</p>
    \`;
}

// Add some interactivity
document.addEventListener('DOMContentLoaded', () => {
    console.log('$title site loaded successfully!');
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
EOF

    # Create deploy.json
    cat > "$dir/deploy.json" <<EOF
{
  "name": "test-$name",
  "domain": "test-$name.spinforge.local",
  "type": "static",
  "customerId": "test-customer",
  "framework": "static",
  "env": {
    "SITE_NAME": "$title",
    "SITE_ID": "$name"
  }
}
EOF

    echo "✅ Created $name site"
}

# Deploy site using the API
deploy_site() {
    local name=$1
    local title=$2
    local dir="$BASE_DIR/$name"
    
    echo "🔄 Deploying $name to SpinForge..."
    
    # Create the vhost configuration via API
    local response=$(curl -s -X POST http://localhost:8080/api/vhost \
        -H "Content-Type: application/json" \
        -d '{
            "subdomain": "test-'$name'",
            "type": "static",
            "customerId": "test-customer",
            "metadata": {
                "title": "'"$title"'",
                "created": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
            }
        }')
    
    echo "API Response: $response"
    
    # Copy files to static directory
    local static_dir="/Users/imzee/projects/spinforge/hosting/data/static/test-$name"
    mkdir -p "$static_dir"
    cp -r "$dir"/* "$static_dir/"
    
    echo "✅ Deployed $name"
}

# Main execution
echo "Starting deployment process..."
echo ""

# Create all sites
i=0
for site in $SITES_NAMES; do
    create_static_site "$site" "${SITES_TITLES[$i]}"
    i=$((i + 1))
done

echo ""
echo "📤 Deploying sites to SpinForge..."
echo ""

# Deploy all sites
i=0
for site in $SITES_NAMES; do
    deploy_site "$site" "${SITES_TITLES[$i]}"
    echo ""
    i=$((i + 1))
done

echo "🎉 All sites deployed successfully!"
echo ""
echo "📋 Access your test sites at:"
echo "================================"
i=0
for site in $SITES_NAMES; do
    echo "- http://test-$site.spinforge.local (${SITES_TITLES[$i]})"
    i=$((i + 1))
done
echo ""
echo "Note: Add these entries to your /etc/hosts file:"
echo "127.0.0.1 test-portfolio.spinforge.local"
echo "127.0.0.1 test-blog.spinforge.local"
echo "127.0.0.1 test-shop.spinforge.local"
echo "127.0.0.1 test-landing.spinforge.local"
echo "127.0.0.1 test-restaurant.spinforge.local"
echo "127.0.0.1 test-agency.spinforge.local"
echo "127.0.0.1 test-photography.spinforge.local"
echo "127.0.0.1 test-fitness.spinforge.local"
echo "127.0.0.1 test-education.spinforge.local"
echo "127.0.0.1 test-startup.spinforge.local"