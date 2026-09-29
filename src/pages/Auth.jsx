import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { Field, Spinner } from '../components/ui.jsx';
import { APP_NAME } from '../lib/config.js';

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on small screens so the form gets the full width. */}
      <div className="relative hidden flex-col justify-between bg-brand-700 p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 font-bold">C</span>
          <span className="text-lg font-semibold">{APP_NAME}</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Every lead, deal and conversation in one place.
          </h2>
          <p className="mt-4 max-w-md text-brand-100">
            Capture leads, work the pipeline, raise quotations, invoice customers and keep support
            in the loop — from first touch to repeat business.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm text-brand-100">
            {['Lead capture, scoring and conversion', 'Kanban sales pipeline with forecasting',
              'Quotations → orders → invoices → payments', 'Campaigns, support tickets and reporting'].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[11px]">✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">Node · Express · MongoDB · React</p>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 font-bold text-white">C</span>
            <span className="text-lg font-semibold text-slate-900">{APP_NAME}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

function Alert({ message, tone = 'error' }) {
  if (!message) return null;
  const tones = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
  };
  return <div className={`mb-4 rounded-lg border px-3.5 py-2.5 text-sm ${tones[tone]}`}>{message}</div>;
}

// ---------------------------------------------------------------- Login (+ MFA step)

export function Login() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [mfa, setMfa] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await login(form.email.trim(), form.password);
      if (result.mfaRequired) setMfa(result.email);
      else navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await verifyMfa(mfa, code.trim());
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (mfa) {
    return (
      <AuthShell title="Two-factor verification" subtitle={`We sent a 6-digit code to ${mfa}.`}>
        <Alert message={error} />
        <form onSubmit={submitMfa} className="space-y-4">
          <Field label="Verification code">
            <input className="input tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value)}
              maxLength={6} inputMode="numeric" autoFocus required placeholder="000000" />
          </Field>
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Verify and sign in'}</button>
          <button type="button" className="btn-ghost w-full" onClick={() => { setMfa(null); setCode(''); }}>Back to sign in</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Enter your credentials to continue."
      footer={<>No account? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create one</Link></>}
    >
      <Alert message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address">
          <input className="input" type="email" autoComplete="username" autoFocus required
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" required
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">Forgot password?</Link>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Sign in'}</button>
      </form>

      <div className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
        <div className="space-y-1 text-xs text-slate-600">
          {[['admin@crm.local', 'Super Admin'], ['manager@crm.local', 'Sales Manager'],
            ['sales1@crm.local', 'Sales Executive'], ['finance@crm.local', 'Finance'],
            ['support@crm.local', 'Support']].map(([email, role]) => (
            <button
              key={email}
              type="button"
              className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-white"
              onClick={() => setForm({ email, password: 'Admin@123' })}
            >
              <span className="font-mono">{email}</span>
              <span className="text-slate-400">{role}</span>
            </button>
          ))}
          <p className="pt-1 text-slate-400">Password for all: <span className="font-mono">Admin@123</span></p>
        </div>
      </div>
    </AuthShell>
  );
}

// ---------------------------------------------------------------- Register

export function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/register', form);
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError([err.message, ...(err.errors || [])].join(' · '));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="The first account created becomes the Super Admin."
      footer={<>Already registered? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link></>}
    >
      <Alert message={error} />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
        </div>
        <Field label="Email address">
          <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" hint="At least 8 characters, with a letter and a number.">
          <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}

// ---------------------------------------------------------------- Forgot → OTP → Reset

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
      setTimeout(() => navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="We'll email you a code to reset it."
      footer={<Link to="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link>}
    >
      <Alert message={error} />
      {sent && <Alert tone="success" message="If that address exists, a reset code is on its way. Redirecting…" />}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address">
          <input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Send reset code'}</button>
      </form>
    </AuthShell>
  );
}

export function VerifyOtp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get('email') || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/verify-otp', { email, code: code.trim(), purpose: 'reset' });
      navigate(`/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code.trim())}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Enter your code"
      subtitle={`We sent a 6-digit code to ${email || 'your email'}. It expires in 10 minutes.`}
      footer={<Link to="/forgot-password" className="font-medium text-brand-600 hover:underline">Send another code</Link>}
    >
      <Alert message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Verification code" hint="Without SMTP configured, the code is printed in the server console.">
          <input className="input text-center text-lg tracking-[0.5em]" maxLength={6} inputMode="numeric" required autoFocus
            value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Verify code'}</button>
      </form>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: params.get('email') || '',
    code: params.get('code') || '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email: form.email, code: form.code, password: form.password });
      navigate('/login');
    } catch (err) {
      setError([err.message, ...(err.errors || [])].join(' · '));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a password you haven't used before.">
      <Alert message={error} />
      <form onSubmit={submit} className="space-y-4">
        {!params.get('email') && (
          <Field label="Email address">
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        )}
        {!params.get('code') && (
          <Field label="Reset code">
            <input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
        )}
        <Field label="New password" hint="At least 8 characters, with a letter and a number.">
          <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Confirm new password">
          <input className="input" type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Update password'}</button>
      </form>
    </AuthShell>
  );
}
