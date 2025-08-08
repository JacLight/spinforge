# How to Test the AppMint VS Code Extension

## Method 1: Development Testing (Recommended for Development)

1. **Open the extension project in VS Code:**
   ```bash
   cd /Users/imzee/projects/appmint-vibe/auth/vscode-extension
   code .
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Press F5** or go to **Run > Start Debugging**
   - This will open a new VS Code window titled "Extension Development Host"
   - The extension will be loaded in this new window

4. **Test the extension:**
   - Open Command Palette (Cmd+Shift+P on Mac, Ctrl+Shift+P on Windows/Linux)
   - Type "AppMint" to see available commands:
     - `AppMint: Login`
     - `AppMint: Logout`
     - `AppMint: Authentication Status`
   - Check the status bar (bottom right) for authentication status

## Method 2: Install from VSIX (Production-like Testing)

1. **Build the extension:**
   ```bash
   cd /Users/imzee/projects/appmint-vibe/auth/vscode-extension
   ./build.sh
   ```

2. **Install the VSIX file:**
   - Open VS Code
   - Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
   - Type "Extensions: Install from VSIX..."
   - Navigate to `/Users/imzee/projects/appmint-vibe/auth/vscode-extension/`
   - Select the `.vsix` file (e.g., `appmint-auth-0.0.1.vsix`)

3. **Reload VS Code** when prompted

## Testing the Authentication Flow

1. **On first launch:**
   - The extension will show a notification asking you to login
   - Click "Login" or use the command palette

2. **Login process:**
   - Enter your email address
   - Enter your site name (without .appmint.app)
   - Enter your password

3. **Check authentication:**
   - Look at the status bar (bottom right)
   - Authenticated: Shows "AppMint: your-email@example.com"
   - Not authenticated: Shows "AppMint: Not Authenticated" with warning color

4. **Test commands:**
   - `AppMint: Authentication Status` - Shows current login status
   - `AppMint: Logout` - Logs you out
   - `AppMint: Login` - Prompts for login again

## Debugging Tips

1. **View extension logs:**
   - In the Extension Development Host window
   - Go to Help > Toggle Developer Tools
   - Check the Console tab for logs

2. **Common issues:**
   - If login fails, check:
     - Correct API URL in settings (`appmint-auth.apiUrl`)
     - Valid credentials
     - Network connectivity
   - The extension stores tokens securely, so they persist across VS Code restarts

## Uninstalling

1. **Open Extensions view** (Cmd+Shift+X or Ctrl+Shift+X)
2. **Search for "AppMint Authentication"**
3. **Click the gear icon** and select "Uninstall"