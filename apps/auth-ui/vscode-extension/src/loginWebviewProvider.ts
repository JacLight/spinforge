import * as vscode from 'vscode';
import * as path from 'path';

export class LoginWebviewProvider {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private onLoginCallback: ((authData: any) => void) | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public async show(onLogin: (authData: any) => void) {
        this.onLoginCallback = onLogin;

        // Create webview panel that takes over the entire screen
        this.panel = vscode.window.createWebviewPanel(
            'appmintLogin',
            'AppMint Login',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
                ]
            }
        );

        // Set the webview content
        this.panel.webview.html = this.getWebviewContent(this.panel.webview);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'login-success':
                        if (this.onLoginCallback) {
                            this.onLoginCallback(message.authData);
                        }
                        this.panel?.dispose();
                        break;
                    case 'cancel':
                        this.panel?.dispose();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Make the webview take focus
        this.panel.reveal(vscode.ViewColumn.One);
    }

    private getWebviewContent(webview: vscode.Webview): string {
        // Get paths to resources
        const mediaPath = path.join(this.context.extensionPath, 'media');
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'login.css')));
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'login.js')));
        const logoUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'appmint-logo.png')));

        // Get the API URL from configuration
        const config = vscode.workspace.getConfiguration('appmint-auth');
        const apiUrl =  config.get<string>('apiUrl') || 'https://appengine.appmint.io';

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AppMint Login</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            <div id="root">
                <div class="login-container">
                    <div class="login-card">
                        <!-- Logo -->
                        <div class="logo-container">
                            <img src="${logoUri}" alt="AppMint Logo" class="logo" />
                        </div>

                        <div class="header">
                            <h1>Welcome Back</h1>
                            <p>Sign in to continue to your account</p>
                        </div>

                        <div id="error-message" class="error-message" style="display: none;"></div>
                        <div id="success-message" class="success-message" style="display: none;"></div>

                        <form id="login-form">
                            <!-- Email Step -->
                            <div id="email-step" class="form-step">
                                <div class="form-group">
                                    <input 
                                        type="email" 
                                        id="email" 
                                        class="form-input" 
                                        placeholder="Email"
                                        required
                                    />
                                </div>
                                
                                <div class="button-group">
                                    <button type="button" id="continue-btn" class="btn btn-primary">
                                        Continue with Password
                                    </button>
                                    <button type="button" id="magic-link-btn" class="btn btn-secondary">
                                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                                        </svg>
                                        Send Magic Link
                                    </button>
                                </div>

                                <div class="divider">
                                    <span>Or continue with</span>
                                </div>

                                <div class="social-buttons">
                                    <button type="button" class="btn btn-social" id="facebook-btn">
                                        <svg class="social-icon" viewBox="0 0 24 24">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                        </svg>
                                        Continue with Facebook
                                    </button>
                                    <button type="button" class="btn btn-social" id="github-btn">
                                        <svg class="social-icon" viewBox="0 0 24 24">
                                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                        </svg>
                                        Continue with GitHub
                                    </button>
                                </div>
                            </div>

                            <!-- Credentials Step -->
                            <div id="credentials-step" class="form-step" style="display: none;">
                                <div class="form-group">
                                    <div class="input-group">
                                        <input 
                                            type="text" 
                                            id="orgId" 
                                            class="form-input" 
                                            placeholder="Site Name"
                                            required
                                        />
                                        <span class="input-suffix">.appmint.io</span>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <input 
                                        type="email" 
                                        id="email-display" 
                                        class="form-input" 
                                        readonly
                                        disabled
                                    />
                                </div>

                                <div class="form-group">
                                    <input 
                                        type="password" 
                                        id="password" 
                                        class="form-input" 
                                        placeholder="Password"
                                        required
                                    />
                                </div>

                                <div class="form-options">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="remember" />
                                        <span>Remember me</span>
                                    </label>
                                    <a href="#" class="link" id="forgot-password">Forgot Password?</a>
                                </div>

                                <div class="button-group">
                                    <button type="button" id="back-btn" class="btn btn-secondary">
                                        Back
                                    </button>
                                    <button type="submit" class="btn btn-primary">
                                        Sign In
                                    </button>
                                </div>
                            </div>
                        </form>

                        <div class="footer">
                            <p>Don't have an account? <a href="#" class="link" id="sign-up">Sign Up</a></p>
                        </div>

                        <button id="cancel-btn" class="cancel-btn" title="Cancel">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const apiUrl = '${apiUrl}';
            </script>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    public dispose() {
        this.panel?.dispose();
    }
}