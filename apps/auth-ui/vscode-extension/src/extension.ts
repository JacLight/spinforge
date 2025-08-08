import * as vscode from 'vscode';
import { AuthProvider } from './authProvider';
import { AuthStatusBar } from './authStatusBar';
import { LoginWebviewProvider } from './loginWebviewProvider';

let authProvider: AuthProvider;
let statusBar: AuthStatusBar;
let loginWebviewProvider: LoginWebviewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('AppMint Authentication extension is now active!');

    authProvider = new AuthProvider(context);
    statusBar = new AuthStatusBar();
    loginWebviewProvider = new LoginWebviewProvider(context);

    // Register commands
    const loginCommand = vscode.commands.registerCommand('appmint-auth.login', async () => {
        await authProvider.login();
    });

    // Add webview login command
    const loginWebviewCommand = vscode.commands.registerCommand('appmint-auth.loginWebview', async () => {
        loginWebviewProvider.show(async (authData) => {
            // Handle successful login from webview
            const authStatus: any = {
                isAuthenticated: true,
                token: authData.token,
                user: authData.user,
                orgId: authData.user.orgId
            };
            await authProvider['storeAuthData'](authStatus);
            authProvider['authChangeEmitter'].fire(authStatus);
            vscode.window.showInformationMessage('Successfully logged in to AppMint!');
        });
    });

    const logoutCommand = vscode.commands.registerCommand('appmint-auth.logout', async () => {
        await authProvider.logout();
    });

    const statusCommand = vscode.commands.registerCommand('appmint-auth.status', async () => {
        const status = await authProvider.getAuthStatus();
        if (status.isAuthenticated && status.user) {
            vscode.window.showInformationMessage(
                `Logged in as: ${status.user?.data?.email} (${status?.orgId})`
            );
        } else {
            vscode.window.showInformationMessage('Not authenticated');
        }
    });

    context.subscriptions.push(loginCommand, loginWebviewCommand, logoutCommand, statusCommand);
    context.subscriptions.push(statusBar.getStatusBarItem());

    // Check authentication status on startup
    authProvider.checkAuthStatus();

    // Listen for authentication changes
    authProvider.onAuthChange((status) => {
        statusBar.update(status);
        
        if (!status.isAuthenticated) {
            // Show login prompt if not authenticated
            vscode.window.showInformationMessage(
                'AppMint: You need to login to use the application',
                'Login'
            ).then(selection => {
                if (selection === 'Login') {
                    vscode.commands.executeCommand('appmint-auth.login');
                }
            });
        }
    });

    // Export the auth provider API for other extensions
    return {
        getAuthStatus: () => authProvider.getAuthStatus(),
        getAuthToken: () => authProvider.getAuthToken(),
        onAuthChange: authProvider.onAuthChange
    };
}

export function deactivate() {
    if (statusBar) {
        statusBar.dispose();
    }
}