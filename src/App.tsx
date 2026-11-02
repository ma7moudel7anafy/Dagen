import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
const today = () => new Date().toISOString().slice(0, 10)
const days = (a: string, b = today()) => Math.floor((+new Date(b) - +new Date(a)) / 864e5) + 1
const F = ({ l, children }: any) => <label>{l}{children}</label>

export default function App() {
  const [s, setS] = useState<any>(undefined)
  const [cid, setCid] = useState<string | null>(null)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setS(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, x) => setS(x))
    return () => data.subscription.unsubscribe()
  }, [])
  if (s === undefined) return <div className="wrap">جاري التحميل...</div>
  if (!s) return <Auth />
  return <div className="wrap">{cid ? <Cycle id={cid} back={() => setCid(null)} /> : <Cycles open={setCid} />}</div>
}

function Auth() {
  const [up, setUp] = useState(false)
  const [f, setF] = useState({ email: '', password: '', name: '' })
  const [msg, setMsg] = useState('')
  const go = async () => {
    setMsg('')
    const r = up
      ? await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name } } })
      : await sb.auth.signInWithPassword({ email: f.email, password: f.password })
    if (r.error) setMsg(r.error.message)
    else if (up && !r.data.session) setMsg('تم إنشاء الحساب. افتح الإيميل لتأكيده ثم سجّل الدخول.')
  }
  return (
    <div className="wrap"><h1>دورات الدواجن</h1>
      <div className="card">
        <h2>{up ? 'إنشاء حساب' : 'تسجيل الدخول'}</h2>
        {up && <F l="الاسم"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></F>}
        <F l="الإيميل"><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></F>
        <F l="كلمة المرور"><input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></F>
        <p className="err">{msg}</p>
        <button onClick={go}>{up ? 'إنشاء الحساب' : 'دخول'}</button>{' '}
        <button className="sec" onClick={() => setUp(!up)}>{up ? 'عندي حساب' : 'حساب جديد'}</button>
      </div>
    </div>
  )
}

function Cycles({ open }: any) {
  const [p, setP] = useState<any>(null)
  const [list, setList] = useState<any[]>([])
  const [show, setShow] = useState(false)
  const [f, setF] = useState<any>({ start_date: today() })
  const [err, setErr] = useState('')
  const load = async () => {
    const { data: u } = await sb.auth.getUser()
    setP((await sb.from('profiles').select('*').eq('id', u.user!.id).single()).data)
    setList((await sb.from('cycles').select('*').order('start_date', { ascending: false })).data || [])
  }
  useEffect(() => { load() }, [])
  const create = async () => {
    setErr('')
    const { data, error } = await sb.rpc('create_cycle', {
      p_name: f.name, p_house_name: f.house || null, p_breed: f.breed || null, p_start_date: f.start_date,
      p_chick_count: +f.count, p_chick_source: f.source || null, p_chick_unit_price: f.price ? +f.price : null, p_notes: null,
    })
    if (error) return setErr(error.message.includes('NO_CREDITS') ? 'رصيد الدورات خلص. تواصل معنا لإضافة دورات.' : error.message)
    open(data)
  }
  return (<>
    <div className="bar"><h1>دوراتي</h1><button className="sec" onClick={() => sb.auth.signOut()}>خروج</button></div>
    <div className="card bar"><div><b>{p?.cycle_credits ?? 0}</b> دورة متبقية في اشتراكك</div>
      <button onClick={() => setShow(!show)}>دورة جديدة</button></div>
    {show && <div className="card">
      <div className="row">
        <F l="اسم الدورة"><input onChange={e => setF({ ...f, name: e.target.value })} /></F>
        <F l="العنبر"><input onChange={e => setF({ ...f, house: e.target.value })} /></F>
        <F l="السلالة"><input onChange={e => setF({ ...f, breed: e.target.value })} /></F>
        <F l="تاريخ التسكين"><input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} /></F>
        <F l="عدد الكتاكيت"><input type="number" onChange={e => setF({ ...f, count: e.target.value })} /></F>
        <F l="سعر الكتكوت"><input type="number" onChange={e => setF({ ...f, price: e.target.value })} /></F>
        <F l="مصدر الكتاكيت"><input onChange={e => setF({ ...f, source: e.target.value })} /></F>
      </div>
      <p className="err">{err}</p>
      <button disabled={!f.name || !f.count} onClick={create}>بدء الدورة (تخصم دورة من رصيدك)</button>
    </div>}
    {list.length === 0 && <div className="card">لا توجد دورات بعد. اضغط "دورة جديدة" لتسجيل أول دورة.</div>}
    {list.map(c => <div key={c.id} className="card list" onClick={() => open(c.id)}>
      <div className="bar"><h3>{c.name}</h3><span className={'badge ' + (c.status === 'closed' ? 'c' : '')}>{c.status === 'closed' ? 'مقفولة' : 'نشطة'}</span></div>
      <span>{c.chick_count} كتكوت · تسكين {c.start_date} · اليوم {days(c.start_date, c.end_date || today())}</span>
    </div>)}
  </>)
}

function Cycle({ id, back }: any) {
  const [c, setC] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [ev, setEv] = useState<any[]>([])
  const [tab, setTab] = useState('sum')
  const [l, setL] = useState<any>({ log_date: today(), mortality: 0 })
  const [h, setH] = useState<any>({ event_date: today(), event_type: 'vaccine' })
  const load = async () => {
    setC((await sb.from('cycles').select('*').eq('id', id).single()).data)
    setLogs((await sb.from('daily_logs').select('*').eq('cycle_id', id).order('log_date', { ascending: false })).data || [])
    setEv((await sb.from('health_events').select('*').eq('cycle_id', id).order('event_date', { ascending: false })).data || [])
  }
  useEffect(() => { load() }, [id])
  if (!c) return <div>جاري التحميل...</div>
  const open = c.status === 'active'
  const dead = logs.reduce((a, x) => a + x.mortality, 0)
  const feed = logs.reduce((a, x) => a + (+x.feed_kg || 0), 0)
  const uid = async () => (await sb.auth.getUser()).data.user!.id
  const ok = (e: any) => e ? alert(e.message) : load()
  const saveLog = async () => ok((await sb.from('daily_logs').upsert({
    cycle_id: id, user_id: await uid(), log_date: l.log_date, mortality: +l.mortality || 0,
    feed_kg: l.feed_kg ? +l.feed_kg : 0, water_liters: l.water ? +l.water : null, notes: l.notes || null,
  }, { onConflict: 'cycle_id,log_date' })).error)
  const saveEv = async () => { const r = await sb.from('health_events').insert({ cycle_id: id, user_id: await uid(), ...h }); ok(r.error) }
  const del = async (t: string, x: string) => confirm('حذف هذا السجل؟') && ok((await sb.from(t).delete().eq('id', x)).error)
  const close = async () => confirm('قفل الدورة؟ لن تقدر تضيف سجلات بعد القفل.') &&
    ok((await sb.from('cycles').update({ status: 'closed', end_date: today() }).eq('id', id)).error)
  return (<>
    <div className="bar"><h1>{c.name}</h1><button className="sec" onClick={back}>رجوع</button></div>
    <div className="tabs">{[['sum', 'ملخص'], ['logs', 'اليوميات'], ['hl', 'تحصين وعلاج']].map(([k, n]) =>
      <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</div>

    {tab === 'sum' && <div className="card"><div className="stats">
      <div className="stat"><b>{c.chick_count - dead}</b><span>الطيور الحالية</span></div>
      <div className="stat warn"><b>{dead}</b><span>إجمالي النافق ({(dead / c.chick_count * 100).toFixed(1)}%)</span></div>
      <div className="stat"><b>{days(c.start_date, c.end_date || today())}</b><span>عمر الدورة (يوم)</span></div>
      <div className="stat"><b>{feed.toFixed(0)}</b><span>إجمالي العلف (كجم)</span></div></div>
      <p>العنبر: {c.house_name || '-'} · السلالة: {c.breed || '-'} · المصدر: {c.chick_source || '-'}</p>
      {open && <button className="sec" onClick={close}>قفل الدورة</button>}
    </div>}

    {tab === 'logs' && <>
      {open && <div className="card"><div className="row">
        <F l="التاريخ"><input type="date" value={l.log_date} onChange={e => setL({ ...l, log_date: e.target.value })} /></F>
        <F l="النافق"><input type="number" value={l.mortality} onChange={e => setL({ ...l, mortality: e.target.value })} /></F>
        <F l="العلف (كجم)"><input type="number" onChange={e => setL({ ...l, feed_kg: e.target.value })} /></F>
        <F l="المياه (لتر)"><input type="number" onChange={e => setL({ ...l, water: e.target.value })} /></F></div>
        <F l="ملاحظات"><textarea rows={2} onChange={e => setL({ ...l, notes: e.target.value })} /></F>
        <p><small>لو سجّلت نفس اليوم مرة تانية، السجل القديم يتحدّث.</small></p>
        <button onClick={saveLog}>حفظ اليوم</button></div>}
      <div className="card scroll"><table><thead><tr><th>اليوم</th><th>التاريخ</th><th>نافق</th><th>علف</th><th>ملاحظات</th><th></th></tr></thead><tbody>
        {logs.map(x => <tr key={x.id}><td>{days(c.start_date, x.log_date)}</td><td>{x.log_date}</td><td>{x.mortality}</td><td>{x.feed_kg}</td><td>{x.notes}</td>
          <td>{open && <button className="del" onClick={() => del('daily_logs', x.id)}>حذف</button>}</td></tr>)}</tbody></table>
        {!logs.length && <p>لا توجد يوميات بعد.</p>}</div></>}

    {tab === 'hl' && <>
      {open && <div className="card"><div className="row">
        <F l="التاريخ"><input type="date" value={h.event_date} onChange={e => setH({ ...h, event_date: e.target.value })} /></F>
        <F l="النوع"><select value={h.event_type} onChange={e => setH({ ...h, event_type: e.target.value })}>
          <option value="vaccine">تحصين</option><option value="treatment">علاج</option></select></F>
        <F l="الاسم"><input onChange={e => setH({ ...h, name: e.target.value })} /></F>
        <F l="الجرعة"><input onChange={e => setH({ ...h, dose: e.target.value })} /></F>
        <F l="الطريقة (مياه / رش / حقن)"><input onChange={e => setH({ ...h, method: e.target.value })} /></F>
        <F l="ملاحظات"><input onChange={e => setH({ ...h, notes: e.target.value })} /></F></div>
        <button disabled={!h.name} onClick={saveEv}>حفظ</button></div>}
      <div className="card scroll"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الاسم</th><th>الجرعة</th><th>الطريقة</th><th></th></tr></thead><tbody>
        {ev.map(x => <tr key={x.id}><td>{x.event_date}</td><td>{x.event_type === 'vaccine' ? 'تحصين' : 'علاج'}</td><td>{x.name}</td><td>{x.dose}</td><td>{x.method}</td>
          <td>{open && <button className="del" onClick={() => del('health_events', x.id)}>حذف</button>}</td></tr>)}</tbody></table>
        {!ev.length && <p>لا توجد تحصينات أو علاجات مسجلة.</p>}</div></>}
  </>)
}
