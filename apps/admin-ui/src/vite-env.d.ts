/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_SPINHUB_URL: string
  readonly VITE_PROMETHEUS_URL: string
  readonly VITE_GRAFANA_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}