"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Clock, Video, Globe, ChevronLeft, ChevronRight, Info } from "lucide-react"

const AVAILABLE_TIMES = ["10:00", "11:30", "14:00", "15:30", "16:00"]
const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

type PrefillData = {
    name?: string
    email?: string
    company?: string
    details?: string
}

type Props = {
    prefill?: PrefillData | null
}

type BookingResponse = {
    calendarUrl?: string
    meetingUrl?: string
    inviteSent?: boolean
    deliveryMode?: "calendar" | "email"
    teamEmailSent?: boolean
    clientEmailSent?: boolean
    meetingType?: string
    meetingLocalTime?: string
    indiaTime?: string
    requestReceivedIndiaTime?: string
    requesterTimeZone?: string
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1
}

export default function ContactCalendar({ prefill }: Props) {
    const [currentDate, setCurrentDate] = useState<Date | null>(null)
    const [selectedDate, setSelectedDate] = useState<number | null>(null)
    const [selectedTime, setSelectedTime] = useState<string | null>(null)
    const [step, setStep] = useState<"calendar" | "form">("calendar")

    const [formStatus, setFormStatus] = useState({ submitting: false, submitted: false, error: "" })
    const [formData, setFormData] = useState({ name: "", email: "", company: "", details: "" })
    const [bookingResponse, setBookingResponse] = useState<BookingResponse | null>(null)
    const submitLockRef = useRef(false)

    useEffect(() => {
        setCurrentDate(new Date())
    }, [])

    const year = currentDate?.getFullYear()
    const month = currentDate?.getMonth()

    useEffect(() => {
        if (!prefill) return
        setFormData((prev) => ({
            ...prev,
            name: prefill.name ?? prev.name,
            email: prefill.email ?? prev.email,
            company: prefill.company ?? prev.company,
            details: prefill.details ?? prev.details,
        }))
        setStep("form")
        setFormStatus({ submitting: false, submitted: false, error: "" })
    }, [prefill])

    const monthName = useMemo(
        () => currentDate?.toLocaleString("default", { month: "long" }) ?? "",
        [currentDate],
    )

    const handlePrevMonth = () => {
        if (!currentDate || year === undefined || month === undefined) return
        setCurrentDate(new Date(year, month - 1, 1))
        setSelectedDate(null)
        setSelectedTime(null)
    }

    const handleNextMonth = () => {
        if (!currentDate || year === undefined || month === undefined) return
        setCurrentDate(new Date(year, month + 1, 1))
        setSelectedDate(null)
        setSelectedTime(null)
    }

    const daysInMonth = year !== undefined && month !== undefined ? getDaysInMonth(year, month) : 0
    const firstDay = year !== undefined && month !== undefined ? getFirstDayOfMonth(year, month) : 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (submitLockRef.current) return
        submitLockRef.current = true
        setFormStatus({ submitting: true, submitted: false, error: "" })

        try {
            const payload: any = {
                ...formData,
                source: "calendar",
            }

            if (currentDate && selectedDate && selectedTime && year !== undefined && month !== undefined) {
                const [h, m] = selectedTime.split(":").map(Number)
                const localDate = new Date(year, month, selectedDate, h, m, 0, 0)
                payload.meetingIsoUtc = localDate.toISOString()
                payload.meetingLabel = `Meeting: ${monthName} ${selectedDate} at ${selectedTime}`
                payload.requesterTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
                payload.requesterOffsetMinutes = new Date().getTimezoneOffset()
                payload.meetingLocalIso = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
            }

            console.log("contact-calendar: submit payload", {
                formData,
                payload,
                selectedDate,
                selectedTime,
                currentMonth: monthName,
                currentYear: year,
            })

            const res = await fetch("/api/contact-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const contentType = res.headers.get("content-type") || ""
            let data: any = null

            if (contentType.includes("application/json")) {
                data = await res.json()
            } else {
                const text = await res.text()
                console.error("contact-calendar: non-json response", {
                    status: res.status,
                    statusText: res.statusText,
                    body: text,
                })
                throw new Error(
                    `Request failed (${res.status}). ${text.slice(0, 140) || "Unexpected response from server."}`,
                )
            }

            console.log("contact-calendar: api response", {
                ok: res.ok,
                status: res.status,
                requestEmail: payload.email,
                requestName: payload.name,
                data,
            })

            if (!res.ok) {
                console.error("contact-calendar: api error", {
                    status: res.status,
                    requestEmail: payload.email,
                    requestName: payload.name,
                    payload,
                    data,
                })
                throw new Error(data?.error || `Failed to submit (${res.status})`)
            }

            setBookingResponse({
                calendarUrl: data?.calendarUrl || "",
                meetingUrl: data?.meetingUrl || "",
                inviteSent: Boolean(data?.inviteSent),
                deliveryMode: data?.deliveryMode === "calendar" ? "calendar" : "email",
                teamEmailSent: Boolean(data?.teamEmailSent),
                clientEmailSent: Boolean(data?.clientEmailSent),
                meetingType: data?.meetingType || "Strategy Call",
                meetingLocalTime: data?.meetingLocalTime || "",
                indiaTime: data?.indiaTime || "",
                requestReceivedIndiaTime: data?.requestReceivedIndiaTime || "",
                requesterTimeZone: data?.requesterTimeZone || "",
            })
            console.log("contact-calendar: booking success", {
                requestEmail: payload.email,
                requestName: payload.name,
                calendarUrl: data?.calendarUrl || "",
                meetingUrl: data?.meetingUrl || "",
                inviteSent: Boolean(data?.inviteSent),
                deliveryMode: data?.deliveryMode === "calendar" ? "calendar" : "email",
                fullResponse: data,
            })
            setFormStatus({ submitting: false, submitted: true, error: "" })
        } catch (err: any) {
            console.error("contact-calendar: submit failed", {
                message: err?.message || "Unknown error",
                formData,
                error: err,
            })
            setFormStatus({ submitting: false, submitted: false, error: err.message })
        } finally {
            submitLockRef.current = false
        }
    }

    if (!currentDate) {
        return (
            <div className="w-full max-w-5xl mx-auto rounded-3xl bg-[#111113] border border-white/10 shadow-2xl overflow-hidden p-8 text-gray-400">
                Loading scheduler...
            </div>
        )
    }

    if (formStatus.submitted) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white/[0.03] border border-white/10 rounded-3xl backdrop-blur-xl">
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-3xl font-bold text-white mb-3">Booking confirmed!</h3>
                <p className="max-w-md text-lg text-gray-400">
                    {selectedDate && selectedTime
                        ? `Your exploratory call is booked for ${monthName} ${selectedDate} at ${selectedTime}.`
                        : "We'll review your request and get back to you shortly."}
                </p>
                <p className="mt-3 max-w-lg text-sm text-gray-400">
                    {bookingResponse?.calendarUrl
                        ? "A confirmation email with the calendar invite was sent to you and our team."
                        : bookingResponse?.meetingUrl
                          ? "A confirmation email with the meeting details was sent to you and our team."
                          : "Your request was emailed to our team. They will confirm the meeting details shortly."}
                </p>
                <div className="mt-6 w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-400">Booking Status</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                            <p className="text-xs text-gray-500">Meeting Type</p>
                            <p className="text-sm font-medium text-white">{bookingResponse?.meetingType || "Strategy Call"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Delivery Mode</p>
                            <p className="text-sm font-medium capitalize text-white">{bookingResponse?.deliveryMode || "email"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Team Email</p>
                            <p className="text-sm font-medium text-white">{bookingResponse?.teamEmailSent ? "Sent" : "Pending"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Client Email</p>
                            <p className="text-sm font-medium text-white">{bookingResponse?.clientEmailSent ? "Sent" : "Pending"}</p>
                        </div>
                        {bookingResponse?.meetingLocalTime && (
                            <div>
                                <p className="text-xs text-gray-500">Your Time</p>
                                <p className="text-sm font-medium text-white">{bookingResponse.meetingLocalTime}</p>
                            </div>
                        )}
                        {bookingResponse?.indiaTime && (
                            <div>
                                <p className="text-xs text-gray-500">India Time</p>
                                <p className="text-sm font-medium text-white">{bookingResponse.indiaTime}</p>
                            </div>
                        )}
                        {bookingResponse?.requesterTimeZone && (
                            <div>
                                <p className="text-xs text-gray-500">Time Zone</p>
                                <p className="text-sm font-medium text-white">{bookingResponse.requesterTimeZone}</p>
                            </div>
                        )}
                        {bookingResponse?.requestReceivedIndiaTime && (
                            <div>
                                <p className="text-xs text-gray-500">Request Logged</p>
                                <p className="text-sm font-medium text-white">{bookingResponse.requestReceivedIndiaTime}</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {bookingResponse?.meetingUrl && (
                        <a
                            href={bookingResponse.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition-transform hover:scale-[1.02]"
                        >
                            Open Google Meet
                        </a>
                    )}
                    {bookingResponse?.calendarUrl && (
                        <a
                            href={bookingResponse.calendarUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                        >
                            Open Calendar Event
                        </a>
                    )}
                </div>
                <button
                    onClick={() => {
                        setBookingResponse(null)
                        setFormStatus({ submitting: false, submitted: false, error: "" })
                        setStep("calendar")
                        setSelectedTime(null)
                        setSelectedDate(null)
                    }}
                    className="mt-8 rounded-full bg-white/10 hover:bg-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                    Book another slot
                </button>
            </div>
        )
    }

    return (
        <div className="w-full max-w-5xl mx-auto rounded-3xl bg-[#111113] border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-[320px] p-8 border-b md:border-b-0 md:border-r border-white/10 flex flex-col">
                <div className="mb-6 flex items-center gap-4">
                    <img src="/logo.png" alt="GoHype" className="w-12 h-12 rounded-full border border-white/20 bg-slate-900 p-1" />
                    <span className="text-gray-400 font-medium text-sm">Go Hype Media</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Strategy Call w/ GoHype</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-8 text-pretty">
                    Thank you for your interest in GoHype! We look forward to learning more about how we can support your web experiences and answer any questions you might have.
                </p>

                <div className="mt-auto space-y-4 pt-4">
                    <div className="flex items-center gap-3 text-gray-300 font-medium text-sm">
                        <Clock size={18} className="text-gray-500" />
                        30m
                    </div>
                    <div className="flex items-center gap-3 text-gray-300 font-medium text-sm">
                        <Video size={18} className="text-gray-500" />
                        Google Meet
                    </div>
                    <div className="flex items-center gap-3 text-gray-300 font-medium text-sm">
                        <Globe size={18} className="text-gray-500" />
                        Local Time
                    </div>
                </div>
            </div>

            {step === "calendar" ? (
                <div className="flex flex-col md:flex-row flex-1">
                    <div className="flex-1 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-bold text-white">
                                {monthName} <span className="font-normal text-gray-500">{year}</span>
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrevMonth}
                                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={handleNextMonth}
                                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center">
                            {DAYS_OF_WEEK.map((day) => (
                                <div key={day} className="text-xs font-bold text-gray-500 mb-2">
                                    {day}
                                </div>
                            ))}

                            {Array.from({ length: firstDay }).map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}

                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1
                                const isSelected = selectedDate === day
                                const isUnavailable =
                                    day < new Date().getDate() &&
                                    month === new Date().getMonth() &&
                                    year === new Date().getFullYear()

                                if (isUnavailable) {
                                    return (
                                        <div key={day} className="h-12 w-full flex items-center justify-center text-gray-600 cursor-not-allowed text-sm">
                                            {day}
                                        </div>
                                    )
                                }

                                return (
                                    <button
                                        key={day}
                                        onClick={() => {
                                            setSelectedDate(day)
                                            setSelectedTime(null)
                                        }}
                                        className={`h-12 w-full rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                                            isSelected
                                                ? "bg-gradient-to-r from-yellow-400 to-amber-300 text-slate-950 shadow-lg"
                                                : "text-white hover:bg-white/10"
                                        }`}
                                    >
                                        {day}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className={`md:w-[260px] p-8 border-t md:border-t-0 md:border-l border-white/10 transition-opacity duration-300 ${selectedDate ? "opacity-100 block" : "opacity-0 hidden md:block md:invisible"}`}>
                        <div className="mb-6 flex justify-between items-center text-white font-medium">
                            <span>{DAYS_OF_WEEK[(firstDay + (selectedDate || 1) - 1) % 7]} {selectedDate}</span>
                        </div>

                        <div className="space-y-3 mt-4">
                            {AVAILABLE_TIMES.map((time) => (
                                <div key={time} className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedTime(time)}
                                        className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all duration-300 ${
                                            selectedTime === time
                                                ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                                                : "border-white/20 text-white hover:border-yellow-400/50 hover:text-yellow-400"
                                        }`}
                                    >
                                        {time}
                                    </button>
                                    {selectedTime === time && (
                                        <button
                                            onClick={() => setStep("form")}
                                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-300 text-slate-950 font-bold text-sm shadow-lg hover:scale-[1.02] transition-all"
                                        >
                                            Next
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 p-8 flex flex-col">
                    <button
                        onClick={() => setStep("calendar")}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 text-sm font-medium w-fit"
                    >
                        <ChevronLeft size={16} /> Back to Calendar
                    </button>

                    <h3 className="text-xl font-bold text-white mb-6">Enter Details</h3>

                    <form className="space-y-4 max-w-md" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Name *</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/50 transition-all outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email *</label>
                            <input
                                required
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/50 transition-all outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Company</label>
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/50 transition-all outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Anything we should know? (Optional)</label>
                            <textarea
                                rows={3}
                                value={formData.details}
                                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/50 transition-all outline-none resize-none"
                            />
                        </div>

                        {formStatus.error && (
                            <p className="text-red-400 text-sm flex items-center gap-2">
                                <Info size={16} /> {formStatus.error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={formStatus.submitting}
                            className="w-full mt-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 py-3.5 text-slate-950 font-bold shadow-lg hover:shadow-yellow-400/30 hover:scale-[1.01] transition-all disabled:opacity-50"
                        >
                            {formStatus.submitting ? "Scheduling..." : "Schedule Event"}
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}
