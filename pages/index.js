import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

const DEFAULT_PLATFORMS = ['IG Feed', 'IG Story', 'IG Reel', 'TikTok', 'YouTube Shorts', 'LinkedIn', 'Facebook']
const DEFAULT_UPLOADERS = ['Jane', 'Andrew', 'Adrian', 'Mike']
const TAG_COLORS = ['#e74c3c', '#8e44ad', '#2980b9', '#16a085', '#f39c12', '#d35400', '#c0392b', '#27ae60', '#34495e', '#e67e22']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ---------- date helpers (local-time safe — no UTC drift on AEST) ----------
const pad = n => String(n).padStart(2, '0')
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function weekOf(ds) { const d = parseDate(ds); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmtDate(d) }
function niceDate(ds) {
  return parseDate(ds).toLocaleDateString('en-AU',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
// Month grid, Monday-first. Leading/trailing days spill from adjacent months.
function monthGrid(y, m) {
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const days = new Date(y, m + 1, 0).getDate()
  const total = Math.ceil((offset + days) / 7) * 7
  return Array.from({ length: total }, (_, i) => new Date(y, m, i + 1 - offset))
}
// Deterministic colour per client name so tags stay consistent everywhere.
function clientColor(name) {
  let h = 0
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

export default function Home() {
  const [session, setSession] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [view, setView] = useState('calendar')          // 'calendar' | 'day' | 'list'
  const [dayCursor, setDayCursor] = useState(fmtDate(new Date()))
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [narrow, setNarrow] = useState(false)
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

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function load() {
    const { data } = await supabase.from('posts').select('*').order('post_date')
    setPosts(data || [])
    setLoading(false)
  }

  async function save(post) {
    const row = { ...post }
    let error
    if (row.id) {
      // id is GENERATED ALWAYS — Postgres rejects updates that include it,
      // so strip immutable fields before updating.
      const { id, created_at, ...fields } = row
      const res = await supabase.from('posts').update(fields).eq('id', id)
      error = res.error
    } else {
      delete row.id
      row.created_by = session?.user?.email || ''
      const res = await supabase.from('posts').insert(row)
      error = res.error
    }
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
    const all = (post.platforms || []).length > 0 && post.platforms.every(p => done.has(p))
    await supabase.from('posts').update({ done_platforms: arr, all_done: all })
      .eq('id', post.id)
    load()
  }

  if (loading) return <div style={s.center}>Loading…</div>

  const byDate = {}
  posts.forEach(p => { (byDate[p.post_date] = byDate[p.post_date] || []).push(p) })

  const knownClients = [...new Set(posts.map(p => p.client).filter(Boolean))].sort()
  const knownPeople = [...new Set([...DEFAULT_UPLOADERS,
    ...posts.map(p => p.uploader).filter(Boolean),
    ...posts.map(p => p.owner).filter(Boolean)])]

  const grouped = {}
  posts.forEach(p => {
    const wk = weekOf(p.post_date)
    ;(grouped[wk] = grouped[wk] || []).push(p)
  })

  const todayStr = fmtDate(new Date())
  const prevMonth = () => setCursor(c => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })
  const nextMonth = () => setCursor(c => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })
  const shiftDay = n => setDayCursor(d => {
    const dt = parseDate(d); dt.setDate(dt.getDate() + n); return fmtDate(dt)
  })

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={{ ...s.logo, fontSize: narrow ? 16 : 20 }}>📅 GSMR Content Calendar</h1>
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(view === 'calendar' ? s.tabOn : {}) }}
            onClick={() => setView('calendar')}>Month</button>
          <button style={{ ...s.tab, ...(view === 'day' ? s.tabOn : {}) }}
            onClick={() => setView('day')}>Day</button>
          <button style={{ ...s.tab, ...(view === 'list' ? s.tabOn : {}) }}
            onClick={() => setView('list')}>List</button>
        </div>
        <div style={s.headBtns}>
          <button style={s.addBtn} onClick={() => setEditing(blankPost())}>+ New post</button>
          <button style={s.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      {/* ---------------- CALENDAR VIEW ---------------- */}
      {view === 'calendar' && (
        <div style={s.calWrap}>
          <div style={s.calBar}>
            <button style={s.navBtn} onClick={prevMonth}>‹</button>
            <h2 style={s.calTitle}>{MONTHS[cursor.m]} {cursor.y}</h2>
            <button style={s.navBtn} onClick={nextMonth}>›</button>
            <button style={s.todayBtn}
              onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
          </div>
          <div style={s.dowRow}>{DOW.map(d => <div key={d} style={s.dow}>{d}</div>)}</div>
          <div style={s.grid}>
            {monthGrid(cursor.y, cursor.m).map((d, i) => {
              const ds = fmtDate(d)
              const inMonth = d.getMonth() === cursor.m
              const isToday = ds === todayStr
              const dayPosts = byDate[ds] || []
              return (
                <div key={i} onClick={() => { setDayCursor(ds); setView('day') }}
                  style={{ ...s.cell, minHeight: narrow ? 58 : 96,
                    background: inMonth ? '#fff' : '#eef0f3',
                    outline: isToday ? '2px solid #2c3e50' : 'none' }}>
                  <div style={{ ...s.cellNum, ...(isToday ? s.todayNum : {}),
                    color: isToday ? '#fff' : inMonth ? '#333' : '#b5bcc4' }}>
                    {d.getDate()}
                  </div>
                  {narrow ? (
                    dayPosts.length > 0 && (
                      <div style={s.dotRow}>
                        {dayPosts.slice(0, 4).map(p => (
                          <span key={p.id}
                            style={{ ...s.dot, background: clientColor(p.client),
                              opacity: p.all_done ? 0.45 : 1 }} />
                        ))}
                        {dayPosts.length > 4 &&
                          <span style={s.more}>+{dayPosts.length - 4}</span>}
                      </div>
                    )
                  ) : (
                    <>
                      {dayPosts.slice(0, 3).map(p => (
                        <div key={p.id} title={`${p.client} — ${p.title}`}
                          onClick={e => { e.stopPropagation(); setEditing(p) }}
                          style={{ ...s.pill, background: clientColor(p.client),
                            opacity: p.all_done ? 0.55 : 1 }}>
                          {p.all_done ? '✓ ' : ''}{p.trial_reel ? '🧪 ' : ''}{p.title}
                        </div>
                      ))}
                      {dayPosts.length > 3 &&
                        <div style={s.more}>+{dayPosts.length - 3} more</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <p style={s.legend}>Tap a day to open its Day view · tap a pill to edit that post · 🧪 = Trial Reel · ✓ = all platforms done</p>
        </div>
      )}

      {/* ---------------- LIST VIEW ---------------- */}
      {view === 'list' && (
        <>
          {Object.keys(grouped).length === 0 &&
            <p style={s.empty}>No posts yet — hit “+ New post” to add your first.</p>}
          {Object.entries(grouped).map(([wk, items]) => (
            <div key={wk} style={s.week}>
              <h2 style={s.weekTitle}>Week of {wk}</h2>
              {items.map(p => (
                <PostCard key={p.id} p={p} onEdit={() => setEditing(p)}
                  onDelete={() => remove(p.id)} onToggle={togglePlatform} />
              ))}
            </div>
          ))}
        </>
      )}

      {/* ---------------- DAY VIEW ---------------- */}
      {view === 'day' && (() => {
        const dayPosts = [...(byDate[dayCursor] || [])].sort((a, b) =>
          (a.uploader || '').localeCompare(b.uploader || '') ||
          (a.client || '').localeCompare(b.client || ''))
        const doneCount = dayPosts.filter(p => p.all_done).length
        return (
          <div style={s.dayWrap}>
            <div style={s.calBar}>
              <button style={s.navBtn} onClick={() => shiftDay(-1)}>‹</button>
              <h2 style={{ ...s.dayTitle, fontSize: narrow ? 15 : 18 }}>{niceDate(dayCursor)}</h2>
              <button style={s.navBtn} onClick={() => shiftDay(1)}>›</button>
              <button style={s.todayBtn} onClick={() => setDayCursor(todayStr)}>Today</button>
            </div>
            <div style={s.dayBar2}>
              <span style={s.dayCount}>
                {dayPosts.length === 0 ? 'No uploads scheduled'
                  : `${dayPosts.length} upload${dayPosts.length !== 1 ? 's' : ''} · ${doneCount} done`}
              </span>
              <button style={s.addSmall}
                onClick={() => setEditing(blankPost(dayCursor))}>+ Add post</button>
            </div>
            {dayPosts.length === 0 &&
              <p style={s.emptyDay}>Nothing on this day yet — hit “+ Add post” to schedule the first upload.</p>}
            {dayPosts.map(p => (
              <PostCard key={p.id} p={p} onEdit={() => setEditing(p)}
                onDelete={() => remove(p.id)} onToggle={togglePlatform} />
            ))}
          </div>
        )
      })()}

      {editing && <Editor post={editing} clients={knownClients} people={knownPeople}
        onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  )
}

// ---------------- shared post card (list view + day panel) ----------------
function PostCard({ p, onEdit, onDelete, onToggle }) {
  return (
    <div style={{ ...s.post, borderLeft: `5px solid ${p.all_done ? '#27ae60' : '#e67e22'}` }}>
      <div style={s.postHead}>
        <div style={{ minWidth: 0 }}>
          <span style={s.ref}>{p.post_ref}</span>
          <strong style={s.title}>{p.title}</strong>
        </div>
        <div style={s.date}>{p.post_date}</div>
      </div>
      <div style={s.tagRow}>
        <span style={{ ...s.tag, background: clientColor(p.client) }}>{p.client}</span>
        {p.owner && <span style={s.ownerTag} title="Post owner">🎬 {p.owner}</span>}
        {p.uploader && <span style={s.uploaderTag} title="Uploader">👤 {p.uploader}</span>}
        {p.trial_reel && <span style={s.trialTag}>🧪 Trial Reel</span>}
      </div>
      {p.link && <a href={p.link} style={s.link} target="_blank" rel="noreferrer">🔗 {p.link}</a>}
      {p.caption && <p style={s.caption}>{p.caption}</p>}
      <div style={s.platforms}>
        {(p.platforms || []).map(plat => {
          const done = (p.done_platforms || []).includes(plat)
          return (
            <span key={plat} onClick={() => onToggle(p, plat)}
              style={{ ...s.chip, background: done ? '#27ae60' : '#ecf0f1',
                color: done ? '#fff' : '#555' }}>
              {done ? '✓ ' : ''}{plat}
            </span>
          )
        })}
      </div>
      <div style={s.actions}>
        <button style={s.edit} onClick={onEdit}>Edit</button>
        <button style={s.del} onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

// ---------------- editor modal ----------------
function Editor({ post, clients, people, onSave, onCancel }) {
  const [p, setP] = useState(post)
  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }))
  const togglePlat = plat => {
    const cur = new Set(p.platforms || [])
    cur.has(plat) ? cur.delete(plat) : cur.add(plat)
    set('platforms', [...cur])
  }
  return (
    <div style={s.modalWrap} onClick={onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalBody}>
        <h2 style={s.modalTitle}>{p.id ? 'Edit post' : 'New post'}</h2>

        <label style={s.lbl}>Client</label>
        <input style={s.mInput} list="client-suggestions" value={p.client}
          onChange={e => set('client', e.target.value)}
          placeholder="Start typing — existing clients will suggest" />
        <datalist id="client-suggestions">
          {clients.map(c => <option key={c} value={c} />)}
        </datalist>

        <label style={s.lbl}>Title</label>
        <input style={s.mInput} value={p.title} onChange={e => set('title', e.target.value)} />

        <label style={s.lbl}>Post date</label>
        <input style={s.mInput} type="date" value={p.post_date}
          onChange={e => set('post_date', e.target.value)} />

        <label style={s.lbl}>Post owner <span style={s.hintInline}>(whose content it is)</span></label>
        <div style={s.platforms}>
          {people.map(u => (
            <span key={u} onClick={() => set('owner', p.owner === u ? '' : u)}
              style={{ ...s.chip, background: p.owner === u ? '#8e44ad' : '#ecf0f1',
                color: p.owner === u ? '#fff' : '#555' }}>
              {u}
            </span>
          ))}
        </div>
        <input style={s.mInput} value={p.owner || ''}
          onChange={e => set('owner', e.target.value)} placeholder="or type a name…" />

        <label style={s.lbl}>Uploader <span style={s.hintInline}>(who posts it)</span></label>
        <div style={s.platforms}>
          {people.map(u => (
            <span key={u} onClick={() => set('uploader', p.uploader === u ? '' : u)}
              style={{ ...s.chip, background: p.uploader === u ? '#2c3e50' : '#ecf0f1',
                color: p.uploader === u ? '#fff' : '#555' }}>
              {u}
            </span>
          ))}
        </div>
        <input style={s.mInput} value={p.uploader || ''}
          onChange={e => set('uploader', e.target.value)} placeholder="or type a name…" />

        <label style={s.lbl}>Link (optional)</label>
        <input style={s.mInput} value={p.link || ''}
          onChange={e => set('link', e.target.value)} placeholder="https://…" />

        <label style={s.lbl}>Caption (optional)</label>
        <textarea style={{ ...s.mInput, height: 60 }} value={p.caption || ''}
          onChange={e => set('caption', e.target.value)} />

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

        <div style={s.checkRow} onClick={() => set('trial_reel', !p.trial_reel)}>
          <input type="checkbox" checked={!!p.trial_reel} readOnly
            style={{ cursor: 'pointer' }} />
          <span>🧪 Post as a Trial Reel
            <span style={s.hint}> (IG tests it on non-followers first)</span></span>
        </div>

        </div>
        <div style={s.modalActions}>
          <button style={s.cancel} onClick={onCancel}>Cancel</button>
          <button style={s.saveBtn}
            onClick={() => {
              if (!p.client || !p.title || !p.post_date) {
                alert('Client, title and date are required'); return
              }
              onSave(p)
            }}>Save</button>
        </div>
      </div>
    </div>
  )
}

function blankPost(date) {
  return { client: '', title: '', post_date: date || fmtDate(new Date()),
    link: '', caption: '', platforms: ['IG Feed', 'IG Story', 'TikTok'],
    done_platforms: [], uploader: '', owner: '', trial_reel: false }
}

const s = {
  page: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui', paddingBottom: 60 },
  center: { minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui' },
  header: { background: '#1a1a2e', color: '#fff', padding: '14px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    position: 'sticky', top: 0, zIndex: 5, flexWrap: 'wrap', gap: 10 },
  logo: { margin: 0, fontSize: 20 },
  tabs: { display: 'flex', background: '#2f2f4a', borderRadius: 9, padding: 3, gap: 3 },
  tab: { background: 'transparent', color: '#bbb', border: 0, padding: '7px 16px',
    borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  tabOn: { background: '#fff', color: '#1a1a2e' },
  headBtns: { display: 'flex', gap: 8 },
  addBtn: { background: '#27ae60', color: '#fff', border: 0, padding: '10px 16px',
    borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
  signout: { background: 'transparent', color: '#aaa', border: '1px solid #444',
    padding: '10px 14px', borderRadius: 8, cursor: 'pointer' },
  empty: { textAlign: 'center', color: '#888', marginTop: 60 },

  // calendar
  calWrap: { maxWidth: 1080, margin: '20px auto', padding: '0 12px' },
  calBar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  calTitle: { margin: 0, fontSize: 20, minWidth: 170, textAlign: 'center' },
  navBtn: { background: '#fff', border: '1px solid #ddd', borderRadius: 8,
    width: 34, height: 34, fontSize: 18, cursor: 'pointer', lineHeight: 1 },
  todayBtn: { background: '#fff', border: '1px solid #ddd', borderRadius: 8,
    padding: '7px 14px', cursor: 'pointer', marginLeft: 'auto', fontWeight: 600 },
  dowRow: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 },
  dow: { textAlign: 'center', fontSize: 11, color: '#888',
    textTransform: 'uppercase', letterSpacing: 1 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 },
  cell: { minHeight: 96, borderRadius: 8, padding: 4, cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,.05)', overflow: 'hidden' },
  cellNum: { fontSize: 12, fontWeight: 600, margin: '2px 4px 4px', width: 20, height: 20,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  todayNum: { background: '#2c3e50', borderRadius: '50%' },
  pill: { color: '#fff', borderRadius: 5, padding: '2px 6px', fontSize: 10.5,
    marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  more: { fontSize: 10, color: '#888', paddingLeft: 4 },
  dotRow: { display: 'flex', flexWrap: 'wrap', gap: 3, padding: '0 3px' },
  dot: { width: 7, height: 7, borderRadius: '50%' },
  legend: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 14 },

  // list
  week: { maxWidth: 780, margin: '24px auto', padding: '0 16px' },
  weekTitle: { fontSize: 14, textTransform: 'uppercase', color: '#888', letterSpacing: 1 },

  // post card
  post: { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  postHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  ref: { background: '#eef2f5', color: '#555', padding: '2px 8px', borderRadius: 6,
    fontSize: 12, marginRight: 8, fontFamily: 'monospace' },
  title: { fontSize: 16, marginRight: 8 },
  date: { color: '#999', fontSize: 13, whiteSpace: 'nowrap' },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 0' },
  tag: { color: '#fff', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 },
  ownerTag: { background: '#f3e8fd', color: '#6d3a9e', padding: '3px 10px',
    borderRadius: 12, fontSize: 12 },
  uploaderTag: { background: '#ecf0f1', color: '#555', padding: '3px 10px',
    borderRadius: 12, fontSize: 12 },
  trialTag: { background: '#fff3cd', color: '#8a6d1a', padding: '3px 10px',
    borderRadius: 12, fontSize: 12, fontWeight: 600 },
  link: { color: '#2980b9', fontSize: 13, display: 'block', margin: '8px 0', wordBreak: 'break-all' },
  caption: { color: '#555', fontSize: 14, margin: '8px 0' },
  platforms: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' },
  chip: { padding: '5px 10px', borderRadius: 14, fontSize: 12, cursor: 'pointer', userSelect: 'none' },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
  edit: { background: '#ecf0f1', border: 0, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' },
  del: { background: '#fdecea', color: '#c0392b', border: 0, padding: '6px 14px',
    borderRadius: 6, cursor: 'pointer' },

  // modals
  modalWrap: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 10,
    overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', padding: 14 },
  modal: { background: '#fff', borderRadius: 14, width: 440, maxWidth: '100%', margin: 'auto' },
  modalBody: { padding: '20px 22px 6px' },
  modalTitle: { marginTop: 0, fontSize: 19 },
  dayWrap: { maxWidth: 780, margin: '20px auto', padding: '0 16px' },
  dayTitle: { margin: 0, fontSize: 18, flex: 1, textAlign: 'center' },
  dayBar2: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    margin: '14px 0 10px', gap: 10 },
  dayCount: { color: '#888', fontSize: 13 },
  addSmall: { background: '#27ae60', color: '#fff', border: 0, padding: '8px 14px',
    borderRadius: 8, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  emptyDay: { color: '#888' },
  lbl: { display: 'block', fontSize: 12, color: '#888', margin: '12px 0 4px',
    textTransform: 'uppercase' },
  mInput: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd',
    fontSize: 16, boxSizing: 'border-box', fontFamily: 'inherit' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 4px',
    cursor: 'pointer', fontSize: 14, userSelect: 'none' },
  hint: { color: '#999', fontSize: 12 },
  hintInline: { textTransform: 'none', color: '#aaa' },
  modalActions: { position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end',
    gap: 8, padding: '14px 22px', background: '#fff', borderTop: '1px solid #ececec',
    borderRadius: '0 0 14px 14px', marginTop: 10 },
  cancel: { background: '#ecf0f1', border: 0, padding: '12px 20px', borderRadius: 8,
    cursor: 'pointer', fontSize: 15 },
  saveBtn: { background: '#2c3e50', color: '#fff', border: 0, padding: '12px 22px',
    borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15 }
}
