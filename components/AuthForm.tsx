import React, { useState } from 'react';
import { UserRole } from '../types';

interface AuthFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  onLoginWithGoogle: (role: string) => Promise<void>;
  onLoginWithGithub: (role: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AuthForm: React.FC<AuthFormProps> = ({ onLogin, onRegister, onLoginWithGoogle, onLoginWithGithub, loading, error }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole | ''>(UserRole.STUDENT);
  const [validationError, setValidationError] = useState<string | null>(null);

  const getPasswordStrength = () => {
    if (!password) return { label: '', color: 'bg-slate-200', width: 'w-0' };
    if (password.length < 6) return { label: 'Weak', color: 'bg-danger', width: 'w-1/3' };
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) return { label: 'Strong', color: 'bg-success', width: 'w-full' };
    return { label: 'Medium', color: 'bg-warning', width: 'w-2/3' };
  };

  const strength = getPasswordStrength();

  const validateRegisterForm = (): boolean => {
    setValidationError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setValidationError('Full name must be at least 2 characters');
      return false;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setValidationError('Please enter a valid email address');
      return false;
    }
    if (!password || password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return false;
    }
    if (!role) {
      setValidationError('Please select a role');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (isRegister) {
      if (!validateRegisterForm()) return;
      await onRegister(name.trim(), email.trim(), password, role as UserRole);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setValidationError('Please enter email and password');
      return;
    }
    await onLogin(trimmedEmail, password);
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    if (loading) return;
    setValidationError(null);
    try {
      if (provider === 'google') await onLoginWithGoogle(role as string);
      else await onLoginWithGithub(role as string);
    } catch {
      // Error surfaced via auth hook
    }
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row min-h-[600px]">
      {/* Left side branding (hidden on small mobile) */}
      <div className="hidden md:flex flex-col justify-center items-start w-1/2 p-12 bg-primary text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-light rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse-soft translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary-dark rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse-soft -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10 animate-fade-in">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg">
              <i className="fas fa-bridge text-2xl text-white"></i>
            </div>
            <h1 className="text-4xl font-black tracking-tight">CareerBridge</h1>
          </div>
          <h2 className="text-5xl font-bold mb-6 leading-tight">Elevate your<br/>career journey.</h2>
          <p className="text-xl text-indigo-100 max-w-md font-medium leading-relaxed">
            The next-generation ecosystem connecting elite talent with top-tier companies globally.
          </p>
        </div>
      </div>

      {/* Right side form */}
      <div className="w-full md:w-1/2 p-8 md:p-16 bg-white flex flex-col justify-center relative z-10 animate-slide-in">
        <div className="max-w-md w-full mx-auto">
          <div className="mb-8">
            <h3 className="text-3xl font-bold text-neutral-text mb-2">
              {isRegister ? 'Create an account' : 'Welcome back'}
            </h3>
            <p className="text-neutral-500 font-medium">
              {isRegister ? 'Join thousands of students and companies.' : 'Enter your details to access your dashboard.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-sm font-semibold text-neutral-text">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <i className="fas fa-user text-neutral-400"></i>
                  </div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-300 font-medium"
                    placeholder="Ahmed Khan"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 animate-fade-in">
              <label className="text-sm font-semibold text-neutral-text">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <i className="fas fa-envelope text-neutral-400"></i>
                </div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-300 font-medium"
                  placeholder="you@example.com"
                  type="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5 animate-fade-in">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-neutral-text">Password</label>
                {!isRegister && (
                  <a href="#" className="text-xs font-bold text-primary hover:text-primary-dark transition-colors">Forgot password?</a>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <i className="fas fa-lock text-neutral-400"></i>
                </div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-300 font-medium"
                  placeholder="••••••••"
                  type="password"
                  disabled={loading}
                />
              </div>
              {isRegister && password.length > 0 && (
                <div className="mt-2 animate-fade-in">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${strength.width} ${strength.color} transition-all duration-500`}></div>
                  </div>
                  <p className={`text-xs mt-1 font-semibold ${strength.label === 'Weak' ? 'text-danger' : strength.label === 'Strong' ? 'text-success' : 'text-warning'}`}>
                    {strength.label} password
                  </p>
                </div>
              )}
            </div>

            {isRegister && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-sm font-semibold text-neutral-text">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole(UserRole.STUDENT)}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all ${role === UserRole.STUDENT ? 'border-primary bg-indigo-50 text-primary' : 'border-slate-200 text-neutral-500 hover:border-slate-300'}`}
                  >
                    <i className="fas fa-user-graduate"></i> Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole(UserRole.RECRUITER)}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all ${role === UserRole.RECRUITER ? 'border-primary bg-indigo-50 text-primary' : 'border-slate-200 text-neutral-500 hover:border-slate-300'}`}
                  >
                    <i className="fas fa-building"></i> Company
                  </button>
                </div>
              </div>
            )}

            {(error || validationError) && (
              <div className="rounded-2xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger font-semibold flex items-center gap-3 animate-fade-in">
                <i className="fas fa-exclamation-circle text-lg"></i>
                {error || validationError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/30 transition-all hover:bg-primary-dark hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 relative overflow-hidden group"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-circle-notch fa-spin"></i> Processing...
                </span>
              ) : (
                isRegister ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-neutral-400 font-medium">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleOAuthLogin('google')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-slate-200 bg-white text-neutral-text font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <i className="fas fa-circle-notch fa-spin text-lg" />
                ) : (
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                )}
                Google
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleOAuthLogin('github')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-slate-200 bg-white text-neutral-text font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <i className="fas fa-circle-notch fa-spin text-lg" />
                ) : (
                  <i className="fab fa-github text-lg" />
                )}
                GitHub
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm font-medium text-neutral-500">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setValidationError(null);
              }}
              className="font-bold text-primary hover:text-primary-dark transition-colors"
            >
              {isRegister ? 'Sign in instead' : 'Create one now'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
