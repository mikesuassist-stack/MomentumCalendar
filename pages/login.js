import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [mode, setMode] = useState('signin')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/')
    })
  }, [])

  async function submit() {
    setMsg('')
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword
      : supabase.auth.signUp
    const { error } = await fn({ email, password })
    if (error) setMsg(error.message)
    else if (mode === 'signup') setMsg('Account created — you can sign in now.')
    else router.push('/')
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.h1}>GSMR Content Calendar</h1>
        <p style={s.sub}>{mode === 'signin' ? 'Sign in' : 'Create your account'}</p>
        <input style={s.input} placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} />
        <input style={s.input} type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        <button style={s.btn} onClick={submit}>
          {mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        {msg && <p style={s.msg}>{msg}</p>}
        <p style={s.toggle} onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? "Need an account? Sign up" : 'Have an account? Sign in'}
        </p>
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#1a1a2e', fontFamily: 'system-ui' },
  card: { background: '#fff', padding: 40, borderRadius: 16, width: 340,
    boxShadow: '0 20px 60px rgba(0,0,0,.3)' },
  h1: { fontSize: 22, margin: '0 0 4px', color: '#1a1a2e' },
  sub: { color: '#666', margin: '0 0 24px', fontSize: 14 },
  input: { width: '100%', padding: 12, marginBottom: 12, borderRadius: 8,
    border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box' },
  btn: { width: '100%', padding: 12, background: '#2c3e50', color: '#fff',
    border: 0, borderRadius: 8, fontSize: 15, cursor: 'pointer', fontWeight: 600 },
  msg: { color: '#c0392b', fontSize: 13, marginTop: 12 },
  toggle: { color: '#2980b9', fontSize: 13, marginTop: 16, cursor: 'pointer',
    textAlign: 'center' }
}
