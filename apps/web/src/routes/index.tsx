import { useGSAP } from "@gsap/react"
import { Add01Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

import "lenis/dist/lenis.css"
import { Fragment, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { BrandLockup } from "@/components/brand-lockup"
import { getUser } from "@/functions/get-user"

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

// Text-first redesign: a white page with Claude clay as the only accent.
// Geist reads, JetBrains Mono records (labels, numbers), and Fraunces is used
// once, on the tagline.
//
// Clay tokens, scoped to the landing root:
// --clay        #D97757, large type, rules, the chart line, the CTA panel
// --clay-strong #B5532F, button fills (white text passes 4.5:1)
// --clay-ink    small clay text; lightens in dark mode to keep contrast
const LANDING_ROOT_CLASS =
  "[--clay:#d97757] [--clay-strong:#b5532f] [--clay-ink:#b5532f] dark:[--clay-ink:#e0895f]"

// The landing motion curve is cubic-bezier(0.22, 1, 0.36, 1), a quint
// ease-out; GSAP's power4.out is the same family.
const LANDING_EASE = "power4.out"
const EASE_CLASS = "ease-[cubic-bezier(0.22,1,0.36,1)]"

const CONTAINER_CLASS = "mx-auto w-full max-w-6xl px-6 md:px-10"
const EYEBROW_CLASS = "font-jetbrains text-sm text-(--clay-ink)"
const SECTION_TITLE_CLASS =
  "text-4xl font-semibold tracking-tight text-balance md:text-5xl"
const PRIMARY_CTA_CLASS = `group inline-flex items-center gap-2 rounded-lg bg-(--clay-strong) px-4 py-3 text-base font-semibold text-white transition-transform duration-500 ${EASE_CLASS} hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--clay-strong) active:scale-[0.98]`
const NAV_LINK_CLASS =
  "rounded-sm text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--clay-ink)"

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function LandingNavbar() {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav
        aria-label={t("landing.nav.label", "Main")}
        className="flex items-center gap-6 rounded-2xl border border-foreground/10 bg-white/80 py-2 pr-2 pl-4 backdrop-blur-xl dark:bg-[#181818]/80"
      >
        <Link
          className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--clay-ink)"
          to="/"
        >
          <BrandLockup iconClassName="size-7" wordmarkClassName="text-base" />
        </Link>

        <div className="hidden items-center gap-6 text-sm md:flex">
          <a className={NAV_LINK_CLASS} href="#features">
            {t("landing.nav.features", "Features")}
          </a>
          <a className={NAV_LINK_CLASS} href="#how-it-works">
            {t("landing.nav.howItWorks", "How it works")}
          </a>
          <a className={NAV_LINK_CLASS} href="#faq">
            {t("landing.nav.faq", "FAQ")}
          </a>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <Link
            className="rounded-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--clay-ink)"
            to="/login"
          >
            {t("auth.signIn", "Sign in")}
          </Link>
          <Link
            className={`rounded-lg bg-(--clay-strong) px-3 py-2 text-sm font-semibold text-white transition-transform duration-500 ${EASE_CLASS} hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--clay-strong) active:scale-[0.98]`}
            to="/register"
          >
            {t("landing.nav.getStarted", "Get started")}
          </Link>
        </div>
      </nav>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

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
    <section className={`${CONTAINER_CLASS} pt-40 pb-16`} ref={root}>
      <div className="flex flex-col items-start gap-6">
        <p
          className="inline-flex items-center gap-2 rounded-full border border-foreground/10 py-1 pr-3 pl-1 text-sm text-muted-foreground"
          data-hero-rise=""
        >
          <span className="rounded-full bg-(--clay)/15 px-2 py-0.5 text-xs font-semibold text-(--clay-ink)">
            {t("landing.hero.badgeTag", "New")}
          </span>
          {t("landing.hero.badge", "Edit a note together in real time")}
        </p>

        {/* pb-2 keeps descenders inside the clipped gradient. */}
        <h1
          className="max-w-[680px] bg-linear-to-r from-black to-[#666666] bg-clip-text pb-2 text-5xl font-semibold tracking-tight text-balance text-transparent md:text-6xl dark:from-white dark:to-[#9b9b9b]"
          data-hero-rise=""
        >
          <span className="block">
            {t("landing.hero.titleLine1", "Learn it once.")}
          </span>
          <span className="block">
            {t("landing.hero.titleLine2", "Remember it for good.")}
          </span>
        </h1>

        <p
          className="max-w-[680px] text-lg text-pretty text-muted-foreground md:text-xl"
          data-hero-rise=""
        >
          {t(
            "landing.hero.subtitle",
            "FolioNote is a learning notebook for students, engineers and language learners. Save notes and links on any device, ask AI about everything you have saved, and get a short daily review that brings ideas back before they fade."
          )}
        </p>

        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-2"
          data-hero-rise=""
        >
          <Link className={PRIMARY_CTA_CLASS} to="/register">
            {t("landing.hero.cta", "Create your free notebook")}
            <HugeiconsIcon
              className={`size-4 transition-transform duration-500 ${EASE_CLASS} group-hover:translate-x-1`}
              icon={ArrowRight02Icon}
            />
          </Link>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {proofPoints.map((point, index) => (
              <li className="flex items-center gap-4" key={point}>
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="hidden text-foreground/25 sm:inline"
                  >
                    ·
                  </span>
                )}
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pt-16" data-hero-preview="">
        <HeroNotePreview />
      </div>
    </section>
  )
}

// Sample note and answer drawn as text in the hero. It is a picture of the
// product, so the copy stays fixed instead of going through i18n.
const PREVIEW_TAGS = ["react", "forms", "react 19"] as const
const PREVIEW_CITATIONS = [
  "React useActionState",
  "Form actions in React 19",
  "Controlled inputs, a refresher"
] as const

function HeroNotePreview() {
  const { t } = useTranslation()

  return (
    <figure
      aria-label={t(
        "landing.hero.previewLabel",
        "FolioNote showing a note about React useActionState next to the AI assistant answering a question with links to three entries"
      )}
      className="m-0 rounded-3xl border border-foreground/10 bg-[#faf9f5] p-2 dark:bg-[#1f1f1f]"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <article
          aria-hidden="true"
          className="flex flex-col gap-4 rounded-2xl bg-white p-6 md:p-8 dark:bg-[#272727]"
        >
          <p className="font-jetbrains text-xs text-muted-foreground">
            Saved Oct 21 · react.dev
          </p>
          <p className="text-3xl font-semibold tracking-tight">
            React useActionState
          </p>
          <p className="text-base text-pretty text-foreground/80">
            A hook for state that changes as the result of a form action. You
            pass it an action and an initial state, and it gives back the
            current state, a wrapped action, and a pending flag.
          </p>
          <p className="text-base text-pretty text-foreground/80">
            <mark className="rounded-sm bg-(--clay)/15 px-1 text-foreground">
              Reach for it when the form itself owns the result,
            </mark>{" "}
            such as a sign up error or a saved message. Keep plain useState for
            values the user is still typing.
          </p>
          <ul className="flex flex-wrap gap-2 pt-2">
            {PREVIEW_TAGS.map((tag) => (
              <li
                className="rounded-full border border-foreground/10 px-2 py-0.5 text-xs text-muted-foreground"
                key={tag}
              >
                {tag}
              </li>
            ))}
          </ul>
        </article>

        <div
          aria-hidden="true"
          className="flex flex-col gap-4 rounded-2xl bg-white p-6 md:p-8 dark:bg-[#272727]"
        >
          <p className="font-jetbrains text-xs text-muted-foreground">
            Ask your notes
          </p>
          <p className="max-w-[85%] self-end rounded-xl bg-[#f5f4ed] px-3 py-2 text-sm dark:bg-[#313131]">
            When should I use useActionState instead of useState?
          </p>
          <p className="text-base text-pretty text-foreground/80">
            Use it when a form action produces the state, like a server reply or
            a validation error <Cite n={1} />. It also tracks the pending state
            for you, so you can drop the manual loading flag <Cite n={2} />. For
            live input values, your notes still recommend useState{" "}
            <Cite n={3} />.
          </p>
          <ol className="flex flex-col gap-2 pt-4 text-sm">
            {PREVIEW_CITATIONS.map((title, index) => (
              <li
                className="flex gap-3 rounded-lg bg-[#faf9f5] px-3 py-2 dark:bg-[#1f1f1f]"
                key={title}
              >
                <span className="font-jetbrains text-(--clay-ink)">
                  {index + 1}
                </span>
                {title}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  )
}

function Cite({ n }: { n: number }) {
  return <sup className="font-jetbrains font-medium text-(--clay-ink)">{n}</sup>
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

  const pains = [
    {
      marker: "a",
      title: t("landing.problem.links.title", "Links pile up unread"),
      desc: t(
        "landing.problem.links.desc",
        "Bookmarks and read later queues grow faster than you can open them."
      )
    },
    {
      marker: "b",
      title: t("landing.problem.scatter.title", "Notes scatter across apps"),
      desc: t(
        "landing.problem.scatter.desc",
        "Chat threads, docs and phone photos each hold a piece, and none of them talk to each other."
      )
    },
    {
      marker: "c",
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
    <section className={`${CONTAINER_CLASS} py-24`} ref={root}>
      <div className="flex flex-wrap items-center gap-16">
        <div
          className="flex min-w-0 flex-[1_1_420px] flex-col gap-6"
          data-reveal=""
        >
          <p className={EYEBROW_CLASS}>
            01 · {t("landing.problem.eyebrow", "Why notes do not stick")}
          </p>
          <h2 className={SECTION_TITLE_CLASS}>
            {/* Block lines balance on their own, so a phone wrap never
                strands one word. */}
            <span className="block">
              {t("landing.problem.titleLine1", "Saving is easy.")}
            </span>
            <span className="block text-(--clay)">
              {t("landing.problem.titleLine2", "Remembering is harder.")}
            </span>
          </h2>
          <p className="max-w-[560px] text-lg text-pretty text-muted-foreground">
            {t(
              "landing.problem.lede",
              "Most learning tools stop at the save button. FolioNote keeps going after it, so the things you collect turn into things you know."
            )}
          </p>
          <ul className="flex flex-col gap-6 pt-4">
            {pains.map((pain) => (
              <li className="flex gap-4" key={pain.marker}>
                <span className="font-jetbrains text-sm leading-6 text-(--clay-ink)">
                  {pain.marker}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{pain.title}</h3>
                  <p className="text-base text-pretty text-muted-foreground">
                    {pain.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <figure
          className="m-0 flex min-w-0 flex-[1_1_420px] flex-col gap-4 rounded-3xl border border-foreground/10 p-6 md:p-8"
          data-reveal=""
        >
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="text-base font-semibold">
              {t(
                "landing.problem.chartTitle",
                "How much you keep over a month"
              )}
            </p>
            <p className="font-jetbrains text-xs text-muted-foreground">
              {t("landing.problem.chartNote", "Illustration")}
            </p>
          </div>
          <ForgettingCurveChart />
          <figcaption className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-4 border-t-2 border-dashed border-muted-foreground" />
              {t("landing.problem.legendWithout", "Without review")}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 border-t-2 border-(--clay)" />
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
      <g className="stroke-foreground/10" strokeWidth={1}>
        <line x1={40} x2={40} y1={20} y2={200} />
        <line x1={40} x2={470} y1={200} y2={200} />
        <line strokeDasharray="2 4" x1={40} x2={470} y1={110} y2={110} />
      </g>
      <g className="fill-muted-foreground font-jetbrains" fontSize={12}>
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
        className="stroke-(--clay)"
        d="M40 20 C60 70 80 88 98 96 L98 28 C120 70 136 82 152 86 L152 30 C185 62 210 72 232 76 L232 34 C300 56 345 64 382 66 L382 38 C410 48 440 54 470 56"
        fill="none"
        strokeLinejoin="round"
        strokeWidth={2.5}
      />
      <g className="fill-(--clay)">
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

  const benefits = [
    {
      number: "01",
      title: t(
        "landing.benefits.capture.title",
        "Capture in seconds, from anywhere"
      ),
      desc: t(
        "landing.benefits.capture.desc",
        "A calm editor with markdown, code blocks and images on the web, plus quick notes from your phone. Every entry keeps its source, so you always know where an idea came from."
      )
    },
    {
      number: "02",
      title: t(
        "landing.benefits.ask.title",
        "Ask your notes, get answers with sources"
      ),
      desc: t(
        "landing.benefits.ask.desc",
        "Chat with everything you have saved. Each answer links back to the entries it used. Connect your own model provider key if you prefer."
      )
    },
    {
      number: "03",
      title: t("landing.benefits.review.title", "Review a few minutes a day"),
      desc: t(
        "landing.benefits.review.desc",
        "Spaced repetition brings each note back right before you would forget it. Rate your recall and the next review moves to match."
      )
    },
    {
      number: "04",
      title: t("landing.benefits.graph.title", "See how your ideas connect"),
      desc: t(
        "landing.benefits.graph.desc",
        "Links and shared tags draw a map of what you know, so a new note can find its neighbors."
      )
    },
    {
      number: "05",
      title: t(
        "landing.benefits.japanese.title",
        "Read Japanese with grammar in color"
      ),
      desc: t(
        "landing.benefits.japanese.desc",
        "Paste an article and every word gets furigana and a part of speech color. Then practice with JLPT style questions."
      )
    }
  ]

  return (
    <section
      className={`${CONTAINER_CLASS} scroll-mt-24 py-24`}
      id="features"
      ref={root}
    >
      <div className="flex flex-col gap-6 pb-16" data-reveal="">
        <p className={EYEBROW_CLASS}>
          02 · {t("landing.benefits.eyebrow", "What you get")}
        </p>
        <h2 className={`${SECTION_TITLE_CLASS} max-w-[760px]`}>
          <span className="block">
            {t("landing.benefits.titleLine1", "One notebook that keeps up")}
          </span>
          <span className="block">
            {t("landing.benefits.titleLine2", "with how you learn")}
          </span>
        </h2>
      </div>

      <ul className="flex flex-col border-y border-foreground/10">
        {benefits.map((benefit) => (
          <li
            className="flex flex-wrap gap-x-10 gap-y-4 border-foreground/10 py-8 not-first:border-t"
            data-reveal=""
            key={benefit.number}
          >
            <span className="flex-[0_0_64px] font-jetbrains text-3xl text-(--clay)">
              {benefit.number}
            </span>
            <h3 className="min-w-0 flex-[1_1_280px] text-2xl font-semibold text-balance">
              {benefit.title}
            </h3>
            <p className="min-w-0 flex-[1_1_400px] text-lg text-pretty text-muted-foreground">
              {benefit.desc}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tagline
// ---------------------------------------------------------------------------

// Words light up as the tagline crosses this band of the viewport, measured
// as fractions of its height from the top.
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
    <section className={`${CONTAINER_CLASS} py-24`}>
      <p
        className="max-w-[900px] font-display text-4xl font-normal tracking-tight text-balance md:text-6xl"
        ref={textRef}
      >
        {lines.map((line) => (
          <span className="block" key={line}>
            {[...segmenter.segment(line)].map((segment) =>
              // Punctuation lights with the words; only spaces stay plain.
              segment.segment.trim() ? (
                <span
                  className={`text-foreground/30 transition-colors duration-500 ${EASE_CLASS} data-lit:text-foreground`}
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
    </section>
  )
}

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

function HowItWorksSection() {
  const { t } = useTranslation()
  const root = useReveal<HTMLElement>()

  const steps = [
    {
      number: "1",
      title: t("landing.howItWorks.step1.title", "Capture"),
      desc: t(
        "landing.howItWorks.step1.desc",
        "Write ideas, highlights and lessons as they come. Use the full editor on the web or a quick note from your phone, and paste from anywhere."
      )
    },
    {
      number: "2",
      title: t("landing.howItWorks.step2.title", "Organize"),
      desc: t(
        "landing.howItWorks.step2.desc",
        "Tag entries, keep their sources, and let AI suggest where each one belongs. Related notes find each other through links and shared tags."
      )
    },
    {
      number: "3",
      title: t("landing.howItWorks.step3.title", "Remember"),
      desc: t(
        "landing.howItWorks.step3.desc",
        "A short daily review brings back the notes you are about to forget. Rate your recall and the next review moves to match."
      )
    }
  ]

  return (
    <section
      className={`${CONTAINER_CLASS} scroll-mt-24 py-24`}
      id="how-it-works"
      ref={root}
    >
      <div className="flex flex-col gap-6 pb-16" data-reveal="">
        <p className={EYEBROW_CLASS}>
          03 · {t("landing.howItWorks.eyebrow", "How it works")}
        </p>
        <h2 className={`${SECTION_TITLE_CLASS} max-w-[760px]`}>
          <span className="block">
            {t("landing.howItWorks.titleLine1", "Three steps from")}
          </span>
          <span className="block">
            {t("landing.howItWorks.titleLine2", "saved to known")}
          </span>
        </h2>
      </div>

      <ol className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
        {steps.map((step) => (
          <li className="flex flex-col gap-4" data-reveal="" key={step.number}>
            <span className="font-jetbrains text-6xl font-semibold text-(--clay)">
              {step.number}
            </span>
            <h3 className="text-2xl font-semibold">{step.title}</h3>
            <p className="text-base text-pretty text-muted-foreground">
              {step.desc}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const REPOSITORY_URL = "https://github.com/AmbitionsXXXV/FolioNote"

function FaqSection() {
  const { t } = useTranslation()
  const root = useReveal<HTMLElement>()

  const questions = [
    {
      id: "free",
      q: t("landing.faq.free.q", "Is FolioNote free?"),
      a: t(
        "landing.faq.free.a",
        "Yes. Every feature is free and no card is needed. There is no paid plan today."
      )
    },
    {
      id: "devices",
      q: t("landing.faq.devices.q", "Which devices does it run on?"),
      a: t(
        "landing.faq.devices.a",
        "The web, iOS and Android. Your notes are the same on every device you sign in on."
      )
    },
    {
      id: "model",
      q: t("landing.faq.model.q", "Can I use my own AI model?"),
      a: t(
        "landing.faq.model.a",
        "Yes. Add your own model provider key in settings. Every answer still links back to the entries it used."
      )
    },
    {
      id: "review",
      q: t("landing.faq.review.q", "How does the daily review pick notes?"),
      a: t(
        "landing.faq.review.a",
        "It uses spaced repetition. Each note comes back right before you are likely to forget it, and your recall rating sets the next date."
      )
    },
    {
      id: "collab",
      q: t("landing.faq.collab.q", "Can I edit a note with someone else?"),
      a: t(
        "landing.faq.collab.a",
        "Yes. Invite a collaborator to an entry and you both edit it in real time."
      )
    },
    {
      id: "japanese",
      q: t("landing.faq.japanese.q", "Does it help with learning Japanese?"),
      a: t(
        "landing.faq.japanese.a",
        "Paste an article to get furigana and part of speech colors on every word, then practice with JLPT style questions."
      )
    },
    {
      id: "openSource",
      q: t("landing.faq.openSource.q", "Is the code open source?"),
      a: t(
        "landing.faq.openSource.a",
        "Yes, under the MIT license. Read the code, file an issue or send a pull request on GitHub."
      ),
      link: REPOSITORY_URL
    }
  ]

  return (
    <section
      className={`${CONTAINER_CLASS} scroll-mt-24 py-24`}
      id="faq"
      ref={root}
    >
      <div className="flex flex-wrap gap-x-16 gap-y-12">
        <div
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-6"
          data-reveal=""
        >
          <p className={EYEBROW_CLASS}>
            04 · {t("landing.faq.eyebrow", "Questions")}
          </p>
          <h2 className={SECTION_TITLE_CLASS}>
            <span className="block">
              {t("landing.faq.titleLine1", "Before you")}
            </span>
            <span className="block">
              {t("landing.faq.titleLine2", "start")}
            </span>
          </h2>
        </div>

        <div
          className="flex min-w-0 flex-[2_1_560px] flex-col border-b border-foreground/10"
          data-reveal=""
        >
          {questions.map((item) => (
            <details
              className="group border-t border-foreground/10"
              key={item.id}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-6 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--clay-ink) [&::-webkit-details-marker]:hidden">
                {item.q}
                <HugeiconsIcon
                  className={`size-5 flex-none text-(--clay-ink) transition-transform duration-500 ${EASE_CLASS} group-open:rotate-45`}
                  icon={Add01Icon}
                />
              </summary>
              <div className="flex flex-col gap-2 pr-12 pb-6 text-base text-pretty text-muted-foreground">
                <p>{item.a}</p>
                {item.link && (
                  <a
                    className="w-fit rounded-sm font-medium text-(--clay-ink) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--clay-ink)"
                    href={item.link}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    github.com/AmbitionsXXXV/FolioNote
                  </a>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------

function FinalCtaSection() {
  const { t } = useTranslation()
  const root = useReveal<HTMLElement>()

  // The panel is clay in both themes, so its text and button stay dark slate.
  return (
    <section className={`${CONTAINER_CLASS} pt-16 pb-24`} ref={root}>
      <div
        className="flex flex-col items-center gap-6 rounded-3xl bg-(--clay) px-6 py-20 text-center text-[#141413] md:px-10"
        data-reveal=""
      >
        <h2 className={`${SECTION_TITLE_CLASS} max-w-[680px]`}>
          <span className="block">
            {t("landing.cta.titleLine1", "Keep what you learn.")}
          </span>
          <span className="block">
            {t("landing.cta.titleLine2", "Start with your next note.")}
          </span>
        </h2>
        <p className="max-w-[560px] text-lg text-pretty">
          {t(
            "landing.cta.description",
            "Capture it, ask about it, and review it for a few minutes a day."
          )}
        </p>
        <Link
          className={`group inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-3 text-base font-semibold text-white transition-transform duration-500 ${EASE_CLASS} hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141413] active:scale-[0.98]`}
          to="/register"
        >
          {t("landing.hero.cta", "Create your free notebook")}
          <HugeiconsIcon
            className={`size-4 transition-transform duration-500 ${EASE_CLASS} group-hover:translate-x-1`}
            icon={ArrowRight02Icon}
          />
        </Link>
        <p className="text-sm">
          {t(
            "landing.cta.riskReversal",
            "Free to start. No card needed. Open source under MIT."
          )}
        </p>
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
    <footer
      className={`${CONTAINER_CLASS} flex flex-wrap items-center justify-between gap-6 py-10 text-sm`}
    >
      <BrandLockup iconClassName="size-6" wordmarkClassName="text-base" />
      <nav
        aria-label={t("landing.footer.navLabel", "Footer")}
        className="flex flex-wrap gap-6"
      >
        <a className={NAV_LINK_CLASS} href="#features">
          {t("landing.nav.features", "Features")}
        </a>
        <a className={NAV_LINK_CLASS} href="#how-it-works">
          {t("landing.nav.howItWorks", "How it works")}
        </a>
        <a className={NAV_LINK_CLASS} href="#faq">
          {t("landing.nav.faq", "FAQ")}
        </a>
        <a
          className={NAV_LINK_CLASS}
          href={REPOSITORY_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub
        </a>
        <Link className={NAV_LINK_CLASS} to="/login">
          {t("auth.signIn", "Sign in")}
        </Link>
      </nav>
      <p className="text-muted-foreground">
        {t("landing.footer.copyright", "© {{year}} FolioNote", { year })}
      </p>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Page Composition
// ---------------------------------------------------------------------------

function LandingPage() {
  const { t } = useTranslation()

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

  // z-[1] lifts the flat page above the body's marketing glow and grain
  // overlays (packages/ui index.css), which would tint the white canvas.
  return (
    <div
      className={`${LANDING_ROOT_CLASS} relative z-[1] min-h-screen overflow-x-clip bg-white font-geist text-foreground dark:bg-[#181818]`}
    >
      <a
        className="fixed top-4 left-4 z-[60] -translate-y-24 rounded-lg bg-foreground px-3 py-2 text-sm text-background focus-visible:translate-y-0"
        href="#main"
      >
        {t("landing.skipToContent", "Skip to content")}
      </a>
      <LandingNavbar />
      <main id="main">
        <HeroSection />
        <ProblemSection />
        <BenefitsSection />
        <TaglineSection />
        <HowItWorksSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
