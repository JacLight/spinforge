/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Home,
  Book,
  Rocket,
  Shield,
  Menu,
  X,
  ChevronRight,
  ChevronDown
} from "lucide-react";

interface DocSection {
  title: string;
  href?: string;
  items?: Array<{
    title: string;
    href: string;
    description?: string;
  }>;
  icon?: any;
}

const docSections: DocSection[] = [
  {
    title: "Getting Started",
    icon: Home,
    items: [
      { title: "Introduction", href: "/docs", description: "Welcome to SpinForge" },
      { title: "Quick Start", href: "/docs/quick-start", description: "Deploy your first app in minutes" },
    ]
  },
  {
    title: "Core Concepts",
    icon: Book,
    items: [
      { title: "How SpinForge Works", href: "/docs/concepts/how-it-works", description: "Understanding the deployment model" },
      { title: "Pre-built Applications", href: "/docs/concepts/pre-built-apps", description: "Why we only run built apps" },
    ]
  },
  {
    title: "API Reference",
    icon: Shield,
    items: [
      { title: "API Overview", href: "/docs/api", description: "REST API documentation" },
      { title: "Authentication", href: "/docs/api/authentication", description: "Admin and customer authentication" },
      { title: "Sites Management", href: "/docs/api/sites", description: "Create and manage sites" },
      { title: "Containers", href: "/docs/api/containers", description: "Docker container management" },
      { title: "SSL Certificates", href: "/docs/api/certificates", description: "Manage SSL/TLS certificates" },
      { title: "Metrics", href: "/docs/api/metrics", description: "Access metrics and logs" },
      { title: "Templates", href: "/docs/api/templates", description: "Deploy from templates" },
      { title: "Admin Operations", href: "/docs/api/admin", description: "Admin-only endpoints" },
    ]
  },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(
    docSections.map(s => s.title)
  );

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <Rocket className="h-8 w-8 text-indigo-600" />
                <span className="ml-2 text-xl font-semibold">SpinForge</span>
              </Link>
              <div className="hidden md:block ml-10">
                <nav className="flex space-x-4">
                  <Link href="/docs" className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                    Documentation
                  </Link>
                  <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                    Dashboard
                  </Link>
                </nav>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Mobile sidebar */}
        <div className={cn(
          "fixed inset-0 z-40 md:hidden",
          sidebarOpen ? "block" : "hidden"
        )}>
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex h-16 items-center justify-between px-4 border-b">
              <span className="text-lg font-semibold">Documentation</span>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
              {renderSidebar()}
            </nav>
          </div>
        </div>

        {/* Desktop sidebar */}
        <nav className="hidden md:block w-64 bg-gray-50 min-h-screen border-r border-gray-200">
          <div className="sticky top-16 p-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
            {renderSidebar()}
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );

  function renderSidebar() {
    return (
      <div className="space-y-6">
        {docSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.includes(section.title);

          return (
            <div key={section.title}>
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-900 hover:text-gray-700"
              >
                <div className="flex items-center">
                  {Icon && <Icon className="h-4 w-4 mr-2" />}
                  {section.title}
                </div>
                {section.items && (
                  isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {section.items && isExpanded && (
                <ul className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "block px-3 py-2 text-sm rounded-md transition-colors",
                            isActive
                              ? "bg-indigo-100 text-indigo-700 font-medium"
                              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          )}
                        >
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }
}
