import { Badge } from "@folionote/ui/badge"
import { Button } from "@folionote/ui/button"
import { Separator } from "@folionote/ui/separator"
import { useGSAP } from "@gsap/react"
import {
  AiChat02Icon,
  ArrowRight02Icon,
  BookOpen01Icon,
  Bookmark01Icon,
  Calendar03Icon,
  ChartDecreaseIcon,
  CheckmarkCircle02Icon,
  ComputerIcon,
  File01Icon,
  GridViewIcon,
  InboxIcon,
  Link01Icon,
  MagicWand01Icon,
  PencilEdit02Icon,
  SmartPhone01Icon,
  SparklesIcon,
  Tick02Icon,
  TranslateIcon
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

import "lenis/dist/lenis.css"
import type { ReactNode } from "react"
import { Fragment, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { BrandLockup } from "@/components/brand-lockup"
import { getUser } from "@/functions/get-user"
import type { JapanesePartOfSpeech } from "@/lib/japanese-pos"
import { JAPANESE_POS_SWATCH_COLOR_MAP } from "@/lib/japanese-pos"
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

// The landing motion curve is cubic-bezier(0.22, 1, 0.36, 1), a quint
// ease-out; GSAP's power4.out is the same family.
const LANDING_EASE = "power4.out"

function HeroSection() {
  const { t } = useTranslation()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: LANDING_EASE, duration: 0.7 } })
          .from("[data-hero-rise]", { y: 32, autoAlpha: 0, stagger: 0.06 })
          .from(
            "[data-hero-preview]",
            { y: 32, autoAlpha: 0, duration: 0.8 },
            "-=0.4"
          )
      })
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.from("[data-hero-rise], [data-hero-preview]", {
          autoAlpha: 0,
          duration: 0.5,
          ease: "power1.out"
        })
      })
    },
    { scope: root }
  )

  const proofPoints = [
    t("landing.hero.proofFree", "Free to start, no card needed"),
    t("landing.hero.proofPlatforms", "Web, iOS and Android"),
    t("landing.hero.proofOpenSource", "Open source under MIT")
  ]

  return (
    <section className="px-6 pt-24 pb-24" ref={root}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 pt-16 text-center">
        <p
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-sm text-muted-foreground"
          data-hero-rise=""
        >
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {t("landing.hero.badgeTag", "New")}
          </span>
          {t("landing.hero.badge", "Edit a note together in real time")}
        </p>

        {/* pb-2 keeps descenders inside the clipped gradient. */}
        <h1
          className="max-w-[680px] bg-linear-to-r from-black to-[#666666] bg-clip-text pb-2 text-5xl font-semibold tracking-tight text-balance text-transparent md:text-6xl dark:from-white dark:to-[#9b9b9b]"
          data-hero-rise=""
        >
          {t("landing.hero.titleLine1", "Learn it once.")}
          <br />
          {t("landing.hero.titleLine2", "Remember it for good.")}
        </h1>

        <p
          className="max-w-[680px] text-lg text-pretty text-muted-foreground"
          data-hero-rise=""
        >
          {t(
            "landing.hero.subtitle",
            "FolioNote is a learning notebook for students, engineers and language learners. Save notes and links on any device, ask AI about everything you have saved, and get a short daily review that brings ideas back before they fade."
          )}
        </p>

        <div
          className="flex flex-col items-center gap-4 pt-2"
          data-hero-rise=""
        >
          <Link
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-base font-semibold text-primary-foreground transition-[background-color,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
            to="/register"
          >
            {t("landing.hero.cta", "Create your free notebook")}
            <HugeiconsIcon
              className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
              icon={ArrowRight02Icon}
            />
          </Link>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {proofPoints.map((point) => (
              <li className="flex items-center gap-1" key={point}>
                <HugeiconsIcon
                  className="size-4 text-primary"
                  icon={Tick02Icon}
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="w-full pt-10" data-hero-preview="">
          <HeroAppPreview />
        </div>
      </div>
    </section>
  )
}

// Sample workspace drawn in the hero preview. It is a picture of the product,
// so the copy stays fixed instead of going through i18n.
const PREVIEW_NAV: {
  label: string
  icon: IconSvgElement
  meta?: string
  active?: boolean
  due?: boolean
}[] = [
  { label: "Inbox", icon: InboxIcon, meta: "4" },
  { label: "Entries", icon: File01Icon, meta: "318", active: true },
  { label: "Review", icon: Calendar03Icon, meta: "12 due", due: true },
  { label: "Graph", icon: GridViewIcon },
  { label: "Japanese", icon: TranslateIcon }
]

const PREVIEW_COLLECTIONS = [
  { label: "React 19", dot: "bg-primary" },
  { label: "Systems design", dot: "bg-sky-500" },
  { label: "JLPT N3", dot: "bg-emerald-500" },
  { label: "Reading list", dot: "bg-rose-500" }
] as const

const PREVIEW_CODE = `const [state, formAction, isPending] =
  useActionState(saveNote, null)

<form action={formAction}>
  <button disabled={isPending}>Save</button>
</form>`

const PREVIEW_CITATIONS = [
  "useActionState in practice",
  "Forms in React 19",
  "Comment form refactor"
] as const

function HeroAppPreview() {
  const { t } = useTranslation()

  return (
    <div
      aria-label={t(
        "landing.hero.previewLabel",
        "FolioNote showing a note about React useActionState next to the AI assistant answering a question with links to three entries"
      )}
      className="mx-auto w-full overflow-hidden rounded-3xl border border-border bg-card text-left shadow-[0_1px_2px_rgba(26,25,21,0.04),0_24px_48px_-24px_rgba(26,25,21,0.16)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_24px_48px_-24px_rgba(0,0,0,0.6)]"
      role="img"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-3 rounded-full bg-border" />
        <span className="size-3 rounded-full bg-border" />
        <span className="size-3 rounded-full bg-border" />
        <span className="mx-auto text-xs text-muted-foreground">FolioNote</span>
      </div>

      <div className="grid min-h-[520px] lg:grid-cols-[224px_minmax(0,1fr)_320px]">
        <div className="hidden flex-col gap-1 border-r border-border bg-surface-secondary/50 px-3 py-4 lg:flex">
          <div className="flex items-center gap-2 px-2 pt-1 pb-3 text-sm font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full border border-border bg-card text-xs text-muted-foreground">
              MS
            </span>
            Mina's notebook
          </div>
          {PREVIEW_NAV.map((item) => (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground",
                item.active &&
                  "bg-card font-medium text-foreground ring-1 ring-border"
              )}
              key={item.label}
            >
              <HugeiconsIcon className="size-4" icon={item.icon} />
              {item.label}
              {item.meta ? (
                <span
                  className={cn(
                    "ml-auto text-xs",
                    item.due ? "font-semibold text-foreground" : ""
                  )}
                >
                  {item.meta}
                </span>
              ) : null}
            </div>
          ))}
          <p className="px-2 pt-4 pb-1 text-xs font-medium text-muted-foreground">
            Collections
          </p>
          {PREVIEW_COLLECTIONS.map((collection) => (
            <div
              className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground"
              key={collection.label}
            >
              <span className={cn("size-2 rounded-full", collection.dot)} />
              {collection.label}
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-4 px-6 py-8 md:px-10">
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>React 19 / Actions</span>
            <span className="flex items-center gap-2">
              <span className="flex">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-foreground ring-2 ring-card">
                  M
                </span>
                <span className="-ml-2 flex size-6 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold ring-2 ring-card">
                  J
                </span>
              </span>
              2 editing
            </span>
          </div>
          <p className="text-3xl font-semibold tracking-tight">
            useActionState in practice
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-foreground">
              #react
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              #forms
            </span>
            <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              <HugeiconsIcon className="size-3" icon={Link01Icon} />
              react.dev
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              Next review in 3 days
            </span>
          </div>
          <p className="text-base text-muted-foreground">
            The hook wraps an async action and hands back{" "}
            <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">
              the latest result, a form action and a pending flag
            </mark>
            . It replaces most of the manual loading state I used to keep beside
            every form.
          </p>
          <pre className="overflow-hidden rounded-xl border border-border bg-surface-secondary/50 px-4 py-3 font-mono text-xs text-muted-foreground">
            {PREVIEW_CODE}
          </pre>
          <p className="text-base text-muted-foreground">
            Errors come back through{" "}
            <code className="font-mono text-sm">state</code>, so the form can
            show them inline without a separate effect.
          </p>
        </div>

        <div className="hidden flex-col gap-3 border-l border-border p-4 lg:flex">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <HugeiconsIcon
              className="size-4 text-primary"
              icon={SparklesIcon}
            />
            Ask your notes
          </p>
          <p className="max-w-60 self-end rounded-2xl bg-surface-secondary px-3 py-2 text-sm">
            How is useActionState different from useFormStatus?
          </p>
          <p className="text-sm text-muted-foreground">
            useActionState owns the result of the action, while useFormStatus
            only reads whether the parent form is submitting. You noted using
            both together on the comment form.
          </p>
          <div className="flex flex-col items-start gap-2">
            <span className="text-xs text-muted-foreground">
              From 3 entries
            </span>
            {PREVIEW_CITATIONS.map((title, index) => (
              <span
                className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                key={title}
              >
                <span className="font-mono">{index + 1}</span>
                {title}
              </span>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">
            Ask anything about your notes
            <HugeiconsIcon className="size-4" icon={ArrowRight02Icon} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Rises each [data-reveal] child once as it enters the viewport. With reduced
// motion it only fades.
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useGSAP(
    (_context, contextSafe) => {
      const el = ref.current
      if (!(el && contextSafe)) {
        return
      }
      const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]", el)
      const mm = gsap.matchMedia()
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)"
        },
        (context) => {
          const rise = Boolean(context.conditions?.motion)
          gsap.set(targets, { autoAlpha: 0, y: rise ? 32 : 0 })
          const reveal = contextSafe((target: Element) => {
            gsap.to(target, {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              ease: rise ? LANDING_EASE : "power1.out"
            })
          })
          const observer = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  observer.unobserve(entry.target)
                  reveal(entry.target)
                }
              }
            },
            { rootMargin: "0px 0px -12% 0px" }
          )
          for (const target of targets) {
            observer.observe(target)
          }
          return () => observer.disconnect()
        }
      )
    },
    { scope: ref }
  )

  return ref
}

// ---------------------------------------------------------------------------
// Problem
// ---------------------------------------------------------------------------

function ProblemSection() {
  const { t } = useTranslation()
  const root = useReveal<HTMLElement>()

  const pains: { title: string; desc: string; icon: IconSvgElement }[] = [
    {
      icon: Bookmark01Icon,
      title: t("landing.problem.links.title", "Links pile up unread"),
      desc: t(
        "landing.problem.links.desc",
        "Bookmarks and read later queues grow faster than you can open them."
      )
    },
    {
      icon: GridViewIcon,
      title: t("landing.problem.scatter.title", "Notes scatter across apps"),
      desc: t(
        "landing.problem.scatter.desc",
        "Chat threads, docs and phone photos each hold a piece, and none of them talk to each other."
      )
    },
    {
      icon: ChartDecreaseIcon,
      title: t(
        "landing.problem.fade.title",
        "Memory fades without a second look"
      ),
      desc: t(
        "landing.problem.fade.desc",
        "An idea you never revisit is mostly gone within days. A few short reviews keep it."
      )
    }
  ]

  return (
    <section
      className="border-y border-border bg-white px-6 py-24 dark:bg-[#1f1f1f]"
      ref={root}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-16">
        <div
          className="flex min-w-0 flex-[1_1_440px] flex-col gap-6"
          data-reveal=""
        >
          <p className="text-sm font-semibold text-amber-700 dark:text-primary">
            {t("landing.problem.eyebrow", "Why notes do not stick")}
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {/* Block lines balance on their own, so a phone wrap never
                strands one word. */}
            <span className="block">
              {t("landing.problem.titleLine1", "Saving is easy.")}
            </span>
            <span className="block">
              {t("landing.problem.titleLine2", "Remembering is harder.")}
            </span>
          </h2>
          <p className="text-lg text-pretty text-muted-foreground">
            {t(
              "landing.problem.lede",
              "Most learning tools stop at the save button. FolioNote keeps going after it, so the things you collect turn into things you know."
            )}
          </p>
          <ul className="flex flex-col gap-6 pt-4">
            {pains.map((pain) => (
              <li className="flex gap-4" key={pain.title}>
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-primary/15 text-amber-700 dark:text-primary">
                  <HugeiconsIcon className="size-5" icon={pain.icon} />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{pain.title}</h3>
                  <p className="text-base text-pretty text-muted-foreground">
                    {pain.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <figure
          className="m-0 flex min-w-0 flex-[1_1_440px] flex-col gap-6 rounded-3xl border border-border bg-[#fbfaf7] p-8 dark:bg-[#181818]"
          data-reveal=""
        >
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="text-base font-semibold">
              {t(
                "landing.problem.chartTitle",
                "How much you keep over a month"
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("landing.problem.chartNote", "Illustration")}
            </p>
          </div>
          <ForgettingCurveChart />
          <figcaption className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-6 border-t-2 border-dashed border-muted-foreground" />
              {t("landing.problem.legendWithout", "Without review")}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-6 border-t-2 border-primary" />
              {t(
                "landing.problem.legendWith",
                "With a FolioNote review on days 1, 3, 7 and 16"
              )}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

// Illustrative curves, not measured data: recall decays on its own, and each
// review lifts it back up and slows the next decay.
const CURVE_AXIS_DAYS = [
  { label: "1", x: 98 },
  { label: "3", x: 152 },
  { label: "7", x: 232 },
  { label: "16", x: 382 },
  { label: "30", x: 462 }
] as const
const CURVE_REVIEW_POINTS = [
  { x: 98, y: 28 },
  { x: 152, y: 30 },
  { x: 232, y: 34 },
  { x: 382, y: 38 }
] as const

function ForgettingCurveChart() {
  const { t } = useTranslation()

  return (
    <svg
      aria-label={t(
        "landing.problem.chartLabel",
        "Two curves. Without review, recall drops quickly and stays low. With reviews on days 1, 3, 7 and 16, recall is lifted back up each time and ends high."
      )}
      className="h-auto w-full"
      role="img"
      viewBox="0 0 480 240"
    >
      <g className="stroke-border" strokeWidth={1}>
        <line x1={40} x2={40} y1={20} y2={200} />
        <line x1={40} x2={470} y1={200} y2={200} />
        <line strokeDasharray="2 4" x1={40} x2={470} y1={110} y2={110} />
      </g>
      <g className="fill-muted-foreground font-mono" fontSize={12}>
        <text x={0} y={24}>
          100%
        </text>
        <text x={8} y={114}>
          50%
        </text>
        <text x={40} y={222}>
          {t("landing.problem.chartDay", "Day 0")}
        </text>
        {CURVE_AXIS_DAYS.map((day) => (
          <text key={day.label} textAnchor="middle" x={day.x} y={222}>
            {day.label}
          </text>
        ))}
      </g>
      <path
        className="stroke-muted-foreground"
        d="M40 20 C70 120 120 160 200 172 S380 186 470 190"
        fill="none"
        strokeDasharray="6 6"
        strokeWidth={2}
      />
      <path
        className="stroke-primary"
        d="M40 20 C60 70 80 88 98 96 L98 28 C120 70 136 82 152 86 L152 30 C185 62 210 72 232 76 L232 34 C300 56 345 64 382 66 L382 38 C410 48 440 54 470 56"
        fill="none"
        strokeLinejoin="round"
        strokeWidth={2.5}
      />
      <g className="fill-primary">
        {CURVE_REVIEW_POINTS.map((point) => (
          <circle cx={point.x} cy={point.y} key={point.x} r={4} />
        ))}
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Benefits
// ---------------------------------------------------------------------------

function BenefitsSection() {
  const { t } = useTranslation()
  const root = useReveal<HTMLElement>()

  return (
    <section className="scroll-mt-24 px-6 py-24" id="features" ref={root}>
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <div className="flex max-w-[680px] flex-col gap-4" data-reveal="">
          <p className="text-sm font-semibold text-amber-700 dark:text-primary">
            {t("landing.benefits.eyebrow", "What you get")}
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            <span className="block">
              {t("landing.benefits.titleLine1", "One notebook that keeps up")}
            </span>
            <span className="block">
              {t("landing.benefits.titleLine2", "with how you learn")}
            </span>
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <BenefitCard
              className="flex-[1_1_560px]"
              desc={t(
                "landing.benefits.capture.desc",
                "A calm editor with markdown, code blocks and images on the web, plus quick notes from your phone. Every entry keeps its source, so you always know where an idea came from."
              )}
              title={t(
                "landing.benefits.capture.title",
                "Capture in seconds, from anywhere"
              )}
            >
              <CaptureMock />
            </BenefitCard>
            <BenefitCard
              className="flex-[1_1_400px]"
              desc={t(
                "landing.benefits.ask.desc",
                "Chat with everything you have saved. Each answer links back to the entries it used. Connect your own model provider key if you prefer."
              )}
              title={t(
                "landing.benefits.ask.title",
                "Ask your notes, get answers with sources"
              )}
            >
              <AskMock />
            </BenefitCard>
          </div>

          <div className="flex flex-wrap gap-4">
            <BenefitCard
              className="flex-[1_1_340px]"
              desc={t(
                "landing.benefits.review.desc",
                "Spaced repetition brings each note back right before you would forget it. Rate your recall and the next review moves to match."
              )}
              title={t(
                "landing.benefits.review.title",
                "Review a few minutes a day"
              )}
            >
              <ReviewMock />
            </BenefitCard>
            <BenefitCard
              className="flex-[1_1_340px]"
              desc={t(
                "landing.benefits.graph.desc",
                "Links and shared tags draw a map of what you know, so a new note can find its neighbors."
              )}
              title={t(
                "landing.benefits.graph.title",
                "See how your ideas connect"
              )}
            >
              <ConnectionsMock />
            </BenefitCard>
            <BenefitCard
              className="flex-[1_1_340px]"
              desc={t(
                "landing.benefits.japanese.desc",
                "Paste an article and every word gets furigana and a part of speech color. Then practice with JLPT style questions."
              )}
              id="japanese"
              title={t(
                "landing.benefits.japanese.title",
                "Read Japanese with grammar in color"
              )}
            >
              <JapaneseMock />
            </BenefitCard>
          </div>
        </div>
      </div>
    </section>
  )
}

function BenefitCard({
  title,
  desc,
  className,
  id,
  children
}: {
  title: string
  desc: string
  className?: string
  id?: string
  children: ReactNode
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 scroll-mt-24 flex-col gap-6 rounded-3xl border border-border bg-white p-8 dark:bg-[#1f1f1f]",
        className
      )}
      data-reveal=""
      id={id}
    >
      <div className="flex max-w-[520px] flex-col gap-2">
        <h3 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h3>
        <p className="text-base text-pretty text-muted-foreground">{desc}</p>
      </div>
      {/* The mock repeats what the copy says, so screen readers skip it. */}
      <div
        aria-hidden="true"
        className="mt-auto rounded-xl border border-border bg-[#fbfaf7] p-4 dark:bg-[#181818]"
      >
        {children}
      </div>
    </article>
  )
}

const MOCK_CHIP =
  "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground"

// The mocks below are pictures of the product, so their sample copy stays
// fixed instead of going through i18n.
const CAPTURE_TOOLS = ["B", "I", "H1", "List", "Code", "Link"] as const

function CaptureMock() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 border-b border-border pb-3">
        {CAPTURE_TOOLS.map((tool) => (
          <span className={cn(MOCK_CHIP, "font-mono")} key={tool}>
            {tool}
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">Saved</span>
      </div>
      <p className="text-lg font-semibold">
        Notes from Designing Data Intensive Applications, ch. 5
      </p>
      <p className="text-sm text-muted-foreground">
        Leader based replication sends every write through one node. Followers
        apply the log in the same order, which is why{" "}
        <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">
          read your own writes
        </mark>{" "}
        needs care once reads hit a follower.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={MOCK_CHIP}>
          <HugeiconsIcon className="size-3" icon={File01Icon} />
          Book, p. 151
        </span>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium">
          #systems
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <HugeiconsIcon className="size-4" icon={SmartPhone01Icon} />
          Synced to iPhone just now
        </span>
      </div>
    </div>
  )
}

function AskMock() {
  return (
    <div className="flex flex-col gap-3">
      <p className="self-end rounded-2xl border border-border bg-white px-3 py-2 text-sm dark:bg-[#1f1f1f]">
        What did I learn about caching last month?
      </p>
      <p className="text-sm text-muted-foreground">
        You compared write through and write behind caches, and noted that cache
        stampedes hit the checkout service twice in September.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className={MOCK_CHIP}>
          <span className="font-mono">1</span>Caching patterns
        </span>
        <span className={MOCK_CHIP}>
          <span className="font-mono">2</span>Checkout incident notes
        </span>
      </div>
    </div>
  )
}

const REVIEW_RATINGS = [
  { label: "Again", next: "1m" },
  { label: "Hard", next: "6m" },
  { label: "Good", next: "2d", picked: true },
  { label: "Easy", next: "5d" }
] as const

function ReviewMock() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Due today</span>
        <span className="font-mono">3 of 12</span>
      </div>
      <div className="h-1 rounded-full bg-border">
        <div className="h-1 w-1/4 rounded-full bg-primary" />
      </div>
      <p className="py-2 text-base font-medium">
        What does useOptimistic return while an action is pending?
      </p>
      <div className="flex gap-2">
        {REVIEW_RATINGS.map((rating) => (
          <span
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-lg border p-2 text-sm font-medium",
              "picked" in rating
                ? "border-transparent bg-primary/15"
                : "border-border bg-white dark:bg-[#1f1f1f]"
            )}
            key={rating.label}
          >
            {rating.label}
            <span className="font-mono text-xs text-muted-foreground">
              {rating.next}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

const CONNECTION_NODES = [
  { label: "Replication", x: 60, y: 44, labelY: 30 },
  { label: "Redis notes", x: 246, y: 40, labelY: 26 },
  { label: "Checkout incident", x: 70, y: 146, labelY: 170 },
  { label: "CDN basics", x: 236, y: 140, labelY: 164 }
] as const
const CONNECTION_HUB = { label: "Caching", x: 150, y: 90 } as const
// Links between outer nodes, by index into CONNECTION_NODES.
const CONNECTION_LINKS = [
  [0, 2],
  [1, 3]
] as const

function ConnectionsMock() {
  return (
    <svg className="block h-auto w-full" viewBox="0 0 300 180">
      <g className="stroke-border" strokeWidth={1.5}>
        {CONNECTION_NODES.map((node) => (
          <line
            key={node.label}
            x1={CONNECTION_HUB.x}
            x2={node.x}
            y1={CONNECTION_HUB.y}
            y2={node.y}
          />
        ))}
        {CONNECTION_LINKS.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={CONNECTION_NODES[from].x}
            x2={CONNECTION_NODES[to].x}
            y1={CONNECTION_NODES[from].y}
            y2={CONNECTION_NODES[to].y}
          />
        ))}
      </g>
      <circle
        className="fill-primary"
        cx={CONNECTION_HUB.x}
        cy={CONNECTION_HUB.y}
        r={10}
      />
      <g className="fill-white stroke-muted-foreground dark:fill-[#1f1f1f]">
        {CONNECTION_NODES.map((node) => (
          <circle
            cx={node.x}
            cy={node.y}
            key={node.label}
            r={6}
            strokeWidth={1.5}
          />
        ))}
      </g>
      <g className="fill-muted-foreground" fontSize={12} textAnchor="middle">
        <text
          className="fill-foreground"
          fontWeight={600}
          x={CONNECTION_HUB.x}
          y={CONNECTION_HUB.y + 28}
        >
          {CONNECTION_HUB.label}
        </text>
        {CONNECTION_NODES.map((node) => (
          <text key={node.label} x={node.x} y={node.labelY}>
            {node.label}
          </text>
        ))}
      </g>
    </svg>
  )
}

// 猫が静かに眠っている, tokenized the way the reading view colors it.
const JAPANESE_SAMPLE: {
  kanji?: string
  reading?: string
  kana: string
  pos: JapanesePartOfSpeech
}[] = [
  { kanji: "猫", reading: "ねこ", kana: "", pos: "noun" },
  { kana: "が", pos: "particle" },
  { kanji: "静", reading: "しず", kana: "かに", pos: "adverb" },
  { kanji: "眠", reading: "ねむ", kana: "って", pos: "verb" },
  { kana: "いる", pos: "auxiliary" }
]
const JAPANESE_SAMPLE_LEGEND: JapanesePartOfSpeech[] = [
  "noun",
  "particle",
  "adverb",
  "verb",
  "auxiliary"
]

function JapaneseMock() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-end gap-2" lang="ja">
        {JAPANESE_SAMPLE.map((token) => (
          <span
            className="flex flex-col gap-1"
            key={`${token.kanji ?? ""}${token.kana}`}
          >
            <span className="text-xl font-medium">
              {token.kanji ? (
                <ruby>
                  {token.kanji}
                  <rt className="text-xs font-normal text-muted-foreground">
                    {token.reading}
                  </rt>
                </ruby>
              ) : null}
              {token.kana}
            </span>
            <span
              className={cn(
                "h-0.5 w-full rounded-full",
                JAPANESE_POS_SWATCH_COLOR_MAP[token.pos]
              )}
            />
          </span>
        ))}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {JAPANESE_SAMPLE_LEGEND.map((pos) => (
          <span className="flex items-center gap-1" key={pos}>
            <span
              className={cn(
                "size-2 rounded-full",
                JAPANESE_POS_SWATCH_COLOR_MAP[pos]
              )}
            />
            {t(`review.japaneseTyping.posCategories.${pos}`)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tagline
// ---------------------------------------------------------------------------

// Lighting runs from when the text top reaches 85% of the viewport height until
// its bottom reaches 45%, so each word lights as it crosses the reading line.
const TAGLINE_START = 0.85
const TAGLINE_END = 0.45

function TaglineSection() {
  const { t, i18n } = useTranslation()
  const textRef = useRef<HTMLParagraphElement>(null)

  const lines = [
    t("landing.tagline.line1", "Every idea you save"),
    t("landing.tagline.line2", "should still be with you"),
    t("landing.tagline.line3", "a year from now.")
  ]
  // Word segmentation instead of splitting on spaces, so languages written
  // without spaces still light word by word.
  const segmenter = new Intl.Segmenter(i18n.language, { granularity: "word" })

  useEffect(() => {
    const text = textRef.current
    if (!text) {
      return
    }
    const words = [...text.querySelectorAll<HTMLElement>("[data-word]")]
    let frame = 0

    const update = () => {
      frame = 0
      const rect = text.getBoundingClientRect()
      const start = window.innerHeight * TAGLINE_START
      const end = window.innerHeight * TAGLINE_END
      const progress = (start - rect.top) / (start - end + rect.height)
      const lit = Math.round(gsap.utils.clamp(0, 1, progress) * words.length)
      for (const [index, word] of words.entries()) {
        word.toggleAttribute("data-lit", index < lit)
      }
    }
    // Scroll fires every frame; batch the reads into one rAF.
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section className="px-6 py-24">
      <div className="mx-auto flex max-w-6xl justify-center">
        <p
          className="max-w-[680px] text-4xl font-semibold tracking-tight text-balance md:text-5xl"
          ref={textRef}
        >
          {lines.map((line) => (
            <span className="block" key={line}>
              {[...segmenter.segment(line)].map((segment) =>
                // Punctuation lights with the words; only spaces stay plain.
                segment.segment.trim() ? (
                  <span
                    className="text-foreground/30 transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] data-lit:text-foreground"
                    data-word=""
                    key={segment.index}
                  >
                    {segment.segment}
                  </span>
                ) : (
                  <Fragment key={segment.index}>{segment.segment}</Fragment>
                )
              )}
            </span>
          ))}
        </p>
      </div>
    </section>
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

  // Flat canvas over the body glow and grain: the redesign keeps backgrounds
  // solid and lighter than the app theme.
  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[#fbfaf7] font-geist dark:bg-[#181818]"
      ref={root}
    >
      <span
        aria-hidden="true"
        className="fixed top-0 left-0 z-[60] h-1 w-full origin-left scale-x-0 bg-linear-to-r from-primary to-amber-400"
        data-progress=""
      />
      <LandingNavbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <BenefitsSection />
        <TaglineSection />
        <HowItWorksSection />
        <ShowcaseSection />
        <StatsSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
