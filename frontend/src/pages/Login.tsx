import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Loader2, Sparkles, User } from 'lucide-react';
import { cn } from '../utils';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegisterMode) {
        // 验证注册表单
        if (!formData.email || !formData.username || !formData.password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        
        console.log('Registering user:', { email: formData.email, username: formData.username });
        await register({
          email: formData.email,
          username: formData.username,
          password: formData.password,
        });
      } else {
        // 验证登录表单
        if (!formData.email || !formData.password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        
        console.log('Logging in user:', { email: formData.email });
        await login({
          email: formData.email,
          password: formData.password,
        });
      }
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Authentication error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Authentication failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] relative flex items-center justify-center overflow-hidden font-sans selection:bg-blue-500/30 text-slate-200">
      
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px]" />
        {/* Tech Grid Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-soft-light"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[420px] px-4"
      >
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-700/50 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/10">
          
          {/* Header Section */}
          <div className="p-8 pt-10 text-center relative">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6 group relative"
            >
              <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Shield className="h-8 w-8 text-white relative z-10" />
            </motion.div>
            
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-slate-300 tracking-tight">
              CypherGuard AI
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2 text-slate-400 text-sm">
              <Sparkles className="h-3 w-3 text-blue-400" />
              <span>Next-Gen Security Intelligence</span>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              {isRegisterMode ? 'Create your account' : 'Sign in to continue'}
            </p>
          </div>

          {/* Form Section */}
          <div className="p-8 pt-2 pb-10">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
              >
                <div className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <div>
                    <p className="font-semibold">Authentication Failed</p>
                    <p className="text-xs mt-1">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Email/Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
                  {isRegisterMode ? 'Email' : 'Email or Username'}
                </label>
                <div 
                  className={cn(
                    "relative group transition-all duration-300 rounded-xl",
                    focusedField === 'email' ? "ring-2 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "hover:bg-white/5"
                  )}
                >
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className={cn("h-5 w-5 transition-colors", focusedField === 'email' ? "text-blue-400" : "text-slate-500")} />
                  </div>
                  <input
                    type={isRegisterMode ? "email" : "text"}
                    required
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-transparent focus:bg-slate-900/80 transition-all font-medium"
                    placeholder={isRegisterMode ? "name@cypherguard.ai" : "email or username"}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>
              </div>

              {/* Username Input (only for register) */}
              {isRegisterMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5"
                >
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                  <div 
                    className={cn(
                      "relative group transition-all duration-300 rounded-xl",
                      focusedField === 'username' ? "ring-2 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "hover:bg-white/5"
                    )}
                  >
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className={cn("h-5 w-5 transition-colors", focusedField === 'username' ? "text-blue-400" : "text-slate-500")} />
                    </div>
                    <input
                      type="text"
                      required={isRegisterMode}
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-transparent focus:bg-slate-900/80 transition-all font-medium"
                      placeholder="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                </motion.div>
              )}

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
                  Password
                </label>
                <div 
                  className={cn(
                    "relative group transition-all duration-300 rounded-xl",
                    focusedField === 'password' ? "ring-2 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "hover:bg-white/5"
                  )}
                >
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className={cn("h-5 w-5 transition-colors", focusedField === 'password' ? "text-blue-400" : "text-slate-500")} />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={isRegisterMode ? 6 : undefined}
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-transparent focus:bg-slate-900/80 transition-all font-medium"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>
                {isRegisterMode && (
                  <p className="text-xs text-slate-500 ml-1 mt-1">
                    Minimum 6 characters
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden rounded-xl p-[1px]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-violet-600 group-hover:from-blue-500 group-hover:to-violet-500 transition-all duration-300" />
                <div className="relative bg-transparent h-full w-full px-4 py-3.5 flex items-center justify-center gap-2 text-white font-semibold tracking-wide">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white/90" />
                  ) : (
                    <>
                      <span>{isRegisterMode ? 'Create Account' : 'Authenticate'}</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </form>

            {/* Toggle Register/Login */}
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setError(null);
                }}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {isRegisterMode ? 'Already have an account? Sign in' : "Don't have an account? Register"}
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
              <p className="text-xs text-slate-500">
                Restricted System. Unauthorized access is monitored.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}