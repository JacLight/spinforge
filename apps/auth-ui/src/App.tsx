import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useSearchParams,
} from "react-router-dom";
import { Login } from "./auth/Login";
import { Register } from "./auth/Register";
import { Recover } from "./auth/Recover";
import { ResetPassword } from "./auth/ResetPassword";
import { OAuth2Login } from "./auth/OAuth2Login";
import { OAuth2Token } from "./auth/OAuth2Token";
import "./App.css";
import { Logout } from "./auth";
import AccountSites from "./sites";

interface AuthData {
  token: string;
  orgId?: string;
  user: {
    sk: string;
    data: {
      email: string;
      username?: string;
    };
  };
}

function AuthGateway() {
  const [searchParams] = useSearchParams();
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [authCompleted, setAuthCompleted] = useState(false);

  useEffect(() => {
    const url =
      searchParams.get("rd") ||
      searchParams.get("return_url") ||
      searchParams.get("redirect");
    if (url) {
      setReturnUrl(url);
      sessionStorage.setItem("auth_return_url", url);
    } else {
      const storedUrl = sessionStorage.getItem("auth_return_url");
      if (storedUrl) {
        setReturnUrl(storedUrl);
      }
    }
  }, [searchParams]);

  const handleAuthSuccess = (authData: AuthData) => {
    console.log("Authentication successful:", authData);

    // Set cookies for both current domain and Express server domain
    const domain = window.location.hostname;
    const cookieOptions = `path=/; max-age=86400; SameSite=Lax`;

    // Set cookies for current domain (Vite dev server)
    document.cookie = `authToken=${authData.token}; ${cookieOptions}`;
    document.cookie = `email=${authData.user?.data?.email}; ${cookieOptions}`;

    if (authData.user?.data?.username) {
      document.cookie = `username=${authData.user.data.username}; ${cookieOptions}`;
    }

    if (authData?.orgId) {
      document.cookie = `orgId=${authData.orgId}; ${cookieOptions}`;
    }

    const host = window.location.origin;
    console.log("Setting cookies on Express server:", host);
    fetch(`${host}/set-cookies`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(authData),
    }).catch(() => {
      // Ignore errors - the redirect will work anyway by passing credentials in URL
    });

    // Clear the stored return URL
    sessionStorage.removeItem("auth_return_url");

    setAuthCompleted(true);

    // Redirect after a short delay to ensure cookies are set
    setTimeout(() => {
      if (returnUrl) {
        // Handle both absolute and relative URLs
        if (
          returnUrl.startsWith("http://") ||
          returnUrl.startsWith("https://")
        ) {
          // Absolute URL
          const redirectUrl = new URL(returnUrl);
          redirectUrl.searchParams.set("X-Auth-Token", authData.token);
          redirectUrl.searchParams.set("X-Email", authData.user.data.email);
          redirectUrl.searchParams.set("X-Org-Id", authData.orgId);
          window.location.href = redirectUrl.toString();
        } else {
          // Relative URL - redirect to Express server with absolute URL
          const cleanReturnUrl = returnUrl.startsWith("/")
            ? returnUrl
            : `/${returnUrl}`;
          window.location.href = `${host}/${cleanReturnUrl}`;
        }
      } else {
        window.location.href = `http://localhost:3300`;
        // window.location.href = `${host}`;
      }
    }, 100);
  };

  if (authCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting you to your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-auto">
      {returnUrl && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-2 text-center">
          <p className="text-sm text-yellow-800">
            You will be redirected back after authentication
          </p>
        </div>
      )}
      <Routes>
        <Route
          path="/login"
          element={
            <Login onAuthSuccess={handleAuthSuccess} redirect={returnUrl} />
          }
        />
        <Route path="/logout" element={<Logout />} />
        <Route
          path="/register"
          element={<Register onAuthSuccess={handleAuthSuccess} />}
        />
        <Route path="/recover" element={<Recover />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/sites" element={<AccountSites />} />
        <Route 
          path="/oauth2/authorize" 
          element={<OAuth2Login onAuthSuccess={handleAuthSuccess} />} 
        />
        <Route path="/oauth2/token" element={<OAuth2Token />} />
        {/* <Route path="/verify" element={<Verify />} /> */}
        <Route
          path="/"
          element={
            <Navigate
              to={{
                pathname: "/login",
                search: window.location.search,
              }}
              replace
            />
          }
        />
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-400 mb-4">404</h1>
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                  Page Not Found
                </h2>
                <p className="text-gray-600 mb-8">
                  The authentication page you're looking for doesn't exist.
                </p>
                <a
                  href="/auth/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                  Go to Login
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router basename="/auth">
      <AuthGateway />
    </Router>
  );
}

export default App;
