/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import { Plug, ArrowRight, Key, Server } from "lucide-react";
import Link from "next/link";

export default function PartnersOverviewPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <div className="flex items-center mb-6">
        <Plug className="h-8 w-8 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900 mb-0">Partner Integrations</h1>
      </div>

      <p className="text-lg text-gray-600 mb-8">
        A partner is a product that wants to let its end-users host sites on SpinForge without having
        them manage SpinForge accounts directly. One API call — the auth exchange — validates your
        user&apos;s identity and returns a scoped SpinForge session, optionally upserting a site at
        the same time.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">How it fits together</h2>
      <ol className="list-decimal list-inside space-y-3 mb-8">
        <li>
          <strong>Your user signs into your product.</strong> You already have an auth token for them
          — opaque to us, known to you.
        </li>
        <li>
          <strong>Your backend calls <code>POST /_partners/auth</code></strong> with your
          <code>sfpk_</code> key and the user&apos;s token.
        </li>
        <li>
          <strong>SpinForge calls your validation URL.</strong> You return the user&apos;s identity
          (<code>orgId</code>, optionally <code>email</code> and <code>name</code>) or deny.
        </li>
        <li>
          <strong>SpinForge returns <code>sfc_...</code></strong> — a customer session scoped to that
          user&apos;s organization, plus any site you asked to upsert.
        </li>
        <li>
          <strong>You cache the <code>sfc_</code> token</strong> until <code>expiresAt</code> and use
          it to manage sites on behalf of the user.
        </li>
      </ol>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Registration</h2>
      <p className="mb-4">
        Operators add your partner integration in the admin UI
        (<a href="https://admin.spinforge.dev" className="text-indigo-600 underline">admin.spinforge.dev</a>,
        <strong> Partners</strong>). The operator configures:
      </p>

      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <ul className="space-y-3 text-sm">
          <li>
            <strong>validationUrl</strong> — an endpoint on your side that SpinForge will call to
            confirm a user&apos;s token. Can contain <code>:paramName</code> placeholders that are
            substituted from the exchange body (more below).
          </li>
          <li>
            <strong>validationMethod</strong> — <code>GET</code> or <code>POST</code>.
          </li>
          <li>
            <strong>validationHeaders</strong> — a static map added to every outbound call (for
            example, a service-to-service auth header).
          </li>
          <li>
            <strong>tokenTtlSeconds</strong> — how long issued <code>sfc_</code> sessions live.
            Default 3600.
          </li>
        </ul>
      </div>

      <p className="mb-8">
        The operator returns a <code>sfpk_...</code> key (shown once). You send it as
        <code>X-Partner-Key</code> on every <code>/_partners/*</code> call.
      </p>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer model</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8 not-prose">
        <p className="text-sm text-gray-600 mb-3">
          Customers are keyed by <code>partner_&lt;partnerId&gt;_&lt;orgId&gt;</code>. Multiple users
          within the same <code>orgId</code> share one SpinForge customer — their sites live together,
          their tokens count against the same tenant.
        </p>
        <p className="text-sm text-gray-600 mb-0">
          If your validation callback does not return <code>orgId</code>, SpinForge falls back to the
          <code>pk</code> claim of an incoming JWT (shape <code>&quot;orgid|datatype&quot;</code>).
        </p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Site upsert in the same call</h2>
      <p className="mb-4">
        Include a <code>site</code> object in the exchange payload and SpinForge will create or
        reconcile the site in the same request. The primary domain is auto-generated as{" "}
        <code>&lt;orgId&gt;-&lt;projectName&gt;.spinforge.dev</code>. Aliases you pass in
        <code>site.aliases</code> are reconciled against the existing list.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Key className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Security</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            The <code>sfpk_</code> key is a server-side secret. Never ship it to a browser. Call the
            exchange from your backend only.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2">
            <Server className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="font-semibold text-gray-900 mb-0">Caching</h3>
          </div>
          <p className="text-sm text-gray-600 mb-0">
            Issued <code>sfc_</code> tokens are valid until <code>expiresAt</code>. Cache them
            per-user until they expire — don&apos;t exchange on every API call.
          </p>
        </div>
      </div>

      <Link href="/docs/partners/auth" className="bg-white p-6 rounded-lg border border-gray-200 hover:border-indigo-300 not-prose inline-block">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
          Auth exchange reference <ArrowRight className="h-4 w-4 ml-2" />
        </h3>
        <p className="text-sm text-gray-600 mb-0">Full payload, URL param substitution, error codes.</p>
      </Link>
    </div>
  );
}
