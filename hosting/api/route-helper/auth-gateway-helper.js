const crypto = require("crypto");
const redisClient = require("../utils/redis");

// Helper to generate unique ID
const generateId = () => crypto.randomBytes(8).toString("hex");

const addRouteAuth = async (domain, route) => {
  if (!route.pattern) {
    throw new Error("Route pattern is required");
  }

  // Generate route ID
  route.id = route.id || generateId();
  route.createdAt = new Date().toISOString();

  // Get existing routes
  const existingRoutes = await redisClient.get(`auth:${domain}:routes`);
  const routes = existingRoutes ? JSON.parse(existingRoutes) : [];

  // Add new route
  routes.push(route);

  // Sort by specificity (more specific patterns first)
  routes.sort((a, b) => {
    // Exact matches first
    if (!a.pattern.includes("*") && b.pattern.includes("*")) return -1;
    if (a.pattern.includes("*") && !b.pattern.includes("*")) return 1;
    // Then by length (longer = more specific)
    return b.pattern.length - a.pattern.length;
  });

  // Store in Redis
  await redisClient.set(`auth:${domain}:routes`, JSON.stringify(routes));

  // Enable auth for this domain
  await redisClient.set(`auth:${domain}:enabled`, "1");

  // Invalidate OpenResty cache
  await invalidateAuthCache(domain);
  return route;
};

// Helper to invalidate OpenResty cache
async function invalidateAuthCache(domain) {
  try {
    // Set a cache invalidation flag that OpenResty will check
    await redisClient.setEx(`auth:${domain}:cache_invalid`, 5, "1");
  } catch (error) {
    console.error("Failed to invalidate cache:", error);
  }
}

module.exports = {
  addRouteAuth,
  invalidateAuthCache
};