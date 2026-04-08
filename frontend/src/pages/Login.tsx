import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
        if (!formData.email || !formData.username || !formData.password) {
          setError('请填写所有必填项');
          setLoading(false);
          return;
        }
        await register({
          email: formData.email,
          username: formData.username,
          password: formData.password,
        });
      } else {
        if (!formData.email || !formData.password) {
          setError('请填写所有必填项');
          setLoading(false);
          return;
        }
        await login({
          email: formData.email,
          password: formData.password,
        });
      }
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Authentication error:', err);
      const errorMessage = err.response?.data?.detail || err.message || '认证失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSSO = (provider: string) => {
    // SSO 待开发
    alert(`SSO ${provider} 登录 - 功能开发中...`);
    console.log(`SSO ${provider} clicked - To be developed`);
  };

  return (
    <div className="min-h-screen bg-slate-950 relative flex items-center justify-center overflow-hidden">
      
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        {/* Cyber Grid */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 80%)'
          }}
        />
        {/* Floating Orbs */}
        <motion.div 
          animate={{ y: [0, 30, 0], scale: [1, 1.1, 0.9] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-500 rounded-full blur-3xl opacity-30"
        />
        <motion.div 
          animate={{ y: [0, -30, 0], scale: [1, 0.9, 1.1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: -5 }}
          className="absolute bottom-[-10%] right-[-10%] w-72 h-72 bg-emerald-500 rounded-full blur-3xl opacity-30"
        />
        <motion.div 
          animate={{ y: [0, 20, 0], scale: [1, 1.05, 0.95] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: -10 }}
          className="absolute top-[40%] left-[60%] w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-30"
        />
      </div>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
      >
        {/* Left Side: Branding (Hidden on mobile) */}
        <div className="hidden lg:flex flex-col space-y-8 p-8">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CypherGuard AI</h1>
              <p className="text-slate-400 text-sm leading-snug max-w-md">
                AI驱动的网络安全知识体系管理系统
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              融合深度学习与威胁情报，构建企业级网络安全知识图谱。实时分析、智能推理、协同防御。
            </p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-slate-900/60 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">
              {isRegisterMode ? '创建账户' : '欢迎回来'}
            </h3>
            {isRegisterMode ? null : (
              <p className="text-slate-400">登录您的 CypherGuard AI 账户</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email/Username Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                {isRegisterMode ? '邮箱' : '邮箱或用户名'}
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                <input
                  type={isRegisterMode ? 'email' : 'text'}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
                  placeholder={isRegisterMode ? "security@company.com" : "admin@company.com 或 admin"}
                  required
                />
              </div>
              {!isRegisterMode && (
                <p className="text-xs text-slate-400">可使用邮箱或用户名登录</p>
              )}
            </div>

            {/* Username Input (Register Only) */}
            {isRegisterMode && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">用户名</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
                  placeholder="your_username"
                  required
                />
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">密码</label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-4 pr-12 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
                  placeholder="••••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot (Login Only) */}
            {!isRegisterMode && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-cyan-500" />
                  <span className="text-slate-400 group-hover:text-slate-300">记住设备</span>
                </label>
                <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                  忘记密钥?
                </a>
              </div>
            )}

            {/* Security Indicator */}
            <div className="flex items-center space-x-2 py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium">AI 安全防护已激活</span>
              <Lock className="w-3 h-3 text-emerald-400 ml-auto" />
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 transform transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>验证身份中...</span>
                </>
              ) : (
                <>
                  <span>{isRegisterMode ? '创建账户' : '进入系统'}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-900/50 text-slate-500">或者使用 SSO 登录</span>
            </div>
          </div>

          {/* SSO Buttons */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Google', key: 'google' },
              { label: 'GitHub', key: 'github' },
              { label: '企业 SSO', key: 'enterprise' }
            ].map((sso) => (
              <motion.button
                key={sso.key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSSO(sso.label)}
                type="button"
                className="bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center group"
                title={`${sso.label} 登录 - 开发中`}
              >
                <span className="text-slate-300 text-sm group-hover:text-white transition-colors">
                  {sso.label}
                </span>
              </motion.button>
            ))}
          </div>

          {/* Toggle Mode */}
          <div className="text-center mt-8 text-slate-400">
            {isRegisterMode ? (
              <>
                已有账户?{' '}
                <button
                  onClick={() => { setIsRegisterMode(false); setError(null); }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  登录
                </button>
              </>
            ) : (
              <>
                没有账户?{' '}
                <button
                  onClick={() => { setIsRegisterMode(true); setError(null); }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  注册
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
