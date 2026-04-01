/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Shield, Lock, LogOut, UserPlus, User, Users } from "lucide-react";

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
          SpinForge uses JWT-based authentication with two separate authentication systems: <strong>Admin Authentication</strong> and <strong>Customer Authentication</strong>.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 not-prose mb-4">
          <p className="text-sm text-yellow-900">
            <strong>Important:</strong> Admin and customer authentication are completely separate. Use the appropriate endpoints based on your user type.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Base URL</h2>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code>Production: https://api.spinforge.dev/api
Development: http://localhost:8080/api</code></pre>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication Headers</h2>
        <p className="text-gray-600 mb-4">All authenticated requests must include one of the following:</p>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code> (preferred)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Cookie: auth-token=&lt;token&gt;</code> (set automatically by browser)</li>
        </ul>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* ADMIN AUTHENTICATION */}
      <section className="mb-12">
        <div className="flex items-center mb-6">
          <Users className="h-7 w-7 text-red-600 mr-3" />
          <h2 className="text-3xl font-bold text-gray-900 mb-0">Admin Authentication</h2>
        </div>

        <p className="text-gray-600 mb-6">
          Admin authentication is for platform administrators to manage customers, sites, and system settings.
        </p>

        <div className="mb-8">
          <div className="flex items-center mb-4">
            <LogOut className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-0">Admin Login</h3>
          </div>

          <h4 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/_admin/login</code></h4>
          <p className="text-gray-600 mb-4">Authenticate an administrator with email and password.</p>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "email": "admin@spinforge.com",
  "password": "AdminPassword123!"
}`}</code></pre>
          </div>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Response</h5>
          <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "message": "Login successful",
  "admin": {
    "id": "admin_abc123",
    "email": "admin@spinforge.com",
    "name": "Admin User",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`}</code></pre>
          </div>

          <p className="text-gray-600 mb-2"><strong>Error (401 Unauthorized)</strong></p>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Invalid credentials"
}`}</code></pre>
          </div>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Example - cURL</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-bash">{`curl -X POST https://api.spinforge.dev/api/_admin/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@spinforge.com",
    "password": "AdminPassword123!"
  }'`}</code></pre>
          </div>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Example - JavaScript</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const adminLogin = async () => {
  try {
    const response = await fetch('https://api.spinforge.dev/api/_admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@spinforge.com',
        password: 'AdminPassword123!'
      })
    });

    const data = await response.json();
    const { token, admin } = data;

    // Store token
    localStorage.setItem('admin-token', token);
    console.log('Logged in as admin:', admin.email);
  } catch (error) {
    console.error('Admin login failed:', error);
  }
};`}</code></pre>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/_admin/logout</code></h3>
          <p className="text-gray-600 mb-4">Logout the current admin and invalidate the session.</p>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Headers</h5>
          <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
            <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code></li>
          </ul>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Response</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "message": "Logout successful"
}`}</code></pre>
          </div>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      {/* CUSTOMER AUTHENTICATION */}
      <section className="mb-12">
        <div className="flex items-center mb-6">
          <User className="h-7 w-7 text-blue-600 mr-3" />
          <h2 className="text-3xl font-bold text-gray-900 mb-0">Customer Authentication</h2>
        </div>

        <p className="text-gray-600 mb-6">
          Customer authentication is for end users who deploy and manage their own sites on SpinForge.
        </p>

        <div className="mb-8">
          <div className="flex items-center mb-4">
            <UserPlus className="h-6 w-6 text-green-600 mr-2" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-0">Customer Registration</h3>
          </div>

          <h4 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/_auth/customer/register</code></h4>
          <p className="text-gray-600 mb-4">Register a new customer account.</p>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}`}</code></pre>
          </div>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Response</h5>
          <p className="text-gray-600 mb-2"><strong>Success (201 Created)</strong></p>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "message": "Customer registered successfully",
  "customer": {
    "id": "cust_xyz789",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`}</code></pre>
          </div>

          <p className="text-gray-600 mb-2"><strong>Error (400 Bad Request)</strong></p>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Email already exists"
}`}</code></pre>
          </div>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Example - JavaScript</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const registerCustomer = async () => {
  try {
    const response = await fetch('https://api.spinforge.dev/api/_auth/customer/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'SecurePassword123!',
        name: 'John Doe'
      })
    });

    const data = await response.json();
    localStorage.setItem('auth-token', data.token);
    console.log('Registered as:', data.customer.email);
  } catch (error) {
    console.error('Registration failed:', error);
  }
};`}</code></pre>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center mb-4">
            <LogOut className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-0">Customer Login</h3>
          </div>

          <h4 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/_auth/customer/login</code></h4>
          <p className="text-gray-600 mb-4">Authenticate a customer with email and password.</p>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}`}</code></pre>
          </div>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Response</h5>
          <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "message": "Login successful",
  "customer": {
    "id": "cust_xyz789",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}`}</code></pre>
          </div>

          <p className="text-gray-600 mb-2"><strong>Error (401 Unauthorized)</strong></p>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Invalid credentials"
}`}</code></pre>
          </div>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Example - JavaScript</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const customerLogin = async () => {
  try {
    const response = await fetch('https://api.spinforge.dev/api/_auth/customer/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'SecurePassword123!'
      })
    });

    const data = await response.json();
    localStorage.setItem('auth-token', data.token);
    console.log('Logged in as:', data.customer.email);
  } catch (error) {
    console.error('Login failed:', error);
  }
};`}</code></pre>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/_auth/customer/logout</code></h3>
          <p className="text-gray-600 mb-4">Logout the current customer and invalidate the session.</p>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Headers</h5>
          <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
            <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code></li>
          </ul>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Response</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "message": "Logout successful"
}`}</code></pre>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-2xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/_auth/customer/verify</code></h3>
          <p className="text-gray-600 mb-4">Verify if the current customer token is valid.</p>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Headers</h5>
          <ul className="list-disc list-inside text-gray-600 space-y-1 mb-6">
            <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">Authorization: Bearer &lt;token&gt;</code></li>
          </ul>

          <h5 className="text-lg font-semibold text-gray-900 mb-3">Response</h5>
          <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
            <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "valid": true,
  "customer": {
    "id": "cust_xyz789",
    "email": "user@example.com",
    "name": "John Doe"
  }
}`}</code></pre>
          </div>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Handling</h2>
        <p className="text-gray-600 mb-4">All endpoints follow a consistent error response format:</p>

        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Error message",
  "message": "Detailed error description"
}`}</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Common Error Codes</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">400</code> - Bad Request (invalid input)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">401</code> - Unauthorized (invalid or missing token)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">403</code> - Forbidden (insufficient permissions)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">409</code> - Conflict (e.g., email already exists)</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">500</code> - Internal Server Error</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Security Best Practices</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">1. Token Storage</h3>
            <p className="text-gray-600 mb-2">Store tokens securely:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Browser: Use secure localStorage or httpOnly cookies</li>
              <li>Never expose tokens in URLs or logs</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Token Expiration</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Implement automatic re-authentication when tokens expire</li>
              <li>Handle 401 responses appropriately</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">3. HTTPS in Production</h3>
            <p className="text-gray-600">Always use HTTPS in production environments to protect tokens in transit</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Password Requirements</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Minimum 8 characters</li>
              <li>Include a mix of uppercase, lowercase, numbers, and special characters</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
