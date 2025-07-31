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