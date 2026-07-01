import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function SignUpForm() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setLoading(true);
    const result = await signUp(email, password, username.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Account created! Check your email for a confirmation link.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-felt flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gold">🎴 Kenyan Poker</h1>
          <p className="text-green-300 mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-felt-light rounded-xl p-8 space-y-5 shadow-2xl">
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-green-200 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="w-full bg-green-900 border border-green-700 rounded-lg px-4 py-3 text-white placeholder-green-500 focus:outline-none focus:border-gold transition"
              placeholder="poker_king"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-200 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-green-900 border border-green-700 rounded-lg px-4 py-3 text-white placeholder-green-500 focus:outline-none focus:border-gold transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-200 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-green-900 border border-green-700 rounded-lg px-4 py-3 text-white placeholder-green-500 focus:outline-none focus:border-gold transition"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-green-400 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-gold hover:text-yellow-400 font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
