/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ApiTokensPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to settings page with API tokens section
    router.push('/dashboard/settings?section=api-tokens');
  }, [router]);

  return null;
}