import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { loginAdmin } from '../../src/services/firebaseAuth';
import { useAuth } from '../../src/hooks/useAuth';
import { UserRole } from '../../types';

const AdminLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if ((profile?.role as any) === UserRole.ADMIN) {
      navigate('/admin', { replace: true });
    } else if (profile && (profile.role as any) !== UserRole.ADMIN) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginAdmin(password);
      toast.success('Admin signed in successfully');
      navigate('/admin');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-8 md:p-16 bg-white flex flex-col justify-center relative z-10">
      <div className="max-w-md w-full mx-auto">
        <div className="mb-8 text-center">
          <h3 className="text-3xl font-bold text-neutral-text mb-2">Admin Login</h3>
          <p className="text-neutral-500 font-medium">
            Sign in with the fixed admin credentials configured for this platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-text">Email</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value="admin@careerbridge.com"
              disabled
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-text">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Enter admin password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger font-semibold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary py-3 text-white font-bold text-base shadow-lg shadow-primary/20 transition hover:bg-primary-dark disabled:opacity-70"
          >
            {loading ? 'Signing in…' : 'Sign in as Admin'}
          </button>

          <p className="text-sm text-slate-500">
            Default admin credentials are stored in Firebase Auth and Firestore for this demo.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
