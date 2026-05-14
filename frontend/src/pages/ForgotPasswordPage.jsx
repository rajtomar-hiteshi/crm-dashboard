import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import api from '../api/api'

export default function ForgotPasswordPage() {
  const { isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-[#0F172A]' : 'bg-[#F1F5F9]'}`}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo.svg" alt="Hiteshi" className="w-12 h-12 rounded-xl" />
          <div>
            <h1 className={`text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Hiteshi CRM</h1>
            <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Dashboard</p>
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{
          background: isDark ? '#1E293B' : '#FFFFFF',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0',
          boxShadow: isDark ? '0 25px 50px -12px rgba(0,0,0,0.5)' : '0 25px 50px -12px rgba(0,0,0,0.1)',
        }}>
          {sent ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Check Your Email</h2>
              <p className={`text-sm mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>
                If <strong className={isDark ? 'text-white' : 'text-[#0F172A]'}>{email}</strong> is registered, we've sent a password reset link.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Forgot Password</h2>
              <p className={`text-sm mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Enter your email and we'll send a reset link</p>

              {error && (
                <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>Email</label>
                  <div className="relative">
                    <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-[#475569]' : 'text-[#94A3B8]'}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@hiteshi.com"
                      required
                      className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors ${
                        isDark
                          ? 'bg-[#0F172A] border border-[#334155] text-white placeholder-[#475569]'
                          : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8]'
                      }`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
