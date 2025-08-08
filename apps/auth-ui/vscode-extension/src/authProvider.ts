import * as vscode from "vscode";
import axios from "axios";

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    sk: string;
    data: {
      email: string;
      username?: string;
    };
  };
  token?: string;
  orgId?: string;
}

export class AuthProvider {
  private context: vscode.ExtensionContext;
  private authChangeEmitter = new vscode.EventEmitter<AuthStatus>();
  public readonly onAuthChange = this.authChangeEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async login() {
    try {
      // Show input for email
      const email = await vscode.window.showInputBox({
        prompt: "Enter your email",
        placeHolder: "email@example.com",
        validateInput: (value) => {
          if (!value || !value.includes("@")) {
            return "Please enter a valid email";
          }
          return null;
        },
      });

      if (!email) {
        return;
      }

      // Show input for organization ID
      const orgId = await vscode.window.showInputBox({
        prompt: "Enter your site name",
        placeHolder: "mysite",
        validateInput: (value) => {
          if (!value) {
            return "Site name is required";
          }
          return null;
        },
      });

      if (!orgId) {
        return;
      }

      // Show input for password
      const password = await vscode.window.showInputBox({
        prompt: "Enter your password",
        password: true,
        validateInput: (value) => {
          if (!value) {
            return "Password is required";
          }
          return null;
        },
      });

      if (!password) {
        return;
      }

      // Get API URL from configuration
      const config = vscode.workspace.getConfiguration("appmint-auth");
      const apiUrl = config.get<string>('apiUrl') || 'https://appengine.appmint.io';

      // Perform login
      console.log("Logging in with:", { email, orgId, apiUrl });
      const response = await axios.post(
        `${apiUrl}/profile/user/signin`,
        { email, password },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            orgid: orgId,
          },
        }
      );

      if (response.data && response.data.token) {
        // Store authentication data
        const authData: AuthStatus = {
          isAuthenticated: true,
          orgId,
          ...response.data,
        };
        await this.storeAuthData(authData);
        this.authChangeEmitter.fire(authData);
        vscode.window.showInformationMessage(
          "Successfully logged in to AppMint!"
        );
      }
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Login failed. Please check your credentials.";
      vscode.window.showErrorMessage(`AppMint Login Error: ${errorMessage}`);
    }
  }

  async logout() {
    await this.context.secrets.delete("appmint-auth-data");
    const status: AuthStatus = { isAuthenticated: false };
    this.authChangeEmitter.fire(status);

    vscode.window.showInformationMessage(
      "Successfully logged out from AppMint"
    );
  }

  async checkAuthStatus() {
    const authData = await this.getStoredAuthData();
    this.authChangeEmitter.fire(authData);
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const authData = await this.getStoredAuthData();
    if (authData && authData.isAuthenticated) {
      return {
        isAuthenticated: true,
        user: authData.user,
        orgId: authData.orgId,
        token: authData.token,
      };
    }
    return { isAuthenticated: false };
  }

  private async storeAuthData(authData: AuthStatus) {
    await this.context.secrets.store(
      "appmint-auth-data",
      JSON.stringify(authData)
    );
  }

  private async getStoredAuthData(): Promise<AuthStatus> {
    const authData = await this.context.secrets.get("appmint-auth-data");
    return authData ? JSON.parse(authData) : { isAuthenticated: false };
  }

  async getAuthToken(): Promise<string | undefined> {
    const authData = await this.getStoredAuthData();
    return authData.token ? authData.token : undefined;
  }
}
