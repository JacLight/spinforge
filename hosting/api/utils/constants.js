/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
// Data root configuration
const DATA_ROOT = process.env.DATA_ROOT || '/data';
const STATIC_ROOT = process.env.STATIC_ROOT || `${DATA_ROOT}/static`;
const UPLOADS_ROOT = process.env.UPLOADS_ROOT || `${DATA_ROOT}/uploads`;
const DEPLOYMENTS_ROOT = process.env.DEPLOYMENTS_ROOT || `${DATA_ROOT}/deployments`;
const CERTS_ROOT = process.env.CERTS_ROOT || `${DATA_ROOT}/certs`;

module.exports = {
  DATA_ROOT,
  STATIC_ROOT,
  UPLOADS_ROOT,
  DEPLOYMENTS_ROOT,
  CERTS_ROOT
};