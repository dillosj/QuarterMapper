import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import FieldMapper from './FieldMapper'
import { LOGO } from './logo'

const EMAIL_DOMAIN = '@quartermapper.app'
const T = {
  green: "#2F7D32", greenLt: "#A5D6A7",
  blue: "#1E3A8A", blueLt: "#93C5FD",
  bg: "#F8FAFC", srf: "#FFFFFF", bdr: "#E5E7EB",
  txt: "#111827", mut: "#6B7280",
  err: "#DC2626",
}
const FF = "'Inter',ui-sans-serif,system-ui,sans-serif"
const FD = "'Poppins',ui-sans-serif,system-ui,sans-serif"

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: FF, color: T.mut }}>Loading...</div>

  if (!session) return <LoginScreen />

  return <FieldMapper session={session} />
}

function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    const uname = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!uname) { setError('Username can only contain letters, numbers, and underscores.'); return }

    const email = uname + EMAIL_DOMAIN
    setBusy(true)
    setError('')

    // Try login first
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
    if (!loginErr) { setBusy(false); return }

    // If invalid credentials, try registering
    if (loginErr.message.includes('Invalid login credentials')) {
      const { error: signupErr } = await supabase.auth.signUp({ email, password })
      if (signupErr) {
        setError(signupErr.message)
        setBusy(false)
        return
      }
      // Auto-login after signup
      const { error: loginErr2 } = await supabase.auth.signInWithPassword({ email, password })
      if (loginErr2) {
        setError('Account created but could not log in. Try again.')
      }
      setBusy(false)
      return
    }

    setError(loginErr.message)
    setBusy(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FF, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <img src={LOGO} alt="QuarterMapper" style={{ height: 160, marginBottom: 8 }} />
        <p style={{ color: T.mut, fontSize: 14, marginBottom: 24 }}>Sign in or create an account</p>

        <form onSubmit={handleSubmit} style={{ background: T.srf, border: "1px solid " + T.bdr, borderRadius: 12, padding: "28px 24px", textAlign: "left" }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 6 }}>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="e.g. johnny"
            autoComplete="username"
            style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.bdr, borderRadius: 8, fontSize: 14, fontFamily: FF, outline: "none", marginBottom: 16, boxSizing: "border-box" }} />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 6 }}>Password</label>
          <input value={password} onChange={e => setPassword(e.target.value)}
            type="password"
            placeholder="At least 6 characters"
            autoComplete="current-password"
            style={{ width: "100%", padding: "10px 14px", border: "1px solid " + T.bdr, borderRadius: 8, fontSize: 14, fontFamily: FF, outline: "none", marginBottom: 20, boxSizing: "border-box" }} />

          {error && <div style={{ color: T.err, fontSize: 13, marginBottom: 14, fontWeight: 500 }}>{error}</div>}

          <button type="submit" disabled={busy}
            style={{ width: "100%", padding: "12px", background: T.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, fontFamily: FF, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Working..." : "Sign In"}
          </button>

          <p style={{ textAlign: "center", color: T.mut, fontSize: 12, marginTop: 14 }}>
            New username? We'll create your account automatically.
          </p>
        </form>
      </div>
    </div>
  )
}
