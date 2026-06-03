import { Resend } from 'resend'

const resend = process.env['RESEND_API_KEY']
  ? new Resend(process.env['RESEND_API_KEY'])
  : null

const FROM = 'SecureOps <notifications@secureops.in>'

async function send(to: string | string[], subject: string, html: string) {
  if (!resend) {
    console.log('[Email skipped — RESEND_API_KEY not set]', { to, subject })
    return
  }
  try {
    await resend.emails.send({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html })
  } catch (e) {
    console.error('[Email send failed]', e)
  }
}

function base(title: string, body: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
<div style="background:#1d4ed8;color:#fff;border-radius:8px;padding:16px 20px;margin-bottom:24px">
<h2 style="margin:0;font-size:18px">SecureOps</h2></div>
<h3 style="color:#1e293b;margin-top:0">${title}</h3>
${body}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="color:#94a3b8;font-size:12px;margin:0">SecureOps — Security Agency Management Platform</p>
</div></body></html>`
}

export const emailService = {
  async incidentReported(opts: {
    to: string | string[]; incidentTitle: string; category: string
    severity: string; siteName?: string; reportedBy?: string
  }) {
    const severityColor: Record<string, string> = {
      low: '#3b82f6', medium: '#f59e0b', high: '#f97316', critical: '#ef4444'
    }
    const color = severityColor[opts.severity] ?? '#6b7280'
    const html = base('New Incident Reported', `
      <p style="color:#475569">A new incident has been reported and requires your attention.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Title</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${opts.incidentTitle}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Category</td><td style="padding:8px 0;color:#475569;text-transform:capitalize">${opts.category.replace(/_/g,' ')}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Severity</td><td style="padding:8px 0"><span style="background:${color}22;color:${color};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;text-transform:capitalize">${opts.severity}</span></td></tr>
        ${opts.siteName ? `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Site</td><td style="padding:8px 0;color:#475569">${opts.siteName}</td></tr>` : ''}
        ${opts.reportedBy ? `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Reported By</td><td style="padding:8px 0;color:#475569">${opts.reportedBy}</td></tr>` : ''}
      </table>
      <p style="background:#fef3c7;border-radius:8px;padding:12px 16px;color:#92400e;font-size:13px">Please log in to SecureOps to review and action this incident.</p>
    `)
    await send(opts.to, `🚨 [${opts.severity.toUpperCase()}] Incident: ${opts.incidentTitle}`, html)
  },

  async leaveRequested(opts: {
    to: string | string[]; employeeName: string; leaveType: string
    fromDate: string; toDate: string; days: number; reason: string
  }) {
    const html = base('Leave Request Submitted', `
      <p style="color:#475569"><strong>${opts.employeeName}</strong> has submitted a leave request.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Leave Type</td><td style="padding:8px 0;font-weight:600;color:#1e293b;text-transform:capitalize">${opts.leaveType.replace(/_/g,' ')}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">From</td><td style="padding:8px 0;color:#475569">${opts.fromDate}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">To</td><td style="padding:8px 0;color:#475569">${opts.toDate}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Days</td><td style="padding:8px 0;color:#475569">${opts.days} day(s)</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Reason</td><td style="padding:8px 0;color:#475569">${opts.reason}</td></tr>
      </table>
      <p style="color:#475569;font-size:13px">Please log in to SecureOps to approve or reject this request.</p>
    `)
    await send(opts.to, `📋 Leave Request — ${opts.employeeName} (${opts.days} day${opts.days !== 1 ? 's' : ''})`, html)
  },

  async leaveDecision(opts: {
    to: string; employeeName: string; status: 'approved' | 'rejected'
    leaveType: string; fromDate: string; toDate: string; reason?: string
  }) {
    const approved = opts.status === 'approved'
    const html = base(`Leave Request ${approved ? 'Approved' : 'Rejected'}`, `
      <p style="color:#475569">Your leave request has been <strong style="color:${approved ? '#059669' : '#dc2626'}">${opts.status}</strong>.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Leave Type</td><td style="padding:8px 0;text-transform:capitalize">${opts.leaveType.replace(/_/g,' ')}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Period</td><td style="padding:8px 0">${opts.fromDate} to ${opts.toDate}</td></tr>
        ${opts.reason ? `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Reason</td><td style="padding:8px 0;color:#dc2626">${opts.reason}</td></tr>` : ''}
      </table>
    `)
    await send(opts.to, `${approved ? '✅' : '❌'} Leave ${opts.status} — ${opts.fromDate} to ${opts.toDate}`, html)
  },

  async payrollLocked(opts: {
    to: string | string[]; month: string; year: number
    totalEmployees: number; totalNetPay: string
  }) {
    const html = base('Payroll Locked', `
      <p style="color:#475569">The payroll for <strong>${opts.month} ${opts.year}</strong> has been locked and is ready for disbursement.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Employees</td><td style="padding:8px 0;font-weight:600">${opts.totalEmployees}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Total Net Pay</td><td style="padding:8px 0;font-weight:600;color:#059669">₹${Number(opts.totalNetPay).toLocaleString('en-IN')}</td></tr>
      </table>
      <p style="color:#475569;font-size:13px">Please process bank transfers and mark as paid in SecureOps.</p>
    `)
    await send(opts.to, `💰 Payroll Locked — ${opts.month} ${opts.year}`, html)
  },
}
