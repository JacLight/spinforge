/**
 * SpinForge - Static File Management Routes
 * Handles file uploads and management for static hosting sites
 */
const express = require('express');
const router = express.Router();
const redisClient = require('../utils/redis');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const unzipper = require('unzipper');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  }
});

// Helper function to ensure directory exists
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
  }
}

// Helper function to clean directory
async function cleanDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await cleanDirectory(filePath);
        await fs.rmdir(filePath);
      } else {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    console.error(`Error cleaning directory ${dirPath}:`, error);
  }
}

// Upload static files
router.post('/:domain/static/upload', upload.fields([
  { name: 'files', maxCount: 1000 },
  { name: 'zipFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'static') {
      return res.status(400).json({ error: 'Not a static site' });
    }
    
    // Determine the static files directory
    const staticDir = `/data/static/${domain.replace(/\./g, '_')}`;
    await ensureDir(staticDir);
    
    // Clear existing files first
    await cleanDirectory(staticDir);
    
    // Handle ZIP file upload
    if (req.files.zipFile && req.files.zipFile[0]) {
      const zipFile = req.files.zipFile[0];
      console.log(`Extracting ZIP file for ${domain}: ${zipFile.path}`);
      
      try {
        // Extract ZIP file directly to static directory
        await new Promise((resolve, reject) => {
          const stream = fsSync.createReadStream(zipFile.path)
            .pipe(unzipper.Extract({ path: staticDir }));
          
          stream.on('close', resolve);
          stream.on('error', reject);
        });
        
        // Clean up uploaded file
        await fs.unlink(zipFile.path);
        
        console.log(`ZIP file extracted successfully for ${domain}`);
      } catch (error) {
        console.error('ZIP extraction error:', error);
        await fs.unlink(zipFile.path);
        return res.status(500).json({ error: 'Failed to extract ZIP file' });
      }
    }
    // Handle multiple file uploads
    else if (req.files.files && req.files.files.length > 0) {
      console.log(`Uploading ${req.files.files.length} files for ${domain}`);
      
      for (const file of req.files.files) {
        const destPath = path.join(staticDir, file.originalname);
        
        // Ensure subdirectory exists if file has path
        const destDir = path.dirname(destPath);
        await ensureDir(destDir);
        
        // Move file to destination
        await fs.rename(file.path, destPath);
        console.log(`Uploaded file: ${file.originalname}`);
      }
    } else {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    // Update site status
    site.files_exist = true;
    site.updatedAt = new Date().toISOString();
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    
    // Check if any files were uploaded
    const files = await fs.readdir(staticDir);
    const fileCount = files.length;
    
    res.json({ 
      message: 'Files uploaded successfully',
      fileCount: fileCount,
      directory: staticDir
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up any uploaded files
    if (req.files) {
      if (req.files.zipFile) {
        for (const file of req.files.zipFile) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
      if (req.files.files) {
        for (const file of req.files.files) {
          try {
            await fs.unlink(file.path);
          } catch (e) {}
        }
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Clear all static files
router.delete('/:domain/static/clear', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'static') {
      return res.status(400).json({ error: 'Not a static site' });
    }
    
    const staticDir = `/data/static/${domain.replace(/\./g, '_')}`;
    
    // Clear all files in the directory
    await cleanDirectory(staticDir);
    
    // Update site status
    site.files_exist = false;
    site.updatedAt = new Date().toISOString();
    await redisClient.set(`site:${domain}`, JSON.stringify(site));
    
    res.json({ message: 'All static files cleared successfully' });
  } catch (error) {
    console.error('Clear files error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List static files
router.get('/:domain/static/list', async (req, res) => {
  try {
    const domain = req.params.domain;
    const data = await redisClient.get(`site:${domain}`);
    
    if (!data) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const site = JSON.parse(data);
    if (site.type !== 'static') {
      return res.status(400).json({ error: 'Not a static site' });
    }
    
    const staticDir = `/data/static/${domain.replace(/\./g, '_')}`;
    
    // Helper function to get directory tree
    async function getDirectoryTree(dir, basePath = '') {
      const items = [];
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const relativePath = path.join(basePath, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isDirectory()) {
            const children = await getDirectoryTree(filePath, relativePath);
            items.push({
              name: file,
              path: relativePath,
              type: 'directory',
              size: 0,
              children: children
            });
          } else {
            items.push({
              name: file,
              path: relativePath,
              type: 'file',
              size: stat.size,
              modified: stat.mtime
            });
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
      }
      
      return items;
    }
    
    const files = await getDirectoryTree(staticDir);
    
    res.json({ 
      files: files,
      directory: staticDir,
      filesExist: files.length > 0
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;