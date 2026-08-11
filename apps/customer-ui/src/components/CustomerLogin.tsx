import { useState, useEffect } from 'react';
import { Loader2, Lock, Mail, Eye, EyeOff, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import {
  customerAuth,
  persistSession,
  readAuthLinkFromUrl,
  type CustomerSession,
} from '../services/customerAuth';

interface CustomerLoginProps {
  onLogin: (session: CustomerSession) => void;
}

/**
 * Four screens behind one component:
 *
 *   password  email + password
 *   magic     email → we mail a one-time sign-in link
 *   forgot    email → we mail a one-time reset link
 *   reset     set a new password (reached only from an emailed link)
 *
 * `magic` matters beyond convenience: customers an admin provisioned have no
 * password at all, so the link is their only way in.
 */
type View = 'password' | 'magic' | 'forgot' | 'reset';

const MIN_PASSWORD_LENGTH = 10;

export function CustomerLogin({ onLogin }: CustomerLoginProps) {
  const [view, setView] = useState<View>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  // Set while redeeming a magic link on page load, so we show a spinner
  // rather than flashing the sign-in form at someone who just clicked through.
  const [redeeming, setRedeeming] = useState(false);

  // Handle the `?mode=…&token=…` URL that emailed links land on.
  useEffect(() => {
    const link = readAuthLinkFromUrl();
    if (!link) return;

    if (link.mode === 'forgot') {
      setView('forgot');
      return;
    }
    if (link.mode === 'reset') {
      setResetToken(link.token);
      setView('reset');
      return;
    }

    setRedeeming(true);
    customerAuth
      .consumeMagicLink(link.token)
      .then((session) => {
        persistSession(session);
        onLogin(session);
      })
      .catch((err: any) => {
        setRedeeming(false);
        setView('magic');
        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            'That sign-in link is no longer valid. Request a new one.',
        );
      });
  }, [onLogin]);

  const goTo = (next: View) => {
    setView(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const errorFrom = (err: any, fallback: string) =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const session = await customerAuth.login(email, password);
      persistSession(session);
      onLogin(session);
    } catch (err: any) {
      const status = err?.response?.status;
      // The account exists but was provisioned without a password — point
      // them at the link flow instead of leaving them stuck on a form that
      // can never succeed.
      if (status === 409 && err?.response?.data?.error === 'no_password_set') {
        goTo('magic');
        setNotice('This account has no password yet. Sign in with an email link, then set one from Settings.');
      } else if (status === 401) {
        setError('Invalid email or password');
      } else {
        setError(errorFrom(err, 'Login failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const message =
        view === 'magic'
          ? await customerAuth.requestMagicLink(email)
          : await customerAuth.requestPasswordReset(email);
      setNotice(message);
    } catch (err: any) {
      setError(errorFrom(err, 'Could not send the email. Try again in a moment.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);
    try {
      const session = await customerAuth.resetPassword(resetToken, password);
      persistSession(session);
      onLogin(session);
    } catch (err: any) {
      setError(errorFrom(err, 'Could not reset your password.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';
  const buttonClass =
    'w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

  const emailField = (
    <div>
      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>
    </div>
  );

  const passwordField = (id: string, label: string, value: string, setValue: (v: string) => void, autoComplete: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          required
          className={`${inputClass} pr-10`}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  const messages = (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}
      {notice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm flex gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}
    </>
  );

  const backLink = (label: string) => (
    <button
      type="button"
      onClick={() => goTo('password')}
      className="mt-5 w-full text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1.5"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </button>
  );

  const subtitle = {
    password: 'Sign in to your dashboard',
    magic: 'Sign in with an email link',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  }[view];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 items-center justify-center mb-4 shadow-lg">
            <span className="text-white font-bold text-xl">SF</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SpinForge</h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 p-8">
          {redeeming ? (
            <div className="py-8 flex flex-col items-center gap-3 text-gray-600">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-sm">Signing you in…</p>
            </div>
          ) : view === 'password' ? (
            <>
              <form onSubmit={handlePasswordLogin} className="space-y-5">
                {emailField}
                {passwordField('password', 'Password', password, setPassword, 'current-password')}
                {messages}
                <button type="submit" disabled={loading || !email || !password} className={buttonClass}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
                </button>
              </form>

              <div className="mt-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <button
                type="button"
                onClick={() => goTo('magic')}
                className="mt-5 w-full py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Sparkles className="h-4 w-4 text-blue-600" /> Email me a sign-in link
              </button>

              <button
                type="button"
                onClick={() => goTo('forgot')}
                className="mt-4 w-full text-sm text-blue-600 hover:text-blue-700"
              >
                Forgot your password?
              </button>
            </>
          ) : view === 'reset' ? (
            <form onSubmit={handleReset} className="space-y-5">
              {passwordField('new-password', 'New password', password, setPassword, 'new-password')}
              {passwordField('confirm-password', 'Confirm password', confirmPassword, setConfirmPassword, 'new-password')}
              <p className="text-xs text-gray-500">
                At least {MIN_PASSWORD_LENGTH} characters. Setting it signs out every other device.
              </p>
              {messages}
              <button type="submit" disabled={loading || !password || !confirmPassword} className={buttonClass}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Set password and sign in'}
              </button>
            </form>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-5">
                {view === 'magic'
                  ? 'Enter your email and we’ll send you a link that signs you in — no password required.'
                  : 'Enter your email and we’ll send you a link to choose a new password.'}
              </p>
              <form onSubmit={handleLinkRequest} className="space-y-5">
                {emailField}
                {messages}
                <button type="submit" disabled={loading || !email} className={buttonClass}>
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                    : view === 'magic' ? 'Send sign-in link' : 'Send reset link'}
                </button>
              </form>
              {backLink('Back to password sign-in')}
            </>
          )}

          {view === 'password' && (
            <p className="mt-6 text-xs text-gray-500 text-center">
              New customers are provisioned by an administrator. Contact support if you need an account.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
