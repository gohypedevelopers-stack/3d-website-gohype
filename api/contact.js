'use strict'

const nodemailer = require('nodemailer')

const SMTP_HOST = process.env.SMTP_HOST || ''
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_SECURE = (process.env.SMTP_SECURE || 'true') === 'true'
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER
const CONTACT_RECIPIENTS = process.env.CONTACT_RECIPIENTS || SMTP_USER
const INDIA_TIME_ZONE = 'Asia/Kolkata'

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  let body
  try {
    body = await readBody(req)
  } catch (error) {
    console.error('contact: invalid JSON', error)
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }

  const {
    name = '',
    email = '',
    message = '',
    details = '',
  } = body || {}

  const leadFields = normalizeLeadFields(body)

  if (!name.trim() || !email.trim()) {
    return res.status(400).json({ error: 'Name and email are required.' })
  }

  const normalizedRecipients = CONTACT_RECIPIENTS.split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (normalizedRecipients.length === 0) {
    console.error('contact: CONTACT_RECIPIENTS is misconfigured')
    return res.status(500).json({ error: 'Email service is unavailable.' })
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('contact: missing SMTP configuration')
    return res.status(500).json({ error: 'SMTP mail is not configured.' })
  }

  const finalMessage = firstNonEmpty([message, details]) || ''
  const timeContext = buildTimeContext(body, req, leadFields.meetingLabel)

  const html = buildHtml({
    name,
    email,
    company: leadFields.company,
    budget: leadFields.budget,
    message: finalMessage,
    source: leadFields.source,
    meetingType: leadFields.meetingType,
    timeContext,
  })

  const text = buildText({
    name,
    email,
    company: leadFields.company,
    budget: leadFields.budget,
    message: finalMessage,
    source: leadFields.source,
    meetingType: leadFields.meetingType,
    timeContext,
  })

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: `"GoHype Inquiry" <${SMTP_FROM_EMAIL}>`,
      to: normalizedRecipients,
      replyTo: email,
      subject: `New GoHype inquiry from ${name}`,
      text: text,
      html: html,
    })

    return res.status(200).json({
      success: true,
      indiaTime: timeContext.meetingIndiaTime || '',
      requestReceivedIndiaTime: timeContext.requestReceivedIndiaTime,
      requesterTimeZone: timeContext.requesterTimeZone,
    })
  } catch (error) {
    console.error('contact: unexpected error', error)
    return res.status(500).json({ error: error.message || 'Failed to send email.' })
  }
}

async function readBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function buildHtml({ name, email, company, budget, message, source, meetingType, timeContext }) {
  const format = (label, value) =>
    `<tr><td style="padding:4px 0;color:#0f172a;"><strong>${label}:</strong></td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(
      value,
    )}</td></tr>`

  const rows = [format('Name', name), format('Email', email)]

  if (company) {
    rows.push(format('Company', company))
  }

  if (budget) {
    rows.push(format('Budget', budget))
  }

  if (message) {
    rows.push(format('Message', message))
  }

  if (source) {
    rows.push(format('Source', source))
  }

  if (meetingType) {
    rows.push(format('Meeting Type', meetingType))
  }

  if (timeContext.requesterTimeZone) {
    rows.push(format('Requester Time Zone', timeContext.requesterTimeZone))
  }

  if (timeContext.meetingLocalTime) {
    rows.push(format('Meeting (Requester Local)', timeContext.meetingLocalTime))
  }

  if (timeContext.meetingIndiaTime) {
    rows.push(format('Meeting (India Time)', timeContext.meetingIndiaTime))
  }

  if (timeContext.requestReceivedIndiaTime) {
    rows.push(format('Request Received (India Time)', timeContext.requestReceivedIndiaTime))
  }

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;">
      <h2 style="margin:0 0 16px;">New enquiry from ${escapeHtml(name)}</h2>
      <table style="border-collapse:collapse;">
        ${rows.join('')}
      </table>
    </div>
  `
}

function buildText({ name, email, company, budget, message, source, meetingType, timeContext }) {
  const lines = [`New enquiry from ${name}`, `Email: ${email}`]

  if (company) {
    lines.push(`Company: ${company}`)
  }

  if (budget) {
    lines.push(`Budget: ${budget}`)
  }

  if (message) {
    lines.push(`Message: ${message}`)
  }

  if (source) {
    lines.push(`Source: ${source}`)
  }

  if (meetingType) {
    lines.push(`Meeting Type: ${meetingType}`)
  }

  if (timeContext.requesterTimeZone) {
    lines.push(`Requester Time Zone: ${timeContext.requesterTimeZone}`)
  }

  if (timeContext.meetingLocalTime) {
    lines.push(`Meeting (Requester Local): ${timeContext.meetingLocalTime}`)
  }

  if (timeContext.meetingIndiaTime) {
    lines.push(`Meeting (India Time): ${timeContext.meetingIndiaTime}`)
  }

  if (timeContext.requestReceivedIndiaTime) {
    lines.push(`Request Received (India Time): ${timeContext.requestReceivedIndiaTime}`)
  }

  return lines.join('\n')
}

function buildTimeContext(body, req, fallbackMeetingLabel = '') {
  const requesterTimeZone = resolveRequesterTimeZone(body, req)
  const meetingDate = extractMeetingDate(body)
  const meetingLabel =
    firstNonEmpty([
      body?.meetingLabel,
      body?.meeting,
      body?.schedule,
      body?.scheduledAtLabel,
      fallbackMeetingLabel,
    ]) || ''

  return {
    requesterTimeZone,
    meetingLocalTime: meetingDate
      ? formatDateInTimeZone(meetingDate, requesterTimeZone, requesterTimeZone)
      : meetingLabel,
    meetingIndiaTime: meetingDate
      ? formatDateInTimeZone(meetingDate, INDIA_TIME_ZONE, 'IST')
      : '',
    requestReceivedIndiaTime: formatDateInTimeZone(new Date(), INDIA_TIME_ZONE, 'IST'),
  }
}

function normalizeLeadFields(body) {
  let company = firstNonEmpty([
    body?.company,
    body?.companyName,
    body?.organization,
    body?.organisation,
  ])
  let budget = firstNonEmpty([body?.budget, body?.projectBudget])
  let meetingType = firstNonEmpty([body?.meetingType, body?.callType, body?.eventType])
  let meetingLabel = firstNonEmpty([
    body?.meetingLabel,
    body?.meeting,
    body?.schedule,
    body?.scheduledAtLabel,
  ])

  if (looksLikeMeetingType(company) && (!meetingType || company === meetingType)) {
    if (!meetingType) {
      meetingType = company
    }
    company = ''
  }

  if (looksLikeMeetingLabel(budget) && (!meetingLabel || budget === meetingLabel)) {
    if (!meetingLabel) {
      meetingLabel = budget
    }
    budget = ''
  }

  if (looksLikeMeetingLabel(company) && (!meetingLabel || company === meetingLabel)) {
    if (!meetingLabel) {
      meetingLabel = company
    }
    company = ''
  }

  return {
    source: normalizeSource(body),
    company,
    budget,
    meetingType,
    meetingLabel,
  }
}

function normalizeSource(body) {
  const explicitSource = firstNonEmpty([
    body?.source,
    body?.leadSource,
    body?.formSource,
    body?.origin,
  ])

  if (explicitSource) return explicitSource

  const hasMeetingDetails = Boolean(
    extractMeetingDate(body) ||
      firstNonEmpty([body?.meetingLabel, body?.meeting, body?.schedule, body?.scheduledAtLabel]),
  )

  return hasMeetingDetails ? 'calendar' : 'website'
}

function looksLikeMeetingType(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false

  const meetingWords = /\b(call|meeting|consultation|session)\b/i
  return meetingWords.test(trimmed) && !looksLikeCompanyName(trimmed)
}

function looksLikeMeetingLabel(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false

  return /^meeting\s*:/i.test(trimmed)
}

function looksLikeCompanyName(value) {
  if (typeof value !== 'string') return false
  return /\b(ltd|llc|inc|corp|corporation|company|co\.|pvt|private|limited|gmbh|studio|media)\b/i.test(
    value,
  )
}

function resolveRequesterTimeZone(body, req) {
  const candidates = [
    body?.requesterTimeZone,
    body?.timeZone,
    body?.timezone,
    body?.tz,
    getHeader(req, 'x-vercel-ip-timezone'),
    getHeader(req, 'cf-timezone'),
    getHeader(req, 'x-timezone'),
  ]

  for (const candidate of candidates) {
    const normalized = normalizeTimeZone(candidate)
    if (normalized) return normalized
  }

  return 'UTC'
}

function normalizeTimeZone(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    Intl.DateTimeFormat('en-US', { timeZone: trimmed })
    return trimmed
  } catch {
    return ''
  }
}

function extractMeetingDate(body) {
  const directCandidates = [
    body?.meetingIsoUtc,
    body?.meetingISO,
    body?.meetingDateTime,
    body?.meetingDatetime,
    body?.dateTime,
    body?.datetime,
    body?.scheduledAt,
  ]

  for (const candidate of directCandidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue
    const parsed = new Date(candidate)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return parseLocalIsoWithOffset(body?.meetingLocalIso, body?.requesterOffsetMinutes)
}

function parseLocalIsoWithOffset(localIso, offsetMinutes) {
  if (typeof localIso !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localIso.trim())
  const parsedOffset = Number(offsetMinutes)

  if (!match || !Number.isFinite(parsedOffset)) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])

  const utcTimestamp =
    Date.UTC(year, month - 1, day, hour, minute, 0, 0) + parsedOffset * 60000

  const date = new Date(utcTimestamp)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateInTimeZone(date, timeZone, suffix) {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })

  const formatted = formatter.format(date)
  return suffix ? `${formatted} ${suffix}` : formatted
}

function getHeader(req, name) {
  if (!req || !req.headers) return ''
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
