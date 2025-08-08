import * as vscode from 'vscode';
import { AuthStatus } from './authProvider';

export class AuthStatusBar {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'appmint-auth.status';
        this.update({ isAuthenticated: false });
        this.statusBarItem.show();
    }

    update(status: AuthStatus) {
        if (status.isAuthenticated && status.user) {
            this.statusBarItem.text = `$(account) AppMint: ${status.user?.data?.email}`;
            this.statusBarItem.tooltip = `Logged in to appengine.appmint.io ORG: ${status.orgId}`;
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = '$(alert) AppMint: Not Authenticated';
            this.statusBarItem.tooltip = 'Click to login';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }

    getStatusBarItem(): vscode.StatusBarItem {
        return this.statusBarItem;
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}