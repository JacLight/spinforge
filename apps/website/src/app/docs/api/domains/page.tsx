/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Globe, Shield, CheckCircle, AlertCircle, Trash2, Settings } from "lucide-react";
import Link from "next/link";

export default function DomainsAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Globe className="h-8 w-8 text-green-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Domains & Routes API</h1>
      </div>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          Manage custom domains, SSL certificates, and routing configurations for your deployments.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Base URL</h2>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code>Production: https://api.spinforge.app
Development: http://localhost:3000</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication</h2>
        <p className="text-gray-600 mb-4">All endpoints require authentication via:</p>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code></li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">X-Auth-Token: &lt;token&gt;</code></li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Cookie: auth-token=&lt;token&gt;</code></li>
        </ul>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Globe className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">1. List Domains</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/routes</code></h3>
        <p className="text-gray-600 mb-4">List all domains and routes for the authenticated user.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">status</code> (optional): Filter by status (<code>active</code>, <code>pending</code>, <code>failed</code>)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">type</code> (optional): Filter by type (<code>primary</code>, <code>alias</code>, <code>redirect</code>)</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "routes": [
    {
      "id": "route_abc123",
      "domain": "example.com",
      "www": true,
      "deployment": "my-app",
      "type": "primary",
      "status": "active",
      "ssl": {
        "enabled": true,
        "provider": "letsencrypt",
        "status": "active",
        "expiresAt": "2025-04-15T00:00:00Z",
        "autoRenew": true
      },
      "dns": {
        "configured": true,
        "records": [
          {
            "type": "A",
            "name": "@",
            "value": "76.76.21.21",
            "status": "verified"
          },
          {
            "type": "CNAME",
            "name": "www",
            "value": "cname.spinforge.app",
            "status": "verified"
          }
        ]
      },
      "createdAt": "2025-01-10T10:00:00Z",
      "verifiedAt": "2025-01-10T10:15:00Z"
    }
  ]
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`import axios from 'axios';

const listDomains = async (filters = {}) => {
  try {
    const token = localStorage.getItem('auth-token');
    const params = new URLSearchParams(filters).toString();
    
    const response = await axios.get(\`https://api.spinforge.app/api/routes\${params ? '?' + params : ''}\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    console.log(\`Found \${response.data.routes.length} domains\`);
    return response.data.routes;
  } catch (error) {
    console.error('Failed to fetch domains:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Globe className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">2. Add Custom Domain</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/routes</code></h3>
        <p className="text-gray-600 mb-4">Add a custom domain to a deployment.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "domain": "example.com",
  "deployment": "my-app",
  "www": true,
  "ssl": {
    "enabled": true,
    "provider": "letsencrypt"
  },
  "redirect": {
    "fromWww": false,
    "toWww": true,
    "forceHttps": true
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">domain</code> (required): The domain name to add</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">deployment</code> (required): Deployment name or ID to route to</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">www</code> (optional): Include www subdomain (default: true)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">ssl</code> (optional): SSL configuration</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">redirect</code> (optional): Redirect rules</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (201 Created)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "route": {
    "id": "route_new123",
    "domain": "example.com",
    "deployment": "my-app",
    "status": "pending",
    "dns": {
      "configured": false,
      "required": [
        {
          "type": "A",
          "name": "@",
          "value": "76.76.21.21"
        },
        {
          "type": "CNAME",
          "name": "www",
          "value": "cname.spinforge.app"
        }
      ],
      "verificationToken": "spinforge-verify-abc123xyz"
    },
    "message": "Domain added. Please configure DNS records to activate."
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const addCustomDomain = async (domainConfig) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.post('https://api.spinforge.app/api/routes', {
      domain: domainConfig.domain,
      deployment: domainConfig.deployment,
      www: true,
      ssl: {
        enabled: true,
        provider: 'letsencrypt'
      },
      redirect: {
        forceHttps: true,
        toWww: true
      }
    }, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Domain added:', response.data.route.domain);
    console.log('DNS records to configure:', response.data.route.dns.required);
    
    return response.data.route;
  } catch (error) {
    console.error('Failed to add domain:', error.response?.data?.error);
  }
};

// Usage
addCustomDomain({
  domain: 'example.com',
  deployment: 'my-app'
});`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Globe className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">3. Get Domain Details</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/routes/[domain]</code></h3>
        <p className="text-gray-600 mb-4">Get detailed information about a specific domain.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Path Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">domain</code>: The domain name</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "route": {
    "id": "route_abc123",
    "domain": "example.com",
    "deployment": "my-app",
    "type": "primary",
    "status": "active",
    "ssl": {
      "enabled": true,
      "provider": "letsencrypt",
      "status": "active",
      "certificate": {
        "issuer": "Let's Encrypt",
        "subject": "example.com",
        "altNames": ["example.com", "www.example.com"],
        "validFrom": "2025-01-15T00:00:00Z",
        "validTo": "2025-04-15T00:00:00Z",
        "fingerprint": "SHA256:abc123..."
      },
      "autoRenew": true,
      "renewalDate": "2025-03-15T00:00:00Z"
    },
    "dns": {
      "configured": true,
      "lastChecked": "2025-01-15T15:00:00Z",
      "records": [
        {
          "type": "A",
          "name": "@",
          "value": "76.76.21.21",
          "status": "verified",
          "ttl": 3600
        }
      ],
      "nameservers": [
        "ns1.example.com",
        "ns2.example.com"
      ]
    },
    "redirect": {
      "fromWww": false,
      "toWww": true,
      "forceHttps": true
    },
    "analytics": {
      "requests": {
        "total": 45230,
        "today": 1523
      },
      "bandwidth": {
        "total": "12.3 GB",
        "today": "456 MB"
      },
      "visitors": {
        "unique": 3421,
        "today": 234
      }
    },
    "createdAt": "2025-01-10T10:00:00Z",
    "verifiedAt": "2025-01-10T10:15:00Z",
    "updatedAt": "2025-01-15T14:00:00Z"
  }
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Settings className="h-6 w-6 text-orange-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">4. Update Domain Configuration</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">PUT /api/routes/[domain]</code></h3>
        <p className="text-gray-600 mb-4">Update domain configuration including SSL and redirect settings.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "deployment": "new-app",
  "ssl": {
    "enabled": true,
    "provider": "custom",
    "certificate": "-----BEGIN CERTIFICATE-----...",
    "privateKey": "-----BEGIN PRIVATE KEY-----..."
  },
  "redirect": {
    "fromWww": true,
    "toWww": false,
    "forceHttps": true
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const updateDomain = async (domain, updates) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.put(\`https://api.spinforge.app/api/routes/\${domain}\`, updates, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Domain updated:', response.data.route);
    return response.data.route;
  } catch (error) {
    console.error('Update failed:', error.response?.data?.error);
  }
};

// Usage - Update redirect rules
updateDomain('example.com', {
  redirect: {
    fromWww: true,
    toWww: false,
    forceHttps: true
  }
});`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">5. Verify Domain</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/routes/[domain]/verify</code></h3>
        <p className="text-gray-600 mb-4">Trigger domain verification check.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "verification": {
    "domain": "example.com",
    "status": "verified",
    "dns": {
      "configured": true,
      "records": [
        {
          "type": "A",
          "name": "@",
          "expected": "76.76.21.21",
          "actual": "76.76.21.21",
          "status": "match"
        },
        {
          "type": "TXT",
          "name": "_spinforge",
          "expected": "spinforge-verify-abc123xyz",
          "actual": "spinforge-verify-abc123xyz",
          "status": "match"
        }
      ]
    },
    "ssl": {
      "status": "active",
      "provider": "letsencrypt"
    },
    "message": "Domain verified successfully"
  }
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (400 Bad Request)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "verification": {
    "domain": "example.com",
    "status": "pending",
    "dns": {
      "configured": false,
      "records": [
        {
          "type": "A",
          "name": "@",
          "expected": "76.76.21.21",
          "actual": "1.2.3.4",
          "status": "mismatch"
        }
      ]
    },
    "message": "DNS configuration incomplete"
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const verifyDomain = async (domain) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.post(\`https://api.spinforge.app/api/routes/\${domain}/verify\`, {}, {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    if (response.data.verification.status === 'verified') {
      console.log('Domain verified successfully!');
    } else {
      console.log('Verification pending. Check DNS records:', response.data.verification.dns.records);
    }
    
    return response.data.verification;
  } catch (error) {
    console.error('Verification failed:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Trash2 className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">6. Remove Domain</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">DELETE /api/routes/[domain]</code></h3>
        <p className="text-gray-600 mb-4">Remove a custom domain from your account.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "message": "Domain removed successfully"
}`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">DNS Configuration Guide</h2>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3">A Record (Root Domain)</h3>
        <div className="bg-gray-100 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-800 overflow-x-auto"><code>Type: A
Name: @ (or blank)
Value: 76.76.21.21
TTL: 3600</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">CNAME Record (Subdomains)</h3>
        <div className="bg-gray-100 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-800 overflow-x-auto"><code>Type: CNAME
Name: www (or subdomain)
Value: cname.spinforge.app
TTL: 3600</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Verification TXT Record</h3>
        <div className="bg-gray-100 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-800 overflow-x-auto"><code>Type: TXT
Name: _spinforge
Value: spinforge-verify-[your-token]
TTL: 3600</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Popular DNS Providers</h3>
        
        <h4 className="text-lg font-semibold text-gray-900 mb-3">Cloudflare</h4>
        <ol className="list-decimal list-inside text-gray-600 space-y-1 mb-6">
          <li>Set proxy status to "DNS only" (gray cloud) during verification</li>
          <li>After verification, you can enable proxy (orange cloud)</li>
        </ol>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Route 53 (AWS)</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "example.com",
      "Type": "A",
      "TTL": 3600,
      "ResourceRecords": [{"Value": "76.76.21.21"}]
    }
  }]
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Google Cloud DNS</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`gcloud dns record-sets transaction start --zone=my-zone
gcloud dns record-sets transaction add 76.76.21.21 \\
  --name=example.com. --ttl=3600 --type=A --zone=my-zone
gcloud dns record-sets transaction execute --zone=my-zone`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">SSL Certificate Management</h2>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3">Automatic SSL (Let's Encrypt)</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li>Certificates are automatically provisioned</li>
          <li>Auto-renewal 30 days before expiration</li>
          <li>Supports wildcard certificates for subdomains</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Custom SSL Certificates</h3>
        <p className="text-gray-600 mb-4">Upload your own SSL certificate:</p>

        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const uploadCustomSSL = async (domain, certData) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.put(\`https://api.spinforge.app/api/routes/\${domain}\`, {
      ssl: {
        enabled: true,
        provider: 'custom',
        certificate: certData.certificate,
        privateKey: certData.privateKey,
        chain: certData.chain // Optional certificate chain
      }
    }, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Custom SSL uploaded');
    return response.data;
  } catch (error) {
    console.error('SSL upload failed:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Codes</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">DOMAIN_IN_USE</code> - Domain is already registered</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">DNS_NOT_CONFIGURED</code> - DNS records not properly configured</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">SSL_PROVISIONING_FAILED</code> - SSL certificate provisioning failed</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">INVALID_DOMAIN</code> - Domain format is invalid</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">VERIFICATION_FAILED</code> - Domain ownership verification failed</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">DEPLOYMENT_NOT_FOUND</code> - Referenced deployment doesn't exist</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limiting</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li>Add domain: 10 per hour</li>
          <li>Verify domain: 30 per hour</li>
          <li>Update configuration: 20 per hour</li>
          <li>SSL provisioning: 5 per hour per domain</li>
        </ul>
      </section>
    </div>
  );
}