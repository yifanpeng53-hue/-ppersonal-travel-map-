import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoginForm({ onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setMessage('Please enter email and password.');
      return;
    }
    setLoading(true);
    setMessage('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (!signInError) {
      setLoading(false);
      setMessage('Welcome back! Loading your footprints…');
      onAuthSuccess?.();
      setEmail('');
      setPassword('');
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signUpError) {
      setMessage(signUpError.message);
      return;
    }

    setMessage('Account created! Check your email, then sign in.');
    setEmail('');
    setPassword('');
  };

  return (
    <form onSubmit={handleSubmit} className="panel-form auth-panel-form">
      <input
        type="email"
        value={email}
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <input
        type="password"
        value={password}
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />

      <button type="submit" disabled={loading}>
        {loading ? 'SUBMITTING…' : 'SUBMIT'}
      </button>

      {message && <p className="auth-panel-message">{message}</p>}

      <p className="auth-panel-hint">第一次登陆默认为注册</p>
    </form>
  );
}
