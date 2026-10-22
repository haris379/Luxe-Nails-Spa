import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { api, parseError } from '../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// status -> label shown to the customer (also announced to screen readers)
const LABELS = {
  idle: 'Email not verified',
  sending: 'Sending verification email…',
  sent: 'Verification email sent',
  verifying: 'Checking code…',
  verified: 'Verification successful',
  expired: 'Verification code expired',
  failed: 'Verification failed',
};
const TONE = {
  idle: 'text-ink-mute', sending: 'text-ink-soft', sent: 'text-brand-600', verifying: 'text-ink-soft',
  verified: 'text-green-700', expired: 'text-amber-700', failed: 'text-red-600',
};

/**
 * Email field + one-time-code check. Reports the server-issued authorization through
 * onTokenChange(token) and clears it ('') whenever the address changes or the check is lost.
 * The frontend only guides the customer; the booking API enforces verification itself.
 */
export default function EmailVerification({ value, onValueChange, error, onTokenChange, resetKey = 0 }) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const lockedEmail = useRef(''); // the address the current code / verification belongs to
  const normalized = value.trim().toLowerCase();

  // Any change of address invalidates the code and the verification for the old one.
  useEffect(() => {
    if (lockedEmail.current && normalized !== lockedEmail.current) {
      lockedEmail.current = '';
      setStatus('idle');
      setMessage('');
      setCode('');
      setCooldown(0);
      onTokenChange('');
    }
  }, [normalized]); // eslint-disable-line react-hooks/exhaustive-deps

  // The booking page asks us to start over (e.g. the server rejected the authorization).
  useEffect(() => {
    if (!resetKey) return;
    lockedEmail.current = '';
    setStatus('idle');
    setCode('');
    setMessage('Please verify your email address again.');
    onTokenChange('');
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resend countdown (one timer at a time; always cleaned up).
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const busy = status === 'sending' || status === 'verifying';
  const canEnterCode = lockedEmail.current && ['sent', 'verifying', 'expired', 'failed'].includes(status);

  async function requestCode() {
    if (busy || cooldown > 0 || status === 'verified') return;
    if (!EMAIL_RE.test(value.trim())) {
      setStatus('failed');
      setMessage('Enter a valid email address first.');
      return;
    }
    setStatus('sending');
    setMessage('');
    setCode('');
    onTokenChange('');
    try {
      const res = await api.post('/verification/email/request', { email: value.trim() });
      lockedEmail.current = normalized;
      setStatus('sent');
      setCooldown(res.data.data?.cooldownSeconds ?? 60);
      setMessage(`We sent a 6-digit code to ${value.trim()}. It expires in ${Math.round((res.data.data?.expiresInSeconds ?? 600) / 60)} minutes.`);
    } catch (err) {
      const p = parseError(err);
      const wait = err.response?.data?.errors?.retryAfterSeconds;
      if (err.response?.data?.code === 'COOLDOWN' && wait) setCooldown(wait);
      // A code may already be on its way for this address (cooldown): keep the code box usable.
      if (err.response?.data?.code === 'COOLDOWN') lockedEmail.current = lockedEmail.current || normalized;
      setStatus(err.response?.data?.code === 'COOLDOWN' && lockedEmail.current ? 'sent' : 'failed');
      setMessage(p.message);
    }
  }

  async function verifyCode(e) {
    e?.preventDefault();
    if (busy || !lockedEmail.current) return;
    if (!/^\d{6}$/.test(code)) {
      setMessage('Enter the 6-digit code from the email.');
      return;
    }
    setStatus('verifying');
    setMessage('');
    try {
      const res = await api.post('/verification/email/verify', { email: value.trim(), code });
      setStatus('verified');
      setCode('');
      setCooldown(0);
      setMessage('Your email address is verified. You can now confirm your booking.');
      onTokenChange(res.data.data.verificationToken);
    } catch (err) {
      const p = parseError(err);
      const c = err.response?.data?.code;
      onTokenChange('');
      if (c === 'CODE_EXPIRED') setStatus('expired');
      else if (c === 'INVALID_CODE') setStatus('sent'); // can try again
      else setStatus('failed');
      setMessage(p.message);
    }
  }

  const verified = status === 'verified';
  return (
    <div>
      <label htmlFor="email" className="label">Email Address <span className="text-brand-600"> *</span></label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="email" type="email" autoComplete="email" placeholder="your@email.com" value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className={`${error ? 'input input-error' : 'input'} pl-9`}
            aria-invalid={!!error} aria-describedby="email-status"
          />
        </div>
        <button type="button" onClick={requestCode} disabled={busy || verified || cooldown > 0}
          className={`btn ${verified ? 'btn-outline' : 'btn-primary'} shrink-0 !py-2.5`}>
          {status === 'sending' ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending…</>
            : verified ? <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Verified</>
            : cooldown > 0 ? `Resend in ${cooldown}s`
            : lockedEmail.current ? 'Resend code' : 'Verify Email'}
        </button>
      </div>
      {error && <p id="email-error" role="alert" className="mt-1 text-xs text-red-600">{error}</p>}

      <p id="email-status" role="status" aria-live="polite" className={`mt-1.5 text-xs font-medium ${TONE[status]}`} data-testid="email-status">
        {LABELS[status]}
      </p>
      {message && <p className="mt-0.5 text-xs text-ink-soft">{message}</p>}

      {canEnterCode && !verified && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row" role="group" aria-label="Enter verification code">
          <div className="flex-1">
            <label htmlFor="otp" className="sr-only">6-digit verification code</label>
            <input
              id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') verifyCode(e); }}
              className="input text-center text-lg tracking-[0.4em]"
            />
          </div>
          <button type="button" onClick={verifyCode} disabled={busy || code.length !== 6} className="btn btn-primary shrink-0 !py-2.5">
            {status === 'verifying' ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…</> : 'Verify code'}
          </button>
        </div>
      )}
    </div>
  );
}
