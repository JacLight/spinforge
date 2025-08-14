/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Users, User, Lock, Bell, Trash2, Settings, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function UserManagementAPIPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Users className="h-8 w-8 text-blue-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">User Management API</h1>
      </div>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
        <p className="text-gray-600 mb-4">
          User management endpoints for profile updates, password changes, and notification preferences.
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
          <User className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">1. Get User Profile</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/user/profile</code></h3>
        <p className="text-gray-600 mb-4">Retrieve the current user's profile information.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Headers</h4>
        <div className="bg-gray-100 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-800 overflow-x-auto"><code>Authorization: Bearer &lt;token&gt;</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "customerId": "cust_abc123",
    "role": "user",
    "createdAt": "2025-01-15T10:30:00Z",
    "subscription": {
      "plan": "pro",
      "status": "active",
      "expiresAt": "2025-02-15T10:30:00Z"
    },
    "usage": {
      "deployments": 5,
      "bandwidth": "10.5 GB",
      "storage": "2.3 GB"
    }
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`import axios from 'axios';

const getUserProfile = async () => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.get('https://api.spinforge.app/api/user/profile', {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    console.log('User profile:', response.data.user);
    return response.data.user;
  } catch (error) {
    console.error('Failed to fetch profile:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Settings className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">2. Update User Profile</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">PUT /api/user/profile</code></h3>
        <p className="text-gray-600 mb-4">Update user profile information.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "email": "newemail@example.com",
  "displayName": "John Doe",
  "company": "Acme Corp",
  "timezone": "America/New_York"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "newemail@example.com",
    "displayName": "John Doe",
    "company": "Acme Corp",
    "timezone": "America/New_York",
    "updatedAt": "2025-01-15T14:30:00Z"
  }
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (400 Bad Request)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Email already in use"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const updateProfile = async (profileData) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.put('https://api.spinforge.app/api/user/profile', profileData, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Profile updated:', response.data.user);
    return response.data.user;
  } catch (error) {
    console.error('Profile update failed:', error.response?.data?.error);
  }
};

// Usage
updateProfile({
  displayName: 'John Doe',
  company: 'Acme Corp',
  timezone: 'America/New_York'
});`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Lock className="h-6 w-6 text-orange-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">3. Change Password</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">POST /api/user/password</code></h3>
        <p className="text-gray-600 mb-4">Change the user's password.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!",
  "confirmPassword": "NewSecurePassword456!"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "message": "Password updated successfully"
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (401 Unauthorized)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Current password is incorrect"
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (400 Bad Request)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "New password does not meet requirements",
  "requirements": [
    "Minimum 8 characters",
    "At least one uppercase letter",
    "At least one lowercase letter",
    "At least one number",
    "At least one special character"
  ]
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const changePassword = async (passwordData) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.post('https://api.spinforge.app/api/user/password', {
      currentPassword: passwordData.current,
      newPassword: passwordData.new,
      confirmPassword: passwordData.confirm
    }, {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    console.log('Password changed successfully');
    // Optionally redirect to login
    return response.data;
  } catch (error) {
    console.error('Password change failed:', error.response?.data?.error);
    throw error;
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Bell className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">4. Notification Preferences</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">GET /api/user/notifications</code></h3>
        <p className="text-gray-600 mb-4">Get user notification preferences.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "notifications": {
    "email": {
      "deploymentSuccess": true,
      "deploymentFailure": true,
      "usageAlerts": true,
      "securityAlerts": true,
      "newsletter": false
    },
    "webhook": {
      "enabled": false,
      "url": null
    },
    "slack": {
      "enabled": false,
      "webhookUrl": null
    }
  }
}`}</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">PUT /api/user/notifications</code></h3>
        <p className="text-gray-600 mb-4">Update notification preferences.</p>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "email": {
    "deploymentSuccess": true,
    "deploymentFailure": true,
    "usageAlerts": false,
    "securityAlerts": true,
    "newsletter": true
  },
  "webhook": {
    "enabled": true,
    "url": "https://example.com/webhook"
  },
  "slack": {
    "enabled": true,
    "webhookUrl": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "notifications": {
    "email": {
      "deploymentSuccess": true,
      "deploymentFailure": true,
      "usageAlerts": false,
      "securityAlerts": true,
      "newsletter": true
    },
    "webhook": {
      "enabled": true,
      "url": "https://example.com/webhook"
    },
    "slack": {
      "enabled": true,
      "webhookUrl": "https://hooks.slack.com/services/..."
    }
  }
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const updateNotifications = async (preferences) => {
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.put('https://api.spinforge.app/api/user/notifications', preferences, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Notifications updated:', response.data.notifications);
    return response.data.notifications;
  } catch (error) {
    console.error('Failed to update notifications:', error.response?.data?.error);
  }
};

// Usage
updateNotifications({
  email: {
    deploymentSuccess: true,
    deploymentFailure: true,
    usageAlerts: false,
    securityAlerts: true,
    newsletter: true
  },
  slack: {
    enabled: true,
    webhookUrl: 'https://hooks.slack.com/services/...'
  }
});`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <div className="flex items-center mb-4">
          <Trash2 className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-0">5. Delete Account</h2>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3"><code className="bg-gray-100 px-2 py-1 rounded text-sm">DELETE /api/user/profile</code></h3>
        <p className="text-gray-600 mb-4">Permanently delete user account and all associated data.</p>

        <div className="bg-red-50 border-l-4 border-red-400 p-4 not-prose mb-6">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
            <div>
              <p className="text-red-700 font-medium">Warning</p>
              <p className="text-red-600 text-sm">This action cannot be undone. All deployments, data, and configurations will be permanently deleted.</p>
            </div>
          </div>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Request Body</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "password": "CurrentPassword123!",
  "confirmation": "DELETE MY ACCOUNT"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Response</h4>
        <p className="text-gray-600 mb-2"><strong>Success (200 OK)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "success": true,
  "message": "Account deleted successfully"
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (401 Unauthorized)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-4">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Invalid password"
}`}</code></pre>
        </div>

        <p className="text-gray-600 mb-2"><strong>Error (400 Bad Request)</strong></p>
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Invalid confirmation text"
}`}</code></pre>
        </div>

        <h4 className="text-lg font-semibold text-gray-900 mb-3">Example - Axios</h4>
        <div className="bg-gray-900 rounded-lg p-4 not-prose">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-javascript">{`const deleteAccount = async (password) => {
  // Double confirmation
  const confirmed = window.confirm('Are you sure you want to delete your account? This cannot be undone.');
  if (!confirmed) return;
  
  try {
    const token = localStorage.getItem('auth-token');
    const response = await axios.delete('https://api.spinforge.app/api/user/profile', {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      },
      data: {
        password: password,
        confirmation: 'DELETE MY ACCOUNT'
      }
    });
    
    console.log('Account deleted');
    localStorage.clear();
    window.location.href = '/';
  } catch (error) {
    console.error('Account deletion failed:', error.response?.data?.error);
  }
};`}</code></pre>
        </div>
      </section>

      <hr className="my-8 border-gray-200" />

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Error Handling</h2>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-3">Common Error Responses</h3>
        
        <div className="bg-gray-900 rounded-lg p-4 not-prose mb-6">
          <pre className="text-gray-100 overflow-x-auto"><code className="language-json">{`{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}`}</code></pre>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-3">Error Codes</h3>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">INVALID_TOKEN</code> - Authentication token is invalid or expired</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">INSUFFICIENT_PERMISSIONS</code> - User lacks required permissions</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">VALIDATION_ERROR</code> - Input validation failed</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">DUPLICATE_EMAIL</code> - Email address already in use</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">WEAK_PASSWORD</code> - Password doesn't meet requirements</li>
          <li><code className="bg-gray-100 px-2 py-1 rounded text-sm">RATE_LIMIT_EXCEEDED</code> - Too many requests</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limiting</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li>Profile updates: 10 requests per hour</li>
          <li>Password changes: 3 requests per hour</li>
          <li>Account deletion: 1 request per day</li>
        </ul>
      </section>
    </div>
  );
}