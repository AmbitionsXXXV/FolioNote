import {
  ImpactFeedbackStyle,
  impactAsync,
  NotificationFeedbackType,
  notificationAsync,
  selectionAsync
} from "expo-haptics"
import { Platform } from "react-native"

/**
 * The app's haptic vocabulary (design canvas, page `onboard` › 触感词汇表).
 * Each name stands for one kind of moment so the same action feels the same
 * everywhere. One haptic per gesture; never on scroll, page or back.
 * iOS mutes these by itself when system haptics are off.
 */

const STAMP_SUCCESS_DELAY_MS = 120

// Haptics are a nicety: a failure (simulator, unsupported device) must never
// surface to the user, so every call swallows its rejection on purpose.
const ignore = () => undefined
const isSupported = Platform.OS === "ios"

const run = (fire: () => Promise<void>) => {
  if (!isSupported) return
  fire().catch(ignore)
}

export type RatingFeel = "again" | "hard" | "good"

export const haptics = {
  /** 轻点: toggles, ruler ticks, tapping a subtitle word, picking a glyph. */
  tap: () => run(selectionAsync),
  /** 落下: a note lands in the inbox, a word goes into the word book. */
  drop: () => run(() => impactAsync(ImpactFeedbackStyle.Medium)),
  /** The cover cards settling: the lightest landing. */
  settle: () => run(() => impactAsync(ImpactFeedbackStyle.Light)),
  /** 翻面: the card passes the halfway point of its flip. */
  flip: () => run(() => impactAsync(ImpactFeedbackStyle.Soft)),
  /** 评分: three different feels for the three ratings. */
  rate: (rating: RatingFeel) => {
    if (rating === "again") {
      run(() => impactAsync(ImpactFeedbackStyle.Rigid))
      return
    }
    if (rating === "hard") {
      run(() => impactAsync(ImpactFeedbackStyle.Light))
      return
    }
    run(() => notificationAsync(NotificationFeedbackType.Success))
  },
  /** 蓄力: one pulse of the press-and-hold charge. */
  charge: () => run(() => impactAsync(ImpactFeedbackStyle.Light)),
  /** 盖章: the only heavy haptic in the app, then a success 120ms later. */
  stamp: () => {
    run(() => impactAsync(ImpactFeedbackStyle.Heavy))
    setTimeout(
      () => run(() => notificationAsync(NotificationFeedbackType.Success)),
      STAMP_SUCCESS_DELAY_MS
    )
  },
  /** 出错: wrong email or password, network failure. */
  error: () => run(() => notificationAsync(NotificationFeedbackType.Error)),
  /** 完成: signed in or signed up. */
  done: () => run(() => notificationAsync(NotificationFeedbackType.Success))
}
