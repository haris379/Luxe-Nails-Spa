import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Seo from '../../components/Seo';
import { Field } from '../../components/ui';
import Logo from '../../components/Logo';
import { api, parseError, setToken } from '../../lib/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(params.get('reason') === 'expired' ? 'Your session has ended. Please sign in again.' : '');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/admin/login', form);
      setToken(res.data.data.token);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(parseError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <Seo title="Admin sign in" noindex />
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex justify-center"><Logo plain /></div>
        <h1 className="text-center text-lg font-semibold">Admin sign in</h1>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Field label="Email" htmlFor="a-email"><input id="a-email" type="email" required autoComplete="username" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password" htmlFor="a-pass"><input id="a-pass" type="password" required autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Sign in'}</button>
      </form>
    </div>
  );
}
