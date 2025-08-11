/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 * 
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */

/**
 * Convert domain name to filesystem-friendly format
 * Replaces dots with underscores for folder names
 */
function domainToFolder(domain) {
  return domain.replace(/\./g, '_');
}

/**
 * Convert folder name back to domain format
 * Replaces underscores with dots
 */
function folderToDomain(folder) {
  return folder.replace(/_/g, '.');
}

module.exports = {
  domainToFolder,
  folderToDomain
};