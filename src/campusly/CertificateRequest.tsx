import { useState } from 'react'
import { Award, CheckCircle2, Send, X } from 'lucide-react'
import { USER } from './data'

const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default function CertificateRequest({ data, updateData, previewMode = false }) {
  const requests = data.certRequests || []
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const courses = data.courses || []
  const courseComplete = courses.length > 0 && courses.every(course =>
    Number(course.lessons) > 0 && Number(course.completed || 0) >= Number(course.lessons)
  )
  const hasPendingRequest = requests.some(r => r.status === 'Pending')
  const requestLocked = !courseComplete || hasPendingRequest || submitting
  const appNo = `CA-${new Date().getFullYear()}-${String(requests.length + 1).padStart(3, '0')}`

  function submit() {
    if (!courseComplete || hasPendingRequest || submitting) return
    updateData(d => ({ ...d, certRequests: [...(d.certRequests || []), { id: appNo, course: USER.program || 'Course completion', date: today(), status: 'Pending' }] }))
    setSubmitting(true)
    setNotice(`Application ${appNo} sent. You will be told once it is approved.`)
  }

  return <div className="page-stack">
    <div className="certificate-request-heading"><span className="eyebrow">CERTIFICATE SERVICES</span><h2 style={{ margin: '4px 0' }}>Certificate Request</h2><p className="muted-text">Submit a certificate request and track its approval status. Your student details are added automatically.</p></div>
    {previewMode && <div className="notice-card" role="status"><Award size={19}/><div><strong>Preview only</strong><p>Submissions stay on this device and will not be sent to the institute or issue a certificate.</p></div></div>}
    {notice && <div className="success-banner" role="status"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15}/></button></div>}
    {requests.length > 0 && <section className="panel cert-requests-panel"><h3>Your requests</h3><div className="cert-request-list">{requests.map(r => <article className="cert-request-item" key={r.id}><div className="cert-request-icon"><Award size={17}/></div><div className="cert-request-copy"><strong>Course completion certificate</strong><span>Application {r.id} · Submitted {r.date}</span></div><span className={`cert-request-status ${r.status === 'Approved' ? 'approved' : r.status === 'Rejected' ? 'rejected' : 'pending'}`}>{r.status || 'Pending'}</span></article>)}</div></section>}
    <section className="panel cert-submit-panel"><div className="cert-submit-row"><div className="cert-submit-icon"><Award size={22}/></div><div className="cert-submit-copy"><h3>Course completion certificate</h3><p>Your course and student details are included automatically. No application form is needed.</p>{!courseComplete && <p className="cert-request-lock-hint">Complete every course module to unlock your certificate request.</p>}</div><button className="primary-button" type="button" disabled={requestLocked} onClick={submit}><Send size={15}/>{hasPendingRequest || submitting ? 'Request pending' : courseComplete ? 'Submit request' : 'Complete course first'}</button></div></section>
  </div>
}
