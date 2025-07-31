import { Server, Package, Globe, Shield, Zap, Cloud } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">How SpinForge Works</h1>
      <p className="text-lg text-gray-600 mb-8">
        SpinForge is a deployment platform designed around simplicity and speed. Unlike traditional platforms, 
        SpinForge focuses on running pre-built applications, giving you complete control over your build process 
        while we handle the infrastructure.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Core Architecture</h2>

      <div className="bg-gray-50 rounded-lg p-8 mb-8 not-prose">
        <div className="space-y-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900 mb-2">Pre-built Applications</h3>
              <p className="text-gray-600">
                You build your application locally using your preferred tools and configurations. 
                SpinForge takes your built output and deploys it globally. This gives you complete 
                control over your build process while we focus on what we do best - running applications.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Server className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900 mb-2">Spinlets</h3>
              <p className="text-gray-600">
                Your applications run in lightweight containers called Spinlets. These provide 
                isolation, security, and resource management without the overhead of traditional 
                containers. Spinlets start in milliseconds and scale automatically.
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Globe className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900 mb-2">Global Edge Network</h3>
              <p className="text-gray-600">
                Deployments are distributed across our global edge network. Your application runs 
                close to your users, reducing latency and improving performance. We handle all the 
                complexity of global distribution.
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">The Deployment Process</h2>

      <div className="space-y-8 mb-12">
        <div className="relative">
          <div className="absolute left-8 top-12 bottom-0 w-0.5 bg-gray-300"></div>
          
          <div className="relative flex items-start mb-8">
            <div className="flex-shrink-0 w-16 h-16 bg-white border-4 border-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-indigo-600">1</span>
            </div>
            <div className="ml-6 bg-white rounded-lg border border-gray-200 p-6 flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Build Locally</h3>
              <p className="text-gray-600 mb-3">
                Use your existing build tools to compile, bundle, and optimize your application. 
                Whether it's Next.js, Remix, or a custom build process, you're in control.
              </p>
              <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                npm run build
              </div>
            </div>
          </div>

          <div className="relative flex items-start mb-8">
            <div className="flex-shrink-0 w-16 h-16 bg-white border-4 border-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-indigo-600">2</span>
            </div>
            <div className="ml-6 bg-white rounded-lg border border-gray-200 p-6 flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Deploy with CLI</h3>
              <p className="text-gray-600 mb-3">
                The SpinForge CLI analyzes your built application, packages it efficiently, and 
                uploads it to our platform. This typically takes just a few seconds.
              </p>
              <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono">
                spinforge-cli deploy
              </div>
            </div>
          </div>

          <div className="relative flex items-start mb-8">
            <div className="flex-shrink-0 w-16 h-16 bg-white border-4 border-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-indigo-600">3</span>
            </div>
            <div className="ml-6 bg-white rounded-lg border border-gray-200 p-6 flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Global Distribution</h3>
              <p className="text-gray-600">
                Your application is automatically distributed to edge locations worldwide. SSL 
                certificates are provisioned, and your app is accessible via a unique URL immediately.
              </p>
            </div>
          </div>

          <div className="relative flex items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-white border-4 border-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-indigo-600">4</span>
            </div>
            <div className="ml-6 bg-white rounded-lg border border-gray-200 p-6 flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Automatic Scaling</h3>
              <p className="text-gray-600">
                As traffic increases, SpinForge automatically scales your application. New Spinlets 
                are created on demand, and traffic is distributed intelligently.
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Benefits</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 not-prose">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Zap className="h-8 w-8 text-yellow-500 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Lightning Fast Deployments</h3>
          <p className="text-gray-600 text-sm">
            Since we don't build your app, deployments complete in seconds. Your pre-built 
            application goes live almost instantly.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Shield className="h-8 w-8 text-green-500 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Security by Default</h3>
          <p className="text-gray-600 text-sm">
            Every deployment gets automatic HTTPS, DDoS protection, and runs in complete 
            isolation from other applications.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Cloud className="h-8 w-8 text-blue-500 mb-3" />
          <h3 className="text-lg font-semibold mb-2">No Infrastructure Management</h3>
          <p className="text-gray-600 text-sm">
            Focus on your application, not servers. We handle all infrastructure, scaling, 
            and operations automatically.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Package className="h-8 w-8 text-purple-500 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Build Tool Freedom</h3>
          <p className="text-gray-600 text-sm">
            Use any build tool, any configuration, any optimization. SpinForge works with 
            your existing workflow.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Under the Hood</h2>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8 not-prose">
        <h3 className="font-semibold text-amber-900 mb-2">SpinHub: The Deployment Engine</h3>
        <p className="text-amber-800">
          At the core of SpinForge is SpinHub, our deployment orchestration system. SpinHub manages:
        </p>
        <ul className="mt-3 space-y-2 text-amber-800">
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
            <span>Spinlet lifecycle management</span>
          </li>
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
            <span>Traffic routing and load balancing</span>
          </li>
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
            <span>Health monitoring and auto-recovery</span>
          </li>
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-amber-600 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
            <span>Resource allocation and scaling</span>
          </li>
        </ul>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">What SpinForge Doesn't Do</h2>

      <p className="mb-4">
        Understanding what SpinForge doesn't do is just as important as understanding what it does:
      </p>

      <ul className="list-disc list-inside space-y-2 mb-8 text-gray-700">
        <li><strong>No build infrastructure:</strong> We don't build your application - you do</li>
        <li><strong>No source code storage:</strong> We only store your built application</li>
        <li><strong>No CI/CD:</strong> Use your existing CI/CD pipeline to build, then deploy to SpinForge</li>
        <li><strong>No development environments:</strong> SpinForge is for production deployments</li>
      </ul>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 not-prose">
        <h3 className="text-lg font-semibold text-indigo-900 mb-2">Ready to deploy?</h3>
        <p className="text-indigo-700 mb-4">
          Now that you understand how SpinForge works, deploy your first application.
        </p>
        <a href="/docs/quick-start" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700">
          Get Started →
        </a>
      </div>
    </div>
  );
}