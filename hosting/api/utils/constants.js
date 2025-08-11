/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
// Static root for file storage
const STATIC_ROOT = process.env.STATIC_ROOT || '/data/static';

module.exports = {
  STATIC_ROOT
};