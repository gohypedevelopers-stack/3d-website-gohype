'use strict'

const { randomUUID } = require('node:crypto')
const { google } = require('googleapis')
const nodemailer = require('nodemailer')

const DEFAULT_CONTACT_RECIPIENT = 'ravindranathjha76@gmail.com'
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_HOST = process.env.SMTP_HOST || inferSmtpHost(SMTP_USER)
const SMTP_PORT = parsePositiveInteger(process.env.SMTP_PORT, 465)
const SMTP_SECURE = (process.env.SMTP_SECURE || 'true') === 'true'
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER
const CONTACT_RECIPIENTS = process.env.CONTACT_RECIPIENTS || DEFAULT_CONTACT_RECIPIENT
const GOOGLE_MEET_LINK = process.env.GOOGLE_MEET_LINK || ''
const GOOGLE_CALENDAR_ENABLED = process.env.GOOGLE_CALENDAR_ENABLED === 'true'
const GOOGLE_CALENDAR_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || ''
const GOOGLE_CALENDAR_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ''
const GOOGLE_CALENDAR_REFRESH_TOKEN = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || ''
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary'
const GOOGLE_CALENDAR_ORGANIZER_EMAIL = process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL || SMTP_USER
const BOOKING_DURATION_MINUTES = parsePositiveInteger(process.env.BOOKING_DURATION_MINUTES, 30)
const INDIA_TIME_ZONE = 'Asia/Kolkata'
const DEFAULT_SITE_ORIGIN = 'https://3d.gohypemedia.com'
const BRAND_PHONE = '+91 8447788703'
const BRAND_PHONE_LINK = '+918447788703'
const BRAND_WEBSITE_URL = 'https://www.gohypemedia.com'
const BRAND_WEBSITE_LABEL = 'www.gohypemedia.com'

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

  const { name = '', email = '', message = '', details = '' } = body || {}
  const leadFields = normalizeLeadFields(body)
  const finalMessage = firstNonEmpty([message, details]) || ''
  const meetingStart = extractMeetingDate(body)
  const normalizedRecipients = normalizeEmailList([DEFAULT_CONTACT_RECIPIENT, ...CONTACT_RECIPIENTS.split(',')])
  const debugRequestId = firstNonEmpty([
    body?.debugRequestId,
    getHeader(req, 'x-booking-debug-request-id'),
  ])

  console.log('contact: request received', {
    name: String(name || '').trim(),
    email: String(email || '').trim(),
    source: leadFields.source || '',
    hasMeetingStart: Boolean(meetingStart),
    recipients: normalizedRecipients,
    smtpHost: SMTP_HOST,
    smtpPort: SMTP_PORT,
    smtpSecure: SMTP_SECURE,
    smtpUser: SMTP_USER,
    smtpFromEmail: SMTP_FROM_EMAIL,
    handler: 'legacy-api-contact',
    debugRequestId,
  })

  if (!name.trim() || !email.trim()) {
    return res.status(400).json({ error: 'Name and email are required.' })
  }

  if (normalizedRecipients.length === 0) {
    console.error('contact: CONTACT_RECIPIENTS is misconfigured')
    return res.status(500).json({
      error: `CONTACT_RECIPIENTS is missing. Add ${DEFAULT_CONTACT_RECIPIENT} or another valid recipient email.`,
    })
  }

  const mailConfigError = getMailConfigError()
  if (mailConfigError) {
    console.error('contact: invalid mail config', mailConfigError)
    return res.status(500).json({ error: mailConfigError })
  }

  const timeContext = buildTimeContext(body, req, leadFields.meetingLabel)
  const transporter = createTransporter()
  const isCalendarBooking = Boolean(meetingStart || leadFields.source === 'calendar' || leadFields.meetingLabel)

  console.log('contact: booking mode evaluation', {
    isCalendarBooking,
    googleCalendarEnabled: GOOGLE_CALENDAR_ENABLED,
    hasGoogleMeetLink: Boolean(GOOGLE_MEET_LINK.trim()),
    requesterTimeZone: timeContext.requesterTimeZone,
    meetingLocalTime: timeContext.meetingLocalTime,
    meetingIndiaTime: timeContext.meetingIndiaTime,
    handler: 'legacy-api-contact',
    debugRequestId,
  })

  if (isCalendarBooking) {
    if (!meetingStart) {
      return res.status(400).json({ error: 'Selected slot is invalid. Please choose another time.' })
    }

    const meetingEnd = new Date(meetingStart.getTime() + BOOKING_DURATION_MINUTES * 60000)
    let bookingLinks
    let bookingMode

    if (isGoogleCalendarConfigured()) {
      bookingMode = 'calendar'

      try {
        bookingLinks = await createCalendarBooking({
          name: name.trim(),
          email: email.trim(),
          company: leadFields.company,
          message: finalMessage,
          recipients: normalizedRecipients,
          meetingStart,
          meetingEnd,
        })
        console.log('contact: calendar booking created', bookingLinks)
      } catch (error) {
        console.error('contact: calendar booking failed', serializeError(error))

        const staticMeetLink = getValidatedGoogleMeetLink()
        if (!staticMeetLink) {
          return res.status(500).json({
            error: formatCalendarBookingError(error),
            debug: {
              handler: 'legacy-api-contact',
              debugRequestId,
              source: leadFields.source || '',
              isCalendarBooking: true,
              calendarError: String(error?.message || '').trim(),
              googleCalendarEnabled: GOOGLE_CALENDAR_ENABLED,
              supportsDynamicMeet: true,
            },
          })
        }

        bookingMode = 'email'
        bookingLinks = {
          eventId: '',
          meetingUrl: staticMeetLink,
          calendarUrl: '',
        }
      }
    } else if (getValidatedGoogleMeetLink()) {
      bookingMode = 'email'
      bookingLinks = {
        eventId: '',
        meetingUrl: getValidatedGoogleMeetLink(),
        calendarUrl: '',
      }
    } else {
      console.error('contact: booking configuration missing', {
        googleCalendarEnabled: GOOGLE_CALENDAR_ENABLED,
        hasGoogleMeetLink: Boolean(GOOGLE_MEET_LINK.trim()),
        googleMeetLinkValid: Boolean(getValidatedGoogleMeetLink()),
      })
      return res.status(500).json({
        error:
          'Booking is not configured. Add a valid GOOGLE_MEET_LINK for simple email booking, or add Google Calendar OAuth env vars for automatic invites.',
      })
    }

    console.log('contact: booking prepared', {
      bookingMode,
      bookingLinks,
      handler: 'legacy-api-contact',
      debugRequestId,
    })

    if (bookingMode === 'email' && !bookingLinks.meetingUrl) {
      console.error('contact: meeting link missing for email booking', {
        bookingMode,
        bookingLinks,
      })
      return res.status(500).json({
        error: 'Meeting link is missing for this booking. Please configure GOOGLE_MEET_LINK in production.',
      })
    }

    const teamEmail = {
      name: name.trim(),
      email: email.trim(),
      company: leadFields.company,
      message: finalMessage,
      source: leadFields.source,
      meetingType: leadFields.meetingType,
      timeContext,
      bookingLinks,
    }
    const teamNotificationEnvelope = getInternalNotificationEnvelope(normalizedRecipients)

    try {
      console.log('contact: sending team notification', {
        to: teamNotificationEnvelope.to,
        cc: teamNotificationEnvelope.cc,
        subject: `New GoHype booking from ${name.trim()}`,
        handler: 'legacy-api-contact',
        debugRequestId,
      })

      await sendTeamNotificationEmail(transporter, normalizedRecipients, teamEmail)

      console.log('contact: team notification sent', {
        to: teamNotificationEnvelope.to,
        cc: teamNotificationEnvelope.cc,
      })

      console.log('contact: sending client confirmation', {
        to: email.trim(),
        subject: `Your ${leadFields.meetingType || 'Strategy Call'} with GoHype is confirmed`,
      })

      await sendRequesterConfirmationEmail(transporter, {
        name: name.trim(),
        email: email.trim(),
        company: leadFields.company,
        message: finalMessage,
        meetingType: leadFields.meetingType || 'Strategy Call',
        timeContext,
        bookingLinks,
      })

      console.log('contact: client confirmation sent', {
        to: email.trim(),
      })
    } catch (error) {
      console.error('contact: post-booking email failed', serializeError(error))
      return res.status(500).json({
        error: error?.message || 'Booking was saved, but the confirmation email could not be delivered.',
      })
    }

    return res.status(200).json({
      success: true,
      inviteSent: bookingMode === 'calendar',
      teamEmailSent: true,
      clientEmailSent: true,
      deliveryMode: bookingMode,
      calendarUrl: bookingLinks.calendarUrl,
      meetingUrl: bookingLinks.meetingUrl,
      meetingType: leadFields.meetingType || 'Strategy Call',
      meetingLocalTime: timeContext.meetingLocalTime || '',
      indiaTime: timeContext.meetingIndiaTime || '',
      requestReceivedIndiaTime: timeContext.requestReceivedIndiaTime,
      requesterTimeZone: timeContext.requesterTimeZone,
      debug: {
        handler: 'legacy-api-contact',
        debugRequestId,
        source: leadFields.source || '',
        isCalendarBooking: true,
        deliveryMode: bookingMode,
        hasMeetingUrl: Boolean(bookingLinks.meetingUrl),
        hasCalendarUrl: Boolean(bookingLinks.calendarUrl),
        supportsDynamicMeet: true,
      },
    })
  }

  const html = buildLeadHtml({
    name: name.trim(),
    email: email.trim(),
    company: leadFields.company,
    message: finalMessage,
    source: leadFields.source,
    meetingType: leadFields.meetingType,
    timeContext,
    bookingLinks: null,
  })

  const text = buildLeadText({
    name: name.trim(),
    email: email.trim(),
    company: leadFields.company,
    message: finalMessage,
    source: leadFields.source,
    meetingType: leadFields.meetingType,
    timeContext,
    bookingLinks: null,
  })
  const internalNotificationEnvelope = getInternalNotificationEnvelope(normalizedRecipients)

  try {
    console.log('contact: sending website inquiry', {
      to: internalNotificationEnvelope.to,
      cc: internalNotificationEnvelope.cc,
      subject: `New GoHype inquiry from ${name.trim()}`,
    })

    await transporter.sendMail({
      from: defaultFromAddress('GoHype Inquiry'),
      to: internalNotificationEnvelope.to,
      cc: internalNotificationEnvelope.cc,
      replyTo: email.trim(),
      subject: `New GoHype inquiry from ${name.trim()}`,
      text,
      html,
    })

    console.log('contact: website inquiry sent', {
      to: internalNotificationEnvelope.to,
      cc: internalNotificationEnvelope.cc,
    })

    return res.status(200).json({
      success: true,
      indiaTime: timeContext.meetingIndiaTime || '',
      requestReceivedIndiaTime: timeContext.requestReceivedIndiaTime,
      requesterTimeZone: timeContext.requesterTimeZone,
      debug: {
        handler: 'legacy-api-contact',
        debugRequestId,
        source: leadFields.source || '',
        isCalendarBooking: false,
        deliveryMode: 'email',
        supportsDynamicMeet: true,
      },
    })
  } catch (error) {
    console.error('contact: unexpected error', serializeError(error))
    return res.status(500).json({ error: error?.message || 'Failed to send email.' })
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

function getMailConfigError() {
  if (!SMTP_USER) return 'SMTP_USER is missing.'
  if (!SMTP_PASS) return 'SMTP_PASS is missing. For Gmail, use a 16-character App Password.'
  if (!SMTP_HOST) return 'SMTP_HOST is missing. For Gmail, use smtp.gmail.com.'
  return ''
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  })
}

function defaultFromAddress(label) {
  const email = extractEmailAddress(SMTP_FROM_EMAIL || SMTP_USER)
  return `${label} <${email}>`
}

function getInternalNotificationEnvelope(recipients) {
  const to = extractEmailAddress(SMTP_FROM_EMAIL || SMTP_USER || DEFAULT_CONTACT_RECIPIENT)
    .trim()
    .toLowerCase()
  const cc = normalizeEmailList(recipients).filter((value) => value !== to)

  return {
    to: to || DEFAULT_CONTACT_RECIPIENT,
    cc,
  }
}

function extractEmailAddress(value) {
  const match = /<([^>]+)>/.exec(value)
  return match?.[1]?.trim() || String(value || '').trim()
}

function inferSmtpHost(user) {
  const email = extractEmailAddress(user).toLowerCase()
  if (!email) return ''
  if (email.endsWith('@gmail.com') || email.endsWith('@googlemail.com')) return 'smtp.gmail.com'
  return ''
}

function getValidatedGoogleMeetLink() {
  const trimmed = GOOGLE_MEET_LINK.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    const isGoogleMeetHost = url.hostname === 'meet.google.com' || url.hostname.endsWith('.meet.google.com')
    const path = url.pathname.replace(/^\/+/, '')
    const isPlaceholder = /your-link|your-static-link|whoops/i.test(trimmed)
    const hasMeetCode = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(path)

    if (!isGoogleMeetHost || isPlaceholder || !hasMeetCode) {
      return ''
    }

    return `https://meet.google.com/${path}`
  } catch {
    return ''
  }
}

function serializeError(error) {
  return {
    message: error?.message || '',
    code: error?.code || '',
    command: error?.command || '',
    response: error?.response || '',
    responseCode: error?.responseCode || '',
    rejected: error?.rejected || [],
    stack: error?.stack || '',
  }
}

function formatCalendarBookingError(error) {
  const message = String(error?.message || '').trim()
  const description = String(error?.response?.data?.error_description || '').trim()

  if (message === 'invalid_grant' || description === 'Bad Request') {
    return 'Google Calendar authorization failed. Regenerate GOOGLE_CALENDAR_REFRESH_TOKEN for the same Google account used by your OAuth client, then restart the server.'
  }

  return message || 'Google Calendar booking failed. Check your Google Calendar OAuth configuration and try again.'
}

async function createCalendarBooking({ name, email, company, message, recipients, meetingStart, meetingEnd }) {
  const calendar = createGoogleCalendarClient()
  const attendees = normalizeEmailList([email]).map((value) => ({ email: value }))

  const insertedEvent = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    sendUpdates: 'all',
    conferenceDataVersion: 1,
    requestBody: {
      summary: `GoHype Strategy Call: ${name}`,
      description: buildCalendarDescription({ name, email, company, message }),
      start: { dateTime: meetingStart.toISOString() },
      end: { dateTime: meetingEnd.toISOString() },
      attendees,
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  })

  let event = await waitForConferenceLink(calendar, insertedEvent.data)
  let meetingUrl = extractMeetLink(event)

  if (!meetingUrl) {
    if (event.id) {
      try {
        await calendar.events.delete({
          calendarId: GOOGLE_CALENDAR_ID,
          eventId: event.id,
          sendUpdates: 'none',
        })
      } catch (deleteError) {
        console.error('contact: failed to roll back event without Meet link', deleteError)
      }
    }

    throw new Error('Google Meet link could not be generated for this slot. Please try again.')
  }

  return {
    eventId: event.id || '',
    meetingUrl,
    calendarUrl: event.htmlLink || '',
  }
}

function createGoogleCalendarClient() {
  const auth = new google.auth.OAuth2(GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN })

  return google.calendar({
    version: 'v3',
    auth,
  })
}

async function waitForConferenceLink(calendar, initialEvent) {
  let event = initialEvent

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (extractMeetLink(event)) return event
    if (!event.id) return event

    await delay(1000)

    const refreshed = await calendar.events.get({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId: event.id,
    })

    event = refreshed.data
  }

  return event
}

async function sendTeamNotificationEmail(transporter, recipients, payload) {
  const envelope = getInternalNotificationEnvelope(recipients)

  await transporter.sendMail({
    from: defaultFromAddress('GoHype Inquiry'),
    to: envelope.to,
    cc: envelope.cc,
    replyTo: payload.email,
    subject: `New GoHype booking from ${payload.name}`,
    text: buildBookingTeamText(payload),
    html: buildBookingTeamHtml(payload),
  })
}

async function sendRequesterConfirmationEmail(transporter, payload) {
  await transporter.sendMail({
    from: defaultFromAddress('GoHype Media'),
    to: payload.email,
    replyTo: GOOGLE_CALENDAR_ORGANIZER_EMAIL || SMTP_USER,
    subject: `Your ${payload.meetingType} with GoHype is confirmed`,
    text: buildRequesterConfirmationText(payload),
    html: buildRequesterConfirmationHtml(payload),
  })
}

function buildBookingTeamHtml(payload) {
  return buildBookingEmailHtml(payload, 'team')
}

function buildBookingTeamText(payload) {
  return buildBookingEmailText(payload, 'team')
}

function buildBookingEmailHtml(payload, variant) {
  const greeting = variant === 'team' ? 'Hi Team,' : `Hi ${escapeHtml(payload.name)},`
  const intro =
    variant === 'team'
      ? 'A new call has been scheduled with Go Hype Media.'
      : 'Thank you for scheduling a call with us, we are excited to connect with you!'
  const bullets =
    variant === 'team'
      ? [
          "Understand the client's business goals",
          'Discuss the current challenges in detail',
          'Share how we can help with smart marketing and premium website solutions',
        ]
      : [
          'Understand your business goals',
          'Discuss your current challenges',
          'Share how we can help you grow with smart marketing and premium website solutions',
        ]
  const platformLabel = resolveBookingPlatformLabel(payload.bookingLinks)
  const detailRows = [
    buildBookingDetailRow('Date', payload.timeContext.meetingDateLabel || payload.timeContext.meetingLocalTime || 'To be shared'),
    buildBookingDetailRow('Time', payload.timeContext.meetingTimeLabel || payload.timeContext.meetingLocalTime || 'To be shared'),
    buildBookingDetailRow('Platform', platformLabel),
  ].join('')
  const actions = [
    payload.bookingLinks?.meetingUrl
      ? `<a href="${escapeHtml(
          payload.bookingLinks.meetingUrl,
        )}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;">Join Call</a>`
      : '',
    payload.bookingLinks?.calendarUrl
      ? `<a href="${escapeHtml(
          payload.bookingLinks.calendarUrl,
        )}" style="display:inline-block;padding:12px 20px;border-radius:999px;border:1px solid #111827;color:#111827;text-decoration:none;font-weight:700;margin-left:12px;">View Calendar Invite</a>`
      : '',
  ]
    .filter(Boolean)
    .join('')
  const extraHtml =
    variant === 'team'
      ? buildTeamRequesterDetailsHtml(payload)
      : payload.message
        ? buildOptionalNotesHtml({
            heading: 'Anything specific to prepare?',
            body: payload.message,
          })
        : ''
  const logoUrl = buildBrandLogoUrl()

  return `
    <div style="margin:0;background:#f3f4f6;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#000000 0%,#1f2937 100%);padding:28px 32px;text-align:center;">
          <img src="${escapeHtml(
            logoUrl,
          )}" alt="Go Hype Media" style="display:block;margin:0 auto 18px;max-width:190px;width:100%;height:auto;" />
          <p style="margin:0;color:#d1d5db;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Go Hype Media</p>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;color:#ffffff;">
            ${variant === 'team' ? 'New Call Scheduled' : 'Your Call Is Confirmed'}
          </h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">${greeting}</p>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#334155;">${escapeHtml(intro)}</p>
          <div style="margin:0 0 24px;padding:22px;border-radius:20px;background:#fafafa;border:1px solid #e5e7eb;">
            <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a;">Here are your call details:</p>
            <table style="width:100%;border-collapse:collapse;">
              ${detailRows}
            </table>
          </div>
          ${
            actions
              ? `<div style="margin:0 0 24px;">${actions}</div>`
              : ''
          }
          <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0f172a;">During this call, we will:</p>
          <ul style="margin:0 0 24px;padding-left:20px;color:#334155;line-height:1.8;">
            ${bullets.map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`).join('')}
          </ul>
          ${extraHtml}
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#334155;">
            ${
              variant === 'team'
                ? 'Please review the booking details and be ready to connect with the client at the scheduled time.'
                : 'If there is anything specific you would like us to prepare beforehand, feel free to reply to this email.'
            }
          </p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#334155;">
            ${variant === 'team' ? 'Looking forward to a productive conversation.' : 'Looking forward to speaking with you!'}
          </p>
          <div style="padding-top:20px;border-top:1px solid #e5e7eb;color:#334155;line-height:1.8;">
            <p style="margin:0 0 8px;font-size:16px;">Warm regards,</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">Team Go Hype Media</p>
            <p style="margin:4px 0 0;"><a href="tel:${escapeHtml(BRAND_PHONE_LINK)}" style="color:#111827;text-decoration:none;">${escapeHtml(
              BRAND_PHONE,
            )}</a></p>
            <p style="margin:4px 0 0;"><a href="${escapeHtml(
              BRAND_WEBSITE_URL,
            )}" style="color:#111827;text-decoration:none;">${escapeHtml(BRAND_WEBSITE_LABEL)}</a></p>
          </div>
        </div>
      </div>
    </div>
  `
}

function buildBookingEmailText(payload, variant) {
  const platformLabel = resolveBookingPlatformLabel(payload.bookingLinks)
  const lines = [
    variant === 'team' ? 'Hi Team,' : `Hi ${payload.name},`,
    '',
    variant === 'team'
      ? 'A new call has been scheduled with Go Hype Media.'
      : 'Thank you for scheduling a call with us, we are excited to connect with you!',
    '',
    'Here are your call details:',
    `Date: ${payload.timeContext.meetingDateLabel || payload.timeContext.meetingLocalTime || 'To be shared'}`,
    `Time: ${payload.timeContext.meetingTimeLabel || payload.timeContext.meetingLocalTime || 'To be shared'}`,
    `Platform: ${platformLabel}`,
    payload.bookingLinks?.meetingUrl ? `Call Link: ${payload.bookingLinks.meetingUrl}` : '',
    payload.bookingLinks?.calendarUrl ? `Calendar Invite: ${payload.bookingLinks.calendarUrl}` : '',
    '',
    'During this call, we will:',
    variant === 'team' ? "- Understand the client's business goals" : '- Understand your business goals',
    variant === 'team' ? '- Discuss the current challenges in detail' : '- Discuss your current challenges',
    variant === 'team'
      ? '- Share how we can help with smart marketing and premium website solutions'
      : '- Share how we can help you grow with smart marketing and premium website solutions',
    '',
  ]

  if (variant === 'team') {
    lines.push('Requester Details:')
    lines.push(`Name: ${payload.name}`)
    lines.push(`Email: ${payload.email}`)
    if (payload.company) lines.push(`Company: ${payload.company}`)
    if (payload.meetingType) lines.push(`Meeting Type: ${payload.meetingType}`)
    if (payload.message) lines.push(`Notes: ${payload.message}`)
    lines.push('')
    lines.push('Please review the booking details and be ready to connect with the client at the scheduled time.')
    lines.push('')
    lines.push('Looking forward to a productive conversation.')
  } else {
    if (payload.message) {
      lines.push(`Preparation Note: ${payload.message}`)
      lines.push('')
    }
    lines.push('If there is anything specific you would like us to prepare beforehand, feel free to reply to this email.')
    lines.push('')
    lines.push('Looking forward to speaking with you!')
  }

  lines.push('')
  lines.push('Warm regards,')
  lines.push('Team Go Hype Media')
  lines.push(BRAND_PHONE)
  lines.push(BRAND_WEBSITE_LABEL)

  return lines.filter(Boolean).join('\n')
}

function buildBookingDetailRow(label, value) {
  return `<tr><td style="padding:8px 0;color:#475569;font-size:14px;width:108px;vertical-align:top;"><strong>${escapeHtml(
    label,
  )}:</strong></td><td style="padding:8px 0;color:#0f172a;font-size:15px;">${escapeHtml(value)}</td></tr>`
}

function buildOptionalNotesHtml({ heading, body }) {
  return `
    <div style="margin:0 0 24px;padding:18px 20px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(heading)}</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">${escapeHtml(body)}</p>
    </div>
  `
}

function buildTeamRequesterDetailsHtml(payload) {
  const detailItems = [
    buildBookingDetailRow('Name', payload.name),
    buildBookingDetailRow('Email', payload.email),
    payload.company ? buildBookingDetailRow('Company', payload.company) : '',
    payload.meetingType ? buildBookingDetailRow('Meeting Type', payload.meetingType) : '',
    payload.message ? buildBookingDetailRow('Notes', payload.message) : '',
  ]
    .filter(Boolean)
    .join('')

  return `
    <div style="margin:0 0 24px;padding:20px;border-radius:18px;background:#fafafa;border:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111827;">Requester details</p>
      <table style="width:100%;border-collapse:collapse;">
        ${detailItems}
      </table>
    </div>
  `
}

function resolveBookingPlatformLabel(bookingLinks) {
  if (bookingLinks?.meetingUrl) {
    return bookingLinks.meetingUrl.includes('meet.google.com') ? 'Google Meet' : 'Call Link'
  }

  return bookingLinks?.calendarUrl ? 'Calendar Invite' : 'To be shared'
}

function buildBrandLogoUrl() {
  return `${resolveConfiguredSiteOrigin()}/logo.png`
}

function resolveConfiguredSiteOrigin() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    DEFAULT_SITE_ORIGIN,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate)
    if (normalized) return normalized
  }

  return DEFAULT_SITE_ORIGIN
}

function normalizeOrigin(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    return new URL(candidate).origin
  } catch {
    return ''
  }
}

function buildLeadHtml({ name, email, company, message, source, meetingType, timeContext, bookingLinks }) {
  const format = (label, value) =>
    `<tr><td style="padding:4px 0;color:#0f172a;vertical-align:top;"><strong>${label}:</strong></td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(
      value,
    )}</td></tr>`

  const formatLink = (label, href, text) =>
    `<tr><td style="padding:4px 0;color:#0f172a;vertical-align:top;"><strong>${label}:</strong></td><td style="padding:4px 0;"><a href="${escapeHtml(
      href,
    )}" style="color:#2563eb;">${escapeHtml(text)}</a></td></tr>`

  const rows = [format('Name', name), format('Email', email)]

  if (company) rows.push(format('Company', company))
  if (message) rows.push(format('Message', message))
  if (source) rows.push(format('Source', source))
  if (meetingType) rows.push(format('Meeting Type', meetingType))
  if (timeContext.requesterTimeZone) rows.push(format('Requester Time Zone', timeContext.requesterTimeZone))
  if (timeContext.meetingLocalTime) rows.push(format('Meeting (Requester Local)', timeContext.meetingLocalTime))
  if (timeContext.meetingIndiaTime) rows.push(format('Meeting (India Time)', timeContext.meetingIndiaTime))
  if (timeContext.requestReceivedIndiaTime) {
    rows.push(format('Request Received (India Time)', timeContext.requestReceivedIndiaTime))
  }
  if (bookingLinks?.meetingUrl) rows.push(formatLink('Google Meet', bookingLinks.meetingUrl, 'Open Meet link'))
  if (bookingLinks?.calendarUrl) rows.push(formatLink('Calendar Event', bookingLinks.calendarUrl, 'Open calendar event'))

  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;">
      <h2 style="margin:0 0 16px;">New enquiry from ${escapeHtml(name)}</h2>
      <table style="border-collapse:collapse;">
        ${rows.join('')}
      </table>
    </div>
  `
}

function buildLeadText({ name, email, company, message, source, meetingType, timeContext, bookingLinks }) {
  const lines = [`New enquiry from ${name}`, `Email: ${email}`]

  if (company) lines.push(`Company: ${company}`)
  if (message) lines.push(`Message: ${message}`)
  if (source) lines.push(`Source: ${source}`)
  if (meetingType) lines.push(`Meeting Type: ${meetingType}`)
  if (timeContext.requesterTimeZone) lines.push(`Requester Time Zone: ${timeContext.requesterTimeZone}`)
  if (timeContext.meetingLocalTime) lines.push(`Meeting (Requester Local): ${timeContext.meetingLocalTime}`)
  if (timeContext.meetingIndiaTime) lines.push(`Meeting (India Time): ${timeContext.meetingIndiaTime}`)
  if (timeContext.requestReceivedIndiaTime) {
    lines.push(`Request Received (India Time): ${timeContext.requestReceivedIndiaTime}`)
  }
  if (bookingLinks?.meetingUrl) lines.push(`Google Meet: ${bookingLinks.meetingUrl}`)
  if (bookingLinks?.calendarUrl) lines.push(`Calendar Event: ${bookingLinks.calendarUrl}`)

  return lines.join('\n')
}

function buildRequesterConfirmationHtml({ name, company, message, meetingType, timeContext, bookingLinks }) {
  return buildBookingEmailHtml(
    {
      name,
      email: '',
      company,
      message,
      meetingType,
      timeContext,
      bookingLinks,
    },
    'requester',
  )
}

function buildRequesterConfirmationText({ name, company, message, meetingType, timeContext, bookingLinks }) {
  return buildBookingEmailText(
    {
      name,
      email: '',
      company,
      message,
      meetingType,
      timeContext,
      bookingLinks,
    },
    'requester',
  )
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
    meetingIndiaTime: meetingDate ? formatDateInTimeZone(meetingDate, INDIA_TIME_ZONE, 'IST') : '',
    requestReceivedIndiaTime: formatDateInTimeZone(new Date(), INDIA_TIME_ZONE, 'IST'),
    meetingDateLabel: meetingDate ? formatDateOnlyInTimeZone(meetingDate, requesterTimeZone) : '',
    meetingTimeLabel: meetingDate ? formatTimeOnlyInTimeZone(meetingDate, requesterTimeZone) : '',
  }
}

function normalizeLeadFields(body) {
  let company = firstNonEmpty([body?.company, body?.companyName, body?.organization, body?.organisation])
  let meetingType = firstNonEmpty([body?.meetingType, body?.callType, body?.eventType])
  let meetingLabel = firstNonEmpty([body?.meetingLabel, body?.meeting, body?.schedule, body?.scheduledAtLabel])

  if (looksLikeMeetingType(company) && (!meetingType || company === meetingType)) {
    if (!meetingType) meetingType = company
    company = ''
  }

  if (looksLikeMeetingLabel(company) && (!meetingLabel || company === meetingLabel)) {
    if (!meetingLabel) meetingLabel = company
    company = ''
  }

  return {
    source: normalizeSource(body),
    company,
    meetingType,
    meetingLabel,
  }
}

function normalizeSource(body) {
  const explicitSource = firstNonEmpty([body?.source, body?.leadSource, body?.formSource, body?.origin])
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

  const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0, 0) + parsedOffset * 60000
  const date = new Date(utcTimestamp)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateInTimeZone(date, timeZone, suffix) {
  try {
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
  } catch {
    return ''
  }
}

function formatDateOnlyInTimeZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(date)
  } catch {
    return ''
  }
}

function formatTimeOnlyInTimeZone(date, timeZone) {
  try {
    const formattedTime = new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone,
    }).format(date)

    return timeZone ? `${formattedTime} (${timeZone})` : formattedTime
  } catch {
    return ''
  }
}

function buildCalendarDescription({ name, email, company, message }) {
  return [
    'Booked via GoHype Media website.',
    `Requester: ${name}`,
    `Email: ${email}`,
    company ? `Company: ${company}` : '',
    message ? `Notes: ${message}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function extractMeetLink(event) {
  const entryPoint = event.conferenceData?.entryPoints?.find((item) => item.entryPointType === 'video' && item.uri)
  return entryPoint?.uri || event.hangoutLink || ''
}

function getHeader(req, name) {
  if (!req || !req.headers) return ''
  const normalizedName = String(name || '').toLowerCase()
  const value = req.headers[normalizedName] ?? req.headers[name]
  const normalized = Array.isArray(value) ? value[0] || '' : value || ''
  return String(normalized).split(',')[0].trim()
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function normalizeEmailList(values) {
  const unique = new Set()

  for (const value of values) {
    const trimmed = extractEmailAddress(value).trim().toLowerCase()
    if (!trimmed) continue
    unique.add(trimmed)
  }

  return Array.from(unique)
}

function isGoogleCalendarConfigured() {
  return Boolean(
    GOOGLE_CALENDAR_ENABLED &&
      GOOGLE_CALENDAR_CLIENT_ID &&
      GOOGLE_CALENDAR_CLIENT_SECRET &&
      GOOGLE_CALENDAR_REFRESH_TOKEN &&
      GOOGLE_CALENDAR_ID,
  )
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
