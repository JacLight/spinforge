/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { HelpCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function FAQ({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 mb-4 not-prose">
      <div className="flex items-start">
        <HelpCircle className="h-5 w-5 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">{q}</h3>
          <div className="text-sm text-gray-600 space-y-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
      <p className="text-lg text-gray-600 mb-8">
        Quick answers to the things people ask most.
      </p>

      <FAQ q="Is there a CLI?">
        <p>
          No. SpinForge is HTTP API plus admin UI. Any automation you want sits in front of
          <code>curl</code>, your language&apos;s HTTP client, or CI steps that call our endpoints.
        </p>
      </FAQ>

      <FAQ q="Can SpinForge build my app for me?">
        <p>
          No. We serve pre-built artifacts only. You upload a zip of built files or push a Docker
          image, and we run it. See <Link href="/docs/concepts/pre-built-apps" className="text-indigo-600 underline">Pre-built Apps</Link>.
        </p>
      </FAQ>

      <FAQ q="Can I turn off HTTPS?">
        <p>
          No. Every site is HTTPS, always. <code>ssl_enabled</code> is stored but non-editable.
        </p>
      </FAQ>

      <FAQ q="How big can an upload be?">
        <p>The zip upload endpoint accepts files up to <strong>500 MB</strong>.</p>
      </FAQ>

      <FAQ q="Can I change a site's primary domain?">
        <p>
          No. <code>domain</code> is locked after creation. Create a new site with the desired primary
          and either proxy or <code>DELETE</code> the old one.
        </p>
      </FAQ>

      <FAQ q="What happens when I upload a new zip?">
        <p>
          The previous content is wiped and the new zip is extracted. The edge serves the new files
          immediately after the call returns.
        </p>
      </FAQ>

      <FAQ q="How do I update a container without downtime?">
        <p>
          <code>PUT</code> the site with a new <code>containerConfig</code>. Nomad rolls out a new
          allocation and cuts traffic over once it is healthy. The old allocation is stopped after
          the new one takes over.
        </p>
      </FAQ>

      <FAQ q="What token do I use for what?">
        <ul className="list-disc list-inside">
          <li><code>sfc_...</code> for <code>/_api/customer/*</code> (customer-facing operations)</li>
          <li><code>sfa_...</code> or JWT for <code>/_admin/*</code> (operator-only)</li>
          <li><code>sfpk_...</code> for <code>/_partners/*</code> (partner integrations, server-side)</li>
        </ul>
      </FAQ>

      <FAQ q="How long do customer sessions last?">
        <p>
          By default, 1 hour. Partners can configure the TTL per integration via the admin
          <code>tokenTtlSeconds</code> setting.
        </p>
      </FAQ>

      <FAQ q="Do containers need to expose HTTPS?">
        <p>
          No. Your container listens on plain HTTP on whatever <code>containerConfig.port</code> you
          configure. TLS is terminated at our edge.
        </p>
      </FAQ>

      <FAQ q="Can I run multiple containers under one site?">
        <p>
          One site maps to one Nomad job. For multi-service apps, create a site per service, or use a
          <code>loadbalancer</code> site to spread traffic across several containers on separate
          sites.
        </p>
      </FAQ>

      <FAQ q="Where are my logs stored?">
        <p>
          Container stdout/stderr is streamed by Nomad on demand through the
          <code>/logs</code> endpoint. We do not currently retain historical log volume customers can
          self-query — tail it live or ship your own aggregator.
        </p>
      </FAQ>

      <FAQ q="Why does the first HTTPS request take 5-10 seconds?">
        <p>
          Let&apos;s Encrypt is issuing the certificate. Subsequent requests are fast. See the
          <Link href="/docs/deployment/ssl" className="text-indigo-600 underline"> SSL guide</Link>.
        </p>
      </FAQ>

      <FAQ q="Is there a rate limit on API calls?">
        <p>
          Reasonable operational limits apply to prevent abuse. If you are hitting them in normal use,
          contact support with the calling pattern and we will tune them.
        </p>
      </FAQ>

      <Link href="/docs/troubleshooting" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block mt-6">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
          Back to troubleshooting <ArrowRight className="h-4 w-4 ml-2" />
        </h3>
        <p className="text-sm text-gray-600 mb-0">Symptom-first guide for common errors.</p>
      </Link>
    </div>
  );
}
