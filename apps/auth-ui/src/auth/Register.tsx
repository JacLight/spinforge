import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { IconRenderer } from '@/ui/icons/icon-renderer';
// Helper function to check if value is empty
const isEmpty = (value: any): boolean => {
  return value === null || value === undefined || value === '' || 
    (typeof value === 'object' && Object.keys(value).length === 0);
};
import { gsap } from 'gsap';
import { TemplateSelection } from './TemplateSelection';
import appmintLogo from '../assets/appmint-logo.png';
import { appEndpoints } from '@/request/api-endpoints';
import { getResourcePath } from '@/request';

const badNames = ['appmint', 'stylesavvee', 'freesource', 'websitemint', 'codebae', 'yugo', 'freesource'];

interface RegisterProps {
  onAuthSuccess?: (authData: any) => void;
}

export function Register(props: RegisterProps) {
  let navigate = useNavigate();
  const [signInError, setSignInError] = useState();
  const [currentStep, setCurrentStep] = useState(0);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [templateChoice, setTemplateChoice] = useState<string | null>(null);

  // Refs for animation
  const wizardRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    trigger,
  } = useForm({
    reValidateMode: 'onBlur',
    defaultValues: {
      email: '',
      orgId: '',
      firstName: '',
      lastName: '',
      password: '',
      password_repeat: '',
    },
  });

  const [validName, setValidName] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const emailValue = watch('email');

  // Animation setup
  useEffect(() => {
    if (wizardRef.current) {
      gsap.set(wizardRef.current, { opacity: 0 });
      gsap.to(wizardRef.current, {
        opacity: 1,
        duration: 0.8,
        ease: 'power2.out',
      });
    }
  }, []);

  // Step animation
  useEffect(() => {
    if (stepRefs.current.length > 0) {
      // Hide all steps
      stepRefs.current.forEach((step, index) => {
        if (step) {
          gsap.set(step, {
            opacity: 0,
            x: index < currentStep ? -50 : 50,
            display: 'none',
          });
        }
      });

      // Show current step with animation
      if (stepRefs.current[currentStep]) {
        gsap.set(stepRefs.current[currentStep], { display: 'flex' });
        gsap.to(stepRefs.current[currentStep], {
          opacity: 1,
          x: 0,
          duration: 0.5,
          ease: 'power2.out',
        });
      }
    }
  }, [currentStep, stepRefs.current.length]);

  const handleTemplateChoice = (choice: string) => {
    setTemplateChoice(choice);
  };

  const checkEmailExists = async (email: string) => {
    setCheckingEmail(true);
    try {
      const response = await axios.get(getResourcePath(appEndpoints.get_org_by_email.name) + '/' + email, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      setCheckingEmail(false);
      return response.data.exists;
    } catch (error) {
      console.error('Error checking email:', error);
      setCheckingEmail(false);
      return false;
    }
  };

  const handleEmailNext = async () => {
    const isValid = await trigger('email');
    if (!isValid) return;

    const emailExists = await checkEmailExists(emailValue);

    if (emailExists) {
      // Redirect to login with email pre-filled
      navigate('../login', { state: { email: emailValue } });
    } else {
      // Continue to template choice
      setCurrentStep(1);
    }
  };

  const handleOrgIdNext = async () => {
    const isValid = await trigger('orgId');
    if (isValid && validName) {
      setCurrentStep(3);
    }
  };

  const handlePersonalInfoNext = async () => {
    const firstNameValid = await trigger('firstName');
    const lastNameValid = await trigger('lastName');
    if (firstNameValid && lastNameValid) {
      setCurrentStep(4);
    }
  };

  const checkName = async e => {
    const value = e.target.value;
    if (!value || value.length < 3) {
      setValidName(null);
      setNameError(null);
      return;
    }

    const regex = /^[a-zA-Z](?:[a-zA-Z0-9]*)?$/;
    if (!regex.test(value)) {
      setNameError('Invalid Site Name - use letters and numbers only, starting with a letter');
      return;
    }

    if (badNames.includes(e.target.value)) {
      setNameError('This site name is not allowed');
      return;
    }

    try {
      const uniqueResponse = await axios.get(getResourcePath(appEndpoints.isunique.name) + '/' + value, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          orgid: 'fundu',
        },
      });

      if (!isEmpty(uniqueResponse?.data)) {
        setNameError('Site Name already taken');
      } else {
        setValidName(value);
        setNameError(null);
      }
    } catch (error) {
      console.error('Error checking name uniqueness:', error);
      setNameError('Error checking name availability');
    }
  };

  const onSubmit = async data => {
    setLoading(true);
    setSignInError(undefined);
    
    try {
      const response = await axios.post(
        getResourcePath(appEndpoints.register.name),
        {
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          orgId: data.orgId,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Registration successful
      if (props.onAuthSuccess && response.data) {
        const authData = {
          token: response.data?.token || response.data?.access_token,
          user: {
            id: response.data?.user?.id || response.data?.userId,
            email: data.email,
            name: `${data.firstName} ${data.lastName}`.trim(),
            orgId: data.orgId
          }
        };
        props.onAuthSuccess(authData);
      } else {
        // Default behavior - redirect to login
        navigate('../login', { state: { email: data.email } });
      }
    } catch (error: any) {
      setSignInError(error.response?.data?.message || error.response?.data?.error || 'Registration failed. Please try again.');
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div ref={wizardRef} className="register-wizard w-full max-w-2xl p-8 shadow-xl bg-white rounded-2xl transition-all">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <div className="text-3xl font-bold text-purple-600">
          {' '}
          <img src={appmintLogo} alt="AppMint Logo" className="h-12 w-auto mb-2" />
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="progress-indicator mb-8">
        <div className="flex justify-between mx-auto w-fit gap-5 mb-10">
          {[0, 1, 2, 3, 4].map((step, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= step ? 'bg-purple-500 border-purple-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                {step < currentStep ? <IconRenderer icon="Check" className="w-4 h-4" /> : index + 1}
              </div>
              {index < 4 && <div className={`w-16 h-1 mt-3 ${currentStep > step ? 'bg-purple-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Wizard Content */}
      <div className="wizard-content relative mt-10">
        {/* Email Step */}
        <div ref={el => { stepRefs.current[0] = el; }} className="wizard-step flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-4">Welcome to WebsiteMint</h1>
          <p className="text-center mb-6 text-gray-600">Let's start by creating your account</p>

          {/* Email Input */}
          <div className="w-full max-w-sm mb-6">
            <div className="login-input">
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                placeholder="Email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Invalid Email',
                  },
                })}
              />
            </div>
            {errors.email && <div className="form-error text-red-500 text-sm mt-1">{errors.email.message as any}</div>}
          </div>

          <button onClick={handleEmailNext} disabled={checkingEmail} className="w-full max-w-sm px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center mb-6 whitespace-nowrap">
            {checkingEmail ? (
              <>
                <span className="mr-2">Checking...</span>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              </>
            ) : (
              'Continue with Email'
            )}
          </button>

          {/* Social Login Options */}
          <div className="relative my-6 w-full max-w-sm">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="social-login-section mb-6 w-full max-w-sm">
            <div className="space-y-3">
              <button className="w-full px-6 py-3 flex gap-3 justify-center items-center text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <button className="w-full px-6 py-3 flex gap-3 justify-center items-center text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Continue with Facebook
              </button>

              <button className="w-full px-6 py-3 flex gap-3 justify-center items-center text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </button>
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-gray-600">
            Already have an account?{' '}
            <a href="#" onClick={e => navigate('../login')} className="text-purple-600 hover:underline">
              Sign In
            </a>
          </p>
        </div>

        {/* Template Selection Step */}
        <div ref={el => { stepRefs.current[1] = el; }} className="wizard-step flex flex-col items-center w-full">
          <TemplateSelection
            onSelect={templateId => {
              setTemplateChoice(templateId);
              // Continue to next step after template selection
              setCurrentStep(2);
            }}
            onBack={() => setCurrentStep(0)}
          />
        </div>

        {/* Site Name Step */}
        <div ref={el => { stepRefs.current[2] = el; }} className="wizard-step flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-4">Choose Your Site Name</h1>
          <p className="text-center mb-6 text-gray-600">This will be your unique website address. You can have multiple site names for different projects.</p>

          <div className="w-full mb-2">
            <div className="login-input flex items-center">
              <input
                type="text"
                className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                placeholder="Site Name"
                {...register('orgId', { required: 'Site Name is required', maxLength: 100 })}
                onBlur={checkName}
              />
              <span className="text-sm text-gray-500 bg-gray-100 p-3 rounded-r-lg border border-gray-300 border-l-0">.appmint.app</span>
            </div>
            {nameError && <div className="form-error text-red-500 text-sm mt-1">{nameError}</div>}
            {errors.orgId && <div className="form-error text-red-500 text-sm mt-1">{errors.orgId.message as any}</div>}
          </div>

          <div className="text-sm text-gray-600 mb-6 bg-purple-50 p-4 rounded-lg w-full">
            <p className="font-medium mb-1">Why do I need a site name?</p>
            <p>Your site name creates a separate workspace for each of your projects or businesses. This keeps your work organized and lets you easily manage multiple websites.</p>
          </div>

          <div className="flex gap-4 w-full">
            <button onClick={() => setCurrentStep(1)} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition w-1/4">
              Back
            </button>
            <button onClick={handleOrgIdNext} disabled={!validName} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition w-3/4 disabled:opacity-50 disabled:cursor-not-allowed">
              Continue
            </button>
          </div>
        </div>

        {/* Personal Info Step */}
        <div ref={el => { stepRefs.current[3] = el; }} className="wizard-step flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-4">Tell Us About Yourself</h1>
          <p className="text-center mb-6 text-gray-600">Let's set up your personal information</p>

          <div className="w-full mb-6">
            <div className="login-input mb-3">
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                placeholder="First Name"
                {...register('firstName', { required: 'First name is required', maxLength: 100 })}
              />
              {errors.firstName && <div className="form-error text-red-500 text-sm mt-1">{errors.firstName.message as any}</div>}
            </div>

            <div className="login-input">
              <input
                type="text"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                placeholder="Last Name"
                {...register('lastName', { required: 'Last name is required', maxLength: 100 })}
              />
              {errors.lastName && <div className="form-error text-red-500 text-sm mt-1">{errors.lastName.message as any}</div>}
            </div>
          </div>

          <div className="flex gap-4 w-full">
            <button onClick={() => setCurrentStep(2)} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition w-1/4">
              Back
            </button>
            <button onClick={handlePersonalInfoNext} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition w-3/4">
              Continue
            </button>
          </div>
        </div>

        {/* Password Step */}
        <div ref={el => { stepRefs.current[4] = el; }} className="wizard-step flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-4">Create a Password</h1>
          <p className="text-center mb-6 text-gray-600">Almost there! Just set up a secure password to finish.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="w-full">
            <div className="login-input mb-3">
              <input
                type="password"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                placeholder="Password"
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                })}
              />
              {errors.password && <div className="form-error text-red-500 text-sm mt-1">{errors.password.message as any}</div>}
            </div>

            <div className="login-input mb-6">
              <input
                type="password"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 transition"
                placeholder="Confirm Password"
                {...register('password_repeat', {
                  required: 'Please confirm your password',
                  validate: value => {
                    const password = getValues('password');
                    return value === password || 'Passwords do not match';
                  },
                })}
              />
              {errors.password_repeat && <div className="form-error text-red-500 text-sm mt-1">{errors.password_repeat.message as any}</div>}
            </div>

            {signInError && <div className="text-sm text-red-500 mb-4">{signInError}</div>}

            <div className="flex gap-4 w-full">
              <button type="button" onClick={() => setCurrentStep(3)} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition w-1/4">
                Back
              </button>
              <button type="submit" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition w-3/4">
                Create Account
              </button>
            </div>

            <p className="text-center mt-6 text-sm text-gray-600">
              Already have an account?{' '}
              <a href="#" onClick={e => navigate('../login')} className="text-purple-600 hover:underline">
                Sign In
              </a>
            </p>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
