/**
 * Pronunciation for vocabulary study.
 *
 * A word or sentence plays its pre-generated recording when it has one
 * (downloaded once into the cache folder, so it also works offline) and
 * otherwise falls back to the device's Japanese voice. Only one sound plays
 * at a time: starting another, or calling stopPronouncing, cuts it off.
 */
import { createAudioPlayer, setAudioModeAsync } from "expo-audio"
import type { AudioPlayer } from "expo-audio"
import { Directory, File, Paths } from "expo-file-system"
import * as Speech from "expo-speech"
import Storage from "expo-sqlite/kv-store"

import { speakJapanese } from "@/lib/japanese-speech"

const PREFS_KEY = "jp-study:speech-prefs"
const SLOW_RATE = 0.75
const audioDir = new Directory(Paths.cache, "jp-audio")

export interface SpeechPrefs {
  /** Read each new card aloud as it appears. */
  autoSpeak: boolean
  /** Play everything at 0.75×. */
  slow: boolean
  /** After revealing the answer, read the example sentence too. */
  speakExample: boolean
}

const DEFAULT_PREFS: SpeechPrefs = {
  autoSpeak: true,
  slow: false,
  speakExample: false
}

export const loadSpeechPrefs = (): SpeechPrefs => {
  try {
    const stored = Storage.getItemSync(PREFS_KEY)
    return stored
      ? { ...DEFAULT_PREFS, ...(JSON.parse(stored) as Partial<SpeechPrefs>) }
      : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export const saveSpeechPrefs = (prefs: SpeechPrefs) => {
  Storage.setItemSync(PREFS_KEY, JSON.stringify(prefs))
}

let audioModeReady: Promise<void> | null = null
// Learners tap the speaker on purpose, so play even with the ring switch
// on silent, and only lower (not stop) whatever music is playing.
const ensureAudioMode = () => {
  audioModeReady ??= setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: "duckOthers"
  }).catch(() => undefined)
  return audioModeReady
}

const fileFor = (url: string) => {
  const name = url.split("/").slice(-2).join("-")
  return new File(audioDir, name)
}

/** Download recordings ahead of time so a session can go offline. */
export const prefetchAudio = async (urls: (string | null)[]) => {
  if (!audioDir.exists)
    audioDir.create({ idempotent: true, intermediates: true })
  for (const url of urls) {
    if (!url) continue
    const file = fileFor(url)
    if (file.exists) continue
    try {
      await File.downloadFileAsync(url, file)
    } catch {
      // Not fatal: playback falls back to the stream, then the device voice.
    }
  }
}

let player: AudioPlayer | null = null
let finishCurrent: (() => void) | null = null

export const stopPronouncing = () => {
  Speech.stop()
  if (player) {
    player.pause()
    player.remove()
    player = null
  }
  finishCurrent?.()
  finishCurrent = null
}

const playRecording = async (url: string, slow: boolean) => {
  await ensureAudioMode()
  const cached = fileFor(url)
  const current = createAudioPlayer(cached.exists ? cached.uri : url)
  player = current
  if (slow) current.setPlaybackRate(SLOW_RATE, "high")
  await new Promise<void>((resolve) => {
    finishCurrent = resolve
    current.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) resolve()
    })
    current.play()
  })
  if (player === current) {
    current.remove()
    player = null
  }
}

/**
 * Say `text`, preferring its recording. Resolves when it finishes or is cut
 * off by the next call.
 */
export const pronounce = async (
  text: string,
  options: { audioUrl?: string | null; slow?: boolean } = {}
) => {
  stopPronouncing()
  const slow = options.slow ?? false
  if (options.audioUrl) {
    try {
      await playRecording(options.audioUrl, slow)
      return
    } catch {
      // Fall through to the device voice.
    }
  }
  await speakJapanese(text, slow ? SLOW_RATE : 1)
}
