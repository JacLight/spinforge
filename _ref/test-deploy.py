#!/usr/bin/env python3
"""
SpinForge Test Deployment Script
Quickly deploy multiple static test sites for load testing
"""

import os
import sys
import json
import time
import tempfile
import tarfile
import requests
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
SPINHUB_URL = os.getenv('SPINHUB_URL', 'http://localhost:9004')
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', '')
NUM_SITES = int(os.getenv('NUM_SITES', '10'))
PARALLEL_DEPLOYS = int(os.getenv('PARALLEL_DEPLOYS', '3'))

# ANSI colors
GREEN = '\033[92m'
RED = '\033[91m'
BLUE = '\033[94m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def create_test_site(site_num):
    """Create a test static site with HTML content"""
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Site {site_num}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        .container {{
            text-align: center;
            padding: 3rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
            max-width: 600px;
        }}
        h1 {{
            font-size: 4rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }}
        .site-number {{
            font-size: 6rem;
            font-weight: bold;
            margin: 2rem 0;
            animation: pulse 2s infinite;
        }}
        .info {{
            background: rgba(255, 255, 255, 0.1);
            padding: 1.5rem;
            border-radius: 10px;
            margin: 2rem 0;
        }}
        .info p {{
            margin: 0.5rem 0;
            font-size: 1.1rem;
        }}
        .timestamp {{
            opacity: 0.8;
            font-size: 0.9rem;
            margin-top: 2rem;
        }}
        @keyframes pulse {{
            0%, 100% {{ transform: scale(1); opacity: 1; }}
            50% {{ transform: scale(1.05); opacity: 0.8; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Deployment</h1>
        <div class="site-number">#{site_num}</div>
        <div class="info">
            <p><strong>Domain:</strong> test-{site_num}.localhost</p>
            <p><strong>Type:</strong> Static Site</p>
            <p><strong>Status:</strong> <span style="color: #4ade80;">Active</span></p>
        </div>
        <div class="timestamp">
            Deployed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>"""
    
    # Additional pages
    about_html = f"""<!DOCTYPE html>
<html>
<head>
    <title>About - Test Site {site_num}</title>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 20px; }}
        h1 {{ color: #667eea; }}
    </style>
</head>
<body>
    <h1>About Test Site {site_num}</h1>
    <p>This is a test deployment created by SpinForge stress testing.</p>
    <a href="/">Back to Home</a>
</body>
</html>"""
    
    # CSS file
    css_content = """
/* Additional styles */
.button {
    display: inline-block;
    padding: 10px 20px;
    background: #667eea;
    color: white;
    text-decoration: none;
    border-radius: 5px;
    transition: transform 0.2s;
}
.button:hover {
    transform: translateY(-2px);
}
"""
    
    return {
        'index.html': html_content,
        'about.html': about_html,
        'style.css': css_content,
        'robots.txt': f'User-agent: *\nAllow: /\n',
        'deploy.json': json.dumps({
            'name': f'test-site-{site_num}',
            'framework': 'static',
            'customerId': 'test-customer',
            'domain': f'test-{site_num}.localhost'
        }, indent=2)
    }

def create_tar_gz(files_dict):
    """Create a tar.gz file from a dictionary of files"""
    with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
        with tarfile.open(tmp.name, 'w:gz') as tar:
            for filename, content in files_dict.items():
                # Create a file-like object from the content
                from io import BytesIO
                file_data = BytesIO(content.encode('utf-8'))
                
                # Create tarinfo
                tarinfo = tarfile.TarInfo(name=filename)
                tarinfo.size = len(content.encode('utf-8'))
                tarinfo.mtime = time.time()
                
                # Add to tar
                tar.addfile(tarinfo, file_data)
        
        return tmp.name

def deploy_site(site_num):
    """Deploy a single site"""
    try:
        # Create site content
        files = create_test_site(site_num)
        
        # Create tar.gz
        tar_path = create_tar_gz(files)
        
        # Deploy
        with open(tar_path, 'rb') as f:
            files = {
                'archive': (f'test-site-{site_num}.tar.gz', f, 'application/gzip')
            }
            headers = {
                'Authorization': f'Bearer {ADMIN_TOKEN}'
            }
            
            response = requests.post(
                f'{SPINHUB_URL}/_admin/deployments/upload',
                headers=headers,
                files=files,
                data={
                    'config': json.dumps({
                        'name': f'test-site-{site_num}',
                        'framework': 'static',
                        'customerId': 'test-customer',
                        'domain': f'test-{site_num}.localhost'
                    })
                },
                timeout=30
            )
        
        # Cleanup
        os.unlink(tar_path)
        
        if response.status_code in [200, 201]:
            return {
                'site_num': site_num,
                'success': True,
                'url': f'http://test-{site_num}.localhost',
                'message': response.json().get('message', 'Deployed successfully')
            }
        else:
            return {
                'site_num': site_num,
                'success': False,
                'error': f'HTTP {response.status_code}: {response.text}'
            }
            
    except Exception as e:
        return {
            'site_num': site_num,
            'success': False,
            'error': str(e)
        }

def main():
    """Main function"""
    print(f"{BLUE}🚀 SpinForge Test Deployment Script{RESET}")
    print(f"{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}")
    
    if not ADMIN_TOKEN:
        print(f"{RED}❌ Error: ADMIN_TOKEN not set{RESET}")
        print("\nTo get your admin token:")
        print("1. Open http://localhost:3030")
        print("2. Login with admin credentials")
        print("3. Open DevTools > Application > Local Storage")
        print("4. Copy the 'adminToken' value")
        print("\nThen run:")
        print("  ADMIN_TOKEN=your-token python3 test-deploy.py")
        sys.exit(1)
    
    print(f"📍 SpinHub URL: {SPINHUB_URL}")
    print(f"🔢 Sites to deploy: {NUM_SITES}")
    print(f"⚡ Parallel deploys: {PARALLEL_DEPLOYS}")
    print()
    
    # Deploy sites
    start_time = time.time()
    successful = []
    failed = []
    
    with ThreadPoolExecutor(max_workers=PARALLEL_DEPLOYS) as executor:
        # Submit all deployments
        futures = {
            executor.submit(deploy_site, i): i 
            for i in range(1, NUM_SITES + 1)
        }
        
        # Process results as they complete
        for future in as_completed(futures):
            site_num = futures[future]
            result = future.result()
            
            if result['success']:
                print(f"{GREEN}✅ Site {result['site_num']} deployed: {result['url']}{RESET}")
                successful.append(result)
            else:
                print(f"{RED}❌ Site {result['site_num']} failed: {result['error']}{RESET}")
                failed.append(result)
    
    # Summary
    duration = time.time() - start_time
    
    print()
    print(f"{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}")
    print(f"{BLUE}📊 Deployment Summary{RESET}")
    print(f"{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}")
    print(f"{GREEN}✅ Successful: {len(successful)}{RESET}")
    print(f"{RED}❌ Failed: {len(failed)}{RESET}")
    print(f"{YELLOW}⏱️  Duration: {duration:.2f}s{RESET}")
    print(f"{YELLOW}📈 Rate: {NUM_SITES/duration:.2f} sites/second{RESET}")
    
    if successful:
        print(f"\n{GREEN}🌐 Deployed Sites:{RESET}")
        for i, result in enumerate(successful[:10]):
            print(f"   {result['url']}")
        if len(successful) > 10:
            print(f"   ... and {len(successful) - 10} more")
    
    print(f"\n{BLUE}💡 Next Steps:{RESET}")
    print("- View all sites: http://localhost:3030/applications")
    print("- Check hosting status: http://localhost:3030/hosting")
    print("- Monitor performance: http://localhost:3030/admin")
    
    # Test accessing a site
    if successful:
        print(f"\n{BLUE}🧪 Testing site access...{RESET}")
        test_url = successful[0]['url']
        try:
            # Note: This might fail if nginx doesn't have the route yet
            response = requests.get(test_url, timeout=5, allow_redirects=False)
            if response.status_code == 200:
                print(f"{GREEN}✅ Successfully accessed {test_url}{RESET}")
            else:
                print(f"{YELLOW}⚠️  Got HTTP {response.status_code} from {test_url}{RESET}")
                print("   (Routes might take a moment to propagate)")
        except:
            print(f"{YELLOW}⚠️  Couldn't access {test_url} yet{RESET}")
            print("   (This is normal - nginx might need a moment to pick up the routes)")

if __name__ == '__main__':
    main()