/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Github } from "lucide-react";
import axios from "axios";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const AUTH_CSS = `
.auth{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden;
  background:#fbfaf8;color:#17120e;
  font-family:var(--font-sans),'Hanken Grotesk',ui-sans-serif,system-ui,sans-serif}
.auth .amb{position:absolute;width:620px;height:620px;left:50%;top:-30%;transform:translateX(-50%);border-radius:50%;
  background:radial-gradient(circle,#ffd9b0,transparent 66%);filter:blur(80px);opacity:.55;pointer-events:none}
.auth .amb2{position:absolute;width:420px;height:420px;right:-6%;bottom:-14%;border-radius:50%;
  background:radial-gradient(circle,#ffc7bd,transparent 66%);filter:blur(90px);opacity:.4;pointer-events:none}
.auth .wrap{position:relative;width:100%;max-width:420px}
.auth .back{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono),'IBM Plex Mono',monospace;font-size:12px;color:#9c9389;margin-bottom:16px}
.auth .back:hover{color:#17120e}
.auth .card{background:#fff;border:1px solid #ece7de;border-radius:18px;padding:34px 32px;
  box-shadow:0 2px 4px rgba(23,18,14,.03),0 30px 70px -50px rgba(23,18,14,.35)}
.auth .brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:22px}
.auth .mark{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;
  background:linear-gradient(150deg,#f2551d,#cf3d0c);box-shadow:0 3px 12px -2px rgba(242,85,29,.6),inset 0 1px 0 rgba(255,255,255,.4)}
.auth .mark svg{width:16px;height:16px;color:#fff}
.auth .name{font-family:var(--font-display),'Bricolage Grotesque',sans-serif;font-weight:800;font-size:18px;letter-spacing:-.04em}
.auth h1{font-family:var(--font-display),'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.03em;
  font-size:26px;text-align:center;margin-bottom:6px}
.auth .lead{text-align:center;color:#5f564d;font-size:14px;margin-bottom:24px}
.auth .err{margin-bottom:18px;padding:11px 14px;background:#fdecec;border:1px solid #f3c9c9;border-radius:10px}
.auth .err p{font-size:13px;color:#c0392b;text-align:center;margin:0}
.auth form{display:flex;flex-direction:column;gap:18px}
.auth label{display:block;font-size:13px;font-weight:500;color:#5f564d;margin-bottom:6px}
.auth input{width:100%;padding:11px 13px;border:1px solid #ece7de;border-radius:10px;font-size:14px;color:#17120e;background:#fff;transition:border-color .15s,box-shadow .15s;outline:none}
.auth input::placeholder{color:#bcb2a7}
.auth input:focus{border-color:#f2551d;box-shadow:0 0 0 3px rgba(242,85,29,.12)}
.auth .fielderr{margin-top:6px;font-size:12px;color:#d64545}
.auth .stack{display:flex;flex-direction:column;gap:12px}
.auth .btn-primary{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
  background:linear-gradient(150deg,#f2551d,#cf3d0c);color:#fff;font-weight:600;font-size:14px;
  padding:12px;border-radius:11px;border:0;cursor:pointer;transition:filter .15s,transform .15s;
  box-shadow:0 8px 22px -10px rgba(242,85,29,.7)}
.auth .btn-primary:hover{filter:brightness(1.04);transform:translateY(-1px)}
.auth .btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}
.auth .btn-secondary{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
  background:#fff;color:#17120e;font-weight:600;font-size:14px;padding:12px;border-radius:11px;
  border:1px solid #ece7de;cursor:pointer;transition:border-color .15s,background .15s}
.auth .btn-secondary:hover{border-color:#ded7cb;background:#faf8f4}
.auth .rowbtw{display:flex;align-items:center;justify-content:space-between}
.auth .link{color:#cf3d0c;font-size:13px;font-weight:500}
.auth .link:hover{color:#b8350f}
.auth .muted{color:#9c9389;font-size:13px;background:none;border:0;cursor:pointer}
.auth .muted:hover{color:#5f564d}
.auth .divider{position:relative;margin:24px 0}
.auth .divider::before{content:"";position:absolute;inset:50% 0 auto;height:1px;background:#ece7de}
.auth .divider span{position:relative;display:block;text-align:center}
.auth .divider span b{background:#fff;padding:0 12px;font-size:12px;color:#9c9389;font-weight:400;font-family:var(--font-mono),'IBM Plex Mono',monospace}
.auth .foot{margin-top:26px;text-align:center;font-size:14px;color:#5f564d}
.auth .spin{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fbfaf8}
`;

const Mark = () => (
  <span className="mark">
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 4.5 12.5c-.3.4 0 .9.5.9H10l-1.2 7.8c-.1.6.7 1 1.1.5L20 10.4c.3-.4 0-.9-.5-.9H14l1.2-7.1c.1-.6-.7-1-1.1-.5z" />
    </svg>
  </span>
);

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string>("");

  // Check if already logged in
  useEffect(() => {
    const authToken = localStorage.getItem("auth-token");
    if (authToken) {
      // Already logged in - redirect to dashboard
      router.push("/dashboard");
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const email = watch("email");

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(""); // Clear any previous errors

    try {
      const response = await axios.post("/api/auth/login", data);

      if (response.data.success) {
        toast.success("Login successful!");

        // Store auth data
        localStorage.setItem("auth-token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));

        // Always go to dashboard for regular login
        router.push("/dashboard");
      }
    } catch (error: any) {
      setError(error.response?.data?.error || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Please enter your email first");
      return;
    }

    setIsLoading(true);
    setError(""); // Clear any previous errors
    try {
      await axios.post("/api/auth/magic-link", { email });
      toast.success("Magic link sent! Check your email.");
    } catch (error) {
      setError("Failed to send magic link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = () => {
    // Redirect to GitHub OAuth
    window.location.href = "/api/auth/github";
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
        <div className="spin">
          <Loader2 className="animate-spin" style={{ height: 32, width: 32, color: "#f2551d" }} />
        </div>
      </>
    );
  }

  return (
    <div className="auth">
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
      <div className="amb" /><div className="amb2" />
      <div className="wrap">
        <Link href="/" className="back">← Back to spinforge.dev</Link>
        <div className="card">
          <div className="brand"><Mark /><span className="name">SpinForge</span></div>
          <h1>Welcome back</h1>
          <p className="lead">Sign in to your SpinForge account</p>

          {error && (
            <div className="err"><p>{error}</p></div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label>Email</label>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                onChange={(e) => {
                  register("email").onChange(e);
                  if (error) setError("");
                }}
              />
              {errors.email && <p className="fielderr">{errors.email.message}</p>}
            </div>

            {showPassword ? (
              <div>
                <label>Password</label>
                <input
                  {...register("password")}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  onChange={(e) => {
                    register("password").onChange(e);
                    if (error) setError("");
                  }}
                />
                {errors.password && <p className="fielderr">{errors.password.message}</p>}
              </div>
            ) : (
              <div className="stack">
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword(true);
                    setError("");
                  }}
                  className="btn-primary"
                >
                  Continue with password
                </button>

                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={isLoading}
                  className="btn-secondary"
                >
                  <Mail style={{ height: 16, width: 16 }} />
                  Send magic link
                </button>
              </div>
            )}

            {showPassword && (
              <>
                <div className="rowbtw">
                  <Link href="/forgot-password" className="link">Forgot password?</Link>
                  <button type="button" onClick={() => setShowPassword(false)} className="muted">Back</button>
                </div>

                <button type="submit" disabled={isLoading} className="btn-primary">
                  {isLoading ? <Loader2 className="animate-spin" style={{ height: 20, width: 20 }} /> : "Sign in"}
                </button>
              </>
            )}
          </form>

          <div className="divider"><span><b>Or continue with</b></span></div>

          <button onClick={handleGithubLogin} className="btn-secondary">
            <Github style={{ height: 18, width: 18 }} />
            GitHub
          </button>

          <p className="foot">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="link">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
