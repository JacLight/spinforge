/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield, Lock, Github, RefreshCw, LogOut, UserPlus } from "lucide-react";
import Link from "next/link";

export default function AuthenticationAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Shield className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Authentication API</h1>
      </div>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          SpinForge uses JWT-based authentication with secure cookie management. All API endpoints require authentication unless otherwise specified.
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
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication Headers</h2>
        <p className="text-gray-600 mb-4">All authenticated requests must include one of the following:</p>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code> (preferred)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">X-Auth-Token: &lt;token&gt;</code></li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Cookie: auth-token=&lt;token&gt;</code> (set automatically by browser)</li>
        </ul>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <LogOut className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">1. User Login</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/auth/login</code></h3>
        <p className="text-gray-600 mb-4">Authenticate a user with email and password.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "user@example.com",
    "customerId": "cust_abc123",
    "role": "user"
  }
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (401 Unauthorized)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Invalid credentials"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - cURL</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`curl -X POST https://api.spinforge.app/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`import axios from 'axios';

const login = async () => {
  try {
    const response = await axios.post('https://api.spinforge.app/api/auth/login', {
      email: 'user@example.com',
      password: 'SecurePassword123!'
    });
    
    const { token, user } = response.data;
    // Store token in localStorage or state management
    localStorage.setItem('auth-token', token);
    console.log('Logged in as:', user.email);
  } catch (error) {
    console.error('Login failed:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <UserPlus className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">2. User Signup</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/auth/signup</code></h3>
        <p className="text-gray-600 mb-4">Register a new user account.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (201 Created)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "newuser@example.com",
    "customerId": "cust_xyz789",
    "role": "user"
  }
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (400 Bad Request)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Email already exists"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const signup = async () => {
  try {
    const response = await axios.post('https://api.spinforge.app/api/auth/signup', {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!'
    });
    
    const { token, user } = response.data;
    localStorage.setItem('auth-token', token);
    console.log('Account created for:', user.email);
  } catch (error) {
    console.error('Signup failed:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <LogOut className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">3. Logout</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/auth/logout</code></h3>
        <p className="text-gray-600 mb-4">Logout the current user and invalidate the session.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Headers</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code> or</li>
          <li>Cookie with <code className="bg-gray-100 px-2 py-1 rounded text-sm">auth-token</code></li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "message": "Logged out successfully"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const logout = async () => {
  try {
    const token = localStorage.getItem('auth-token');
    await axios.post('https://api.spinforge.app/api/auth/logout', {}, {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    localStorage.removeItem('auth-token');
    console.log('Logged out successfully');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <RefreshCw className="h-6 w-6 text-orange-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">4. Refresh Token</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/auth/refresh</code></h3>
        <p className="text-gray-600 mb-4">Refresh an expired access token using a refresh token.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (401 Unauthorized)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Invalid or expired refresh token"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const refreshToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refresh-token');
    const response = await axios.post('https://api.spinforge.app/api/auth/refresh', {
      refreshToken
    });
    
    const { token, refreshToken: newRefreshToken } = response.data;
    localStorage.setItem('auth-token', token);
    localStorage.setItem('refresh-token', newRefreshToken);
    
    return token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Redirect to login
    window.location.href = '/login';
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Github className="h-6 w-6 text-gray-900 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">5. GitHub OAuth</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/auth/github</code></h3>
        <p className="text-gray-600 mb-4">Initiate GitHub OAuth authentication flow.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">returnTo</code> (optional): URL to redirect after successful authentication</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-6">Redirects to GitHub OAuth authorization page.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Browser</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-html">{`<a href="https://api.spinforge.app/api/auth/github?returnTo=/dashboard">
  Login with GitHub
</a>`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - JavaScript</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const loginWithGitHub = () => {
  const returnTo = encodeURIComponent('/dashboard');
  window.location.href = \`https://api.spinforge.app/api/auth/github?returnTo=\${returnTo}\`;
};`}</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/auth/github/callback</code></h3>
        <p className="text-gray-600 mb-4">GitHub OAuth callback endpoint (handled automatically).</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Query Parameters</h4>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">code</code>: Authorization code from GitHub</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">state</code>: State parameter for CSRF protection</li>
        </ul>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-6">Redirects to the application with authentication cookies set.</p>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Handling</h2>
        <p className="text-gray-600 mb-4">All endpoints follow a consistent error response format:</p>

        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Error message",
  "details": {} // Optional additional error details
}`}</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Common Error Codes</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">400</code> - Bad Request (invalid input)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">401</code> - Unauthorized (invalid or missing token)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">403</code> - Forbidden (insufficient permissions)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">404</code> - Not Found</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">409</code> - Conflict (e.g., email already exists)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">500</code> - Internal Server Error</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Security Best Practices</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">1. Token Storage</h3>
            <p className="text-gray-600 mb-2">Store tokens securely</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Browser: Use httpOnly cookies or secure localStorage</li>
              <li>Mobile: Use secure keychain/keystore</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Token Expiration</h3>
            <p className="text-gray-600 mb-2">Tokens expire after 7 days</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Implement automatic token refresh</li>
              <li>Handle 401 responses by refreshing or re-authenticating</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">3. HTTPS Only</h3>
            <p className="text-gray-600">Always use HTTPS in production</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Password Requirements</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Minimum 8 characters</li>
              <li>Include uppercase, lowercase, numbers, and special characters</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limiting</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li>Login/Signup: 5 requests per minute per IP</li>
          <li>API calls: 100 requests per minute per user</li>
          <li>Token refresh: 10 requests per minute per user</li>
        </ul>
      </section>
    </div>
  );
}