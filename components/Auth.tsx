import React, { useState } from 'react';
import api, { setToken } from '../services/api';
import { LogIn, UserPlus } from 'lucide-react';

interface AuthProps {
  onLogin: (user: any) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ... inside Auth function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Always Login
      const endpoint = '/auth/login';
      const payload = { email, password };
      
      const res = await api.post(endpoint, payload);
      const { token, user } = res.data;
      
      if (!token || !user) {
         throw new Error("Invalid response from server");
      }

      setToken(token);
      onLogin(user);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || err.message || 'Authentication failed.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl text-white font-bold text-xl mb-3">S</div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Login</h2>
          <p className="text-gray-500 text-sm mt-1">Sign in to manage subscriptions</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 break-words">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="Username"
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
             <input
               type="password"
               required
               value={password}
               onChange={e => setPassword(e.target.value)}
               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
               placeholder="••••••••"
             />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
               <><LogIn size={18} /> Sign In</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
