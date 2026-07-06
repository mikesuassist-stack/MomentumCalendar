import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

const DEFAULT_PLATFORMS = ['IG Feed', 'IG Story', 'IG Reel', 'TikTok', 'YouTube Shorts', 'LinkedIn', 'Facebook']

export default function Home() {
  const [session, setSession] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
      else { setSession(data.session); load() }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) router.push('/login')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*').order('post_date')
    setPosts(data || [])
    setLoading(false)
  }

  async function save(post) {
    const row = { ...post }
    if (!row.id) {
      row.created_by = session?.user?.email || ''
      delete row.id
    }
    const { error } = row.id
      ? await supabase.from('posts').update(row).eq('id', row.id)
      : await supabase.from('posts').insert(row)
    if (error) alert(error.message)
    else { setEditing(null); load() }
  }

  async function remove(id) {
    if (!confirm('Delete this post?')) return
    await supabase.from('posts').delete().eq('id', id)
    load()
  }

  async function togglePlatform(post, plat) {
    const done = new Set(post.done_platforms || [])
    done.has(plat) ? done.delete(plat) : done.add(plat)
    const arr = [...done]
    const all = (post.platforms || []).every(p => done.has(p))
    await supabase.from('posts').update({ done_platforms: arr, all_done: all })
      .eq('id', post.id)
    load()
  }

  if (loading) return <div style={s.center}>Loading…</div>

  const grouped = {}
  posts.forEach(p => {
    const wk = weekOf(p.post_date)
    ;(grouped[wk] = grouped[wk] || []).push(p)
  })

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.logo}>📅 GSMR Content Calendar</h1>
        <div>
          <button style={s.addBtn} onClick={() => setEditing(blankPost())}>+ New post</button>
          <button style={s.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      {Object.keys(grouped).length === 0 &&
        <p style={s.empty}>No posts yet — hit “+ New post” to add your first.</p>}

      {Object.entries(grouped).map(([wk, items]) => (
        <div key={wk} style={s.week}>
          <h2 style={s.weekTitle}>Week of {wk}</h2>
          {items.map(p => (
            <div key={p.id} style={{ ...s.post, borderLeft: `5px solid ${p.all_done ? '#27ae60' : '#e67e22'}` }}>
              <div style={s.postHead}>
                <div>
                  <span style={s.ref}>{p.post_ref}</span>
                  <strong style={s.title}>{p.title}</strong>
                  <span style={s.client}>{p.client}</span>
                </div>
                <div style={s.date}>{p.post_date}</div>
              </div>
              {p.link && <a href={p.link} style={s.link} target="_blank" rel="noreferrer">🔗 {p.link}</a>}
              {p.caption && <p style={s.caption}>{p.caption}</p>}
              <div style={s.platforms}>
                {(p.platforms || []).map(plat => {
                  const done = (p.done_platforms || []).includes(plat)
                  return (
                    <span key={plat} onClick={() => togglePlatform(p, plat)}
                      style={{ ...s.chip, background: done ? '#27ae60' : '#ecf0f1',
                        color: done ? '#fff' : '#555' }}>
                      {done ? '✓ ' : ''}{plat}
                    </span>
                  )
                })}
              </div>
              <div style={s.actions}>
                <button style={s.edit} onClick={() => setEditing(p)}>Edit</button>
                <button style={s.del} onClick={() => remove(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {editing && <Editor post={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  )
}

function Editor({ post, onSave, onCancel }) {
  const [p, setP] = useState(post)
  const set = (k, v) => setP({ ...p, [k]: v })
  const togglePlat = plat => {
    const cur = new Set(p.platforms || [])
    cur.has(plat) ? cur.delete(plat) : cur.add(plat)
    set('platforms', [...cur])
  }
  return (
    <div style={s.modalWrap} onClick={onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <h2 style={s.modalTitle}>{p.id ? 'Edit post' : 'New post'}</h2>
        <label style={s.lbl}>Client</label>
        <input style={s.mInput} value={p.client} onChange={e => set('client', e.target.value)} />
        <label style={s.lbl}>Title</label>
        <input style={s.mInput} value={p.title} onChange={e => set('title', e.target.value)} />
        <label style={s.lbl}>Post date</label>
        <input style={s.mInput} type="date" value={p.post_date} onChange={e => set('post_date', e.target.value)} />
        <label style={s.lbl}>Link (optional)</label>
        <input style={s.mInput} value={p.link || ''} onChange={e => set('link', e.target.value)} placeholder="https://…" />
        <label style={s.lbl}>Caption (optional)</label>
        <textarea style={{ ...s.mInput, height: 60 }} value={p.caption || ''} onChange={e => set('caption', e.target.value)} />
        <label style={s.lbl}>Platforms</label>
        <div style={s.platforms}>
          {DEFAULT_PLATFORMS.map(plat => (
            <span key={plat} onClick={() => togglePlat(plat)}
              style={{ ...s.chip, cursor: 'pointer',
                background: (p.platforms || []).includes(plat) ? '#2c3e50' : '#ecf0f1',
                color: (p.platforms || []).includes(plat) ? '#fff' : '#555' }}>
              {plat}
            </span>
          ))}
        </div>
        <div style={s.modalActions}>
          <button style={s.cancel} onClick={onCancel}>Cancel</button>
          <button style={s.saveBtn}
            onClick={() => {
              if (!p.client || !p.title || !p.post_date) { alert('Client, title and date are required'); return }
              onSave(p)
            }}>Save</button>
        </div>
      </div>
    </div>
  )
}

function blankPost() {
  return { client: '', title: '', post_date: new Date().toISOString().slice(0, 10),
    link: '', caption: '', platforms: ['IG Feed', 'IG Story', 'TikTok'], done_platforms: [] }
}
function weekOf(dateStr) {
  const d = new Date(dateStr); const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10)
}

const s = {
  page: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui', paddingBottom: 60 },
  center: { minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' },
  header: { background: '#1a1a2e', color: '#fff', padding: '16px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 5 },
  logo: { margin: 0, fontSize: 20 },
  addBtn: { background: '#27ae60', color: '#fff', border: 0, padding: '10px 16px',
    borderRadius: 8, cursor: 'pointer', fontWeight: 600, marginRight: 8 },
  signout: { background: 'transparent', color: '#aaa', border: '1px solid #444',
    padding: '10px 14px', borderRadius: 8, cursor: 'pointer' },
  empty: { textAlign: 'center', color: '#888', marginTop: 60 },
  week: { maxWidth: 780, margin: '24px auto', padding: '0 16px' },
  weekTitle: { fontSize: 14, textTransform: 'uppercase', color: '#888', letterSpacing: 1 },
  post: { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  postHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  ref: { background: '#eef2f5', color: '#555', padding: '2px 8px', borderRadius: 6,
    fontSize: 12, marginRight: 8, fontFamily: 'monospace' },
  title: { fontSize: 16, marginRight: 8 },
  client: { color: '#2980b9', fontSize: 13 },
  date: { color: '#999', fontSize: 13 },
  link: { color: '#2980b9', fontSize: 13, display: 'block', margin: '8px 0', wordBreak: 'break-all' },
  caption: { color: '#555', fontSize: 14, margin: '8px 0' },
  platforms: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' },
  chip: { padding: '5px 10px', borderRadius: 14, fontSize: 12, cursor: 'pointer', userSelect: 'none' },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
  edit: { background: '#ecf0f1', border: 0, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' },
  del: { background: '#fdecea', color: '#c0392b', border: 0, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' },
  modalWrap: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'grid', placeItems: 'center', zIndex: 10, padding: 16 },
  modal: { background: '#fff', borderRadius: 14, padding: 24, width: 440, maxWidth: '100%',
    maxHeight: '90vh', overflow: 'auto' },
  modalTitle: { marginTop: 0 },
  lbl: { display: 'block', fontSize: 12, color: '#888', margin: '12px 0 4px', textTransform: 'uppercase' },
  mInput: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd',
    fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  cancel: { background: '#ecf0f1', border: 0, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' },
  saveBtn: { background: '#2c3e50', color: '#fff', border: 0, padding: '10px 18px',
    borderRadius: 8, cursor: 'pointer', fontWeight: 600 }
}
