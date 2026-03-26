"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { Menu, Code, PenTool, Wind, ArrowRight, MessageCircle, X, Send } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { sendEmail } from "./actions" // This imports your server-side function
import ContactCalendar from "../components/contact-calendar"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

// --- DATA OBJECT ---
const DATA = {
  siteName: "Go Hype Media",
  tagline: "Experience the Future of the Web in 3D",
  subTagline:
    "We build immersive, next gen websites powered by Three.js, WebGL, and bold interaction design. Turn your online presence into an experience that moves, breathes, and sells.",
  ctaPrimary: { label: "Book a Clarity Call", href: "#quote" },
  ctaSecondary: { label: "View Work", href: "#work" },
  contact: {
    phone: "+91-8447788703",
    email: "info@gohypemedia.com",
    address: "New Delhi, India",
    hours: "Mon–Sat | 10 AM – 6:30 PM",
  },
  navLinks: [
    { href: "#services", label: "Services" },
    { href: "#work", label: "Work" },
    { href: "#partners", label: "Partners" },
    { href: "#quote", label: "Contact" },
  ],
  partners: [
    {
      name: "Unseen Studios",
      logo: "/logos/unseen-studios.png", // Using local logo
      testimonial: {
        text: "Partnering with GoHype was a turning point. Our 3D website isn’t just a site — it’s a story that our audience interacts with. The blend of design and depth made us stand out instantly.",
        author: "Michael Chen",
        position: "Digital Lead, Unseen Studios",
        rating: 5,
      },
    },
    {
      name: "Palmolive",
      logo: "/logos/palmolive.png", // Using local logo
      testimonial: {
        text: "GoHype Media transformed our digital presence with stunning 3D product visualizations. The attention to detail and creative execution exceeded our expectations.",
        author: "Sarah Johnson",
        position: "Marketing Director, Palmolive",
        rating: 5,
      },
    },
    {
      name: "Kohler",
      logo: "/logos/kohler.png", // Using local logo
      testimonial: {
        text: "The team delivered a premium web experience that perfectly captures our luxury brand essence. The 3D configurator they built has significantly increased customer engagement.",
        author: "Emily Rodriguez",
        position: "VP of Digital, Kohler",
        rating: 5,
      },
    },
    {
      name: "Nestle",
      logo: "/logos/nestle.png", // Using local logo
      testimonial: {
        text: "GoHype Media's expertise in motion design and modern UI helped us launch a campaign that resonated with millions. Their professionalism and creativity are unmatched.",
        author: "David Park",
        position: "Brand Manager, Nestle",
        rating: 5,
      },
    },
    {
      name: "Dabur",
      logo: "/logos/dabur.png", // Using local logo
      testimonial: {
        text: "From concept to execution, GoHype delivered excellence. The interactive elements they created have dramatically improved our user engagement and conversion rates.",
        author: "Priya Sharma",
        position: "Head of Digital Marketing, Dabur",
        rating: 5,
      },
    },
    {
      name: "Cerelac",
      logo: "/logos/cerelac.png", // Using local logo
      testimonial: {
        text: "The modern, playful design GoHype created perfectly aligns with our brand values. Their technical skills combined with creative vision make them our go to agency.",
        author: "James Wilson",
        position: "Product Marketing Lead, Cerelac",
        rating: 5,
      },
    },
  ],
  services: [
    {
      title: "3D Website Development",
      description:
        "Transform your digital space into an interactive dimension. From concept to code, we craft high performance 3D websites powered by advanced rendering and seamless motion.",
      icon: <Code size={24} />,
    },
    {
      title: "Immersive UI/UX Design",
      description:
        "Intuitive layouts meet futuristic aesthetics. We design experiences that guide users through motion, depth, and flow — not just pages.",
      icon: <PenTool size={24} />,
    },
    {
      title: "Web Performance & Optimization",
      description:
        "Visual brilliance means nothing without speed. Our websites load fast, perform smoothly, and are optimized for every device and browser.",
      icon: <Wind size={24} />,
    },
  ],
  projects: [
    {
      "category": "Sports & Recreation",
      "video": "/videos/deuce.mp4"
    },
    {
      "category": "Food & Beverage",
      "video": "/videos/fizzix.mp4"
    },
    {
      "category": "Lifestyle & Culture",
      "video": "/videos/delan.mp4"
    },
    {
      "category": "Technology & Innovation",
      "video": "/videos/katana.mp4"
    },
    {
      "category": "Creative & Digital",
      "video": "/videos/cappen.mp4"
    },
    {
      "category": "Technology & Innovation",
      "video": "/videos/shaga.mp4"
    },
    {
      "category": "Entertainment & Media",
      "video": "/videos/coundex.mp4"
    }
  ],
  social: [
    { label: "Facebook", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "LinkedIn", href: "#" },
    { label: "YouTube", href: "#" },
  ],
}

// Simple Stacking Cards Components
function StackingCards({ children, totalCards }: { children: React.ReactNode; totalCards: number }) {
  return <div className="relative">{children}</div>
}

function StackingCardItem({ children, index, className = "" }: any) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 100 },
      {
        opacity: 1,
        y: 0,
        scrollTrigger: {
          trigger: ref.current,
          start: "top 90%",
          end: "top 50%",
          scrub: 1,
        },
      }
    )
  }, [])

  return (
    <div ref={ref} className={`project-item ${className}`}>
      {children}
    </div>
  )
}

// Simple GlowCard Component
function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`service-card rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl hover:border-primary/30 transition-all duration-300 ${className}`}>
      {children}
    </div>
  )
}

// AI Chat Component
function AIChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([
    { text: "Hi! How can I help you today?", isUser: false },
  ])
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    setMessages([...messages, { text: input, isUser: true }])
    const userMessage = input.toLowerCase()
    setInput("")

    setTimeout(() => {
      let botResponse = "I'm sorry, I didn't understand that. Could you rephrase?"

      if (userMessage.includes("services")) {
        botResponse = `We offer the following services: ${DATA.services
          .map((service) => service.title)
          .join(", ")}.`
      } else if (userMessage.includes("contact")) {
        botResponse = `You can reach us at ${DATA.contact.email} or call us at ${DATA.contact.phone}.`
      } else if (userMessage.includes("projects")) {
        botResponse = `Here are some of our projects: ${DATA.projects
          .map((project) => project.category)
          .join(", ")}.`
      } else if (userMessage.includes("testimonial")) {
        botResponse = `Here's what our clients say: \"${DATA.partners[0].testimonial.text}\" - ${DATA.partners[0].testimonial.author}`
      }

      setMessages((prev) => [...prev, { text: botResponse, isUser: false }])
    }, 1000)
  }

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 text-slate-950 shadow-2xl shadow-yellow-400/30 hover:shadow-yellow-400/50 hover:scale-110 transition-all flex items-center justify-center"
        aria-label="Open chat"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] rounded-3xl bg-slate-950 border border-white/10 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-400 to-amber-300 p-4">
            <h3 className="text-lg font-bold text-slate-950">Chat with us</h3>
            <p className="text-sm text-slate-950/80">We typically reply in minutes</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.isUser
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-300 text-slate-950'
                    : 'bg-white/10 text-white'
                    }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/50 focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleSend}
                className="rounded-xl bg-gradient-to-r from-yellow-400 to-amber-300 p-2 text-slate-950 hover:scale-105 transition-transform"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ThreeBackground Component
function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x0a0a0a, 15, 50)

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0, 0, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const amb = new THREE.AmbientLight(0xffd700, 0.5)
    const dir = new THREE.DirectionalLight(0xffd700, 2.5)
    dir.position.set(5, 5, 5)
    const dir2 = new THREE.DirectionalLight(0xffb700, 2)
    dir2.position.set(-5, -3, -5)
    const pointLight = new THREE.PointLight(0xffc107, 1.5, 20)
    pointLight.position.set(0, 0, 5)
    scene.add(amb, dir, dir2, pointLight)

    const torusGeo = new THREE.TorusKnotGeometry(1.2, 0.4, 128, 16)
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.2,
      wireframe: false,
      emissive: 0xffb700,
      emissiveIntensity: 0.3,
    })
    const torusKnot = new THREE.Mesh(torusGeo, torusMat)
    torusKnot.position.set(-2, 1, -2)
    scene.add(torusKnot)

    const sphereGeo = new THREE.IcosahedronGeometry(0.8, 1)
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xffc107,
      metalness: 0.7,
      roughness: 0.25,
      wireframe: true,
      emissive: 0xffb700,
      emissiveIntensity: 0.2,
    })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.position.set(3, -1, -3)
    scene.add(sphere)

    const octaGeo = new THREE.OctahedronGeometry(1, 0)
    const octaMat = new THREE.MeshStandardMaterial({
      color: 0xffeb3b,
      metalness: 0.75,
      roughness: 0.2,
      wireframe: false,
      emissive: 0xffa000,
      emissiveIntensity: 0.25,
    })
    const octahedron = new THREE.Mesh(octaGeo, octaMat)
    octahedron.position.set(2, 2, -4)
    scene.add(octahedron)

    const pGeo = new THREE.BufferGeometry()
    const COUNT = 1200
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 25
      positions[i + 1] = (Math.random() - 0.5) * 25
      positions[i + 2] = (Math.random() - 0.5) * 25
      colors[i] = 1.0
      colors[i + 1] = 0.8 + Math.random() * 0.2
      colors[i + 2] = 0.0
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    const pMat = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    })
    const points = new THREE.Points(pGeo, pMat)
    scene.add(points)

    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0

    const onMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect()
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    }
    mount.addEventListener("mousemove", onMove)

    const onResize = () => {
      if (!mount) return
      const { clientWidth, clientHeight } = mount
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(clientWidth, clientHeight)
    }
    window.addEventListener("resize", onResize)

    let frameId: number
    const tick = () => {
      frameId = requestAnimationFrame(tick)
      mouseX += (targetX - mouseX) * 0.05
      mouseY += (targetY - mouseY) * 0.05

      torusKnot.rotation.x += 0.003
      torusKnot.rotation.y += 0.005
      torusKnot.position.x += (mouseX * 1.2 - torusKnot.position.x + 2) * 0.03
      torusKnot.position.y += (-mouseY * 1.2 - torusKnot.position.y - 1) * 0.03

      sphere.rotation.x += 0.002
      sphere.rotation.y += 0.004
      sphere.position.y += Math.sin(Date.now() * 0.001) * 0.003
      sphere.position.x += (mouseX * 0.8 - sphere.position.x - 3) * 0.02

      octahedron.rotation.z += 0.004
      octahedron.rotation.y += 0.003
      octahedron.position.x += Math.cos(Date.now() * 0.0008) * 0.003
      octahedron.position.y += (mouseY * 0.6 - octahedron.position.y - 2) * 0.025

      points.rotation.y -= 0.0008
      points.rotation.x = mouseY * 0.15
      points.rotation.z = mouseX * 0.1

      pointLight.position.x = mouseX * 3
      pointLight.position.y = -mouseY * 3

      camera.position.x += (mouseX * 0.3 - camera.position.x) * 0.02
      camera.position.y += (-mouseY * 0.3 - camera.position.y) * 0.02
      camera.lookAt(scene.position)

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("resize", onResize)
      if (mount) mount.removeEventListener("mousemove", onMove)
      if (mount && renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      torusGeo.dispose()
      torusMat.dispose()
      sphereGeo.dispose()
      sphereMat.dispose()
      octaGeo.dispose()
      octaMat.dispose()
      pGeo.dispose()
      pMat.dispose()
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />
}

const MagneticButton = ({ children, className = "", href, ...props }: any) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const spanRef = useRef<HTMLSpanElement>(null)

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current || !spanRef.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    spanRef.current.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`
    ref.current.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`
  }

  const handleLeave = () => {
    if (!ref.current || !spanRef.current) return
    spanRef.current.style.transform = `translate(0px, 0px)`
    ref.current.style.transform = `translate(0px, 0px)`
  }

  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...props}
      className={`relative inline-block transition-transform duration-300 ease-out will-change-transform ${className}`}
    >
      <span ref={spanRef} className="relative block transition-transform duration-300 ease-out will-change-transform">
        {children}
      </span>
    </a>
  )
}

const Header = ({ siteName, navLinks, ctaPrimary }: any) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!headerRef.current) return
    gsap.fromTo(headerRef.current, { y: -100, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" })
  }, [])

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-xl bg-slate-950/80"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
        <a href="#" className="flex items-center gap-3 group" aria-label="Go home">
          <img
            src="/logo.png"
            alt={`${siteName} logo`}
            className="h-11 w-11 group-hover:scale-110 transition-transform duration-300"
          />
          <span className="text-xl font-bold tracking-tight text-white">{siteName}</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link: any) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-yellow-400 group-hover:w-full transition-all duration-300" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a
            href={ctaPrimary.href}
            className="hidden sm:flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-yellow-400/25 hover:shadow-yellow-400/40 hover:scale-105 transition-all duration-300"
          >
            {ctaPrimary.label}
            <ArrowRight size={16} />
          </a>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden rounded-xl border border-white/10 p-2.5 text-sm hover:bg-white/5 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-slate-950/95 backdrop-blur-xl">
          <div className="space-y-1 px-4 py-4">
            {navLinks.map((link: any) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="block rounded-xl px-4 py-3 text-base font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}

const Footer = ({ siteName, contact, social }: any) => (
  <footer className="border-t border-white/10 bg-slate-950">
    <div className="mx-auto max-w-7xl px-6 py-16 md:px-8">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/logo.png"
              alt={`${siteName} logo`}
              className="h-12 w-12"
            />
            <span className="text-xl font-bold text-white">{siteName}</span>
          </div>
          <p className="text-base text-gray-400 max-w-md leading-relaxed">
            We craft futuristic 3D websites that blend creativity, motion, and performance. Built for brands that don’t just want a presence, they want an experience.
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-4 text-lg">Contact</h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li>
              <strong className="text-white">📍 Address:</strong><br />
              {contact.address}
            </li>
            <li>
              <strong className="text-white">✉️ Email:</strong><br />
              <a href={`mailto:${contact.email}`} className="hover:text-yellow-400 transition-colors">
                {contact.email}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-4 text-lg">Get in Touch</h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li>
              <strong className="text-white">📞 Phone:</strong><br />
              <a href={`tel:${contact.phone}`} className="hover:text-yellow-400 transition-colors">
                {contact.phone}
              </a>
            </li>
            <li>
              <strong className="text-white">🕐 Hours:</strong><br />
              {contact.hours}
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-12 pt-8 border-t border-white/10">
        <div className="flex flex-wrap gap-x-8 gap-y-4 items-center mb-8">
          <span className="text-sm font-medium text-white">Let’s stay connected, we share what the future looks like:</span>
          <div className="flex gap-6">
            {social.map((s: any, i: number) => (
              <a
                key={i}
                href={s.href}
                className="text-sm text-gray-400 hover:text-yellow-400 transition-colors font-medium"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-400">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </div>
    </div>
  </footer>
)

const InputField = ({ label, name, type = "text", value, onChange, placeholder, className }: any) => (
  <div className={className}>
    <label htmlFor={name} className="sr-only">
      {label}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 transition-all"
    />
  </div>
)

const TextAreaField = ({ label, name, value, onChange, placeholder, className, rows = 4 }: any) => (
  <div className={className}>
    <label htmlFor={name} className="sr-only">
      {label}
    </label>
    <textarea
      id={name}
      name={name}
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-white placeholder:text-gray-500 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 transition-all resize-none"
    />
  </div>
)

export default function App() {
  // --- STATE MANAGEMENT ---
  const [formStatus, setFormStatus] = useState({ submitting: false, submitted: false, error: "" });
  const [formData, setFormData] = useState({ name: "", email: "", company: "", budget: "", message: "" });
  const [selectedBrand, setSelectedBrand] = useState<number | null>(0);

  // --- REFS FOR ANIMATIONS ---
  const heroRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLElement>(null);
  const projectsRef = useRef<HTMLElement>(null);
  const partnersRef = useRef<HTMLElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  // --- GSAP ANIMATIONS ---
  useEffect(() => {
    if (heroRef.current) {
      gsap.fromTo(
        heroRef.current.querySelector(".hero-content"),
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, delay: 0.3, ease: "power3.out" }
      );

      gsap.fromTo(
        heroRef.current.querySelector(".hero-form"),
        { opacity: 0, x: 50 },
        { opacity: 1, x: 0, duration: 1, delay: 0.5, ease: "power3.out" }
      );
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.left = `${e.clientX}px`;
        spotlightRef.current.style.top = `${e.clientY}px`;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    if (servicesRef.current) {
      const serviceCards = servicesRef.current.querySelectorAll(".service-card");
      gsap.fromTo(
        serviceCards,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: servicesRef.current,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }

    if (partnersRef.current) {
      const partnerLogos = partnersRef.current.querySelectorAll(".partner-logo");
      gsap.fromTo(
        partnerLogos,
        { opacity: 0, scale: 0.8, y: 30 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.12,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: partnersRef.current,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.querySelector((e.currentTarget as HTMLAnchorElement).getAttribute("href")!);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // --- HANDLER FUNCTIONS ---
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus({ submitting: true, submitted: false, error: "" });

    // Call the server action with the form data
    const result = await sendEmail(formData);

    if (result && result.error) {
      // If there's an error, update the state to show it
      setFormStatus({ submitting: false, submitted: false, error: result.error });
      return;
    }

    // On success, update the state and clear the form
    setFormStatus({ submitting: false, submitted: true, error: "" });
    setFormData({ name: "", email: "", company: "", budget: "", message: "" });
  };

  const handleBrandClick = (index: number) => {
    setSelectedBrand(index === selectedBrand ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-yellow-400/20">
      <style dangerouslySetInnerHTML={{
        __html: `
        #cursor-spotlight {
          position: fixed;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(251, 191, 36, 0.08) 0%, transparent 70%);
          pointer-events: none;
          transform: translate(-50%, -50%);
          z-index: 1;
          transition: opacity 0.3s;
        }
      `}} />

      <div ref={spotlightRef} id="cursor-spotlight" />

      <Header siteName={DATA.siteName} navLinks={DATA.navLinks} ctaPrimary={DATA.ctaPrimary} />

      <AIChat />

      <main className="pt-20">
        <section ref={heroRef} className="relative overflow-hidden min-h-screen flex items-center">
          <div className="absolute inset-0 z-0 h-full w-full">
            <ThreeBackground />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/30 to-slate-950 pointer-events-none" />

          <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:px-8 w-full">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div className="hero-content text-center lg:text-left">
                <h1 className="text-5xl font-black tracking-tight md:text-6xl lg:text-7xl leading-none text-balance bg-gradient-to-br from-yellow-400 to-amber-300 bg-clip-text text-transparent">
                  {DATA.tagline}
                </h1>
                <p className="mt-8 max-w-2xl mx-auto lg:mx-0 text-xl text-gray-400 leading-relaxed text-pretty">
                  {DATA.subTagline}
                </p>
                <div className="mt-12 flex flex-wrap gap-5 justify-center lg:justify-start">
                  <a
                    href={DATA.ctaSecondary.href}
                    className="rounded-full border-2 border-white/10 bg-white/[0.03] backdrop-blur-xl px-8 py-4 text-base font-bold text-white hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 flex items-center gap-2"
                  >
                    Explore Our Work
                  </a>
                </div>
              </div>

              <div className="hero-form relative">
                <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-8 backdrop-blur-xl shadow-2xl">
                  <h3 className="text-center text-3xl font-bold tracking-tight text-white mb-2">Get Started Today</h3>
                  <p className="text-center text-gray-400 mb-8">
                    Let’s build something that makes people say “Whoa.”
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <InputField name="name" value={formData.name} onChange={handleFormChange} placeholder="Your Name" />
                    <InputField
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      placeholder="Email Address"
                    />
                    <InputField
                      name="company"
                      value={formData.company}
                      onChange={handleFormChange}
                      placeholder="Company Name"
                    />
                    <InputField
                      name="budget"
                      value={formData.budget}
                      onChange={handleFormChange}
                      placeholder="Project Budget"
                    />
                    <button
                      type="submit"
                      disabled={formStatus.submitting}
                      className="w-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 px-8 py-4 text-base font-bold text-slate-950 shadow-lg shadow-yellow-400/30 hover:shadow-yellow-400/50 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {formStatus.submitting ? "Sending..." : "Request a Quote"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="partners" ref={partnersRef} className="bg-slate-950 text-white py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center mb-16 sm:mb-20">
              <h2 className="text-4xl font-black tracking-tight leading-loose sm:text-5xl md:text-6xl bg-gradient-to-br from-yellow-400 to-amber-300 bg-clip-text text-transparent">
                Trusted by Visionaries
              </h2>
            </div>
            {selectedBrand !== null && DATA.partners[selectedBrand] && (
              <div className="mb-16 max-w-4xl mx-auto">
                <div className="rounded-3xl bg-slate-800/50 border border-slate-700 p-8 md:p-12">
                  <blockquote className="text-xl md:text-2xl font-medium leading-relaxed mb-8">
                    "{DATA.partners[selectedBrand].testimonial.text}"
                  </blockquote>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-yellow-400 to-amber-300 flex items-center justify-center text-slate-950 font-bold text-xl flex-shrink-0">
                        {DATA.partners[selectedBrand].testimonial.author.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-lg">{DATA.partners[selectedBrand].testimonial.author}</div>
                        <div className="text-gray-400 text-sm">{DATA.partners[selectedBrand].testimonial.position}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 items-stretch max-w-6xl mx-auto">
              {DATA.partners.map((partner, index) => (
                <button
                  key={partner.name}
                  onClick={() => handleBrandClick(index)}
                  className={`partner-logo flex flex-col items-center justify-center gap-4 transition-all duration-300 rounded-2xl p-6 border border-slate-800 bg-slate-900 ${selectedBrand === index ? "border-yellow-400/50" : "grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                    }`}
                  aria-label={`View testimonial from ${partner.name}`}
                >
                  <div className="h-16 w-full flex items-center justify-center">
                    <img
                      src={partner.logo}
                      alt={`${partner.name} logo`}
                      className="h-full w-auto max-w-full object-contain"
                      onError={(e) => { e.currentTarget.src = 'https://placehold.co/200x60/f87171/ffffff?text=Error'; }}
                    />
                  </div>
                  <span className="text-base font-bold text-center leading-tight">{partner.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section ref={servicesRef} id="services" className="mx-auto max-w-7xl px-6 py-24 md:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center mb-20">
            <h2 className="text-5xl font-black tracking-tight md:text-6xl bg-gradient-to-br from-yellow-400 to-amber-300 bg-clip-text text-transparent">
              Engineering the Web of Tomorrow
            </h2>
            <p className="mt-5 text-xl text-gray-400 leading-relaxed">
              We design and develop immersive 3D web experiences that redefine how users see and interact with brands. Every element is built to move, react, and feel alive.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {DATA.services.map((s, i) => (
              <div key={i} className="flex items-stretch">
                <GlowCard className="w-full">
                  <div className="p-8">
                    <div className="mb-6 h-14 w-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-300 text-slate-950 flex items-center justify-center">
                      {s.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">{s.title}</h3>
                    <p className="text-base text-gray-400 leading-relaxed">{s.description}</p>
                  </div>
                </GlowCard>
              </div>
            ))}
          </div>
        </section>


        <section id="work" className="bg-white/[0.02] py-24 md:py-32 border-y border-white/5 overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 md:px-8">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black tracking-tight md:text-6xl bg-gradient-to-br from-yellow-400 to-amber-300 bg-clip-text text-transparent mb-5">
                Proof That Dimension Drives Results
              </h2>
              <p className="text-xl text-gray-400 max-w-4xl mx-auto">
                From global brands to bold startups, we've built 3D experiences that turn websites into interactive stories, helping businesses attract, engage, and convert like never before.
              </p>
              <p className="text-sm text-gray-400 mt-4">Scroll down to explore our projects ↓</p>
            </div>

            <StackingCards>
              {DATA.projects.map((p, i) => (
                <StackingCardItem key={i} index={i} className="w-full aspect-video mb-4 md:mb-10">
                  <div className="w-full h-full max-w-6xl mx-auto">
                    <div className="w-full h-full rounded-2xl md:rounded-3xl bg-gradient-to-br from-yellow-400/10 to-amber-300/5 p-0.5 md:p-1 shadow-2xl shadow-yellow-400/20">
                      <div className="w-full h-full rounded-2xl md:rounded-3xl bg-slate-950/95 backdrop-blur-xl overflow-hidden">
                        <div className="relative w-full h-full rounded-xl md:rounded-2xl overflow-hidden bg-slate-950">
                          <video
                            src={p.video}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/60" />

                          <div className="absolute top-4 left-4 md:top-8 md:left-8 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/20 text-xs md:text-sm font-semibold text-white">
                            {p.category}
                          </div>

                          <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2">
                            <a
                              href="#quote"
                              className="inline-flex items-center gap-2 px-5 py-2.5 md:px-8 md:py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 text-slate-950 text-sm md:text-base font-bold hover:gap-4 hover:scale-105 transition-all duration-300 group shadow-lg shadow-yellow-400/30 whitespace-nowrap"
                            >
                              Start Your Project
                              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={16} />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </StackingCardItem>
              ))}

              <StackingCardItem index={DATA.projects.length} className="w-full aspect-video mb-4 md:mb-10">
                <div className="h-full w-full max-w-6xl mx-auto flex items-center justify-center px-4">
                  <div className="text-center">
                    <h3 className="text-5xl md:text-7xl lg:text-9xl leading-loose font-black bg-gradient-to-br from-yellow-400 to-amber-300 bg-clip-text text-transparent mb-4 md:mb-8">
                      Ready?
                    </h3>
                    <p className="text-lg md:text-2xl text-gray-400 mb-8 md:mb-12">
                      Let's create something extraordinary together
                    </p>
                    <a
                      href="#quote"
                      className="inline-flex items-center gap-2 md:gap-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 px-7 py-4 md:px-10 md:py-5 text-base md:text-lg font-bold text-slate-950 shadow-2xl shadow-yellow-400/30 hover:shadow-yellow-400/50 hover:scale-105 transition-all"
                    >
                      Let's Build Yours
                    </a>
                  </div>
                </div>
              </StackingCardItem>
            </StackingCards>
          </div>
        </section>
        <section id="quote" className="bg-slate-950 py-24 md:py-32">
          <div className="mx-auto max-w-5xl px-6 md:px-8">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-black tracking-tight md:text-6xl bg-gradient-to-br from-yellow-400 to-amber-300 bg-clip-text text-transparent mb-6">
                Let’s Build Your 3D Universe
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Ready to create an experience that turns visitors into believers? Book an exploratory call and let's bring your vision to life.
              </p>
            </div>
            <ContactCalendar />
          </div>
        </section>
      </main>

      <Footer siteName={DATA.siteName} contact={DATA.contact} social={DATA.social} />
    </div>
  )
}
