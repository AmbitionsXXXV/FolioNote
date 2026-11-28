import { LANGUAGE_LABELS } from "@folionote/constants"
import { supportedLanguages } from "@folionote/locales"
import type { SupportedLanguage } from "@folionote/locales"
import {
  ArrowRight01Icon,
  Globe02Icon,
  PlayIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react-native"
import { useThemeColor } from "heroui-native"
import type { ReactNode } from "react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  ActionSheetIOS,
  Pressable,
  Text,
  useWindowDimensions,
  View
} from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated"
import type { SharedValue } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useCSSVariable } from "uniwind"

import { BrandLockup } from "@/components/brand-lockup"
import { haptics } from "@/lib/haptics"

import {
  GlassBackButton,
  GlassPillButton,
  PrimaryButton
} from "../onboarding-chrome"
import { PaperSeal } from "../paper-seal"
import { useTilt } from "../use-tilt"

/** The canvas frame the card positions were drawn on. */
const DESIGN_WIDTH = 402
/** Nearest cards move this much at full tilt; farther ones less. */
const MAX_PARALLAX = 10
const DROP_STAGGER_MS = 110
const DROP_SPRING = { damping: 14, stiffness: 140, mass: 0.9 } as const
const CARD_COUNT = 4

interface FloatSpec {
  /** 0 = far, 1 = near: scales the parallax offset. */
  depth: number
  amplitude: number
  rotateFrom: number
  rotateTo: number
  durationMs: number
}

function FloatingCard({
  order,
  spec,
  tilt,
  style,
  children
}: {
  order: number
  spec: FloatSpec
  tilt: { x: SharedValue<number>; y: SharedValue<number> }
  style: object
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const drop = useSharedValue(reduceMotion ? 0 : -90)
  const opacity = useSharedValue(0)
  const float = useSharedValue(0)

  useEffect(() => {
    const delay = order * DROP_STAGGER_MS
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }))
    if (reduceMotion) return
    drop.value = withDelay(delay, withSpring(0, DROP_SPRING))
    float.value = withDelay(
      delay + 600,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: spec.durationMs / 2,
            easing: Easing.inOut(Easing.sin)
          }),
          withTiming(0, {
            duration: spec.durationMs / 2,
            easing: Easing.inOut(Easing.sin)
          })
        ),
        -1
      )
    )
  }, [drop, float, opacity, order, reduceMotion, spec.durationMs])

  const animatedStyle = useAnimatedStyle(() => {
    const parallax = MAX_PARALLAX * spec.depth
    const rotate =
      spec.rotateFrom + (spec.rotateTo - spec.rotateFrom) * float.value
    return {
      opacity: opacity.value,
      transform: [
        { translateX: tilt.x.value * parallax },
        {
          translateY:
            drop.value + spec.amplitude * float.value + tilt.y.value * parallax
        },
        { rotate: `${rotate}deg` }
      ]
    }
  })

  return (
    <Animated.View style={[{ position: "absolute" }, style, animatedStyle]}>
      {children}
    </Animated.View>
  )
}

const cardShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.1,
  shadowRadius: 17,
  shadowOffset: { width: 0, height: 14 }
} as const

export function CoverStep({
  onStart,
  onHaveAccount,
  onClose
}: {
  onStart: () => void
  onHaveAccount?: () => void
  /** Replay only: leave the walk-through. */
  onClose?: () => void
}) {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const tilt = useTilt()
  const foreground = useThemeColor("foreground")
  const accentForeground = useThemeColor("accent-foreground")
  const stageForeground = String(
    useCSSVariable("--color-stage-foreground") ?? accentForeground
  )
  const scale = width / DESIGN_WIDTH
  const at = (value: number) => value * scale

  // One light landing once the last card has settled.
  useEffect(() => {
    const timer = setTimeout(
      haptics.settle,
      CARD_COUNT * DROP_STAGGER_MS + 380
    )
    return () => clearTimeout(timer)
  }, [])

  const chooseLanguage = () => {
    const languages = [...supportedLanguages] as SupportedLanguage[]
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t("onboarding.flow.cover.language"),
        options: [...languages.map((lang) => LANGUAGE_LABELS[lang]), t("common.cancel")],
        cancelButtonIndex: languages.length
      },
      (index) => {
        const picked = languages[index]
        if (!picked) return
        haptics.tap()
        i18n.changeLanguage(picked)
      }
    )
  }

  const currentLabel =
    LANGUAGE_LABELS[i18n.language as SupportedLanguage] ?? i18n.language

  return (
    <View className="flex-1 bg-background">
      {onClose ? (
        <View className="absolute left-4 z-10" style={{ top: insets.top + 6 }}>
          <GlassBackButton label={t("common.close")} onPress={onClose} />
        </View>
      ) : null}
      <View className="absolute right-4 z-10" style={{ top: insets.top + 6 }}>
        <GlassPillButton
          accessibilityLabel={t("onboarding.flow.cover.languageAria", {
            language: currentLabel
          })}
          icon={
            <HugeiconsIcon color={foreground} icon={Globe02Icon} size={18} />
          }
          label={currentLabel}
          onPress={chooseLanguage}
        />
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: at(520) }}
      >
        <FloatingCard
          order={0}
          spec={{ depth: 1, amplitude: -9, rotateFrom: -6, rotateTo: -5, durationMs: 7000 }}
          style={{ left: at(26), top: at(150), width: at(196) }}
          tilt={tilt}
        >
          <View className="gap-1.5 rounded-[20px] bg-surface p-[18px]" style={cardShadow}>
            <Text className="text-[11px] font-semibold tracking-wider text-muted">
              今日の一語
            </Text>
            <View>
              <Text className="text-[12px] text-muted">こもれび</Text>
              <Text className="text-[34px] font-bold leading-[44px] text-foreground">
                木漏れ日
              </Text>
            </View>
            <Text className="text-[13px] text-muted">
              {t("onboarding.flow.demoMeaning")}
            </Text>
          </View>
        </FloatingCard>

        <FloatingCard
          order={1}
          spec={{ depth: 0.45, amplitude: 7, rotateFrom: 5, rotateTo: 6, durationMs: 8500 }}
          style={{ right: at(22), top: at(122), width: at(150) }}
          tilt={tilt}
        >
          <View className="gap-2 rounded-2xl bg-surface p-3.5" style={cardShadow}>
            <Text className="text-[13px] font-semibold leading-[18px] text-foreground">
              {t("onboarding.flow.cover.noteCard")}
            </Text>
            <View className="h-[5px] rounded-full bg-default" />
            <View className="h-[5px] w-[78%] rounded-full bg-default" />
            <Text className="text-[11px] text-muted">
              {t("onboarding.flow.cover.noteDue")}
            </Text>
          </View>
        </FloatingCard>

        <FloatingCard
          order={2}
          spec={{ depth: 0.7, amplitude: -6, rotateFrom: -3, rotateTo: -2, durationMs: 6500 }}
          style={{ right: at(30), top: at(312), width: at(214) }}
          tilt={tilt}
        >
          <View
            className="flex-row items-center gap-2.5 rounded-2xl bg-stage px-3.5 py-3"
            style={cardShadow}
          >
            <View className="size-[30px] items-center justify-center rounded-full bg-stage-foreground/15">
              <HugeiconsIcon color={stageForeground} icon={PlayIcon} size={12} />
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-[14px] font-medium text-stage-foreground" numberOfLines={1}>
                <Text className="text-warning">木漏れ日</Text>がきれいでした
              </Text>
              <Text className="text-[11px] text-stage-muted" style={{ fontVariant: ["tabular-nums"] }}>
                0:42 · {t("onboarding.flow.cover.subtitle")}
              </Text>
            </View>
          </View>
        </FloatingCard>

        <FloatingCard
          order={3}
          spec={{ depth: 0.25, amplitude: 5, rotateFrom: -10, rotateTo: -12, durationMs: 9000 }}
          style={{ left: at(58), top: at(318) }}
          tilt={tilt}
        >
          <PaperSeal caption="12 日連続" glyph="学" size={at(92)} />
        </FloatingCard>
      </View>

      <View className="absolute inset-x-6 gap-3.5" style={{ top: at(478) }}>
        <BrandLockup size={40} wordmarkClassName="text-[26px] text-foreground" />
        <Text
          accessibilityRole="header"
          className="text-[36px] font-bold leading-[42px] tracking-tight text-foreground"
        >
          {t("onboarding.flow.cover.title")}
        </Text>
        <Text className="text-base leading-6 text-muted">
          {t("onboarding.flow.cover.body")}
        </Text>
      </View>

      <View className="absolute inset-x-6 gap-1.5" style={{ bottom: insets.bottom + 12 }}>
        <PrimaryButton
          label={t("onboarding.flow.cover.start")}
          onPress={() => {
            haptics.tap()
            onStart()
          }}
          trailing={
            <HugeiconsIcon color={accentForeground} icon={ArrowRight01Icon} size={18} />
          }
        />
        {onHaveAccount ? (
          <Pressable
            accessibilityRole="button"
            className="h-12 items-center justify-center active:opacity-60"
            onPress={onHaveAccount}
          >
            <Text className="text-base font-medium text-foreground">
              {t("onboarding.flow.cover.haveAccount")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
