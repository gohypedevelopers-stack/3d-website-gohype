const FALLBACK_BOOKING_URL =
  "mailto:info@gohypemedia.com?subject=GoHype%20Discovery%20Call"

export default function ContactCalendar() {
  const bookingUrl =
    process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || FALLBACK_BOOKING_URL
  const opensNewTab = /^https?:\/\//i.test(bookingUrl)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400/80">
          Discovery Call
        </p>
        <h3 className="mt-4 text-3xl font-black tracking-tight text-white">
          Pick the fastest path to launch
        </h3>
        <p className="mt-4 text-base leading-relaxed text-gray-400">
          Share the project scope, budget range, and timeline. If you already
          have references or wireframes, bring them to the call and we can
          turn the conversation into a concrete build plan.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href={bookingUrl}
            target={opensNewTab ? "_blank" : undefined}
            rel={opensNewTab ? "noreferrer" : undefined}
            className="inline-flex items-center rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-yellow-400/25 transition-all duration-300 hover:scale-105 hover:shadow-yellow-400/40"
          >
            {opensNewTab ? "Open Booking Link" : "Email Your Brief"}
          </a>
          <a
            href="tel:+918447788703"
            className="inline-flex items-center rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-yellow-400/40 hover:text-yellow-300"
          >
            Call +91 84477 88703
          </a>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8">
        <h4 className="text-xl font-bold text-white">What to send before we talk</h4>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-400">
          <p>Project type: marketing site, product showcase, or full 3D experience.</p>
          <p>Timeline: desired launch date, campaign deadline, or internal milestone.</p>
          <p>Budget range: enough to scope the right level of motion, rendering, and support.</p>
          <p>References: websites, visual direction, or brand assets you want us to use.</p>
        </div>
      </div>
    </div>
  )
}
