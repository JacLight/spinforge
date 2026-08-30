/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 *
 * Pass-through layout: the old sidebar/nav chrome fought the shared marketing
 * design, so docs pages now render inside their own shell (SiteShell) instead.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
