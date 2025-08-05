/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Cpu, Zap, Shield, Server, Activity, Package } from "lucide-react";

export default function SpinletsConceptPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Spinlets</h1>
      <p className="text-lg text-gray-600 mb-8">
        Spinlets are lightweight, secure containers that run your applications on SpinForge. 
        They provide the isolation of containers with the performance of native processes, 
        starting in milliseconds and scaling instantly.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What are Spinlets?</h2>

      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-8 mb-8 not-prose">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Traditional Containers</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✗</span>
                <span>Slow cold starts (seconds)</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✗</span>
                <span>Heavy resource overhead</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✗</span>
                <span>Complex orchestration</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Full OS isolation</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Spinlets</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Instant starts (milliseconds)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Minimal resource usage</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Automatic scaling</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Secure isolation</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Features</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 not-prose">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <Zap className="h-8 w-8 text-yellow-500 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Instant Startup</h3>
          <p className="text-gray-600 text-sm">
            Spinlets start in under 50ms, enabling true scale-to-zero and instant response 
            to traffic spikes.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <Shield className="h-8 w-8 text-green-500 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Secure Isolation</h3>
          <p className="text-gray-600 text-sm">
            Each spinlet runs in complete isolation with its own filesystem, network namespace, 
            and resource limits.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <Cpu className="h-8 w-8 text-blue-500 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Resource Efficient</h3>
          <p className="text-gray-600 text-sm">
            Spinlets use 10x less memory than containers, allowing more applications to run 
            on the same infrastructure.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">How Spinlets Work</h2>

      <div className="bg-gray-50 rounded-lg p-8 mb-8 not-prose">
        <div className="space-y-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900 mb-2">1. Application Packaging</h4>
              <p className="text-gray-600">
                Your pre-built application is packaged into a spinlet-compatible format, 
                including all dependencies and runtime requirements.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Server className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900 mb-2">2. Spinlet Creation</h4>
              <p className="text-gray-600">
                When a request arrives, SpinHub creates a new spinlet instance in milliseconds, 
                allocating exactly the resources needed.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900 mb-2">3. Request Handling</h4>
              <p className="text-gray-600">
                The spinlet processes requests with near-native performance. Multiple spinlets 
                can run simultaneously to handle concurrent traffic.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Zap className="h-6 w-6 text-amber-600" />
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900 mb-2">4. Automatic Scaling</h4>
              <p className="text-gray-600">
                Spinlets scale up and down automatically based on traffic. Idle spinlets are 
                recycled to free resources for other applications.
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Spinlet Lifecycle</h2>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8 not-prose">
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <div className="flex-1 h-1 bg-blue-200 mx-2"></div>
            <div className="text-sm font-medium text-gray-700">Cold Start (&lt; 50ms)</div>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <div className="flex-1 h-1 bg-green-200 mx-2"></div>
            <div className="text-sm font-medium text-gray-700">Active (handling requests)</div>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <div className="flex-1 h-1 bg-yellow-200 mx-2"></div>
            <div className="text-sm font-medium text-gray-700">Idle (waiting for requests)</div>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
            <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
            <div className="text-sm font-medium text-gray-700">Recycled (after idle timeout)</div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Resource Allocation</h2>

      <div className="overflow-x-auto mb-8">
        <table className="min-w-full divide-y divide-gray-200 not-prose">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Default
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Maximum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                Memory
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                128MB
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                2GB
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Auto-scales based on usage
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                CPU
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                0.1 vCPU
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                2 vCPU
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Bursts available for spikes
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                Disk
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                512MB
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                10GB
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Ephemeral storage
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                Network
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                100Mbps
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                1Gbps
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                Shared bandwidth
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Spinlet vs Traditional Deployment</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 not-prose">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-semibold text-red-900 mb-3">Traditional VPS/Container</h3>
          <div className="space-y-2 text-red-800 text-sm">
            <p>• Always running = always paying</p>
            <p>• Fixed resources even when idle</p>
            <p>• Manual scaling configuration</p>
            <p>• Slow deployments (minutes)</p>
            <p>• Complex setup and maintenance</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-3">Spinlets</h3>
          <div className="space-y-2 text-green-800 text-sm">
            <p>• Scale to zero = pay for usage</p>
            <p>• Dynamic resource allocation</p>
            <p>• Automatic scaling built-in</p>
            <p>• Instant deployments (seconds)</p>
            <p>• Zero configuration required</p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Best Practices</h2>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="font-semibold text-amber-900 mb-4">Optimizing for Spinlets</h3>
        <ul className="space-y-3 text-amber-800">
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
            <div>
              <strong>Fast startup:</strong> Minimize initialization code. Spinlets excel at quick starts.
            </div>
          </li>
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
            <div>
              <strong>Stateless design:</strong> Store state externally. Spinlets may be recycled anytime.
            </div>
          </li>
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
            <div>
              <strong>Efficient memory use:</strong> Start small, let spinlets scale up as needed.
            </div>
          </li>
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
            <div>
              <strong>Handle concurrency:</strong> Multiple spinlets may handle requests simultaneously.
            </div>
          </li>
        </ul>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">Learn More</h3>
        <p className="text-indigo-700 mb-4">
          Ready to deploy your application with spinlets? Check out our deployment guide.
        </p>
        <a href="/docs/deployment/overview" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700">
          Deployment Guide →
        </a>
      </div>
    </div>
  );
}