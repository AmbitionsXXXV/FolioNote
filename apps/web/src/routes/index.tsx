import { Badge } from "@folionote/ui/badge"
import { Button } from "@folionote/ui/button"
import { Separator } from "@folionote/ui/separator"
import { useGSAP } from "@gsap/react"
import {
  AiChat02Icon,
  ArrowRight02Icon,
  BookOpen01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  ComputerIcon,
  GridViewIcon,
  InboxIcon,
  MagicWand01Icon,
  PencilEdit02Icon,
  Search01Icon,
  SmartPhone01Icon,
  Tag01Icon
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

import "lenis/dist/lenis.css"
import type { ReactNode } from "react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { BrandLockup } from "@/components/brand-lockup"
import { getUser } from "@/functions/get-user"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP, ScrollTrigger)

export const Route = createFileRoute("/")({
  component: LandingPage,
  beforeLoad: async () => {
    const session = await getUser()
    if (session) {
      throw redirect({ to: "/activity" })
    }
  }
})

// Obsidian-glossy brand objects (chroma-keyed transparent PNGs).
const OBJ = {
  note: "/img/3d/note.webp",
  lens: "/img/3d/lens.webp",
  bookmark: "/img/3d/bookmark.webp",
  brain: "/img/3d/brain.webp",
  calendar: "/img/3d/calendar.webp",
  graph: "/img/3d/graph.webp",
  tag: "/img/3d/tag.webp",
  sparkle: "/img/3d/sparkle.webp"
} as const

// Warm, obsidian-tinted floating shadow for the 3D objects.
const OBJ_SHADOW = "drop-shadow-[0_30px_46px_rgba(28,20,10,0.34)]"

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

// A glossy brand object. When `float` is set, the outer node is marked for
// hero parallax and the inner node for the idle float animation.
function Obj({
  src,
  alt = "",
  className,
  float = false,
  depth
}: {
  src: string
  alt?: string
  className?: string
  float?: boolean
  depth?: number
}) {
  const img = (
    <img
      alt={alt}
      aria-hidden={alt ? undefined : "true"}
      className={cn("size-full select-none", OBJ_SHADOW)}
      draggable={false}
      loading="lazy"
      src={src}
    />
  )
  if (!float) {
    return <div className={className}>{img}</div>
  }
  return (
    <div
      className={cn("will-change-transform", className)}
      data-depth={depth ?? 1}
      data-parallax=""
    >
      <div className="will-change-transform" data-float="">
        {img}
      </div>
    </div>
  )
}

// Soft radial amber glow placed behind hero/CTA objects.
function Halo({
  className,
  ...rest
}: {
  className?: string
} & Record<`data-${string}`, string>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute rounded-full bg-primary/25 blur-3xl",
        className
      )}
      {...rest}
    />
  )
}

// Organic blurred decorative blob.
function Blob({
  className,
  shape = "47% 53% 60% 40% / 50% 45% 55% 50%"
}: {
  className?: string
  shape?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute blur-3xl", className)}
      style={{ borderRadius: shape }}
    />
  )
}

// Counts a numeric value up when scrolled into view (static if non-numeric or
// reduced-motion). Keeps the rendered value for SSR / no-JS.
function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      const match = value.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/)
      if (!(el && match)) {
        return
      }
      const prefix = match[1] ?? ""
      const digits = match[2] ?? ""
      const suffix = match[3] ?? ""
      const target = Number.parseFloat(digits)
      const counter = { v: 0 }
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        el.textContent = `${prefix}0${suffix}`
        gsap.to(counter, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onUpdate: () => {
            el.textContent = `${prefix}${Math.round(counter.v)}${suffix}`
          }
        })
      })
    },
    { scope: ref }
  )

  return (
    <span className={className} ref={ref}>
      {value}
    </span>
  )
}

// Magnetic wrapper: nudges children toward the pointer for tactile CTAs.
function useMagnetic<T extends HTMLElement>(strength = 0.4) {
  const ref = useRef<T>(null)
  useGSAP(
    (_context, contextSafe) => {
      const el = ref.current
      if (!(el && contextSafe)) {
        return
      }
      const mm = gsap.matchMedia()
      mm.add(
        "(prefers-reduced-motion: no-preference) and (pointer: fine)",
        () => {
          const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" })
          const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" })
          const onMove = contextSafe((event: PointerEvent) => {
            const rect = el.getBoundingClientRect()
            xTo((event.clientX - (rect.left + rect.width / 2)) * strength)
            yTo((event.clientY - (rect.top + rect.height / 2)) * strength)
          })
          const onLeave = contextSafe(() => {
            xTo(0)
            yTo(0)
          })
          el.addEventListener("pointermove", onMove)
          el.addEventListener("pointerleave", onLeave)
          return () => {
            el.removeEventListener("pointermove", onMove)
            el.removeEventListener("pointerleave", onLeave)
          }
        }
      )
    },
    { scope: ref }
  )
  return ref
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function LandingNavbar() {
  const { t } = useTranslation()
  const navRef = useRef<HTMLElement>(null)

  useGSAP(() => {
    ScrollTrigger.create({
      start: 24,
      end: "max",
      onToggle: (self) =>
        navRef.current?.toggleAttribute("data-scrolled", self.isActive)
    })
  })

  return (
    <nav
      className="fixed top-4 right-4 left-4 z-50 mx-auto flex max-w-6xl items-center justify-between rounded-full border border-transparent px-5 py-2.5 transition-all duration-300 data-[scrolled]:border-border/60 data-[scrolled]:bg-background/75 data-[scrolled]:shadow-lg data-[scrolled]:backdrop-blur-xl"
      ref={navRef}
    >
      <Link className="group flex cursor-pointer items-center gap-2.5" to="/">
        <BrandLockup
          iconClassName="size-9 transition-transform duration-300 group-hover:scale-105"
          wordmarkClassName="text-xl"
        />
      </Link>

      <div className="hidden items-center gap-8 md:flex">
        <a
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
          href="#features"
        >
          {t("landing.nav.features", "Features")}
        </a>
        <a
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
          href="#how-it-works"
        >
          {t("landing.nav.howItWorks", "How It Works")}
        </a>
        <a
          className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
          href="#showcase"
        >
          {t("landing.nav.showcase", "Showcase")}
        </a>
      </div>

      <div className="flex items-center gap-2">
        <Link to="/login">
          <Button
            className="cursor-pointer rounded-full"
            size="sm"
            variant="ghost"
          >
            {t("auth.signIn", "Sign In")}
          </Button>
        </Link>
        <Link to="/register">
          <Button className="cursor-pointer gap-1.5 rounded-full px-5">
            {t("landing.nav.getStarted", "Get Started")}
            <HugeiconsIcon className="size-4" icon={ArrowRight02Icon} />
          </Button>
        </Link>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function HeroSection() {
  const { t } = useTranslation()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    (_context, contextSafe) => {
      const mm = gsap.matchMedia()

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.9 }
        })
        tl.from("[data-hero-rise]", { y: 28, autoAlpha: 0, stagger: 0.1 })

        const underline = root.current?.querySelector<SVGPathElement>(
          "[data-hero-underline] path"
        )
        if (underline) {
          const len = underline.getTotalLength()
          gsap.set(underline, { strokeDasharray: len, strokeDashoffset: len })
          tl.to(
            underline,
            { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" },
            "-=0.35"
          )
        }

        tl.from(
          "[data-parallax]",
          {
            autoAlpha: 0,
            scale: 0.6,
            y: 40,
            stagger: 0.12,
            duration: 1,
            ease: "back.out(1.5)"
          },
          "-=0.8"
        )

        // Idle float + gentle spin per object
        for (const el of gsap.utils.toArray<HTMLElement>(
          "[data-float]",
          root.current
        )) {
          gsap.to(el, {
            y: gsap.utils.random(-14, -24),
            duration: gsap.utils.random(3, 4.6),
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: gsap.utils.random(0, 1)
          })
          gsap.to(el, {
            rotation: gsap.utils.random(-6, 6),
            duration: gsap.utils.random(4.5, 6.5),
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
          })
        }

        // Scroll parallax: objects drift up at depth-scaled rates
        for (const el of gsap.utils.toArray<HTMLElement>(
          "[data-parallax]",
          root.current
        )) {
          const depth = Number.parseFloat(el.dataset.depth ?? "1")
          gsap.to(el, {
            yPercent: -16 * depth,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "bottom top",
              scrub: true
            }
          })
        }

        // Copy gently lifts away on scroll
        gsap.to("[data-hero-copy]", {
          yPercent: -8,
          autoAlpha: 0.4,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom 40%",
            scrub: true
          }
        })

        // Pointer parallax for the object cluster
        const items = gsap.utils.toArray<HTMLElement>(
          "[data-parallax]",
          root.current
        )
        const setters = items.map((el) => ({
          x: gsap.quickTo(el, "x", { duration: 0.7, ease: "power3" }),
          depth: Number.parseFloat(el.dataset.depth ?? "1")
        }))
        const onMove = contextSafe?.((event: PointerEvent) => {
          const dx = (event.clientX - window.innerWidth / 2) / window.innerWidth
          for (const s of setters) {
            s.x(dx * 52 * s.depth)
          }
        })
        if (onMove) {
          window.addEventListener("pointermove", onMove)
          return () => window.removeEventListener("pointermove", onMove)
        }
      })
    },
    { scope: root }
  )

  return (
    <section
      className="relative flex min-h-dvh flex-col justify-start overflow-hidden pt-32 pb-20 md:justify-center md:pt-36 md:pb-28"
      ref={root}
    >
      <Blob className="-top-32 left-1/4 size-[460px] bg-primary/20" />
      <Blob
        className="top-10 right-0 size-[380px] bg-amber-300/15"
        shape="60% 40% 30% 70% / 60% 30% 70% 40%"
      />
      <Blob
        className="bottom-0 left-0 size-[320px] bg-primary/10"
        shape="40% 60% 55% 45% / 55% 50% 50% 45%"
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Copy */}
        <div className="text-center lg:text-left" data-hero-copy="">
          <Badge
            className="mb-6 gap-1.5 rounded-full px-3 py-1"
            data-hero-rise=""
            variant="secondary"
          >
            <HugeiconsIcon className="size-3.5" icon={MagicWand01Icon} />
            {t("landing.hero.badge", "Your personal learning companion")}
          </Badge>

          <h1
            className="font-display text-[2.75rem] leading-[1.05] font-bold tracking-tight md:text-6xl"
            data-hero-rise=""
          >
            {t("landing.hero.titleLine1", "Capture, organize &")}{" "}
            <span className="relative inline-block font-script font-normal text-primary">
              {t("landing.hero.titleHighlight", "remember")}
              <svg
                aria-hidden="true"
                className="absolute -bottom-2 left-0 w-full text-primary/50"
                data-hero-underline=""
                fill="none"
                preserveAspectRatio="none"
                viewBox="0 0 200 12"
              >
                <path
                  d="M2 8C40 3 80 3 120 6C150 8 180 7 198 4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              </svg>
            </span>{" "}
            {t("landing.hero.titleLine2", "everything you learn")}
          </h1>

          <p
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl lg:mx-0"
            data-hero-rise=""
          >
            {t(
              "landing.hero.subtitle",
              "A warm, playful home for your notes. Capture ideas in a flash, let AI connect the dots, and let spaced review make them stick — so nothing you learn slips away."
            )}
          </p>

          <div
            className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            data-hero-rise=""
          >
            <Link to="/register">
              <Button className="h-12 cursor-pointer gap-2 rounded-full px-7 text-base shadow-lg shadow-primary/25 transition-transform hover:scale-[1.04] active:scale-[0.97]">
                {t("landing.hero.cta", "Start learning — free")}
                <HugeiconsIcon className="size-5" icon={ArrowRight02Icon} />
              </Button>
            </Link>
            <a href="#features">
              <Button
                className="h-12 cursor-pointer gap-2 rounded-full px-7 text-base transition-transform hover:scale-[1.04] active:scale-[0.97]"
                variant="outline"
              >
                {t("landing.hero.ctaSecondary", "Take the tour")}
              </Button>
            </a>
          </div>

          <div
            className="mt-10 flex items-center justify-center gap-7 lg:justify-start"
            data-hero-rise=""
          >
            <HeroStat
              label={t("landing.hero.statPlatforms", "Platforms")}
              value="3"
            />
            <Separator className="h-9" orientation="vertical" />
            <HeroStat
              label={t("landing.hero.statFreeLabel", "To start")}
              value={t("landing.hero.statFreeValue", "Free")}
            />
            <Separator className="h-9" orientation="vertical" />
            <HeroStat
              label={t("landing.hero.statYoursLabel", "Yours")}
              value="100%"
            />
          </div>
        </div>

        {/* Floating obsidian object cluster */}
        <div className="relative mx-auto h-[360px] w-full max-w-md md:h-[460px]">
          <Halo className="top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2" />
          <Obj
            alt={t(
              "landing.hero.objectBook",
              "A notebook full of what you've learned"
            )}
            className="absolute top-6 left-1/2 size-56 -translate-x-1/2 md:size-72"
            depth={1.6}
            float
            src={OBJ.note}
          />
          <Obj
            alt={t("landing.hero.objectSearch", "Search across everything")}
            className="absolute top-0 right-2 size-24 md:size-28"
            depth={2.4}
            float
            src={OBJ.lens}
          />
          <Obj
            alt={t("landing.hero.objectBookmark", "Save what matters")}
            className="absolute bottom-2 left-0 size-20 md:size-24"
            depth={2.1}
            float
            src={OBJ.bookmark}
          />
          <Obj
            className="absolute right-6 bottom-10 size-14 md:size-16"
            depth={3}
            float
            src={OBJ.sparkle}
          />
        </div>
      </div>
    </section>
  )
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center lg:text-left">
      <p className="font-number text-3xl text-primary md:text-4xl">
        <CountUp value={value} />
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

interface FeatureItem {
  description: string
  gradient: string
  icon: IconSvgElement
  title: string
}

function FeaturesSection() {
  const { t } = useTranslation()
  const root = useRef<HTMLElement>(null)

  const features: FeatureItem[] = [
    {
      icon: PencilEdit02Icon,
      title: t("landing.features.capture.title", "Quick Capture"),
      description: t(
        "landing.features.capture.desc",
        "Catch ideas the moment they strike with a rich, distraction-free editor. Tag and organize without breaking your flow."
      ),
      gradient: "from-primary/25 to-amber-300/10"
    },
    {
      icon: Calendar03Icon,
      title: t("landing.features.review.title", "Spaced Repetition"),
      description: t(
        "landing.features.review.desc",
        "Never forget what you learn. A friendly review schedule resurfaces your notes at exactly the right moment."
      ),
      gradient: "from-amber-300/20 to-primary/15"
    },
    {
      icon: AiChat02Icon,
      title: t("landing.features.ai.title", "AI Knowledge Assistant"),
      description: t(
        "landing.features.ai.desc",
        "Chat with your notes. Ask questions, get summaries, and uncover connections across your whole knowledge base."
      ),
      gradient: "from-primary/20 to-orange-300/10"
    },
    {
      icon: Search01Icon,
      title: t("landing.features.search.title", "Powerful Search"),
      description: t(
        "landing.features.search.desc",
        "Find anything in seconds with full-text and AI-powered semantic search across every entry you've ever made."
      ),
      gradient: "from-amber-400/15 to-primary/15"
    },
    {
      icon: Tag01Icon,
      title: t("landing.features.tags.title", "Smart Organization"),
      description: t(
        "landing.features.tags.desc",
        "Tags, collections, and sources that grow into a personal taxonomy — structure that feels effortless."
      ),
      gradient: "from-primary/20 to-amber-300/15"
    },
    {
      icon: GridViewIcon,
      title: t("landing.features.graph.title", "Knowledge Graph"),
      description: t(
        "landing.features.graph.desc",
        "Watch your notes link up. Explore hidden relationships and see the big picture of everything you know."
      ),
      gradient: "from-amber-300/15 to-primary/20"
    }
  ]

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set("[data-feature-card]", { y: 40, autoAlpha: 0 })
        ScrollTrigger.batch("[data-feature-card]", {
          start: "top 88%",
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              stagger: 0.12,
              duration: 0.7,
              ease: "power3.out",
              overwrite: true
            })
        })
      })
    },
    { scope: root }
  )

  return (
    <section className="relative py-20 md:py-28" id="features" ref={root}>
      <Obj
        className="animate-floaty pointer-events-none absolute top-16 right-[6%] hidden size-20 lg:block"
        src={OBJ.tag}
      />
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          badge={t("landing.features.badge", "Core Features")}
          description={t(
            "landing.features.description",
            "Everything you need to capture, organize, and actually retain what you learn — in one playful place."
          )}
          title={t("landing.features.title", "Built for Lifelong Learners")}
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard feature={feature} key={feature.title} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ feature }: { feature: FeatureItem }) {
  return (
    <div
      className="group relative h-full overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl"
      data-feature-card=""
    >
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          feature.gradient
        )}
      />
      <div className="relative">
        <div
          className={cn(
            "mb-4 flex size-14 items-center justify-center rounded-2xl bg-linear-to-br transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110",
            feature.gradient
          )}
        >
          <HugeiconsIcon className="size-7 text-primary" icon={feature.icon} />
        </div>
        <h3 className="mb-2 font-display text-xl font-semibold">
          {feature.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// How It Works — sticky scrollytelling
// ---------------------------------------------------------------------------

interface StepItem {
  number: string
  title: string
  description: string
  icon: IconSvgElement
  object: string
}

function HowItWorksSection() {
  const { t } = useTranslation()
  const root = useRef<HTMLElement>(null)

  const steps: StepItem[] = [
    {
      number: "1",
      title: t("landing.howItWorks.step1.title", "Capture"),
      description: t(
        "landing.howItWorks.step1.desc",
        "Jot ideas, highlights, and learnings as they come. Rich editor, quick capture, paste from anywhere."
      ),
      icon: PencilEdit02Icon,
      object: OBJ.note
    },
    {
      number: "2",
      title: t("landing.howItWorks.step2.title", "Organize"),
      description: t(
        "landing.howItWorks.step2.desc",
        "Tag your entries, add sources, and let AI help categorize. Your notes become a living knowledge base."
      ),
      icon: InboxIcon,
      object: OBJ.bookmark
    },
    {
      number: "3",
      title: t("landing.howItWorks.step3.title", "Remember"),
      description: t(
        "landing.howItWorks.step3.desc",
        "Spaced review surfaces the right notes at the right time. Revisit, strengthen, and truly retain."
      ),
      icon: BookOpen01Icon,
      object: OBJ.lens
    }
  ]

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(
        "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
        () => {
          const layers = gsap.utils.toArray<HTMLElement>(
            "[data-hiw-layer]",
            root.current
          )
          const stepEls = gsap.utils.toArray<HTMLElement>(
            "[data-hiw-step]",
            root.current
          )
          const dots = gsap.utils.toArray<HTMLElement>(
            "[data-hiw-dot]",
            root.current
          )

          const setActive = (idx: number) => {
            for (const [i, el] of layers.entries()) {
              gsap.to(el, {
                autoAlpha: i === idx ? 1 : 0,
                scale: i === idx ? 1 : 0.86,
                yPercent: i === idx ? 0 : 6,
                duration: 0.6,
                ease: "power3.out"
              })
            }
            for (const [i, el] of stepEls.entries()) {
              gsap.to(el, {
                autoAlpha: i === idx ? 1 : 0.4,
                duration: 0.4,
                ease: "power2.out"
              })
            }
            for (const [i, el] of dots.entries()) {
              el.classList.toggle("bg-primary", i === idx)
              el.classList.toggle("bg-muted-foreground/30", i !== idx)
              gsap.to(el, { scale: i === idx ? 1.4 : 1, duration: 0.3 })
            }
          }

          gsap.set(layers, { autoAlpha: 0, scale: 0.86 })
          setActive(0)

          for (let i = 0; i < steps.length; i++) {
            ScrollTrigger.create({
              trigger: `[data-hiw-step="${i}"]`,
              start: "top center",
              end: "bottom center",
              onToggle: (self) => {
                if (self.isActive) {
                  setActive(i)
                }
              }
            })
          }

          gsap.to("[data-hiw-halo]", {
            yPercent: 16,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "bottom bottom",
              scrub: true
            }
          })
        }
      )

      mm.add(
        "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
        () => {
          gsap.set("[data-hiw-card]", { y: 40, autoAlpha: 0 })
          ScrollTrigger.batch("[data-hiw-card]", {
            start: "top 85%",
            onEnter: (batch) =>
              gsap.to(batch, {
                y: 0,
                autoAlpha: 1,
                stagger: 0.15,
                duration: 0.7,
                ease: "power3.out",
                overwrite: true
              })
          })
        }
      )
    },
    { scope: root }
  )

  return (
    <section className="relative py-20 md:py-28" id="how-it-works" ref={root}>
      <Blob className="top-1/3 left-1/2 size-[520px] -translate-x-1/2 bg-primary/8" />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeader
          badge={t("landing.howItWorks.badge", "Simple Process")}
          description={t(
            "landing.howItWorks.description",
            "Three playful steps to a knowledge system that finally works for you."
          )}
          title={t("landing.howItWorks.title", "How It Works")}
        />

        {/* Desktop: sticky media + scrolling steps */}
        <div className="mt-8 hidden gap-16 lg:grid lg:grid-cols-2">
          <div className="relative">
            <div className="sticky top-0 flex h-dvh items-center justify-center">
              <div className="relative size-[22rem]">
                <Halo
                  className="top-1/2 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2"
                  data-hiw-halo=""
                />
                {steps.map((step, i) => (
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center will-change-transform",
                      i !== 0 && "opacity-0"
                    )}
                    data-hiw-layer=""
                    key={step.number}
                  >
                    <img
                      alt={step.title}
                      className={cn("size-80 select-none", OBJ_SHADOW)}
                      draggable={false}
                      src={step.object}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            {/* progress rail */}
            <div className="pointer-events-none fixed top-1/2 right-8 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex xl:right-16">
              {steps.map((step, i) => (
                <span
                  className="size-2.5 rounded-full bg-muted-foreground/30 transition-colors"
                  data-hiw-dot={i}
                  key={step.number}
                />
              ))}
            </div>

            {steps.map((step, i) => (
              <div
                className="flex min-h-dvh flex-col justify-center"
                data-hiw-step={i}
                key={step.number}
              >
                <StepBody step={step} />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="mt-12 grid gap-8 lg:hidden">
          {steps.map((step) => (
            <div
              className="rounded-3xl border border-border/60 bg-card/70 p-6 text-center shadow-sm backdrop-blur-sm"
              data-hiw-card=""
              key={step.number}
            >
              <div className="relative mx-auto mb-5 size-32">
                <Halo className="inset-0" />
                <img
                  alt={step.title}
                  className={cn("relative size-32 select-none", OBJ_SHADOW)}
                  draggable={false}
                  src={step.object}
                />
              </div>
              <StepBody step={step} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StepBody({ step }: { step: StepItem }) {
  return (
    <div>
      <div className="mb-4 inline-flex items-center gap-3 lg:mb-5">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary font-number text-lg text-primary-foreground shadow-md">
          {step.number}
        </span>
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/12">
          <HugeiconsIcon className="size-5 text-primary" icon={step.icon} />
        </span>
      </div>
      <h3 className="mb-3 font-display text-3xl font-bold md:text-4xl">
        {step.title}
      </h3>
      <p className="mx-auto max-w-md text-lg leading-relaxed text-muted-foreground lg:mx-0">
        {step.description}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Product Showcase (Bento Grid)
// ---------------------------------------------------------------------------

function ShowcaseSection() {
  const { t } = useTranslation()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set("[data-bento]", { y: 44, autoAlpha: 0 })
        ScrollTrigger.batch("[data-bento]", {
          start: "top 88%",
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              stagger: 0.1,
              duration: 0.7,
              ease: "power3.out",
              overwrite: true
            })
        })

        gsap.from("[data-chat]", {
          autoAlpha: 0,
          y: 14,
          stagger: 0.25,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: "[data-chat]", start: "top 85%" }
        })

        const edges = gsap.utils.toArray<SVGLineElement>(
          "[data-graph-edge]",
          root.current
        )
        for (const line of edges) {
          const len = line.getTotalLength()
          gsap.set(line, { strokeDasharray: len, strokeDashoffset: len })
        }
        gsap.to(edges, {
          strokeDashoffset: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: "power2.inOut",
          scrollTrigger: { trigger: "[data-graph]", start: "top 80%" }
        })
        gsap.from("[data-graph-node]", {
          scale: 0,
          transformOrigin: "center",
          stagger: 0.08,
          duration: 0.5,
          ease: "back.out(2)",
          scrollTrigger: { trigger: "[data-graph]", start: "top 80%" }
        })

        gsap.from("[data-review-day]", {
          autoAlpha: 0,
          y: 12,
          scale: 0.8,
          stagger: 0.08,
          duration: 0.5,
          ease: "back.out(1.7)",
          scrollTrigger: { trigger: "[data-review]", start: "top 85%" }
        })

        gsap.from("[data-editor-line]", {
          scaleX: 0,
          transformOrigin: "left",
          stagger: 0.12,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: "[data-editor]", start: "top 85%" }
        })
      })
    },
    { scope: root }
  )

  return (
    <section className="relative py-20 md:py-28" id="showcase" ref={root}>
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          badge={t("landing.showcase.badge", "Product Tour")}
          description={t(
            "landing.showcase.description",
            "Delightful tools designed to make learning stick."
          )}
          title={t(
            "landing.showcase.title",
            "Everything You Need, Nothing You Don’t"
          )}
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BentoCard
            className="lg:col-span-2"
            description={t(
              "landing.showcase.ai.desc",
              "Have a conversation with your knowledge base. Ask questions, get summaries, and discover insights you never knew were there."
            )}
            icon={AiChat02Icon}
            object={OBJ.brain}
            title={t("landing.showcase.ai.title", "AI-Powered Chat")}
          >
            <div className="mt-4 space-y-3">
              <ChatBubble
                isAi={false}
                text={t(
                  "landing.showcase.ai.userMsg",
                  "What did I learn about React hooks last week?"
                )}
              />
              <ChatBubble
                isAi
                text={t(
                  "landing.showcase.ai.aiMsg",
                  "From your 3 entries last week: useEffect cleanup, custom hook patterns, and the rules of hooks…"
                )}
              />
            </div>
          </BentoCard>

          <BentoCard
            description={t(
              "landing.showcase.graph.desc",
              "See how your notes connect. Explore topics and uncover hidden relationships."
            )}
            icon={GridViewIcon}
            title={t("landing.showcase.graph.title", "Knowledge Graph")}
          >
            <div
              className="mt-4 flex items-center justify-center"
              data-graph=""
            >
              <GraphMock />
            </div>
          </BentoCard>

          <BentoCard
            description={t(
              "landing.showcase.review.desc",
              "Science-backed review scheduling that helps you remember what matters most."
            )}
            icon={Calendar03Icon}
            object={OBJ.calendar}
            title={t("landing.showcase.review.title", "Spaced Repetition")}
          >
            <div className="mt-4 flex gap-2" data-review="">
              {REVIEW_DAYS.map((day, i) => (
                <div
                  className="flex-1 text-center"
                  data-review-day=""
                  key={day}
                >
                  <div
                    className={cn(
                      "mx-auto mb-1 flex size-8 items-center justify-center rounded-xl font-medium text-xs",
                      i < 3 && "bg-primary/20 text-primary",
                      i === 3 &&
                        "bg-amber-400/25 text-amber-700 dark:text-amber-300",
                      i > 3 && "bg-surface-secondary/60 text-muted-foreground"
                    )}
                  >
                    {i < 3 ? (
                      <HugeiconsIcon
                        className="size-4"
                        icon={CheckmarkCircle02Icon}
                      />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{day}</span>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard
            className="lg:col-span-2"
            description={t(
              "landing.showcase.editor.desc",
              "A beautiful, distraction-free editor with markdown, code blocks, and rich media."
            )}
            icon={PencilEdit02Icon}
            title={t("landing.showcase.editor.title", "Rich Text Editor")}
          >
            <div
              className="mt-4 rounded-2xl border border-border/40 bg-background/60 p-4"
              data-editor=""
            >
              <div className="mb-3 flex gap-2 border-b border-border/40 pb-3">
                {EDITOR_TOOLS.map((btn) => (
                  <div
                    className="flex size-7 items-center justify-center rounded-lg bg-surface-secondary/50 font-mono text-xs text-muted-foreground"
                    key={btn}
                  >
                    {btn}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {EDITOR_LINES.map((line) => (
                  <div
                    className={cn(
                      "h-2.5 rounded-full bg-primary/15",
                      line.width
                    )}
                    data-editor-line=""
                    key={line.id}
                  />
                ))}
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  )
}

const REVIEW_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const
const EDITOR_TOOLS = ["B", "I", "U", "H1", "H2", "</>"] as const
const EDITOR_LINES = [
  { id: "a", width: "w-4/5" },
  { id: "b", width: "w-full" },
  { id: "c", width: "w-3/5" }
] as const

function BentoCard({
  icon,
  title,
  description,
  className,
  object,
  children
}: {
  icon: IconSvgElement
  title: string
  description: string
  className?: string
  object?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg",
        className
      )}
      data-bento=""
    >
      {object ? (
        <img
          alt=""
          aria-hidden="true"
          className={cn(
            "-top-6 -right-6 pointer-events-none absolute size-28 rotate-6 opacity-90 transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-110",
            OBJ_SHADOW
          )}
          draggable={false}
          src={object}
        />
      ) : null}
      <div className="relative mb-3 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-amber-300/15">
          <HugeiconsIcon className="size-5 text-primary" icon={icon} />
        </div>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      <p className="relative text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  )
}

function ChatBubble({ text, isAi }: { text: string; isAi: boolean }) {
  return (
    <div
      className={cn("flex", isAi ? "justify-start" : "justify-end")}
      data-chat=""
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isAi
            ? "rounded-tl-sm bg-surface-secondary/70 text-foreground"
            : "rounded-tr-sm bg-primary/15 text-foreground"
        )}
      >
        {text}
      </div>
    </div>
  )
}

function GraphMock() {
  return (
    <svg
      aria-label="Knowledge graph visualization"
      className="h-32 w-full text-primary"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      viewBox="0 0 100 100"
    >
      {GRAPH_EDGES.map(([from, to]) => {
        const a = GRAPH_NODES.at(from)
        const b = GRAPH_NODES.at(to)
        if (!(a && b)) {
          return null
        }
        return (
          <line
            data-graph-edge=""
            key={`${from}-${to}`}
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="0.6"
            x1={a.x}
            x2={b.x}
            y1={a.y}
            y2={b.y}
          />
        )
      })}
      {GRAPH_NODES.map((node) => (
        <g data-graph-node="" key={node.label}>
          <circle
            cx={node.x}
            cy={node.y}
            fill="currentColor"
            fillOpacity="0.18"
            r={node.size}
          />
          <circle
            cx={node.x}
            cy={node.y}
            fill="currentColor"
            fillOpacity="0.75"
            r={node.size * 0.4}
          />
          <text
            className="fill-muted-foreground"
            dominantBaseline="hanging"
            fontSize="4"
            textAnchor="middle"
            x={node.x}
            y={node.y + node.size + 2}
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

const GRAPH_NODES = [
  { x: 50, y: 30, size: 10, label: "React" },
  { x: 25, y: 60, size: 8, label: "Hooks" },
  { x: 75, y: 55, size: 9, label: "State" },
  { x: 40, y: 85, size: 7, label: "Effects" },
  { x: 70, y: 80, size: 6, label: "Memo" }
] as const
const GRAPH_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [1, 2]
]

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

interface StatItem {
  value: string
  label: string
  icon: IconSvgElement
}

function StatsSection() {
  const { t } = useTranslation()
  const root = useRef<HTMLElement>(null)

  const stats: StatItem[] = [
    {
      value: "6+",
      label: t("landing.stats.features", "Core Features"),
      icon: MagicWand01Icon
    },
    {
      value: "3",
      label: t("landing.stats.platforms", "Platforms"),
      icon: SmartPhone01Icon
    },
    {
      value: t("landing.stats.freeValue", "Free"),
      label: t("landing.stats.freeLabel", "To Get Started"),
      icon: CheckmarkCircle02Icon
    },
    {
      value: t("landing.stats.openSourceValue", "Open"),
      label: t("landing.stats.openSource", "Source Project"),
      icon: ComputerIcon
    }
  ]

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set("[data-stat]", { y: 36, autoAlpha: 0 })
        ScrollTrigger.batch("[data-stat]", {
          start: "top 88%",
          onEnter: (batch) =>
            gsap.to(batch, {
              y: 0,
              autoAlpha: 1,
              stagger: 0.1,
              duration: 0.6,
              ease: "power3.out",
              overwrite: true
            })
        })
      })
    },
    { scope: root }
  )

  return (
    <section className="relative py-20 md:py-28" ref={root}>
      <Blob className="top-1/2 left-1/2 size-[460px] -translate-x-1/2 -translate-y-1/2 bg-amber-300/8" />
      <Obj
        className="animate-floaty pointer-events-none absolute top-6 left-[8%] hidden size-16 lg:block"
        src={OBJ.sparkle}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatCard({ stat }: { stat: StatItem }) {
  return (
    <div
      className="rounded-3xl border border-border/60 bg-card/70 p-6 text-center shadow-sm backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
      data-stat=""
    >
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/15">
        <HugeiconsIcon className="size-6 text-primary" icon={stat.icon} />
      </div>
      <p className="font-number text-4xl text-primary">
        <CountUp value={stat.value} />
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------

function FinalCTASection() {
  const { t } = useTranslation()
  const root = useRef<HTMLElement>(null)
  const magneticRef = useMagnetic<HTMLSpanElement>(0.5)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-cta-rise]", {
          y: 40,
          autoAlpha: 0,
          stagger: 0.12,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 75%" }
        })
        gsap.to("[data-cta-float]", {
          y: -18,
          duration: 3.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        })
        gsap.to("[data-cta-glow]", {
          autoAlpha: 0.55,
          scale: 1.12,
          duration: 2.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        })
      })
    },
    { scope: root }
  )

  return (
    <section className="relative py-20 md:py-28" ref={root}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border/60 bg-card/70 px-6 py-14 text-center shadow-lg backdrop-blur-sm md:px-16 md:py-20">
          <Blob className="-top-24 left-1/3 size-[420px] bg-primary/18" />
          <Blob
            className="-right-16 -bottom-24 size-[320px] bg-amber-300/15"
            shape="60% 40% 30% 70% / 60% 30% 70% 40%"
          />

          <div className="relative mx-auto mb-6 size-28 md:size-32">
            <Halo
              className="top-1/2 left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 opacity-70"
              data-cta-glow=""
            />
            <img
              alt=""
              aria-hidden="true"
              className={cn(
                "relative size-28 select-none md:size-32",
                OBJ_SHADOW
              )}
              data-cta-float=""
              draggable={false}
              src={OBJ.note}
            />
          </div>

          <div className="relative">
            <h2
              className="font-display text-3xl font-bold md:text-5xl"
              data-cta-rise=""
            >
              {t("landing.cta.title", "Ready to build your")}{" "}
              <span className="font-script font-normal text-primary">
                {t("landing.cta.titleAccent", "knowledge system")}
              </span>
              ?
            </h2>
            <p
              className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground"
              data-cta-rise=""
            >
              {t(
                "landing.cta.description",
                "Join the learners using FolioNote to capture, organize, and remember everything they learn."
              )}
            </p>
            <div
              className="mt-9 flex flex-wrap items-center justify-center gap-4"
              data-cta-rise=""
            >
              <Link to="/register">
                <span className="inline-block" ref={magneticRef}>
                  <Button className="h-12 cursor-pointer gap-2 rounded-full px-8 text-base shadow-lg shadow-primary/25 transition-transform hover:scale-[1.04] active:scale-[0.97]">
                    {t("landing.cta.button", "Get started for free")}
                    <HugeiconsIcon className="size-5" icon={ArrowRight02Icon} />
                  </Button>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function LandingFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <BrandLockup iconClassName="size-6" wordmarkClassName="text-base" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <a
              className="cursor-pointer transition-colors hover:text-foreground"
              href="#features"
            >
              {t("landing.nav.features", "Features")}
            </a>
            <a
              className="cursor-pointer transition-colors hover:text-foreground"
              href="#how-it-works"
            >
              {t("landing.nav.howItWorks", "How It Works")}
            </a>
            <a
              className="cursor-pointer transition-colors hover:text-foreground"
              href="#showcase"
            >
              {t("landing.nav.showcase", "Showcase")}
            </a>

            <Separator className="hidden h-4 md:block" orientation="vertical" />

            <Link
              className="transition-colors hover:text-foreground"
              to="/login"
            >
              {t("auth.signIn", "Sign In")}
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("landing.footer.copyright", "© {{year}} FolioNote", { year })}
          </p>
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function SectionHeader({
  badge,
  title,
  description
}: {
  badge: string
  title: string
  description: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(gsap.utils.toArray(ref.current?.children ?? []), {
          y: 26,
          autoAlpha: 0,
          stagger: 0.12,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: ref.current, start: "top 85%" }
        })
      })
    },
    { scope: ref }
  )

  return (
    <div className="mx-auto max-w-2xl text-center" ref={ref}>
      <Badge className="mb-4 rounded-full px-3 py-1" variant="secondary">
        {badge}
      </Badge>
      <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Composition
// ---------------------------------------------------------------------------

function LandingPage() {
  const root = useRef<HTMLDivElement>(null)

  // Smooth scroll (Lenis) wired into GSAP's ticker + ScrollTrigger.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    lenis.on("scroll", ScrollTrigger.update)
    const ticker = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(ticker)
    gsap.ticker.lagSmoothing(0)

    // Delegate in-page anchor links to Lenis (offset for the fixed navbar).
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.(
        'a[href^="#"]'
      ) as HTMLAnchorElement | null
      const href = anchor?.getAttribute("href")
      if (href && href.length > 1) {
        event.preventDefault()
        lenis.scrollTo(href, { offset: -90 })
      }
    }
    document.addEventListener("click", onClick)

    const onLoad = () => ScrollTrigger.refresh()
    window.addEventListener("load", onLoad)

    return () => {
      document.removeEventListener("click", onClick)
      window.removeEventListener("load", onLoad)
      gsap.ticker.remove(ticker)
      lenis.destroy()
    }
  }, [])

  // Top scroll-progress bar.
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to("[data-progress]", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: document.documentElement,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.3
          }
        })
      })
    },
    { scope: root }
  )

  return (
    <div className="relative min-h-screen overflow-x-clip" ref={root}>
      <span
        aria-hidden="true"
        className="fixed top-0 left-0 z-[60] h-1 w-full origin-left scale-x-0 bg-linear-to-r from-primary to-amber-400"
        data-progress=""
      />
      <LandingNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <ShowcaseSection />
        <StatsSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
