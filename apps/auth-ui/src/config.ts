const appConfig :any= {
  // API Configuration
  appengine: {
    host:   'https://appengine.appmint.io',
  },
  
  // Use App Engine for requests
  useAppEngine: true,
  
  // Application settings
  app: {
    name: 'AppMint Vibe Auth',
    version: '1.0.0',
    environment:'production', // or 'development'
  },
  
  // Authentication settings
  session: {
  },
  
  // Cache settings
  cache: {
    defaultTTL: 60000, // 1 minute
    shortTTL: 10000, // 10 seconds
    longTTL: 300000, // 5 minutes
  },
  
  // Feature flags
  features: {
    enableCache: true,
    enableDebugLogs: process.env.NODE_ENV === 'development',
  },
};

export default appConfig;