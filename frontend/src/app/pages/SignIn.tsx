import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#9481ff' }}>
            <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="white" strokeWidth="1.5" />
              <circle cx="10" cy="10" r="3" fill="white" />
            </svg>
          </div>
          <h2 className="mb-2 font-bold" style={{ color: '#9481ff' }}>Welcome to Sarab</h2>
          <p className="text-muted-foreground">Sign in to access the ophthalmology database</p>
        </div>

        <div className="border border-border rounded-xl bg-card p-8 shadow-sm">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 focus:border-[#9481ff]"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 focus:border-[#9481ff]"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg transition-all font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#9481ff' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing In...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium hover:underline" style={{ color: '#9481ff' }}>
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
