import { useEffect, useMemo, useState } from 'react'
import { Users, CalendarClock, Plus, Pencil, Trash2, X, LogOut, CheckCircle2, Clock3, Layers, RotateCcw, MapPin, UserRound, ShieldCheck, Download } from 'lucide-react'
import { loadBatches, saveBatches, resetBatches, studentBatches, batchStats, fmtDate, fmtTime, endTime, getNextStudentClassDate, updateSessionSchedule, SESSION_STATUSES, CLASS_TIME_SLOTS, CLASS_DURATION_MINUTES } from './batches.ts'
import { DEMO_USER, getAccounts, initialData, isClassTestFailureClearedByProgress } from './data.ts'
import { formatLocalDateKey, getRetestWindowState, isClassTestPassed, localDateKey } from './classTests.ts'
import { buildStaffReportCsv, getStaffAcademicSummary } from './staffReports.ts'

const subjects = initialData.courses.map(c => c.title.replace(/^Module \d+: /, ''))
const pillClass = s => s === 'Completed' ? 'status-approved' : s === 'Cancelled' ? 'status-rejected' : 'status-pending'
const Pill = ({ s }) => <span className={`status-pill ${pillClass(s)}`}><i/>{s}</span>

function Stat({ icon: Icon, label, value, detail }) {
  return <div className="stat-card"><div className="stat-top"><div className="stat-icon tone-violet"><Icon size={19}/></div></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{detail && <div className="stat-detail">{detail}</div>}</div>
}
function Modal({ title, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" onMouseDown={e => e.stopPropagation()}><div className="modal-header"><h3>{title}</h3><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>{children}</div></div>
}
function Field({ label, children }) { return <div><label className="field-label">{label}</label>{children}</div> }

/* ---------- Student view ---------- */
export function MyBatch({ email, store }) {
  const [f, setF] = useState('All')
  const mine = studentBatches(store, email)
  if (!mine.length) return <div className="page-stack"><div className="panel empty-state"><div><Layers size={20}/></div><strong>No batch assigned yet</strong><p>The admin team will assign your batch and class timings soon.</p></div></div>
  return <div className="page-stack">{mine.map(b => {
    const st = batchStats(store, b.id)
    const sessions = store.sessions.filter(s => s.batchId === b.id && (f === 'All' || s.status === f)).sort((a, z) => (a.date + a.time).localeCompare(z.date + z.time))
    const next = store.sessions.filter(s => s.batchId === b.id && s.status !== 'Completed' && s.status !== 'Cancelled').sort((a, z) => (a.date + a.time).localeCompare(z.date + z.time))[0]
    const bySubject = [...new Set(store.sessions.filter(s => s.batchId === b.id).map(s => s.subject))]
    return <div className="page-stack" key={b.id}>
      <div className="welcome-banner" style={{ minHeight: 170 }}><div className="welcome-copy"><span className="welcome-label"><Layers size={14}/> YOUR BATCH · {b.id}</span><h2 style={{ fontSize: 22 }}>{b.name}</h2><p>{b.course} · {b.days} · {fmtTime(b.time)} – {endTime(b.time, b.duration)} · {b.mode} ({b.room}) · Mentor {b.mentor}</p><p style={{ margin: 0 }}>{fmtDate(b.startDate)} → {fmtDate(b.endDate)}</p></div></div>
      <div className="stats-grid"><Stat icon={CalendarClock} label="Total sessions" value={st.total} detail="Planned by admin"/><Stat icon={CheckCircle2} label="Completed" value={st.done} detail={`${st.pct}% done`}/><Stat icon={Clock3} label="Upcoming" value={st.upcoming} detail="Scheduled ahead"/><Stat icon={MapPin} label="Next class" value={next ? fmtDate(next.date).slice(0, 6) : '—'} detail={next ? `${fmtTime(next.time)} · ${next.subject}` : 'Nothing scheduled'}/></div>
      <div className="panel"><div className="panel-heading"><div><h3>Progress by subject</h3><p>Sessions completed per subject</p></div></div>{bySubject.map(sub => { const all = store.sessions.filter(s => s.batchId === b.id && s.subject === sub); const d = all.filter(s => s.status === 'Completed').length; return <div key={sub} style={{ marginBottom: 12 }}><div className="course-progress-label"><span>{sub}</span><strong>{d}/{all.length} sessions</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${all.length ? d / all.length * 100 : 0}%` }}/></div></div> })}</div>
      <div className="filter-row"><div className="segmented">{['All', ...SESSION_STATUSES].map(x => <button key={x} className={f === x ? 'selected' : ''} onClick={() => setF(x)}>{x}</button>)}</div></div>
      <div className="panel table-panel"><div className="panel-heading"><div><h3>Class sessions</h3><p>Date, time and status of every session</p></div></div><div className="table-scroll"><table><thead><tr><th>#</th><th>SUBJECT</th><th>TOPIC</th><th>DATE</th><th>TIME</th><th>STATUS</th></tr></thead><tbody>{sessions.map(s => <tr key={s.id}><td><span className="course-tag">S{s.number}</span></td><td><strong className="normal-weight">{s.subject}</strong></td><td>{s.topic}</td><td>{fmtDate(s.date)}</td><td>{fmtTime(s.time)} – {endTime(s.time, s.duration)}</td><td><Pill s={s.status}/></td></tr>)}</tbody></table>{!sessions.length && <p className="muted-text" style={{ padding: 14 }}>No sessions in this view.</p>}</div></div>
    </div>
  })}</div>
}

/* ---------- Admin portal ---------- */
const emptyBatch = { name: '', course: "Master's in AI Big Data & Advance MLOps", startDate: '', endDate: '', days: 'Mon, Wed, Fri', time: CLASS_TIME_SLOTS[0], duration: CLASS_DURATION_MINUTES, mode: 'Classroom', room: '', mentor: '', capacity: 30, students: [] }

const studentDataKey = (email) =>
  String(email).toLowerCase() === DEMO_USER.email
    ? 'campusly-demo-data'
    : `portal-data-${email}`
const ALL_STUDENTS = '__all_students__'

function readStudentData(email) {
  try {
    return JSON.parse(localStorage.getItem(studentDataKey(email)) || 'null')
  } catch {
    return null
  }
}

function writeStudentData(email, data) {
  localStorage.setItem(studentDataKey(email), JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('campusly-demo-data-change', { detail: { email } }))
}

export function AdminPortal({ user, onLogout }) {
  const [store, setStore] = useState(loadBatches)
  const [tab, setTab] = useState('batches')
  const [editBatch, setEditBatch] = useState(null)
  const [editSession, setEditSession] = useState(null)
  const [batchFilter, setBatchFilter] = useState('All')
  const [retestFilter, setRetestFilter] = useState(ALL_STUDENTS)
  const [retestStatusFilter, setRetestStatusFilter] = useState('all')
  const [reportBatchFilter, setReportBatchFilter] = useState('All')
  const [reportIssueFilter, setReportIssueFilter] = useState('all')
  const [reportSearch, setReportSearch] = useState('')
  const [retestRevision, setRetestRevision] = useState(0)
  useEffect(() => saveBatches(store), [store])
  useEffect(() => {
    const refreshRetestData = () => setRetestRevision((revision) => revision + 1)
    window.addEventListener('campusly-demo-data-change', refreshRetestData)
    return () => window.removeEventListener('campusly-demo-data-change', refreshRetestData)
  }, [])
  const students = useMemo(() => [{ name: 'Nihal Hegde', email: 'student@skillai.demo' }, ...getAccounts().map(a => ({ name: a.name, email: a.email }))], [])
  const totals = { batches: store.batches.length, sessions: store.sessions.length, done: store.sessions.filter(s => s.status === 'Completed').length, students: new Set(store.batches.flatMap(b => b.students)).size }

  function saveBatch(b) {
    const batch = { ...b, duration: CLASS_DURATION_MINUTES }
    setStore(s => batch.id ? { ...s, batches: s.batches.map(x => x.id === batch.id ? batch : x) } : { ...s, batches: [...s.batches, { ...batch, id: `B-${String(Date.now()).slice(-4)}` }] })
    setEditBatch(null)
  }
  function deleteBatch(id) { if (confirm('Delete this batch and all its sessions?')) setStore(s => ({ batches: s.batches.filter(b => b.id !== id), sessions: s.sessions.filter(x => x.batchId !== id) })) }
  function saveSession(x) {
    const updated = { ...x, number: Number(x.number), duration: CLASS_DURATION_MINUTES }
    const previous = x.id ? store.sessions.find((session) => session.id === x.id) : null
    const n = previous ? updateSessionSchedule(previous, updated) : updated
    setStore(s => x.id ? { ...s, sessions: s.sessions.map(y => y.id === x.id ? n : y) } : { ...s, sessions: [...s.sessions, { ...n, id: `S-${Date.now()}` }] })
    setEditSession(null)
  }
  const setStatus = (id, status) => {
    const previous = store.sessions.find((session) => session.id === id)
    if (!previous) return
    const updated = updateSessionSchedule(previous, { ...previous, status })
    setStore(s => ({ ...s, sessions: s.sessions.map(x => x.id === id ? updated : x) }))
  }
  const newSession = () => { const b = store.batches[0]; if (!b) return alert('Create a batch first.'); const sub = subjects[1]; const n = store.sessions.filter(s => s.batchId === b.id && s.subject === sub).length + 1; setEditSession({ batchId: b.id, subject: sub, number: n, date: '', time: b.time, duration: CLASS_DURATION_MINUTES, topic: '', status: 'Scheduled', trainer: b.mentor }) }
  const sessions = store.sessions.filter(s => batchFilter === 'All' || s.batchId === batchFilter).sort((a, z) => (a.date + a.time).localeCompare(z.date + z.time))
  const batchName = id => store.batches.find(b => b.id === id)?.name || id
  const retestStudents = useMemo(
    () => [...new Map(students.map((student) => [student.email, student])).values()],
    [students],
  )
  const retestRecords = useMemo(() => {
    const roster = retestFilter === ALL_STUDENTS
      ? retestStudents
      : retestStudents.filter((student) => student.email === retestFilter)
    return roster.flatMap((student) => {
      const data = readStudentData(student.email)
      if (!data) return []
      const nextClassDate = getNextStudentClassDate(store, student.email, new Date(), true)
      const common = { student, data, nextClassDate }
      const classTests = Object.entries(data.classTests || {})
        .filter(([key, result]) => {
          const [module, lesson] = key.split('-')
          const course = data.courses?.find((item) => Number(item.id) === Number(module))
          return (
            !isClassTestPassed(result) &&
            !isClassTestFailureClearedByProgress(course, lesson, data.classTests)
          )
        })
        .map(([key, result]) => {
          const [module, lesson] = key.split('-')
          return {
            ...common,
            kind: 'class-test',
            key,
            module: Number(module),
            lesson: Number(lesson),
            result,
            retestState: getRetestWindowState(result),
          }
        })
      const assessments = Object.entries(data.moduleAssessments || {})
        .filter(([, result]) => !isClassTestPassed(result))
        .map(([module, result]) => ({
          ...common,
          kind: 'assessment',
          module: Number(module),
          result,
          retestState: getRetestWindowState(result),
        }))
      return [...classTests, ...assessments]
    })
  }, [retestFilter, retestStudents, retestRevision, store])
  const isRetestStatusVisible = (item) =>
    retestStatusFilter === 'all' || item.retestState === retestStatusFilter
  const visibleRetestRecords = retestRecords.filter(isRetestStatusVisible)
  const failedLessonResults = visibleRetestRecords.filter((item) => item.kind === 'class-test')
  const failedAssessmentResults = visibleRetestRecords.filter((item) => item.kind === 'assessment')
  const assignAssessmentRetake = (item) => {
    if (!item.data) return
    const today = localDateKey()
    const isAcademicDay =
      item.nextClassDate === today || item.result.retestAvailableDate === today
    const availableDate =
      item.retestState === 'expired' || !item.result.retestAvailableDate
        ? item.nextClassDate
        : item.result.retestAvailableDate
    if (
      !isAcademicDay ||
      !availableDate ||
      availableDate !== today
    ) return
    const authorizedResult = {
      ...item.result,
      retestAvailableDate: availableDate,
      retestDate: availableDate,
      retestAuthorized: true,
      retestAuthorizedDate: today,
      retestApprovalRequested: false,
      retestApprovalRequestedDate: null,
    }
    const next = {
      ...item.data,
      moduleAssessments: {
        ...(item.data.moduleAssessments || {}),
        [item.module]: authorizedResult,
      },
      moduleAssessmentRetakes: {
        ...(item.data.moduleAssessmentRetakes || {}),
        [item.module]: true,
      },
      notifications: [{
        id: `assessment-retake-${item.module}-${Date.now()}`,
        title: 'Assessment re-exam assigned',
        message: `Academic staff authorized your Module ${item.module} assessment retest for today. It is valid for this academic day only.`,
        time: 'Just now',
        read: false,
        kind: 'class-test',
      }, ...(item.data.notifications || [])],
    }
    writeStudentData(item.student.email, next)
  }
  const authorizeClassTestRetake = (item) => {
    if (!item.data) return
    const authorizedDate = localDateKey()
    const availableDate =
      item.result.retestAvailableDate === authorizedDate
        ? authorizedDate
        : (!item.result.retestAvailableDate || item.retestState === 'expired') &&
            item.nextClassDate === authorizedDate
          ? authorizedDate
          : null
    if (!availableDate) return
    const next = {
      ...item.data,
      classTests: {
        ...(item.data.classTests || {}),
        [item.key]: {
          ...item.result,
          retestAuthorized: true,
          retestAvailableDate: availableDate,
          retestDate: availableDate,
          retestAuthorizedDate: authorizedDate,
          retestApprovalRequested: false,
          retestApprovalRequestedDate: null,
        },
      },
      notifications: [{
        id: `class-test-retest-authorized-${item.module}-${item.lesson}-${Date.now()}`,
        title: `Retest authorized: Session ${item.lesson}`,
        message: `Your retest for Module ${item.module}, Session ${item.lesson} opens on your academic day, ${formatLocalDateKey(availableDate)}, and is valid for that day only.`,
        time: 'Just now',
        read: false,
        kind: 'class-test',
      }, ...(item.data.notifications || [])],
    }
    writeStudentData(item.student.email, next)
  }
  const reportRows = useMemo(() => retestStudents.flatMap((student) => {
    const data = readStudentData(student.email)
    const summary = getStaffAcademicSummary(data, initialData.marks)
    const assignedBatches = store.batches.filter((batch) =>
      batch.students.some((email) => email.toLowerCase() === student.email.toLowerCase()),
    )
    const memberships = assignedBatches.length ? assignedBatches : [null]
    return memberships.map((batch) => {
      const batchSessions = batch
        ? store.sessions.filter((session) => session.batchId === batch.id && session.status !== 'Cancelled')
        : []
      const missingMarkItems = summary.missingMarkRecords
        .map((mark) => `Module ${mark.module} · ${mark.examType}`)
        .join('; ')
      return {
        id: `${student.email}-${batch?.id || 'unassigned'}`,
        studentName: student.name,
        email: student.email,
        batchId: batch?.id || 'unassigned',
        batchName: batch?.name || 'Unassigned',
        modulesCompleted: summary.modulesCompleted,
        modulesTotal: summary.modulesTotal,
        pendingRetests: summary.pendingRetests,
        missingMarks: summary.missingMarkRecords.length,
        missingMarkItems,
        academicRecord: summary.hasRecord ? 'Available' : 'Not found',
        sessionsCompleted: batchSessions.filter((session) => session.status === 'Completed').length,
        sessionsTotal: batchSessions.length,
        hasRecord: summary.hasRecord,
      }
    })
  }), [retestStudents, store, retestRevision])
  const reportBaseRows = reportRows.filter((row) =>
    reportBatchFilter === 'All' || row.batchId === reportBatchFilter,
  )
  const filteredReportRows = reportBaseRows.filter((row) => {
    const query = reportSearch.trim().toLowerCase()
    const matchesSearch = !query ||
      `${row.studentName} ${row.email} ${row.batchName}`.toLowerCase().includes(query)
    const matchesIssue =
      reportIssueFilter === 'all' ||
      (reportIssueFilter === 'pending-retests' && row.pendingRetests > 0) ||
      (reportIssueFilter === 'missing-marks' && row.missingMarks > 0) ||
      (reportIssueFilter === 'no-record' && !row.hasRecord) ||
      (reportIssueFilter === 'no-issues' && row.hasRecord && !row.pendingRetests && !row.missingMarks)
    return matchesSearch && matchesIssue
  })
  const reportBatchSummaries = [...store.batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    rows: reportRows.filter((row) => row.batchId === batch.id),
    sessions: store.sessions.filter((session) => session.batchId === batch.id && session.status !== 'Cancelled'),
  })), {
    id: 'unassigned',
    name: 'Unassigned',
    rows: reportRows.filter((row) => row.batchId === 'unassigned'),
  }].filter((batch) =>
    (reportBatchFilter === 'All' || batch.id === reportBatchFilter) &&
      (batch.id !== 'unassigned' || batch.rows.length),
  )
  const uniqueReportStudents = [...new Map(
    filteredReportRows.map((row) => [row.email, row]),
  ).values()]
  const reportStats = {
    students: uniqueReportStudents.length,
    pendingRetests: uniqueReportStudents.filter((row) => row.pendingRetests > 0).length,
    missingMarks: uniqueReportStudents.filter((row) => row.missingMarks > 0).length,
    noRecord: uniqueReportStudents.filter((row) => !row.hasRecord).length,
  }
  function exportReport() {
    const csv = buildStaffReportCsv(filteredReportRows)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `skillai-class-report-${localDateKey()}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  return <div className="app-shell"><main className="main-area" style={{ marginRight: 0 }}>
    <header className="topbar"><div className="breadcrumb"><ShieldCheck size={16}/><strong>Admin · Batch & Class Management</strong></div><div className="topbar-actions"><span className="muted-text">{user.name}</span><button className="secondary-button" onClick={onLogout}><LogOut size={15}/> Sign out</button></div></header>
    <div className="content-area"><div className="page-stack">
      <div className="welcome-banner" style={{ minHeight: 150 }}><div className="welcome-copy"><span className="welcome-label"><Layers size={14}/> ADMIN TEAM</span><h2 style={{ fontSize: 22 }}>Batches & class sessions</h2><p>Create batches, assign students, and schedule sessions. Students see these instantly in their portal.</p></div></div>
      <div className="stats-grid"><Stat icon={Layers} label="Batches" value={totals.batches}/><Stat icon={Users} label="Students assigned" value={totals.students}/><Stat icon={CalendarClock} label="Sessions planned" value={totals.sessions}/><Stat icon={CheckCircle2} label="Sessions completed" value={totals.done}/></div>
      <div className="filter-row"><div className="segmented">{[['batches', 'Batches'], ['sessions', 'Sessions'], ['retests', 'Re-exams'], ['reports', 'Reports']].map(([k, l]) => <button key={k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>{l}</button>)}</div><div style={{ display: 'flex', gap: 8 }}>{tab !== 'retests' && tab !== 'reports' && <button className="secondary-button" onClick={() => confirm('Reset to default batches?') && setStore(resetBatches())}><RotateCcw size={14}/> Reset</button>}{tab === 'batches' ? <button className="primary-button" onClick={() => setEditBatch({ ...emptyBatch })}><Plus size={15}/> New batch</button> : tab === 'sessions' ? <button className="primary-button" onClick={newSession}><Plus size={15}/> New session</button> : null}</div></div>

      {tab === 'batches' && <div className="course-grid">{store.batches.map(b => { const st = batchStats(store, b.id); return <article className="panel" key={b.id}><div className="panel-heading"><div><span className="course-tag">{b.id}</span><h3 style={{ marginTop: 8 }}>{b.name}</h3><p>{b.course}</p></div><div style={{ display: 'flex' }}><button className="icon-button" aria-label="Edit batch" onClick={() => setEditBatch(b)}><Pencil size={15}/></button><button className="icon-button" aria-label="Delete batch" onClick={() => deleteBatch(b.id)}><Trash2 size={15}/></button></div></div><div className="course-meta" style={{ marginTop: 0 }}><span><CalendarClock size={13}/>{b.days} · {fmtTime(b.time)} – {endTime(b.time, b.duration)}</span><span><MapPin size={13}/>{b.mode} · {b.room || '—'}</span><span><UserRound size={13}/>{b.mentor || '—'}</span><span><Users size={13}/>{b.students.length}/{b.capacity} students</span></div><p className="muted-text" style={{ margin: '10px 0' }}>{fmtDate(b.startDate)} → {fmtDate(b.endDate)}</p><div className="course-progress-label"><span>{st.done}/{st.total} sessions completed</span><strong>{st.pct}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${st.pct}%` }}/></div></article> })}</div>}

      {tab === 'sessions' && <div className="panel table-panel"><div className="panel-heading"><div><h3>Session schedule</h3><p>Update status as classes happen</p></div><select className="select-control" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}><option value="All">All batches</option>{store.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div><div className="table-scroll"><table><thead><tr><th>BATCH</th><th>#</th><th>SUBJECT / TOPIC</th><th>DATE</th><th>TIME</th><th>STATUS</th><th/></tr></thead><tbody>{sessions.map(s => <tr key={s.id}><td>{batchName(s.batchId)}</td><td><span className="course-tag">S{s.number}</span></td><td><strong className="normal-weight">{s.subject}</strong><br/><span className="muted-text">{s.topic}</span></td><td>{fmtDate(s.date)}</td><td>{fmtTime(s.time)} – {endTime(s.time, s.duration)}</td><td><select className="select-control" value={s.status} onChange={e => setStatus(s.id, e.target.value)}>{SESSION_STATUSES.map(x => <option key={x}>{x}</option>)}</select></td><td><button className="icon-button" aria-label="Edit session" onClick={() => setEditSession(s)}><Pencil size={14}/></button><button className="icon-button" aria-label="Delete session" onClick={() => setStore(st => ({ ...st, sessions: st.sessions.filter(x => x.id !== s.id) }))}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div></div>}

      {tab === 'retests' && <div className="page-stack">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Retest queue</h3>
              <p>Follow each failed attempt through its academic date, staff authorization and result. Retests are available only on the authorized academic day.</p>
            </div>
          </div>
          <div className="staff-filter-row">
            <label>
              <span className="field-label">Student</span>
              <select className="select-control" value={retestFilter} onChange={e => setRetestFilter(e.target.value)}>
                <option value={ALL_STUDENTS}>All students</option>
                {retestStudents.map(student => <option key={student.email} value={student.email}>{student.name}</option>)}
              </select>
            </label>
            <label>
              <span className="field-label">Retest status</span>
              <select className="select-control" value={retestStatusFilter} onChange={e => setRetestStatusFilter(e.target.value)}>
                <option value="all">All pending retests</option>
                <option value="approval-required">Needs staff approval</option>
                <option value="scheduled">Scheduled</option>
                <option value="open">Open today</option>
                <option value="expired">Expired</option>
              </select>
            </label>
          </div>
          <div className="stats-grid three-stats">
            <Stat icon={Clock3} label="Pending retests" value={visibleRetestRecords.length} detail="Matching student and status filters"/>
            <Stat icon={Users} label="Class-test retests" value={failedLessonResults.length} detail="Awaiting completion"/>
            <Stat icon={CheckCircle2} label="Assessment retakes" value={failedAssessmentResults.length} detail="Awaiting completion"/>
          </div>
        </div>
        <div className="panel table-panel">
          <div className="panel-heading"><div><h3>Class-test retests</h3><p>Authorize on the student’s scheduled academic day. Each row shows the next staff action.</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>MODULE</th><th>SESSION</th><th>SCORE</th><th>RETEST STATUS</th><th>STAFF ACTION</th></tr></thead><tbody>{failedLessonResults.map(item => {
            const authorized = item.result.retestAuthorized === true &&
              (item.retestState === 'open' || item.retestState === 'scheduled')
            const canAuthorize =
              item.result.retestAvailableDate === localDateKey() ||
              ((!item.result.retestAvailableDate || item.retestState === 'expired') &&
                item.nextClassDate === localDateKey())
            const windowLabel = item.retestState === 'open'
              ? 'Open today only'
              : item.retestState === 'scheduled'
                ? `Opens on academic day · ${formatLocalDateKey(item.result.retestAvailableDate)}`
                : item.retestState === 'expired'
                  ? 'Expired · re-authorization required'
                  : item.result.retestAvailableDate
                    ? `Approval on academic day · ${formatLocalDateKey(item.result.retestAvailableDate)}`
                    : item.nextClassDate
                      ? `Next academic day · ${formatLocalDateKey(item.nextClassDate)}`
                      : 'No academic day scheduled'
            return (
              <tr key={`${item.student.email}-${item.key}`}>
                <td><strong>{item.student.name}</strong><br/><span className="muted-text">{item.student.email}</span></td>
                <td>Module {item.module}</td>
                <td>Session {item.lesson}</td>
                <td><strong>{item.result.score} / {item.result.total}</strong></td>
                <td><span className="status-pill status-pending"><i/>{windowLabel}</span></td>
                <td>
                  <button
                    className={authorized ? 'secondary-button' : 'primary-button'}
                    disabled={authorized || !canAuthorize}
                    onClick={() => authorizeClassTestRetake(item)}
                  >
                    {authorized
                      ? 'Authorized'
                      : canAuthorize
                        ? item.retestState === 'expired'
                          ? 'Re-authorize today'
                          : 'Authorize today'
                        : item.result.retestAvailableDate
                          ? `Authorize on ${formatLocalDateKey(item.result.retestAvailableDate)}`
                          : item.nextClassDate
                            ? `Authorize on ${formatLocalDateKey(item.nextClassDate)}`
                            : 'Schedule academic day first'}
                  </button>
                  {item.result.retestApprovalRequested && <div className="muted-text">Student request received</div>}
                </td>
              </tr>
            )
          })}</tbody></table>{!failedLessonResults.length && <p className="muted-text" style={{ padding: 14 }}>No class-test retests match these filters.</p>}</div>
        </div>
        <div className="panel table-panel">
          <div className="panel-heading"><div><h3>Assessment retakes</h3><p>Authorize retakes on the student’s next academic day. Retakes are valid for that day only.</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>MODULE</th><th>SCORE</th><th>RETEST STATUS</th><th>STAFF ACTION</th></tr></thead><tbody>{failedAssessmentResults.map(item => {
            const assigned = item.result.retestAuthorized === true &&
              (item.retestState === 'open' || item.retestState === 'scheduled')
            const canAssign = (item.nextClassDate === localDateKey() ||
              item.result.retestAvailableDate === localDateKey()) &&
              (!item.result.retestAvailableDate ||
                item.result.retestAvailableDate === item.nextClassDate ||
                item.result.retestAvailableDate === localDateKey() ||
                item.retestState === 'expired')
            const windowLabel = item.retestState === 'open'
              ? 'Open today only'
              : item.retestState === 'scheduled'
                ? `Scheduled · ${formatLocalDateKey(item.result.retestAvailableDate)}`
                : item.retestState === 'expired'
                  ? 'Expired · re-authorization required'
                  : item.result.retestAvailableDate
                    ? `Approval on academic day · ${formatLocalDateKey(item.result.retestAvailableDate)}`
                    : item.nextClassDate
                      ? `Next academic day · ${formatLocalDateKey(item.nextClassDate)}`
                      : 'No academic day scheduled'
            return <tr key={`${item.student.email}-${item.module}`}>
              <td><strong>{item.student.name}</strong><br/><span className="muted-text">{item.student.email}</span></td>
              <td>Module {item.module}</td>
              <td><strong>{item.result.score} / {item.result.total}</strong></td>
              <td><span className="status-pill status-pending"><i/>{windowLabel}</span></td>
              <td><button className={assigned ? 'secondary-button' : 'primary-button'} disabled={assigned || !canAssign} onClick={() => assignAssessmentRetake(item)}>{assigned ? 'Authorized' : canAssign ? item.retestState === 'expired' ? 'Re-authorize today' : 'Authorize today' : item.nextClassDate ? `Authorize on ${formatLocalDateKey(item.nextClassDate)}` : 'Schedule academic day first'}</button>{item.result.retestApprovalRequested && <div className="muted-text">Student request received</div>}</td>
            </tr>
          })}</tbody></table>{!failedAssessmentResults.length && <p className="muted-text" style={{ padding: 14 }}>No assessment retakes match these filters.</p>}</div>
        </div>
      </div>}
      {tab === 'reports' && <div className="page-stack">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Class reports &amp; exports</h3>
              <p>Review class progress, pending retests and marks that are not published for completed modules.</p>
            </div>
            <button className="primary-button" disabled={!filteredReportRows.length} onClick={exportReport}>
              <Download size={15}/> Export filtered CSV
            </button>
          </div>
          <div className="staff-filter-row">
            <label>
              <span className="field-label">Class / batch</span>
              <select className="select-control" value={reportBatchFilter} onChange={e => setReportBatchFilter(e.target.value)}>
                <option value="All">All classes</option>
                {store.batches.map(batch => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                {reportRows.some(row => row.batchId === 'unassigned') && <option value="unassigned">Unassigned students</option>}
              </select>
            </label>
            <label>
              <span className="field-label">Needs attention</span>
              <select className="select-control" value={reportIssueFilter} onChange={e => setReportIssueFilter(e.target.value)}>
                <option value="all">All students</option>
                <option value="pending-retests">Pending retests</option>
                <option value="missing-marks">Missing / unpublished marks</option>
                <option value="no-record">No academic record</option>
                <option value="no-issues">No outstanding items</option>
              </select>
            </label>
            <label>
              <span className="field-label">Find student</span>
              <input className="select-control" type="search" value={reportSearch} onChange={e => setReportSearch(e.target.value)} placeholder="Name or email"/>
            </label>
          </div>
          <p className="muted-text">Missing marks are counted only for completed modules. College sync status is not shown because this portal has no sync-status data.</p>
          <div className="stats-grid three-stats">
            <Stat icon={Users} label="Students in view" value={reportStats.students} detail="After applying filters"/>
            <Stat icon={Clock3} label="Students with pending retests" value={reportStats.pendingRetests} detail="Class tests and assessments"/>
            <Stat icon={CheckCircle2} label="Students missing marks" value={reportStats.missingMarks} detail={`${reportStats.noRecord} without an academic record`}/>
          </div>
        </div>
        <div className="panel table-panel">
          <div className="panel-heading"><div><h3>Class overview</h3><p>Roster and outstanding academic items by batch.</p></div></div>
          <div className="table-scroll"><table>
            <thead><tr><th>CLASS / BATCH</th><th>STUDENTS</th><th>SESSIONS COMPLETED</th><th>WITH PENDING RETESTS</th><th>WITH MISSING MARKS</th></tr></thead>
            <tbody>{reportBatchSummaries.map(batch => {
              const studentsInBatch = [...new Map(batch.rows.map(row => [row.email, row])).values()]
              const sessionSummary = studentsInBatch[0]
              const sessionsCompleted = sessionSummary
                ? sessionSummary.sessionsCompleted
                : batch.sessions.filter(session => session.status === 'Completed').length
              const sessionsTotal = sessionSummary?.sessionsTotal ?? batch.sessions.length
              return <tr key={batch.id}>
                <td><strong>{batch.name}</strong></td>
                <td>{studentsInBatch.length}</td>
                <td>{sessionsTotal ? `${sessionsCompleted} / ${sessionsTotal}` : '—'}</td>
                <td>{studentsInBatch.filter(row => row.pendingRetests > 0).length}</td>
                <td>{studentsInBatch.filter(row => row.missingMarks > 0).length}</td>
              </tr>
            })}</tbody>
          </table>{!reportBatchSummaries.length && <p className="muted-text" style={{ padding: 14 }}>No class data matches this filter.</p>}</div>
        </div>
        <div className="panel table-panel">
          <div className="panel-heading"><div><h3>Student details</h3><p>The CSV export contains these filtered rows.</p></div></div>
          <div className="table-scroll"><table>
            <thead><tr><th>STUDENT</th><th>CLASS</th><th>MODULES</th><th>PENDING RETESTS</th><th>MISSING MARKS</th><th>CLASS SESSIONS</th></tr></thead>
            <tbody>{filteredReportRows.map(row => <tr key={row.id}>
              <td><strong>{row.studentName}</strong><br/><span className="muted-text">{row.email}</span>{!row.hasRecord && <div className="status-pill status-pending"><i/>Academic record not found</div>}</td>
              <td>{row.batchName}</td>
              <td>{row.modulesTotal ? `${row.modulesCompleted} / ${row.modulesTotal} completed` : '—'}</td>
              <td>{row.pendingRetests || 'None'}</td>
              <td>{row.missingMarks ? <><strong>{row.missingMarks}</strong><br/><span className="muted-text">{row.missingMarkItems}</span></> : 'None'}</td>
              <td>{row.sessionsTotal ? `${row.sessionsCompleted} / ${row.sessionsTotal}` : '—'}</td>
            </tr>)}</tbody>
          </table>{!filteredReportRows.length && <p className="muted-text" style={{ padding: 14 }}>No students match these filters.</p>}</div>
        </div>
      </div>}
    </div></div>
    {editBatch && <BatchForm initial={editBatch} students={students} onSave={saveBatch} onClose={() => setEditBatch(null)}/>}
    {editSession && <SessionForm initial={editSession} batches={store.batches} onSave={saveSession} onClose={() => setEditSession(null)}/>}
  </main></div>
}

function BatchForm({ initial, students, onSave, onClose }) {
  const [b, setB] = useState(initial)
  const set = k => e => setB({ ...b, [k]: e.target.value })
  const toggle = email => setB({ ...b, students: b.students.includes(email) ? b.students.filter(x => x !== email) : [...b.students, email] })
  return <Modal title={b.id ? 'Edit batch' : 'New batch'} onClose={onClose}><form className="leave-form" onSubmit={e => { e.preventDefault(); onSave({ ...b, duration: CLASS_DURATION_MINUTES, capacity: Number(b.capacity) }) }}>
    <Field label="Batch name"><input required value={b.name} onChange={set('name')} placeholder="e.g. MBD Jan 2027 — Evening"/></Field>
    <Field label="Course"><input required value={b.course} onChange={set('course')}/></Field>
    <div className="form-two-col"><Field label="Start date"><input type="date" required value={b.startDate} onChange={set('startDate')}/></Field><Field label="End date"><input type="date" value={b.endDate} onChange={set('endDate')}/></Field></div>
    <div className="form-two-col"><Field label="Class days"><input value={b.days} onChange={set('days')} placeholder="Mon, Wed, Fri"/></Field><Field label="Class time slot"><select required value={b.time} onChange={set('time')}>{CLASS_TIME_SLOTS.map(time => <option key={time} value={time}>{fmtTime(time)} – {endTime(time, CLASS_DURATION_MINUTES)}</option>)}</select></Field></div>
    <div className="form-two-col"><Field label="Duration (minutes)"><input type="number" value={CLASS_DURATION_MINUTES} readOnly/></Field><Field label="Capacity"><input type="number" min="1" value={b.capacity} onChange={set('capacity')}/></Field></div>
    <div className="form-two-col"><Field label="Mode"><select value={b.mode} onChange={set('mode')}><option>Classroom</option><option>Online</option><option>Hybrid</option></select></Field><Field label="Room / link"><input value={b.room} onChange={set('room')}/></Field></div>
    <Field label="Mentor"><input value={b.mentor} onChange={set('mentor')}/></Field>
    <Field label={`Students (${b.students.length})`}><div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto' }}>{students.map(s => <label key={s.email} className="muted-text" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={b.students.includes(s.email)} onChange={() => toggle(s.email)}/>{s.name} · {s.email}</label>)}</div></Field>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Save batch</button></div>
  </form></Modal>
}

function SessionForm({ initial, batches, onSave, onClose }) {
  const [s, setS] = useState(initial)
  const set = k => e => setS({ ...s, [k]: e.target.value })
  return <Modal title={s.id ? 'Edit session' : 'New session'} onClose={onClose}><form className="leave-form" onSubmit={e => { e.preventDefault(); onSave(s) }}>
    <Field label="Batch"><select value={s.batchId} onChange={set('batchId')}>{batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
    <div className="form-two-col"><Field label="Subject"><select value={s.subject} onChange={set('subject')}>{subjects.map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Session number"><input type="number" min="1" required value={s.number} onChange={set('number')}/></Field></div>
    <Field label="Topic"><input required value={s.topic} onChange={set('topic')}/></Field>
    <div className="form-two-col"><Field label="Date"><input type="date" required value={s.date} onChange={set('date')}/></Field><Field label="Class time slot"><select required value={s.time} onChange={set('time')}>{CLASS_TIME_SLOTS.map(time => <option key={time} value={time}>{fmtTime(time)} – {endTime(time, CLASS_DURATION_MINUTES)}</option>)}</select></Field></div>
    <div className="form-two-col"><Field label="Duration (minutes)"><input type="number" value={CLASS_DURATION_MINUTES} readOnly/></Field><Field label="Status"><select value={s.status} onChange={set('status')}>{SESSION_STATUSES.map(x => <option key={x}>{x}</option>)}</select></Field></div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Save session</button></div>
  </form></Modal>
}
