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

interface Faq {
  q: string;
  a: ReactNode;
}

const sections: { title: string; items: Faq[] }[] = [
  {
    title: "General",
    items: [
      {
        q: "Does SpinForge build my code?",
        a: (
          <>
            No. SpinForge deploys <strong>pre-built artifacts</strong>: a ZIP for static sites or a Docker image
            for containerized apps. Build locally or in your CI pipeline, then deploy the output.
          </>
        ),
      },
      {
        q: "Can I self-host SpinForge?",
        a: (
          <>
            Yes. SpinForge is open source. Clone the repo, run <code className="bg-gray-100 px-1 rounded text-xs">./setup.sh</code> followed by{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">./start.sh</code>, and you have a full hosting
            control plane on your own infrastructure. See the{" "}
            <Link href="/docs/installation" className="text-indigo-600 hover:underline">installation guide</Link>.
          </>
        ),
      },
      {
        q: "What regions are supported?",
        a: (
          <>
            The managed service runs in US-East, US-West, EU-West, and AP-Southeast. Self-hosted installs can
            run anywhere Docker runs.
          </>
        ),
      },
    ],
  },
  {
    title: "Pricing & Limits",
    items: [
      {
        q: "Is there a free tier?",
        a: (
          <>
            Yes — static sites and small container apps are free. Paid plans start when you need more bandwidth,
            memory, or custom certificates. See{" "}
            <Link href="/pricing" className="text-indigo-600 hover:underline">pricing</Link> for the current
            limits.
          </>
        ),
      },
      {
        q: "What is the maximum upload size?",
        a: <>Static site ZIPs are capped at <strong>100 MB</strong>. Docker images can be any size — they are pulled directly from your registry.</>,
      },
      {
        q: "How many sites can I create?",
        a: <>There is no hard limit on the number of sites you can own. Resource usage (memory, bandwidth) is what counts against your plan.</>,
      },
    ],
  },
  {
    title: "Deployment",
    items: [
      {
        q: "How do I do a zero-downtime deploy?",
        a: (
          <>
            Zero-downtime is the default for container sites. SpinForge starts the new container, waits for its
            health check to pass, then flips traffic over. The old container is stopped only after the new one
            is live.
          </>
        ),
      },
      {
        q: "Can I preview a deploy before it goes live?",
        a: (
          <>
            Create a second site on a preview domain (e.g. <code className="bg-gray-100 px-1 rounded text-xs">staging.app.example.com</code>),
            deploy there first, then swap the production image when you are happy. Full preview environments
            with automatic branch-based URLs are on the roadmap.
          </>
        ),
      },
      {
        q: "How do I roll back a bad deploy?",
        a: (
          <>
            For container sites: update the image field back to the previous known-good tag. For static sites:
            re-upload the previous ZIP. Both trigger a rolling update. The{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">spinforge-cli rollback</code> command does this
            in one step.
          </>
        ),
      },
      {
        q: "Can I deploy from GitHub Actions / GitLab CI?",
        a: (
          <>
            Yes. Generate an API token from{" "}
            <Link href="/dashboard/api-tokens" className="text-indigo-600 hover:underline">Dashboard → API Tokens</Link>,
            store it as a CI secret, and call the REST API or CLI from your workflow. See the{" "}
            <Link href="/docs/cli/overview" className="text-indigo-600 hover:underline">CLI overview</Link> for
            a ready-made GitHub Actions snippet.
          </>
        ),
      },
    ],
  },
  {
    title: "Domains & SSL",
    items: [
      {
        q: "How long does SSL provisioning take?",
        a: <>Typically under a minute once DNS resolves. If your DNS change has not propagated yet, Let&apos;s Encrypt cannot validate the domain and the cert will stay pending until DNS catches up.</>,
      },
      {
        q: "Can I use my existing certificate?",
        a: (
          <>
            Yes. Upload a PEM-encoded full chain and private key from the site&apos;s SSL settings. You are
            responsible for renewing uploaded certificates before they expire. See the{" "}
            <Link href="/docs/deployment/ssl" className="text-indigo-600 hover:underline">SSL guide</Link>.
          </>
        ),
      },
      {
        q: "Do you support wildcard certificates?",
        a: <>Yes, via DNS-01 challenges. You must connect a supported DNS provider so SpinForge can solve the challenge on your behalf.</>,
      },
    ],
  },
  {
    title: "Containers",
    items: [
      {
        q: "What base images should I use?",
        a: <>Alpine variants (e.g. <code className="bg-gray-100 px-1 rounded text-xs">node:20-alpine</code>) are a good default: small, fast to pull, secure. If your app has native dependencies that do not compile against musl, use the slim Debian variants (<code className="bg-gray-100 px-1 rounded text-xs">node:20-slim</code>).</>,
      },
      {
        q: "Can I run privileged containers?",
        a: <>No. Privileged containers, host networking, and host path mounts are rejected for security reasons.</>,
      },
      {
        q: "How do I persist data?",
        a: (
          <>
            Use named volumes in a Docker Compose deployment. Volumes survive restarts and redeploys but not
            site deletion. For production databases, prefer a managed database service and pass the connection
            string as an env var — it is easier to back up, monitor, and scale.
          </>
        ),
      },
      {
        q: "Can I SSH into a running container?",
        a: (
          <>
            Not directly. You can get an interactive shell via the dashboard&apos;s{" "}
            <em>Exec</em> tab, which runs <code className="bg-gray-100 px-1 rounded text-xs">docker exec</code>{" "}
            inside your container. For debugging, reading the logs is usually faster.
          </>
        ),
      },
    ],
  },
  {
    title: "Logs & Observability",
    items: [
      {
        q: "How long are logs retained?",
        a: <>Free plans: 24 hours. Paid plans: up to 30 days. For longer retention, stream logs to your own sink via the API.</>,
      },
      {
        q: "Can I get metrics (CPU, memory, requests)?",
        a: (
          <>
            Yes. The <em>Metrics</em> tab on each site shows CPU, memory, bandwidth, and request volume for the
            last 24 hours. The <Link href="/docs/api/metrics" className="text-indigo-600 hover:underline">metrics API</Link>{" "}
            exposes the same data programmatically.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
      <p className="text-lg text-gray-600 mb-8">
        Quick answers to the questions our users ask most. If you are trying to diagnose a specific error,
        check <Link href="/docs/troubleshooting" className="text-indigo-600 hover:underline">Troubleshooting</Link> first.
      </p>

      {sections.map((section) => (
        <section key={section.title} className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{section.title}</h2>
          <div className="space-y-4 not-prose">
            {section.items.map((faq, idx) => (
              <details
                key={idx}
                className="bg-white border border-gray-200 rounded-lg p-5 group"
              >
                <summary className="cursor-pointer flex items-start font-semibold text-gray-900 list-none">
                  <HelpCircle className="h-5 w-5 text-indigo-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{faq.q}</span>
                </summary>
                <div className="mt-3 ml-7 text-sm text-gray-600 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 not-prose mt-12">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Did we miss something?</h3>
        <p className="text-green-800 mb-4 text-sm">
          If your question is not answered here, open a ticket from{" "}
          <Link href="/dashboard/settings" className="underline">Dashboard → Settings → Support</Link> or jump
          into the troubleshooting guide.
        </p>
        <Link
          href="/docs/troubleshooting"
          className="inline-flex items-center text-green-700 hover:text-green-900 font-medium"
        >
          Troubleshooting guide <ArrowRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
    </div>
  );
}
