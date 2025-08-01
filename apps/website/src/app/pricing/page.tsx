"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Zap, Shield, Globe, Cpu, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type BillingPeriod = "monthly" | "yearly";

interface PricingTier {
  name: string;
  price: {
    monthly: number;
    yearly: number;
  };
  description: string;
  features: Array<{
    text: string;
    included: boolean;
  }>;
  limits: {
    requests: string;
    bandwidth: string;
    buildMinutes: string;
    deployments: string;
    teamMembers: string;
    customDomains: string;
  };
  highlighted?: boolean;
  cta: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Hobby",
    price: {
      monthly: 0,
      yearly: 0,
    },
    description: "Perfect for side projects and experimentation",
    features: [
      { text: "1M requests per month", included: true },
      { text: "100GB bandwidth", included: true },
      { text: "1000 build minutes", included: true },
      { text: "Automatic SSL certificates", included: true },
      { text: "Global CDN", included: true },
      { text: "Basic DDoS protection", included: true },
      { text: "Community support", included: true },
      { text: "Custom domains", included: false },
      { text: "Team collaboration", included: false },
      { text: "Priority support", included: false },
    ],
    limits: {
      requests: "1M/month",
      bandwidth: "100GB",
      buildMinutes: "1,000",
      deployments: "10 active",
      teamMembers: "1",
      customDomains: "0",
    },
    cta: "Start for Free",
  },
  {
    name: "Pro",
    price: {
      monthly: 29,
      yearly: 290,
    },
    description: "For professional developers and small teams",
    features: [
      { text: "10M requests per month", included: true },
      { text: "1TB bandwidth", included: true },
      { text: "5000 build minutes", included: true },
      { text: "Automatic SSL certificates", included: true },
      { text: "Global CDN", included: true },
      { text: "Advanced DDoS protection", included: true },
      { text: "5 custom domains", included: true },
      { text: "Up to 5 team members", included: true },
      { text: "Email support", included: true },
      { text: "99.9% uptime SLA", included: true },
    ],
    limits: {
      requests: "10M/month",
      bandwidth: "1TB",
      buildMinutes: "5,000",
      deployments: "50 active",
      teamMembers: "5",
      customDomains: "5",
    },
    highlighted: true,
    cta: "Start Pro Trial",
  },
  {
    name: "Enterprise",
    price: {
      monthly: 299,
      yearly: 2990,
    },
    description: "For growing businesses with advanced needs",
    features: [
      { text: "Unlimited requests", included: true },
      { text: "Unlimited bandwidth", included: true },
      { text: "Unlimited build minutes", included: true },
      { text: "Automatic SSL certificates", included: true },
      { text: "Global CDN with edge locations", included: true },
      { text: "Enterprise DDoS protection", included: true },
      { text: "Unlimited custom domains", included: true },
      { text: "Unlimited team members", included: true },
      { text: "24/7 priority support", included: true },
      { text: "99.99% uptime SLA", included: true },
    ],
    limits: {
      requests: "Unlimited",
      bandwidth: "Unlimited",
      buildMinutes: "Unlimited",
      deployments: "Unlimited",
      teamMembers: "Unlimited",
      customDomains: "Unlimited",
    },
    cta: "Contact Sales",
  },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <Zap className="h-8 w-8 text-indigo-600" />
                <span className="ml-2 text-xl font-semibold">SpinForge</span>
              </Link>
              <nav className="hidden md:flex ml-10 space-x-4">
                <Link href="/docs" className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                  Documentation
                </Link>
                <Link href="/pricing" className="text-gray-900 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                  Pricing
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                Sign in
              </Link>
              <Link href="/signup" className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Choose the perfect plan for your needs. Always flexible to scale.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 flex items-center justify-center">
            <div className="bg-gray-100 p-1 rounded-lg inline-flex">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  billingPeriod === "monthly"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  billingPeriod === "yearly"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600"
                )}
              >
                Yearly
                <span className="ml-1 text-xs text-green-600">Save 20%</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={cn(
                  "bg-white rounded-lg shadow-lg overflow-hidden",
                  tier.highlighted
                    ? "ring-2 ring-indigo-600 scale-105"
                    : "border border-gray-200"
                )}
              >
                {tier.highlighted && (
                  <div className="bg-indigo-600 text-white text-center py-2 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                  <p className="mt-2 text-gray-600">{tier.description}</p>
                  
                  <div className="mt-6">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">
                        ${tier.price[billingPeriod]}
                      </span>
                      <span className="ml-2 text-gray-600">
                        /{billingPeriod === "monthly" ? "month" : "year"}
                      </span>
                    </div>
                    {billingPeriod === "yearly" && tier.price.yearly > 0 && (
                      <p className="mt-1 text-sm text-green-600">
                        Save ${(tier.price.monthly * 12 - tier.price.yearly)} annually
                      </p>
                    )}
                  </div>

                  <Link
                    href={tier.name === "Enterprise" ? "/contact" : "/signup"}
                    className={cn(
                      "mt-6 block w-full text-center px-4 py-3 rounded-md font-medium transition-colors",
                      tier.highlighted
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    )}
                  >
                    {tier.cta}
                  </Link>

                  <div className="mt-8 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      What's included
                    </h4>
                    <ul className="space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature.text} className="flex items-start">
                          {feature.included ? (
                            <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5" />
                          )}
                          <span
                            className={cn(
                              "ml-3 text-sm",
                              feature.included ? "text-gray-700" : "text-gray-400"
                            )}
                          >
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Limits Comparison */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Compare Plans
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    Feature
                  </th>
                  {pricingTiers.map((tier) => (
                    <th key={tier.name} className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700">API Requests</td>
                  {pricingTiers.map((tier) => (
                    <td key={tier.name} className="px-6 py-4 text-center text-sm text-gray-900">
                      {tier.limits.requests}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">Bandwidth</td>
                  {pricingTiers.map((tier) => (
                    <td key={tier.name} className="px-6 py-4 text-center text-sm text-gray-900">
                      {tier.limits.bandwidth}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700">Build Minutes</td>
                  {pricingTiers.map((tier) => (
                    <td key={tier.name} className="px-6 py-4 text-center text-sm text-gray-900">
                      {tier.limits.buildMinutes}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">Active Deployments</td>
                  {pricingTiers.map((tier) => (
                    <td key={tier.name} className="px-6 py-4 text-center text-sm text-gray-900">
                      {tier.limits.deployments}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700">Team Members</td>
                  {pricingTiers.map((tier) => (
                    <td key={tier.name} className="px-6 py-4 text-center text-sm text-gray-900">
                      {tier.limits.teamMembers}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-700">Custom Domains</td>
                  {pricingTiers.map((tier) => (
                    <td key={tier.name} className="px-6 py-4 text-center text-sm text-gray-900">
                      {tier.limits.customDomains}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I change plans at any time?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                and we'll prorate any charges or credits.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What happens if I exceed my limits?
              </h3>
              <p className="text-gray-600">
                We'll notify you when you're approaching your limits. For Pro and Enterprise plans, 
                you can set up auto-scaling. Hobby plan deployments may be paused if limits are exceeded.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Do you offer custom plans?
              </h3>
              <p className="text-gray-600">
                Yes! For organizations with specific requirements, we offer custom enterprise plans. 
                Contact our sales team to discuss your needs.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards (Visa, Mastercard, American Express) and ACH transfers 
                for Enterprise customers. All payments are processed securely through Stripe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to deploy your first app?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Start with our free tier and scale as you grow. No credit card required.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/signup"
              className="bg-white text-indigo-600 px-6 py-3 rounded-md font-medium hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/docs"
              className="border border-white text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-700 transition-colors"
            >
              View Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Zap className="h-8 w-8 text-indigo-400" />
                <span className="ml-2 text-xl font-semibold text-white">SpinForge</span>
              </div>
              <p className="text-sm">
                Deploy pre-built applications instantly without managing infrastructure.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-white">Documentation</Link></li>
                <li><Link href="/changelog" className="hover:text-white">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; 2024 SpinForge. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}