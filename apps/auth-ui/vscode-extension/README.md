# AppMint Authentication Extension

This VS Code extension provides authentication for AppMint users. Users must authenticate before they can use the AppMint application.

## Features

- Login with email, site name, and password
- Persistent authentication across VS Code sessions
- Status bar indicator showing authentication status
- Secure token storage using VS Code's secrets API

## Requirements

- VS Code 1.74.0 or higher
- An AppMint account

## Extension Settings

This extension contributes the following settings:

* `appmint-auth.apiUrl`: The AppMint API URL (default: `https://appengine.appmint.io`)

## Commands

* `AppMint: Login` - Login to your AppMint account
* `AppMint: Logout` - Logout from your AppMint account
* `AppMint: Authentication Status` - Check your current authentication status

## Usage

1. Install the extension
2. The extension will automatically prompt for login on startup if not authenticated
3. Use the status bar indicator to check your authentication status
4. Click the status bar or use the command palette to login/logout

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch
```

## Building

```bash
# Compile the extension
npm run compile

# Package the extension
vsce package
```