import { useState } from 'react';
import { api } from '../../../api/api';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

export const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const navigate = useNavigate();

  const handleCapsLock = (e: React.KeyboardEvent) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { username, password });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">Register</h2>
        {error && <div className="mb-4 rounded bg-red-100 p-2 text-red-600">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-bold text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-6 relative">
            <label className="mb-2 block text-sm font-bold text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleCapsLock}
                onKeyUp={handleCapsLock}
                className="w-full rounded border px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
              </button>
            </div>
            {isCapsLockOn && (
              <p className="absolute -bottom-5 left-0 text-xs font-semibold text-orange-600">
                Caps Lock is ON
              </p>
            )}
          </div>
          <button
            type="submit"
            className="w-full rounded bg-green-600 py-2 font-bold text-white hover:bg-green-700"
          >
            Create Account
          </button>
        </form>
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};