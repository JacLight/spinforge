/**
 * SpinForge - Docker Image Management Routes
 * Manage Docker images on the system
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Get all Docker images
 * GET /api/images
 */
router.get('/', async (req, res) => {
    try {
        // Get images with detailed information
        const { stdout } = await execAsync('docker images --format "{{json .}}"');
        const lines = stdout.trim().split('\n').filter(line => line);
        
        const images = lines.map(line => {
            try {
                const image = JSON.parse(line);
                
                // Parse size to bytes for sorting
                let sizeInBytes = 0;
                if (image.Size) {
                    const sizeMatch = image.Size.match(/^([\d.]+)([KMGT]?B)$/);
                    if (sizeMatch) {
                        const value = parseFloat(sizeMatch[1]);
                        const unit = sizeMatch[2];
                        const multipliers = {
                            'B': 1,
                            'KB': 1024,
                            'MB': 1024 * 1024,
                            'GB': 1024 * 1024 * 1024,
                            'TB': 1024 * 1024 * 1024 * 1024
                        };
                        sizeInBytes = value * (multipliers[unit] || 1);
                    }
                }
                
                return {
                    id: image.ID,
                    repository: image.Repository,
                    tag: image.Tag,
                    imageId: image.ID,
                    created: image.CreatedAt || image.CreatedSince,
                    size: image.Size,
                    sizeBytes: sizeInBytes,
                    digest: image.Digest || null,
                    inUse: false // Will be updated below
                };
            } catch (err) {
                console.error('Error parsing image:', err);
                return null;
            }
        }).filter(Boolean);
        
        // Get list of images in use by running containers
        try {
            const { stdout: containersOut } = await execAsync('docker ps --format "{{.Image}}"');
            const imagesInUse = new Set(containersOut.trim().split('\n').filter(line => line));
            
            // Mark images that are in use
            images.forEach(image => {
                const imageName = `${image.repository}:${image.tag}`;
                image.inUse = imagesInUse.has(imageName) || imagesInUse.has(image.repository);
            });
        } catch (err) {
            console.error('Error checking containers:', err);
        }
        
        // Sort by creation date (newest first)
        images.sort((a, b) => {
            const dateA = new Date(a.created);
            const dateB = new Date(b.created);
            return dateB - dateA;
        });
        
        res.json({
            success: true,
            images,
            total: images.length,
            totalSize: images.reduce((sum, img) => sum + img.sizeBytes, 0)
        });
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get detailed information about a specific image
 * GET /api/images/:imageId
 */
router.get('/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        const { stdout } = await execAsync(`docker inspect ${imageId}`);
        const imageInfo = JSON.parse(stdout)[0];
        
        // Check if image is in use
        const { stdout: psOut } = await execAsync(`docker ps --filter ancestor=${imageId} --format "{{json .}}"`);
        const containers = psOut.trim().split('\n').filter(line => line).map(line => JSON.parse(line));
        
        res.json({
            success: true,
            image: {
                ...imageInfo,
                inUse: containers.length > 0,
                containers
            }
        });
    } catch (error) {
        console.error('Error fetching image details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Pull a Docker image
 * POST /api/images/pull
 * Body: { image: "image:tag" }
 */
router.post('/pull', async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'Image name is required'
            });
        }
        
        console.log(`Pulling image: ${image}`);
        
        // Start the pull (this can take a while)
        const { stdout, stderr } = await execAsync(`docker pull ${image}`, {
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        res.json({
            success: true,
            message: `Successfully pulled ${image}`,
            output: stdout
        });
    } catch (error) {
        console.error('Error pulling image:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Remove a Docker image
 * DELETE /api/images/:imageId
 */
router.delete('/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        const { force } = req.query;
        
        // Check if image is in use
        const { stdout: psOut } = await execAsync(`docker ps --filter ancestor=${imageId} --format "{{.Names}}"`);
        const containersUsingImage = psOut.trim().split('\n').filter(line => line);
        
        if (containersUsingImage.length > 0 && !force) {
            return res.status(400).json({
                success: false,
                error: 'Image is in use by running containers',
                containers: containersUsingImage
            });
        }
        
        // Remove the image
        const forceFlag = force === 'true' ? '-f' : '';
        const { stdout } = await execAsync(`docker rmi ${forceFlag} ${imageId}`);
        
        res.json({
            success: true,
            message: `Successfully removed image ${imageId}`,
            output: stdout
        });
    } catch (error) {
        console.error('Error removing image:', error);
        
        // Parse Docker error messages
        let errorMessage = error.message;
        if (error.message.includes('image is being used')) {
            errorMessage = 'Image is being used by a container. Use force=true to remove anyway.';
        } else if (error.message.includes('No such image')) {
            errorMessage = 'Image not found';
        }
        
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * Prune unused images
 * POST /api/images/prune
 */
router.post('/prune', async (req, res) => {
    try {
        const { all } = req.body;
        
        // Prune unused images
        const pruneCmd = all ? 'docker image prune -a -f' : 'docker image prune -f';
        const { stdout } = await execAsync(pruneCmd);
        
        // Parse the output to get space reclaimed
        const reclaimedMatch = stdout.match(/Total reclaimed space: (.+)/);
        const spacedReclaimed = reclaimedMatch ? reclaimedMatch[1] : 'unknown';
        
        res.json({
            success: true,
            message: 'Successfully pruned unused images',
            spaceReclaimed: spacedReclaimed,
            output: stdout
        });
    } catch (error) {
        console.error('Error pruning images:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get image history
 * GET /api/images/:imageId/history
 */
router.get('/:imageId/history', async (req, res) => {
    try {
        const { imageId } = req.params;
        const { stdout } = await execAsync(`docker history ${imageId} --format "{{json .}}"`);
        
        const history = stdout.trim().split('\n')
            .filter(line => line)
            .map(line => JSON.parse(line));
        
        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error('Error fetching image history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;