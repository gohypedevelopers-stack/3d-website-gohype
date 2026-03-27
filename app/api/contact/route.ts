import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { google, type calendar_v3 } from 'googleapis'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const CONTACT_RECIPIENTS = process.env.CONTACT_RECIPIENTS || 'gourav.moksh@gmail.com'
const GMAIL_USER = process.env.GMAIL_USER || ''
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'GoHype Media <onboarding@resend.dev>'
const GOOGLE_MEET_LINK = process.env.GOOGLE_MEET_LINK || ''
const GOOGLE_CALENDAR_ENABLED = process.env.GOOGLE_CALENDAR_ENABLED === 'true'
const GOOGLE_CALENDAR_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || ''
const GOOGLE_CALENDAR_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ''
const GOOGLE_CALENDAR_REFRESH_TOKEN = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || ''
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary'
const GOOGLE_CALENDAR_ORGANIZER_EMAIL = process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL || GMAIL_USER
const BOOKING_DURATION_MINUTES = parsePositiveInteger(process.env.BOOKING_DURATION_MINUTES, 30)
const INDIA_TIME_ZONE = 'Asia/Kolkata'

type TimeContext = {
    requesterTimeZone: string
    meetingLocalTime: string
    meetingIndiaTime: string
    requestReceivedIndiaTime: string
}

type BookingLinks = {
    eventId: string
    meetingUrl: string
    calendarUrl: string
}

type BookingMode = 'calendar' | 'email'

type EmailPayload = {
    name: string
    email: string
    company?: string
    message?: string
    source?: string
    meetingType?: string
    timeContext: TimeContext
    bookingLinks?: BookingLinks | null
}

type BookingRequest = {
    name: string
    email: string
    company?: string
    message?: string
    recipients: string[]
    meetingStart: Date
    meetingEnd: Date
}

type MailProvider = {
    send: (options: {
        to: string | string[]
        subject: string
        text: string
        html: string
        replyTo?: string
        from?: string
    }) => Promise<void>
}

export async function POST(req: Request) {
    let body: any

    try {
        body = await req.json()
    } catch (error) {
        console.error('contact: invalid JSON', error)
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const { name = '', email = '', message = '', details = '' } = body || {}
    const leadFields = normalizeLeadFields(body)
    const finalMessage = firstNonEmpty([message, details]) || ''
    const meetingStart = extractMeetingDate(body)
    const normalizedRecipients = normalizeEmailList(CONTACT_RECIPIENTS.split(','))

    if (!name.trim() || !email.trim()) {
        return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    if (normalizedRecipients.length === 0) {
        console.error('contact: CONTACT_RECIPIENTS is misconfigured')
        return NextResponse.json({ error: 'Email service is unavailable.' }, { status: 500 })
    }

    if (!hasMailProvider()) {
        console.error('contact: no mail provider configured')
        return NextResponse.json({ error: 'Email service is not configured.' }, { status: 500 })
    }

    const timeContext = buildTimeContext(body, req, leadFields.meetingLabel)
    const mailProvider = createMailProvider()
    const isCalendarBooking = Boolean(meetingStart || leadFields.source === 'calendar' || leadFields.meetingLabel)

    if (isCalendarBooking) {
        if (!meetingStart) {
            return NextResponse.json({ error: 'Selected slot is invalid. Please choose another time.' }, { status: 400 })
        }

        const meetingEnd = new Date(meetingStart.getTime() + BOOKING_DURATION_MINUTES * 60_000)
        let bookingLinks: BookingLinks
        let bookingMode: BookingMode

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
            } catch (error: any) {
                console.error('contact: calendar booking failed', error)

                bookingMode = 'email'
                bookingLinks = {
                    eventId: '',
                    meetingUrl: GOOGLE_MEET_LINK.trim(),
                    calendarUrl: '',
                }
            }
        } else if (GOOGLE_MEET_LINK.trim()) {
            bookingMode = 'email'
            bookingLinks = {
                eventId: '',
                meetingUrl: GOOGLE_MEET_LINK.trim(),
                calendarUrl: '',
            }
        } else {
            return NextResponse.json(
                {
                    error:
                        'Booking is not configured. Add GOOGLE_MEET_LINK for simple email booking, or add Google Calendar OAuth env vars for automatic invites.',
                },
                { status: 500 },
            )
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

        try {
            await sendTeamNotificationEmail(mailProvider, normalizedRecipients, {
                ...teamEmail,
            })

            await sendRequesterConfirmationEmail(mailProvider, {
                name: name.trim(),
                email: email.trim(),
                company: leadFields.company,
                message: finalMessage,
                meetingType: leadFields.meetingType || 'Strategy Call',
                timeContext,
                bookingLinks,
            })
        } catch (error: any) {
            console.error('contact: post-booking email failed', error)
            return NextResponse.json(
                {
                    error: error?.message || 'Booking was saved, but the confirmation email could not be delivered.',
                },
                { status: 500 },
            )
        }

        return NextResponse.json(
            {
                success: true,
                inviteSent: false,
                teamEmailSent: true,
                clientEmailSent: true,
                deliveryMode: bookingMode,
                calendarUrl: bookingLinks.calendarUrl,
                meetingUrl: bookingLinks.meetingUrl,
                meetingType: leadFields.meetingType || 'Strategy Call',
                indiaTime: timeContext.meetingIndiaTime || '',
                meetingLocalTime: timeContext.meetingLocalTime || '',
                requestReceivedIndiaTime: timeContext.requestReceivedIndiaTime,
                requesterTimeZone: timeContext.requesterTimeZone,
            },
            { status: 200 },
        )
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

    try {
        await mailProvider.send({
            from: defaultFromAddress('GoHype Inquiry'),
            to: normalizedRecipients,
            replyTo: email.trim(),
            subject: `New GoHype inquiry from ${name.trim()}`,
            text,
            html,
        })

        return NextResponse.json(
            {
                success: true,
                indiaTime: timeContext.meetingIndiaTime || '',
                requestReceivedIndiaTime: timeContext.requestReceivedIndiaTime,
                requesterTimeZone: timeContext.requesterTimeZone,
            },
            { status: 200 },
        )
    } catch (error: any) {
        console.error('contact: unexpected error', error)
        return NextResponse.json({ error: error?.message || 'Failed to send email.' }, { status: 500 })
    }
}

function hasMailProvider() {
    return Boolean(RESEND_API_KEY || (GMAIL_USER && GMAIL_APP_PASSWORD))
}

function createMailProvider(): MailProvider {
    if (RESEND_API_KEY) {
        const resend = new Resend(RESEND_API_KEY)

        return {
            async send({ to, subject, text, html, replyTo, from }) {
                const response = await resend.emails.send({
                    from: from || defaultFromAddress('GoHype Media'),
                    to: Array.isArray(to) ? to : [to],
                    subject,
                    text,
                    html,
                    replyTo: replyTo ? [replyTo] : undefined,
                })

                if (response.error) {
                    throw new Error(response.error.message || 'Resend failed to deliver the email.')
                }
            },
        }
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD,
        },
    })

    return {
        async send({ to, subject, text, html, replyTo, from }) {
            await transporter.sendMail({
                from: from || defaultFromAddress('GoHype Media'),
                to,
                replyTo,
                subject,
                text,
                html,
            })
        },
    }
}

function defaultFromAddress(label: string) {
    if (RESEND_API_KEY) {
        const email = extractEmailAddress(RESEND_FROM_EMAIL)
        return `${label} <${email}>`
    }

    return `"${label}" <${GMAIL_USER}>`
}

function extractEmailAddress(value: string) {
    const match = /<([^>]+)>/.exec(value)
    return match?.[1]?.trim() || value.trim()
}

async function createCalendarBooking({
    name,
    email,
    company,
    message,
    recipients,
    meetingStart,
    meetingEnd,
}: BookingRequest): Promise<BookingLinks> {
    const calendar = createGoogleCalendarClient()
    const attendees = normalizeEmailList([email, ...recipients]).map((value) => ({ email: value }))

    const insertedEvent = await calendar.events.insert({
        calendarId: GOOGLE_CALENDAR_ID,
        sendUpdates: 'none',
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

async function waitForConferenceLink(calendar: calendar_v3.Calendar, initialEvent: calendar_v3.Schema$Event) {
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

async function sendTeamNotificationEmail(
    mailProvider: MailProvider,
    recipients: string[],
    payload: EmailPayload,
) {
    await mailProvider.send({
        from: defaultFromAddress('GoHype Inquiry'),
        to: recipients,
        replyTo: payload.email,
        subject: `New GoHype booking from ${payload.name}`,
        text: buildLeadText(payload),
        html: buildLeadHtml(payload),
    })
}

async function sendRequesterConfirmationEmail(
    mailProvider: MailProvider,
    payload: Omit<EmailPayload, 'source'> & { meetingType: string; bookingLinks: BookingLinks },
) {
    await mailProvider.send({
        from: defaultFromAddress('GoHype Media'),
        to: payload.email,
        replyTo: GOOGLE_CALENDAR_ORGANIZER_EMAIL || GMAIL_USER,
        subject: `Your ${payload.meetingType} with GoHype is confirmed`,
        text: buildRequesterConfirmationText(payload),
        html: buildRequesterConfirmationHtml(payload),
    })
}

function buildLeadHtml({
    name,
    email,
    company,
    message,
    source,
    meetingType,
    timeContext,
    bookingLinks,
}: EmailPayload) {
    const format = (label: string, value: string) =>
        `<tr><td style="padding:4px 0;color:#0f172a;vertical-align:top;"><strong>${label}:</strong></td><td style="padding:4px 0;color:#0f172a;">${escapeHtml(
            value,
        )}</td></tr>`

    const formatLink = (label: string, href: string, text: string) =>
        `<tr><td style="padding:4px 0;color:#0f172a;vertical-align:top;"><strong>${label}:</strong></td><td style="padding:4px 0;"><a href="${escapeHtml(
            href,
        )}" style="color:#2563eb;">${escapeHtml(text)}</a></td></tr>`

    const rows: string[] = [format('Name', name), format('Email', email)]

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

function buildLeadText({
    name,
    email,
    company,
    message,
    source,
    meetingType,
    timeContext,
    bookingLinks,
}: EmailPayload) {
    const lines: string[] = [`New enquiry from ${name}`, `Email: ${email}`]

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

function buildRequesterConfirmationHtml({
    name,
    company,
    message,
    meetingType,
    timeContext,
    bookingLinks,
}: Omit<EmailPayload, 'source' | 'email'> & { meetingType: string; bookingLinks: BookingLinks }) {
    const bookingDeliveryText = bookingLinks.calendarUrl
        ? 'Thank you for scheduling with GoHype Media. Your meeting has been reserved and the calendar invitation has been prepared for you.'
        : bookingLinks.meetingUrl
          ? 'Thank you for scheduling with GoHype Media. Your meeting request has been received, and the session details are ready below.'
          : 'Thank you for reaching out to GoHype Media. Our team has received your request and will review your requirements before confirming the meeting details with you shortly.'

    const details = [
        timeContext.meetingLocalTime ? `<li><strong>Your time:</strong> ${escapeHtml(timeContext.meetingLocalTime)}</li>` : '',
        timeContext.meetingIndiaTime ? `<li><strong>India time:</strong> ${escapeHtml(timeContext.meetingIndiaTime)}</li>` : '',
        company ? `<li><strong>Company:</strong> ${escapeHtml(company)}</li>` : '',
        message ? `<li><strong>Notes:</strong> ${escapeHtml(message)}</li>` : '',
    ]
        .filter(Boolean)
        .join('')

    return `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#0f172a;">
      <h2 style="margin:0 0 12px;">Thank you for contacting GoHype Media</h2>
      <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;">${escapeHtml(bookingDeliveryText)}</p>
      <p style="margin:0 0 16px;">A member of our team will connect with you and guide you through the next steps. If your booking already includes a meeting link or calendar invite, you can use the details below to join at the scheduled time.</p>
      <ul style="padding-left:18px;margin:0 0 20px;">
        ${details}
      </ul>
      <p style="margin:0 0 16px;">
        ${
            bookingLinks.meetingUrl
                ? `<a href="${escapeHtml(
                      bookingLinks.meetingUrl,
                  )}" style="display:inline-block;padding:12px 18px;background:#facc15;color:#111827;text-decoration:none;border-radius:999px;font-weight:700;margin-right:12px;">Open Google Meet</a>`
                : ''
        }
        ${
            bookingLinks.calendarUrl
                ? `<a href="${escapeHtml(
                      bookingLinks.calendarUrl,
                  )}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">Open Calendar Event</a>`
                : ''
        }
      </p>
      <p style="margin:0 0 8px;color:#475569;">If you need to update your availability or share anything before the call, simply reply to this email and our team will assist you.</p>
      <p style="margin:0;color:#475569;">Regards,<br />GoHype Media Team</p>
    </div>
  `
}

function buildRequesterConfirmationText({
    name,
    company,
    message,
    meetingType,
    timeContext,
    bookingLinks,
}: Omit<EmailPayload, 'source' | 'email'> & { meetingType: string; bookingLinks: BookingLinks }) {
    const bookingDeliveryText = bookingLinks.calendarUrl
        ? 'Thank you for scheduling with GoHype Media. Your meeting has been reserved and the calendar invitation has been prepared for you.'
        : bookingLinks.meetingUrl
          ? 'Thank you for scheduling with GoHype Media. Your meeting request has been received, and the session details are ready below.'
          : 'Thank you for reaching out to GoHype Media. Our team has received your request and will review your requirements before confirming the meeting details with you shortly.'

    const lines = [
        `Hi ${name},`,
        '',
        bookingDeliveryText,
        'A member of our team will connect with you and guide you through the next steps.',
        '',
        timeContext.meetingLocalTime ? `Your time: ${timeContext.meetingLocalTime}` : '',
        timeContext.meetingIndiaTime ? `India time: ${timeContext.meetingIndiaTime}` : '',
        meetingType ? `Meeting type: ${meetingType}` : '',
        company ? `Company: ${company}` : '',
        message ? `Notes: ${message}` : '',
        '',
        bookingLinks.meetingUrl ? `Google Meet: ${bookingLinks.meetingUrl}` : '',
        bookingLinks.calendarUrl ? `Calendar Event: ${bookingLinks.calendarUrl}` : '',
        '',
        'If you need to update your availability or share anything before the call, reply to this email and our team will assist you.',
        '',
        'Regards,',
        'GoHype Media Team',
    ].filter(Boolean)

    return lines.join('\n')
}

function buildTimeContext(body: any, req: Request, fallbackMeetingLabel = ''): TimeContext {
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
    }
}

function normalizeLeadFields(body: any) {
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

function normalizeSource(body: any) {
    const explicitSource = firstNonEmpty([body?.source, body?.leadSource, body?.formSource, body?.origin])
    if (explicitSource) return explicitSource

    const hasMeetingDetails = Boolean(
        extractMeetingDate(body) ||
            firstNonEmpty([body?.meetingLabel, body?.meeting, body?.schedule, body?.scheduledAtLabel]),
    )

    return hasMeetingDetails ? 'calendar' : 'website'
}

function looksLikeMeetingType(value: unknown) {
    if (typeof value !== 'string') return false
    const trimmed = value.trim()
    if (!trimmed) return false

    const meetingWords = /\b(call|meeting|consultation|session)\b/i
    return meetingWords.test(trimmed) && !looksLikeCompanyName(trimmed)
}

function looksLikeMeetingLabel(value: unknown) {
    if (typeof value !== 'string') return false
    const trimmed = value.trim()
    if (!trimmed) return false
    return /^meeting\s*:/i.test(trimmed)
}

function looksLikeCompanyName(value: unknown) {
    if (typeof value !== 'string') return false
    return /\b(ltd|llc|inc|corp|corporation|company|co\.|pvt|private|limited|gmbh|studio|media)\b/i.test(value)
}

function resolveRequesterTimeZone(body: any, req: Request) {
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

function normalizeTimeZone(value: unknown) {
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

function extractMeetingDate(body: any) {
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

function parseLocalIsoWithOffset(localIso: unknown, offsetMinutes: unknown) {
    if (typeof localIso !== 'string') return null
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localIso.trim())
    const parsedOffset = Number(offsetMinutes)

    if (!match || !Number.isFinite(parsedOffset)) return null

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const hour = Number(match[4])
    const minute = Number(match[5])

    const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0, 0) + parsedOffset * 60_000
    const date = new Date(utcTimestamp)

    return Number.isNaN(date.getTime()) ? null : date
}

function formatDateInTimeZone(date: Date, timeZone: string, suffix?: string) {
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

function buildCalendarDescription({
    name,
    email,
    company,
    message,
}: Pick<BookingRequest, 'name' | 'email' | 'company' | 'message'>) {
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

function extractMeetLink(event: calendar_v3.Schema$Event) {
    const entryPoint = event.conferenceData?.entryPoints?.find((item) => item.entryPointType === 'video' && item.uri)
    return entryPoint?.uri || event.hangoutLink || ''
}

function getHeader(req: Request, name: string) {
    if (!req || !req.headers) return ''
    const value = req.headers.get(name)
    return value || ''
}

function firstNonEmpty(values: unknown[]) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
}

function normalizeEmailList(values: string[]) {
    const unique = new Set<string>()

    for (const value of values) {
        const trimmed = value.trim()
        if (!trimmed) continue
        unique.add(trimmed.toLowerCase())
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

function parsePositiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function escapeHtml(input: string) {
    return String(input || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}
