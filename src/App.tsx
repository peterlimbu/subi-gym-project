
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const supabase = (supabaseUrl && supabaseAnon) ? createClient(supabaseUrl, supabaseAnon) : null;

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
];

const WEEKS = [1,2,3,4,5,6];
const goalForWeek = (week: number) => `3×${Math.min(10 + (week - 1), 15)}`;

function colorForScore(total: number) {
  if (total > 0) return '#d1fae5';
  if (total < 0) return '#fee2e2';
  return '#fef9c3';
}

async function signInOrSignUp(email: string) {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: 'https://example.com' }});
}

export default function App() {
  const [email, setEmail] = useState('');
  const [session, setSession] = useState<any>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (supabase) {
        const s = await supabase.auth.getSession();
        setSession(s.data.session);
        const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
        return () => listener.subscription.unsubscribe();
      } else {
        setSession({ user: { id: 'local' }});
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const savedPlan = await AsyncStorage.getItem('planId');
      if (savedPlan) setPlanId(savedPlan);
      const savedWeek = await AsyncStorage.getItem('activeWeek');
      if (savedWeek) setActiveWeek(Number(savedWeek));
    })();
  }, []);

  useEffect(() => { AsyncStorage.setItem('activeWeek', String(activeWeek)); }, [activeWeek]);

  useEffect(() => {
    (async () => {
      if (!session) return;
      if (!planId) {
        const id = supabase ? await ensurePlanAndSeed(supabase, session.user.id) : 'local-plan';
        setPlanId(id);
        await AsyncStorage.setItem('planId', id);
      }
    })();
  }, [session]);

  useEffect(() => {
    (async () => {
      if (!planId) return;
      if (supabase) {
        const { data } = await supabase.from('entries').select('*').eq('plan_id', planId).eq('week', activeWeek).order('day').order('exercise_index');
        setEntries(data ?? []);
      } else {
        const local = await AsyncStorage.getItem(`entries:${planId}:${activeWeek}`);
        if (local) setEntries(JSON.parse(local));
        else {
          const seeded = seedLocalWeek(activeWeek);
          setEntries(seeded);
          await AsyncStorage.setItem(`entries:${planId}:${activeWeek}`, JSON.stringify(seeded));
        }
      }
    })();
  }, [planId, activeWeek]);

  const weeklyTotal = useMemo(() => entries.reduce((sum, e) => sum + (e.status === 'Amazing' ? 1 : e.status === 'Good' ? 0 : -1), 0), [entries]);

  const grouped = useMemo(() => {
    const g = {1:[],2:[],3:[],4:[]};
    entries.forEach((e:any) => { g[e.day].push(e); });
    return g as Record<number, any[]>;
  }, [entries]);

  const updateEntry = async (e:any, patch: any) => {
    const updated = { ...e, ...patch };
    setEntries(prev => prev.map(x => x.id === e.id ? updated : x));
    if (supabase) { await supabase.from('entries').update(patch).eq('id', e.id); }
    else {
      const list = entries.map(x => x.id === e.id ? updated : x);
      await AsyncStorage.setItem(`entries:${planId}:${activeWeek}`, JSON.stringify(list));
    }
  };

  if (supabase && !session) {
    return (
      <SafeAreaView style={{ flex:1, padding:16, gap:12 }}>
        <Text style={{ fontSize:20, fontWeight:'700' }}>Sign in to save your plan</Text>
        <Text>Use your email. Both of you can sign in; data syncs across devices.</Text>
        <TextInput placeholder="email@example.com" value={email} onChangeText={setEmail} autoCapitalize='none' keyboardType='email-address' style={{ borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:12 }} />
        <TouchableOpacity onPress={() => signInOrSignUp(email)} style={{ backgroundColor:'#111', padding:14, borderRadius:10 }}>
          <Text style={{ color:'#fff', textAlign:'center', fontWeight:'700' }}>Send Magic Link</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1 }}>
      <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>
        <Text style={{ fontSize:22, fontWeight:'800', textAlign:'center' }}>Subi's Workout Plan from Peter</Text>

        <View style={{ flexDirection:'row', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap' }}>
          {WEEKS.map(w => (
            <TouchableOpacity key={w} onPress={() => setActiveWeek(w)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:10, backgroundColor: activeWeek===w ? '#111' : '#eee' }}>
              <Text style={{ color: activeWeek===w ? '#fff' : '#111', fontWeight:'700' }}>Week {w}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height:16, borderRadius:10, backgroundColor: colorForScore(weeklyTotal), borderWidth:1, borderColor:'#e5e7eb' }} />

        {[1,2,3,4].map(dayNum => (
          <View key={dayNum} style={{ borderWidth:1, borderColor:'#eee', borderRadius:14, padding:12, marginTop:12 }}>
            <Text style={{ fontWeight:'700', marginBottom:8 }}>{`Week ${activeWeek} ${DAYS[dayNum-1].name}`}</Text>
            <View style={{ flexDirection:'row', paddingVertical:6 }}>
              <Text style={{ flex:2, fontWeight:'700' }}>Exercise</Text>
              <Text style={{ flex:1, textAlign:'center', fontWeight:'700' }}>Goal</Text>
              <Text style={{ flex:1, textAlign:'center', fontWeight:'700' }}>Actual</Text>
              <Text style={{ flex:1, textAlign:'center', fontWeight:'700' }}>Weight</Text>
              <Text style={{ flex:1.2, textAlign:'center', fontWeight:'700' }}>Status</Text>
            </View>
            {grouped[dayNum]?.map((e:any, idx:number) => {
              const scoreColor = e.status === 'Amazing' ? '#d1fae5' : e.status === 'Bad' ? '#fee2e2' : '#fef9c3';
              return (
                <View key={e.id ?? idx} style={{ flexDirection:'row', alignItems:'center', paddingVertical:6, backgroundColor: scoreColor, borderRadius:8, marginBottom:6, paddingHorizontal:6 }}>
                  <Text style={{ flex:2 }}>{e.exercise}</Text>
                  <Text style={{ flex:1, textAlign:'center', fontWeight:'700' }}>{e.goal || goalForWeek(activeWeek)}</Text>
                  <TextInput value={e.actual ?? ''} onChangeText={(t)=>updateEntry(e,{actual:t})} style={{ flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:6, textAlign:'center' }}/>
                  <TextInput value={e.weight ?? ''} onChangeText={(t)=>updateEntry(e,{weight:t})} placeholder="kg" style={{ flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:6, textAlign:'center' }}/>
                  <View style={{ flex:1.2, flexDirection:'row', gap:6, justifyContent:'center' }}>
                    {(['Amazing','Good','Bad'] as const).map(s => (
                      <TouchableOpacity key={s} onPress={()=>updateEntry(e,{status:s})} style={{ paddingVertical:6, paddingHorizontal:8, borderRadius:8, backgroundColor: e.status===s ? '#111' : '#e5e7eb' }}>
                        <Text style={{ color: e.status===s ? '#fff' : '#111', fontWeight:'700', fontSize:12 }}>{s[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function seedLocalWeek(week:number) {
  const list:any[] = [];
  for (let d=1; d<=4; d++) {
    const goal = goalForWeek(week);
    DAYS[d-1].exercises.forEach((name, idx) => {
      list.push({ id: `${week}-${d}-${idx}`, plan_id: 'local-plan', week, day: d, exercise_index: idx, exercise: name, goal, actual:'', weight:'', status:'Bad' });
    });
  }
  return list;
}

async function ensurePlanAndSeed(supabase:any, userId:string) {
  const { data: plan } = await supabase.from('plans').insert({ user_id: userId }).select().single();
  const id = plan?.id || (await supabase.from('plans').select('id').eq('user_id', userId).single()).data?.id;
  for (const week of WEEKS) {
    for (let d=1; d<=4; d++) {
      const goal = goalForWeek(week);
      const rows = DAYS[d-1].exercises.map((name, idx) => ({ plan_id: id, week, day: d, exercise_index: idx, exercise: name, goal }));
      await supabase.from('entries').upsert(rows, { onConflict: 'plan_id,week,day,exercise_index' });
    }
  }
  return id;
}
