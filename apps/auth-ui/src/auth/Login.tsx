import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import appConfig from "@/config";
import useScreenSize from "@/components/common/use-screen-size";
import { LoadingIndicator } from "@/components/common/loading-indicator";
import { IconRenderer } from "@/ui/icons/icon-renderer";
import { useSiteStore } from "@/store/site-store";
import { localStorageUtils } from "@/utils/localstorage";
import { gsap } from "gsap";
import appmintLogo from "../assets/appmint-logo.png";
import { getResourcePath } from "@/request";
import { appEndpoints } from "@/request/api-endpoints";
import { requestQueueInstance } from "@/request/request-queue";
import { getResponseErrorMessage, performLogout } from "@/request/appengine";

interface LoginProps {
  onAuthSuccess?: (authData: any) => void;
  redirect?: string | null;
}

export function Login(props: LoginProps) {
  const location: any = useLocation();
  let navigate = useNavigate();
  const { width, height, isTooSmall } = useScreenSize(1024, 640);
  const [info, setInfo] = useState({ type: "", message: "", loading: false });
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [step, setStep] = useState("email"); // 'email' or 'credentials'
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [userOrgs, setUserOrgs] = useState<any[]>([]);

  // Ref for animations
  const formRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm();

  const emailValue = watch("email");
  const orgId = watch("orgId");

  // Set up initial form values from location state
  useEffect(() => {
    // If email was passed as state (from register page redirect)
    if (location?.state?.email) {
      setValue("email", location.state.email);
    }
  }, [location]);

  // Clear error message when changing steps
  useEffect(() => {
    setInfo({ type: "", message: "", loading: false });
  }, [step]);

  // Initial animation
  useEffect(() => {
    if (formRef.current) {
      gsap.fromTo(
        formRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }
      );
    }
  }, [resourcesLoaded]);

  // Animation for step change
  useEffect(() => {
    if (formRef.current) {
      const formContent = formRef.current.querySelector(".form-content");
      if (formContent) {
        gsap.fromTo(
          formContent,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
        );
      }
    }
  }, [step]);

  useEffect(() => {
    // Check if logout is in progress or just completed
    const logoutInProgress = localStorageUtils.get('logout_in_progress');
    if (logoutInProgress) {
      // Don't auto-login if logout is in progress
      return;
    }
    
    const session = localStorageUtils.get('session');
    if (session?.token && session?.orgId && session?.user) {
      (async () => {
        await useSiteStore.getState().login(session);
      })();
    }
    if (useSiteStore.getState().isAuthenticated) {
      let path = props.redirect || '';
      if (path.indexOf('login') >= 0) path = '';
      location.href = path;
    }
  }, []);

  useEffect(() => {
    (async () => {
      processLogin();
    })();
  }, [window.location.search]);

  useEffect(() => {
    // Load essential resources here
    const loadResources = async () => {
      // Simulate resource loading with a timeout
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate a delay for resource loading
      setResourcesLoaded(true);
    };

    loadResources();
  }, []);

  const processLogin = async () => {
    let orgId = new URLSearchParams(window.location.search).get("orgId");
    const orgid = new URLSearchParams(window.location.search).get("orgid");
    orgId = orgId || orgid || appConfig.orgId;
    const email = new URLSearchParams(window.location.search).get("email");
    const password = new URLSearchParams(window.location.search).get(
      "password"
    );
    const token = new URLSearchParams(window.location.search).get("token");
    console.log("processLogin", { orgId, email, password, token });
    if (orgId && email && token) {
      performLogout();
      (async () => {
        await signIn(orgId, email, "", token);
      })();
    } else if (orgId && email && password) {
      (async () => {
        await signIn(orgId, email, password);
      })();
    }
  };

  const checkUserOrgs = async (email: string) => {
    setCheckingEmail(true);
    setInfo({ type: "", message: "", loading: false }); // Clear any previous errors

    try {
      // Get user orgs by email
      const response = await axios.get(
        getResourcePath(appEndpoints.get_org_by_email.name) + "/" + email,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      setCheckingEmail(false);

      // Check if response contains valid data
      if (
        response.data &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        const orgs = response.data;
        setUserOrgs(orgs);

        // Store the orgs in the site store
        useSiteStore.getState().setStateItem({ userOrgs: orgs });

        // If the user has organizations, redirect to the sites page
        navigate("/sites");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking user organizations:", error);
      setCheckingEmail(false);
      setInfo({
        type: "error",
        message: "Could not check for existing accounts. Please try again.",
        loading: false,
      });
      return false;
    }
  };

  const handleEmailContinue = async () => {
    const isValid = await trigger("email");
    if (!isValid) return;

    // Check if the user has any organizations
    const hasOrgs = await checkUserOrgs(emailValue);

    if (!hasOrgs) {
      // If no orgs found, proceed to the credentials step
      setStep("credentials");
    }
  };

  if (isTooSmall) {
    // navigate('/too-small');
  }

  async function signIn(orgId, email, password, token?) {
    setInfo({ type: "", message: "", loading: true });

    try {
      let loginResponse;
      if (token) {
        loginResponse = await axios.post(
          getResourcePath(appEndpoints.login_magic_link.name) + "/redirect",
          { email, token },
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              orgid: orgId,
            },
          }
        );
      } else {
        loginResponse = await axios.post(
          getResourcePath(appEndpoints.login.name),
          { email, password },
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              orgid: orgId,
            },
          }
        );
      }
      setInfo({
        type: "success",
        message: "Logged in successfully",
        loading: false,
      });
      appConfig.orgId = orgId;
      localStorageUtils.set("session", {
        orgId,
        ...(loginResponse.data || {}),
      });

      document.cookie = `orgId=${orgId}; path=/; SameSite=Lax`;
      document.cookie = `email=${email}; path=/; SameSite=Lax`;
      document.cookie = `token=${loginResponse.data.token}; path=/; SameSite=Lax`;

      localStorageUtils.set("session", {
        orgId,
        ...(loginResponse.data || {}),
      });

      if (props.onAuthSuccess) {
        props.onAuthSuccess({
          orgId,
          ...(loginResponse.data || {}),
        });
      } else {
        setTimeout(() => {
          window.location.href = "/auth/sites";
        }, 1000); // Small delay to show success message
      }
    } catch (error: any) {
      console.log("error", error);
      setInfo({
        type: "error",
        message:
          error.response?.data?.message ||
          error.response?.data?.error ||
          "Login failed. Please check your credentials.",
        loading: false,
      });
      console.error("error signing in", error);
    }
  }

  const onSubmit = async (data) => {
    if (data["orgId"] && data["email"] && data["password"]) {
      await signIn(data["orgId"], data["email"], data["password"]);
    }
  };

  const magicLinkLogin = async () => {
    if (!emailValue) {
      setInfo({
        type: "error",
        message: "Email and Site Name are required",
        loading: false,
      });
      return;
    }

    setInfo({ type: "", message: "", loading: true });

    try {
      await axios.get(
        getResourcePath(appEndpoints.login_magic_link.name) +
          "?email=" +
          emailValue,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            orgid: orgId || "",
          },
        }
      );
      setInfo({
        type: "success",
        message: "Magic Link sent to your email",
        loading: false,
      });
    } catch (error: any) {
      setInfo({
        type: "error",
        message: getResponseErrorMessage(error) || "Failed to send magic link",
        loading: false,
      });
      console.error(error);
    }
  };

  const facebookLogin = async () => {
    setInfo((prev) => ({ ...prev, loading: true }));
    const path = getResourcePath(appEndpoints.facebook_login.name);
    const rt = await requestQueueInstance
      .processData(path)
      .catch((error) => {
        setInfo({
          type: "error",
          message: getResponseErrorMessage(error) || "GitHub login failed",
          loading: false,
        });
        console.error("GitHub login error:", error);
        return { data: null };
      })
      .finally(() => {
        setInfo((prev) => ({ ...prev, loading: false }));
      });
    window.location.href = rt?.data?.authUrl;
  };

  const githubLogin = async () => {
    setInfo((prev) => ({ ...prev, loading: true }));
    const rt = await requestQueueInstance
      .processData(appEndpoints.github_login.name, undefined, undefined)
      .catch((error) => {
        setInfo({
          type: "error",
          message: getResponseErrorMessage(error) || "GitHub login failed",
          loading: false,
        });
        console.error("GitHub login error:", error);
        return { data: null };
      })
      .finally(() => {
        setInfo((prev) => ({ ...prev, loading: false }));
      });
    window.location.href = rt?.data?.authUrl;
  };

  if (info.loading || !resourcesLoaded) {
    return <LoadingIndicator />;
  }

  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center p-4 overflow-auto">
      <div
        ref={formRef}
        className="login-wizard w-full max-w-md p-8 shadow-xl bg-white rounded-2xl transition-all"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="text-3xl font-bold text-purple-600">
            <img
              src={appmintLogo}
              alt="AppMint Logo"
              className="h-12 w-auto mb-2"
            />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to continue to your account</p>
        </div>

        {info.type === "error" && (
          <div className="login-alert mb-4 animate-fadeIn">
            <div className="text-sm text-white bg-red-500 p-4 rounded-lg">
              {info.message}
            </div>
          </div>
        )}

        {info.type === "success" && (
          <div className="login-alert mb-4 animate-fadeIn">
            <div className="text-sm text-white bg-green-500 p-4 rounded-lg text-center">
              {info.message}
            </div>
          </div>
        )}

        <div className="form-content">
          {step === "email" ? (
            <div className="email-step">
              {/* Email and Magic Link Options */}
              <div className="login-input mb-4">
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                  placeholder="Email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: "Invalid Email",
                    },
                  })}
                />
                {errors?.email && (
                  <div className="text-red-500 text-sm mt-1">
                    {(errors as any).email.message}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={handleEmailContinue}
                  disabled={checkingEmail}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white whitespace-nowrap rounded-lg text-sm hover:bg-purple-700 transition flex items-center justify-center"
                >
                  {checkingEmail ? (
                    <>
                      <span className="mr-2">Checking...</span>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full  whitespace-nowrap"></div>
                    </>
                  ) : (
                    "Continue with Password"
                  )}
                </button>

                <button
                  onClick={magicLinkLogin}
                  className="flex-1 px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition flex items-center justify-center whitespace-nowrap text-sm"
                >
                  <IconRenderer icon="Wand" className="w-4 h-4 mr-2" />
                  Send Magic Link
                </button>
              </div>

              {/* Social Login Options */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="social-login-section mb-6">
                <div className="space-y-3">
                  {/* <button className="w-full px-6 py-3 flex gap-3 justify-center items-center text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="whitespace-nowrap">Continue with Google</span>
                </button> */}

                  <button
                    onClick={facebookLogin}
                    className="w-full px-6 py-3 flex gap-3 justify-center items-center text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Continue with Facebook
                  </button>

                  <button
                    onClick={githubLogin}
                    className="w-full px-6 py-3 flex gap-3 justify-center items-center text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition  whitespace-nowrap"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    Continue with GitHub
                  </button>
                </div>
              </div>

              <p className="text-center mt-6 text-sm text-gray-600">
                Don't have an account?{" "}
                <a
                  href="#"
                  onClick={(e) => navigate("../register")}
                  className="text-purple-600 hover:underline"
                >
                  Sign Up
                </a>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="login-input flex items-center">
                <input
                  type="text"
                  className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                  placeholder="Site Name"
                  {...register("orgId", {
                    required: "Site name is required",
                    maxLength: 100,
                  })}
                />
                <span className="text-sm text-gray-500 bg-gray-100 p-3 rounded-r-lg border border-gray-300 border-l-0">
                  .appmint.app
                </span>
              </div>
              {errors?.orgId && (
                <div className="text-red-500 text-sm mt-1">
                  {(errors as any).orgId.message}
                </div>
              )}

              <div className="login-input">
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition bg-gray-100"
                  readOnly
                  value={emailValue}
                />
              </div>

              <div className="login-input">
                <input
                  type="password"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                  placeholder="Password"
                  {...register("password", {
                    required: "Password is required",
                  })}
                />
              </div>
              {errors?.password && (
                <div className="text-red-500 text-sm mt-1">
                  {(errors as any).password.message}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <input type="checkbox" id="remember" className="mr-2" />
                  <label htmlFor="remember">Remember me</label>
                </div>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("../recover");
                  }}
                  className="text-purple-600 hover:underline"
                >
                  Forgot Password?
                </a>
              </div>

              <div className="flex gap-4 w-full">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="flex-1 px-4 py-2  border border-gray-300 rounded-lg hover:bg-gray-50 flex  justify-center whitespace-nowrap text-sm transition w-1/4"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 border  bg-purple-600 text-white rounded-lg   hover:bg-purple-700  border-purple-600  transition flex items-center justify-center whitespace-nowrap text-sm"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {step === "credentials" && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={magicLinkLogin}
                  className="w-full px-6 py-3 flex gap-3 justify-center items-center text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  <IconRenderer
                    icon="Wand"
                    className="w-5 h-5 text-purple-600"
                  />
                  Sign In with Magic Link
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
