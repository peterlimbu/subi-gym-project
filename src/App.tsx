
import React, { useEffect, useMemo, useState } from 'react'
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
const supabaseUrl = 'https://gibsfeesfqtpkboogscf.supabase.co'
const supabaseAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpYnNmZWVzZnF0cGtib29nc2NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NjQ3NjUsImV4cCI6MjA3MDQ0MDc2NX0.uwl3HFQPY2QKJxcIyKCBAN5LQK9ZfyA9NDrXA1NhlxA'
const baseUrl = window.location.origin
const supabase = createClient(supabaseUrl, supabaseAnon)

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
function loadLocal(): State {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : createEmpty() } catch { return createEmpty() }
}
function saveLocal(s:State){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

async function getOrCreatePlanId(){
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
  const [state,setState] = useState<State>(()=>loadLocal())
  const [week,setWeek] = useState<number>(1)
  const [email,setEmail] = useState('')
  const [online,setOnline] = useState<boolean>(navigator.onLine)

  useEffect(()=>{ saveLocal(state) },[state])
  useEffect(()=>{
    const on = ()=>setOnline(true), off=()=>setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return ()=>{ window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  async function loadFromCloud(){
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    const planId = await getOrCreatePlanId();
    if (!planId) return;
    const { data, error } = await supabase
      .from('entries')
      .select('week, day, exercise_index, exercise, goal, actual, weight, status')
      .eq('plan_id', planId)
      .order('week')
      .order('day')
      .order('exercise_index');
    if (error || !data) { return; }
    setState(prev => {
      const next = { ...prev }
      data.forEach(row => {
        const w = row.week as number
        const di = (row.day as number) - 1
        const ei = row.exercise_index as number
        if (!next.weeks[w]) next.weeks[w] = {} as any
        if (!next.weeks[w][di]) next.weeks[w][di] = {} as any
        const entry = next.weeks[w][di][ei] || { actual:'', weight:'', status:'Bad' as Status }
        next.weeks[w][di][ei] = {
          actual: row.actual ?? entry.actual,
          weight: row.weight ?? entry.weight,
          status: (row.status ?? entry.status) as Status
        }
      })
      return next
    })
  }

  useEffect(()=>{ loadFromCloud() },[])

  const total = useMemo(()=>{
    let sum=0
    DAYS.forEach((_,di)=>DAYS[di].exercises.forEach((__,ei)=>{
      const st = state.weeks[week][di][ei].status
      sum += st==='Amazing'?1: st==='Bad'?-1:0
    }))
    return sum
  },[state,week])
  const barColor = total>0?'var(--green)': total<0?'var(--red)':'var(--yellow)'

  async function cloudLogin(){
    const { data: auth } = await supabase.auth.getUser()
    if (auth?.user) { await loadFromCloud(); return }
    const em = email || window.prompt('Email for magic link?') || ''
    if(!em) return
    await supabase.auth.signInWithOtp({ email: em, options: { emailRedirectTo: `${baseUrl}/` } })
    alert('Magic link sent. Open it, then reload this page.')
  }

  async function saveEntry(w:number, di:number, ei:number){
    const e = state.weeks[w][di][ei]
    try {
      const planId = await getOrCreatePlanId()
      if (!planId) return
      await supabase.from('entries').upsert([{
        plan_id: planId,
        week: w,
        day: di+1,
        exercise_index: ei,
        exercise: DAYS[di].exercises[ei],
        goal: goalForWeek(w),
        actual: e.actual,
        weight: e.weight,
        status: e.status
      }], { onConflict: 'plan_id,week,day,exercise_index' })
    } catch(e) { /* swallow */ }
  }

  function updateEntry(w:number, di:number, ei:number, patch: Partial<Entry>){
    setState(prev => {
      const next = { ...prev }
      const weekState = { ...(next.weeks[w] || {}) }
      const dayState  = { ...(weekState[di] || {}) }
      const entry     = { ...(dayState[ei] || { actual:'', weight:'', status:'Bad' as Status }) }
      Object.assign(entry, patch)
      dayState[ei] = entry
      weekState[di] = dayState
      next.weeks = { ...next.weeks, [w]: weekState }
      return next
    })
  }

  function FieldRow({di,ei,label}:{di:number,ei:number,label:string}){
    const e = state.weeks[week][di][ei]
    const scoreColor = e.status==='Amazing'?'var(--green)':e.status==='Bad'?'var(--red)':'var(--yellow)'
    const inputStyle:React.CSSProperties = { padding:10, border:'1px solid var(--border)', borderRadius:10, textAlign:'center', minHeight:'var(--touch)' }
    return (
      <div className="row" style={{background:scoreColor}}>
        <div className="col-ex">{label}</div>
        <div className="col"><span className="pill"><b>{goalForWeek(week)}</b></span></div>
        <div className="col">
          <input
            value={e.actual}
            onChange={(ev:any)=>updateEntry(week,di,ei,{ actual: ev.target.value })}
            onBlur={()=>saveEntry(week,di,ei)}
            style={inputStyle} />
        </div>
        <div className="col">
          <input
            value={e.weight}
            placeholder="kg"
            onChange={(ev:any)=>updateEntry(week,di,ei,{ weight: ev.target.value })}
            onBlur={()=>saveEntry(week,di,ei)}
            style={inputStyle} />
        </div>
        <div className="col">
          <select
            value={e.status}
            onChange={(ev:any)=>{ updateEntry(week,di,ei,{ status: ev.target.value as Status }); }}
            onBlur={()=>saveEntry(week,di,ei)}
            style={{ padding:10, border:'1px solid var(--border)', borderRadius:10, minHeight:'var(--touch)' }}>
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
        <input placeholder="email (magic link)" value={email} onChange={e=>setEmail(e.target.value)} style={{ padding:10, border:'1px solid var(--border)', borderRadius:10, minHeight:'var(--touch)' }} />
        <button className="btn" onClick={cloudLogin}>Cloud Login</button>
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
        </div>
      </div>
    </div>
  )
}
