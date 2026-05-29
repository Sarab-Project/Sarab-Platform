import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';

export function SignUp() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'Researcher' | 'Contributor'>('Researcher');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  const normalizeValue = (value: string) => value.trim().toLowerCase();

  const containsNameOrEmail = () => {
    const passwordValue = normalizeValue(password);
    const terms = [firstName, lastName, email.split('@')[0]]
      .map(normalizeValue)
      .map(value => value.replace(/[^a-z0-9]/g, ''))
      .filter(value => value.length >= 3);

    return terms.some(term => passwordValue.includes(term));
  };

  const hasSimpleSequence = () => /(?:012|123|234|345|456|567|678|789|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password);
  const hasRepeatedChars = () => /(.)\1\1/.test(password);

  const passwordChecks = {
    length: password.length >= 8,
    lengthStrong: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    noNameOrEmail: !containsNameOrEmail(),
    noSimpleSequence: !hasSimpleSequence(),
    noRepeatedChars: !hasRepeatedChars(),
  };

  const passwordStrength = () => {
    if (!password) return null;
    if (password.length < 8) return { label: 'Too short', color: '#ef4444' };

    let score = 0;
    score += passwordChecks.lengthStrong ? 2 : 1;
    score += passwordChecks.upper ? 1 : 0;
    score += passwordChecks.lower ? 1 : 0;
    score += passwordChecks.digit ? 1 : 0;
    score += passwordChecks.special ? 1 : 0;
    score += passwordChecks.noNameOrEmail ? 1 : 0;
    score += passwordChecks.noSimpleSequence ? 1 : 0;
    score += passwordChecks.noRepeatedChars ? 1 : 0;

    if (score <= 4) return { label: 'Weak', color: '#ef4444' };
    if (score <= 6) return { label: 'Moderate', color: '#f59e0b' };
    return { label: 'Strong', color: '#22c55e' };
  };

  const strength = passwordStrength();

  const getPasswordValidationErrors = (): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters.');
    if (!passwordChecks.upper) errors.push('Add at least one uppercase letter.');
    if (!passwordChecks.lower) errors.push('Add at least one lowercase letter.');
    if (!passwordChecks.digit) errors.push('Add at least one number.');
    if (!passwordChecks.special) errors.push('Add at least one special character.');
    if (!passwordChecks.noNameOrEmail) errors.push('Avoid using your name or email in the password.');
    if (!passwordChecks.noSimpleSequence) errors.push('Avoid simple sequences like 123 or abc.');
    if (!passwordChecks.noRepeatedChars) errors.push('Avoid repeated characters like aaa or 111.');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (firstName.trim().length < 3) {
      setError('First name must be at least 3 characters.');
      return;
    }

    const passwordErrors = getPasswordValidationErrors();
    if (passwordErrors.length > 0) {
      setError(passwordErrors[0]);
      return;
    }

    setLoading(true);
    try {
      await signup(firstName, lastName, email, password, role);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
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
          <h2 className="mb-2 font-bold" style={{ color: '#9481ff' }}>Create an Account</h2>
          <p className="text-muted-foreground">Join the Sarab research community</p>
        </div>

        <div className="border border-border rounded-xl bg-card p-8 shadow-sm">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 focus:border-[#9481ff]"
                  required
                  minLength={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 focus:border-[#9481ff]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 focus:border-[#9481ff]"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <span className="block text-sm font-medium mb-1.5">Account Type</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer transition hover:border-[#9481ff]">
                  <input
                    type="radio"
                    name="role"
                    value="Researcher"
                    checked={role === 'Researcher'}
                    onChange={() => setRole('Researcher')}
                    className="h-4 w-4 text-[#9481ff]"
                  />
                  <div>
                    <span className="font-medium">Researcher</span>
                    <p className="text-sm text-muted-foreground">Can browse public groups and collections.</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer transition hover:border-[#9481ff]">
                  <input
                    type="radio"
                    name="role"
                    value="Contributor"
                    checked={role === 'Contributor'}
                    onChange={() => setRole('Contributor')}
                    className="h-4 w-4 text-[#9481ff]"
                  />
                  <div>
                    <span className="font-medium">Contributor</span>
                    <p className="text-sm text-muted-foreground">Can upload samples and contribute to collections.</p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-[#9481ff]/40 focus:border-[#9481ff]"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {strength && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: strength.label === 'Too short' ? '25%' : strength.label === 'Acceptable' ? '60%' : '100%',
                        backgroundColor: strength.color,
                      }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            <div className="pt-1 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={firstName.trim().length >= 3 ? 'text-green-500' : 'text-muted-foreground/50'} />
                First name at least 3 characters
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={passwordChecks.length ? 'text-green-500' : 'text-muted-foreground/50'} />
                Password at least 8 characters
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={passwordChecks.upper ? 'text-green-500' : 'text-muted-foreground/50'} />
                Contains uppercase letter
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={passwordChecks.lower ? 'text-green-500' : 'text-muted-foreground/50'} />
                Contains lowercase letter
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={passwordChecks.digit ? 'text-green-500' : 'text-muted-foreground/50'} />
                Contains number
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={passwordChecks.special ? 'text-green-500' : 'text-muted-foreground/50'} />
                Contains special character
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={passwordChecks.noNameOrEmail ? 'text-green-500' : 'text-muted-foreground/50'} />
                Does not contain your name or email
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={passwordChecks.noSimpleSequence ? 'text-green-500' : 'text-muted-foreground/50'} />
                Avoids simple patterns like 123 or abc
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={passwordChecks.noRepeatedChars ? 'text-green-500' : 'text-muted-foreground/50'} />
                Avoids repeated characters like aaa or 111
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className={EMAIL_REGEX.test(email.trim()) ? 'text-green-500' : 'text-muted-foreground/50'} />
                Valid email address
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg transition-all font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ backgroundColor: '#9481ff' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/signin" className="font-medium hover:underline" style={{ color: '#9481ff' }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
