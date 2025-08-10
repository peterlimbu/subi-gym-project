
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const DAYS = [
  { name: 'Day 1 – Glutes/Quads', exercises: [
    'Dumbbell Goblet Squat',
    'Dumbbell Step-Ups (onto bench)',
    'Bulgarian Split Squat',
    'Cable Kickbacks',
    'Glute Bridge (dumbbell on hips)'
  ]},
  { name: 'Day 2 – Chest/Posture', exercises: [
    'Incline Dumbbell Chest Press',
    'Cable Face Pull',
    'Dumbbell Lateral Raise',
    'Cable Tricep Rope Pushdown',
    'Plank Hold (seconds)'
  ]},
  { name: 'Day 3 – Glutes/Hamstrings', exercises: [
    'Hip Thrust (dumbbell on hips)',
    'Dumbbell Romanian Deadlift (RDL)',
    'Curtsy Lunge',
    'Cable Pull-Through',
    'Cable Hip Abduction'
  ]},
  { name: 'Day 4 – Chest/Arms/Core', exercises: [
    'Flat Dumbbell Chest Press',
    'One-Arm Dumbbell Row',
    'Dumbbell Bicep Curl',
    'Dumbbell Shoulder Press',
    'Side Plank (seconds)'
  ]}
]
const WEEKS = [1,2,3,4,5,6] as const
const goalForWeek = (w:number) => `3×${Math.min(10 + (w-1), 15)}`
type Status = 'Amazing' | 'Good' | 'Bad'

type Entry = { actual:string; weight:string; status: Status }
type WeekState = { [dayIdx:number]: { [exerciseIdx:number]: Entry } }
type State = { title:string; weeks: { [w:number]: WeekState } }

const STORAGE_KEY = 'mewtwo.web.v1'
const QUEUE_KEY = 'mewtwo.queue.v1'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const baseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) || window.location.origin
const supabase = (supabaseUrl && supabaseAnon) ? createClient(supabaseUrl, supabaseAnon) : null

function createEmpty(): State {
  const weeks:any = {}
  WEEKS.forEach(w=>{
    const wk:any = {}
    DAYS.forEach((d,di)=>{
      const day:any = {}
      d.exercises.forEach((_,ei)=> day[ei] = { actual:'', weight:'', status:'Bad' as Status })
      wk[di] = day
    })
    weeks[w] = wk
  })
  return { title: "Subi's Workout Plan from Peter", weeks }
}
function load(): State {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : createEmpty() } catch { return createEmpty() }
}
function saveLocal(s:State){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }
function loadQueue(){ try{ return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')}catch{return []} }
function saveQueue(q:any[]){ localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) }

function useDebounce(callback:(...a:any[])=>void, delay:number){
  const t = useRef<any>(null)
  return (...a:any[]) => {
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(() => callback(...a), delay)
  }
}

async function getOrCreatePlanId(){
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  const { data: existing } = await supabase
    .from('plans')
    .select('id')
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('plans')
    .insert({ user_id: uid })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

export default function App(){
  const [state,setState] = useState<State>(()=>load())
  const [week,setWeek] = useState<number>(1)
  const [email,setEmail] = useState('')
  const [online,setOnline] = useState<boolean>(navigator.onLine)

  useEffect(()=>{ saveLocal(state) },[state])
  useEffect(()=>{
    const on = ()=>setOnline(true), off=()=>setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return ()=>{ window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const total = useMemo(()=>{
    let sum=0
    DAYS.forEach((_,di)=>DAYS[di].exercises.forEach((__,ei)=>{
      const st = state.weeks[week][di][ei].status
      sum += st==='Amazing'?1: st==='Bad'?-1:0
    }))
    return sum
  },[state,week])
  const barColor = total>0?'var(--green)': total<0?'var(--red)':'var(--yellow)'

  async function flushQueue(){
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return
    const planId = await getOrCreatePlanId()
    if (!planId) return

    const q = loadQueue()
    if (!q.length) return

    const latest = new Map<string, any>()
    for (const it of q) latest.set(it.key, it)
    const rows = Array.from(latest.values()).map((it:any)=> ({
      plan_id: planId, week: it.week, day: it.day, exercise_index: it.exercise_index,
      exercise: it.exercise, goal: goalForWeek(it.week), actual: it.actual, weight: it.weight, status: it.status
    }))
    const { error } = await supabase.from('entries').upsert(rows, { onConflict:'plan_id,week,day,exercise_index' })
    if (!error) saveQueue([])
  }

  async function cloudLogin(){
    if(!supabase){ alert('Cloud sync is optional. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your host to enable.'); return }
    const { data: auth } = await supabase.auth.getUser()
    if (auth?.user) { await flushQueue(); return }
    const em = email || window.prompt('Email for magic link?') || ''
    if(!em) return
    await supabase.auth.signInWithOtp({ email: em, options: { emailRedirectTo: `${baseUrl}/` } })
    alert('Magic link sent. Open it, then reload this page.')
  }

  // stable state update helper to avoid excessive re-renders & input blur on mobile
  function updateEntry(week:number, di:number, ei:number, patch: Partial<Entry>){
    setState(prev => {
      const next = { ...prev }
      const weekState = { ...(next.weeks[week] || {}) }
      const dayState  = { ...(weekState[di] || {}) }
      const entry     = { ...(dayState[ei] || { actual:'', weight:'', status:'Bad' as Status }) }
      Object.assign(entry, patch)
      dayState[ei] = entry
      weekState[di] = dayState
      next.weeks = { ...next.weeks, [week]: weekState }
      return next
    })
  }

  const saveEntry = useDebounce(async (week:number, di:number, ei:number) => {
    const e = state.weeks[week][di][ei]
    const exercise = DAYS[di].exercises[ei]
    const item = { key:`${week}-${di}-${ei}`, week, day: di+1, exercise_index: ei, exercise,
      actual: e.actual, weight: e.weight, status: e.status }
    const q = loadQueue(); q.push(item); saveQueue(q)
    if (online && supabase) await flushQueue()
  }, 350)

  function FieldRow({di,ei,label}:{di:number,ei:number,label:string}){
    const e = state.weeks[week][di][ei]
    const scoreColor = e.status==='Amazing'?'var(--green)':e.status==='Bad'?'var(--red)':'var(--yellow)'
    const inputStyle:React.CSSProperties = { padding:10, border:'1px solid var(--border)', borderRadius:10, textAlign:'center', minHeight:'var(--touch)' }
    return (
      <div className="row" style={{background:scoreColor}}>
        <div className="col-ex">{label}</div>
        <div className="col"><span className="pill"><b>{goalForWeek(week)}</b></span></div>
        <div className="col"><input value={e.actual} onInput={(ev:any)=>{
          updateEntry(week,di,ei,{ actual: ev.target.value }); saveEntry(week,di,ei);
        }} style={inputStyle} /></div>
        <div className="col"><input value={e.weight} placeholder="kg" onInput={(ev:any)=>{
          updateEntry(week,di,ei,{ weight: ev.target.value }); saveEntry(week,di,ei);
        }} style={inputStyle} /></div>
        <div className="col">
          <select value={e.status} onChange={(ev:any)=>{
            updateEntry(week,di,ei,{ status: ev.target.value as Status }); saveEntry(week,di,ei);
          }} style={{ padding:10, border:'1px solid var(--border)', borderRadius:10, minHeight:'var(--touch)' }}>
            <option>Amazing</option>
            <option>Good</option>
            <option>Bad</option>
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>{state.title}</h1>
      <div className="toolbar">
        <div className="seg">
          {WEEKS.map(w=> <div key={w} className={"chip "+(w===week?'active':'')} onClick={()=>setWeek(w)}>Week {w}</div>)}
        </div>
        <button className="btn" onClick={()=>{ const next=createEmpty(); setState(next) }}>Reset All</button>
        <button className="btn" onClick={()=>{ const a=document.createElement('a'); a.href='data:application/json,'+encodeURIComponent(JSON.stringify(state)); a.download='mewtwo.json'; a.click(); }}>Export JSON</button>
        <button className="btn" onClick={()=>{
          const el=document.createElement('input'); el.type='file'; el.accept='application/json'; el.onchange=(e:any)=>{
            const f=e.target.files[0]; const r=new FileReader(); r.onload=()=>{ try{ setState(JSON.parse(String(r.result))); }catch{ alert('Bad JSON') }}; r.readAsText(f);
          }; el.click();
        }}>Import JSON</button>
        <button className="btn" onClick={()=>window.print()}>Print</button>
        <span className="badge">{navigator.onLine ? 'Online' : 'Offline'}</span>
        <button className="btn" onClick={cloudLogin}>Cloud Login / Sync</button>
      </div>

      <div className="bar" style={{background:barColor}}></div>

      <div className="grid">
        {DAYS.map((d,di)=>(
          <div key={d.name} className="card">
            <h3>{`Week ${week} ${d.name}`}</h3>
            <div className="row head">
              <div className="col-ex">Exercise</div>
              <div className="col">Goal</div>
              <div className="col">Actual</div>
              <div className="col">Weight</div>
              <div className="col">Status</div>
            </div>
            {d.exercises.map((ex,ei)=>(
              <FieldRow key={ex} di={di} ei={ei} label={ex} />
            ))}
          </div>
        ))}
      </div>

      <div className="footer">
        <div className="diag">
          <div><b>Diagnostics</b></div>
          <div>Supabase URL present: <code>{String(!!supabaseUrl)}</code></div>
          <div>Supabase anon key present: <code>{String(!!supabaseAnon)}</code></div>
          <div>Cloud client enabled: <code>{String(!!supabase)}</code></div>
          <div>App Base URL: <code>{baseUrl}</code></div>
          <div>Online: <code>{String(online)}</code></div>
        </div>
      </div>
    </div>
  )
}
