import { createServer } from 'http';
import { URL } from 'url';
import chalk from 'chalk';

export interface AuthResult {
  token: string;
  customerId?: string;
  email?: string;
}

export function startAuthServer(): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);
      
      // Handle callback from web auth
      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');
        const customerId = url.searchParams.get('customerId');
        const email = url.searchParams.get('email');
        
        if (token) {
          // Send success response to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>SpinForge CLI - Authentication Successful</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background: #f5f5f5;
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 40px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .success {
                  color: #10b981;
                  font-size: 48px;
                  margin-bottom: 20px;
                }
                h1 {
                  color: #1f2937;
                  margin-bottom: 10px;
                }
                p {
                  color: #6b7280;
                  margin-bottom: 20px;
                }
                .close-hint {
                  font-size: 14px;
                  color: #9ca3af;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="success">✓</div>
                <h1>Authentication Successful!</h1>
                <p>You can now close this window and return to your terminal.</p>
                <p class="close-hint">This window will close automatically in 5 seconds...</p>
              </div>
              <script>
                setTimeout(() => window.close(), 5000);
              </script>
            </body>
            </html>
          `);
          
          // Close server and resolve with auth data
          server.close();
          if (!customerId) {
            reject(new Error('Authentication response missing customer ID'));
            return;
          }
          resolve({
            token,
            customerId,
            email: email || undefined
          });
        } else {
          // Send error response
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>SpinForge CLI - Authentication Failed</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background: #f5f5f5;
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 40px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .error {
                  color: #ef4444;
                  font-size: 48px;
                  margin-bottom: 20px;
                }
                h1 {
                  color: #1f2937;
                  margin-bottom: 10px;
                }
                p {
                  color: #6b7280;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error">✗</div>
                <h1>Authentication Failed</h1>
                <p>No token was provided. Please try again.</p>
              </div>
            </body>
            </html>
          `);
          server.close();
          reject(new Error('No token received'));
        }
      } else {
        // Redirect to callback
        res.writeHead(302, { Location: '/callback' });
        res.end();
      }
    });
    
    // Find available port
    const port = 9876; // Default port for CLI auth
    
    server.listen(port, 'localhost', () => {
      console.log(chalk.dim(`Local auth server started on port ${port}`));
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 5 * 60 * 1000);
  });
}