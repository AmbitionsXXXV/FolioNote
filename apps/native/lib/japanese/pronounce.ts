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

// Name the cached file after the whole bucket path ("words/<voice>/<id>.mp3"),
// so a word and an example that share an id never share a file.
const fileFor = (url: string) => {
  // Plain string work: React Native's URL does not implement pathname.
  const path = url.split("?")[0]?.split("/jp-audio/").pop() ?? url
  return new File(audioDir, path.replaceAll("/", "-"))
}

const PREFETCH_CONCURRENCY = 4

/** Download recordings ahead of time so a session can go offline. */
export const prefetchAudio = async (urls: (string | null)[]) => {
  if (!audioDir.exists)
    audioDir.create({ idempotent: true, intermediates: true })
  const pending = urls.filter(
    (url): url is string => url !== null && !fileFor(url).exists
  )
  const worker = async () => {
    for (let url = pending.shift(); url; url = pending.shift()) {
      try {
        await File.downloadFileAsync(url, fileFor(url))
      } catch {
        // Not fatal: playback falls back to the stream, then the device voice.
      }
    }
  }
  await Promise.all(Array.from({ length: PREFETCH_CONCURRENCY }, worker))
}

// A recording that has not loaded by then (missing file, bad network) gives
// way to the device voice instead of leaving the card silent.
const LOAD_TIMEOUT_MS = 4000

let player: AudioPlayer | null = null
let finishCurrent: (() => void) | null = null
// Bumped by every stop, so a call still waiting on setup knows it was cut off.
let generation = 0

export const stopPronouncing = () => {
  generation += 1
  Speech.stop()
  if (player) {
    player.pause()
    player.remove()
    player = null
  }
  finishCurrent?.()
  finishCurrent = null
}

/** Plays a recording; resolves when it ends or is cut off, rejects if it never loads. */
const playRecording = async (url: string, slow: boolean, turn: number) => {
  await ensureAudioMode()
  if (turn !== generation) return
  const cached = fileFor(url)
  const current = createAudioPlayer(cached.exists ? cached.uri : url)
  player = current
  if (slow) current.setPlaybackRate(SLOW_RATE, "high")
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Recording did not load: ${url}`))
      }, LOAD_TIMEOUT_MS)
      finishCurrent = () => {
        clearTimeout(timeout)
        resolve()
      }
      current.addListener("playbackStatusUpdate", (status) => {
        if (status.isLoaded) clearTimeout(timeout)
        if (status.didJustFinish) resolve()
      })
      current.play()
    })
  } finally {
    if (player === current) {
      current.remove()
      player = null
      finishCurrent = null
    }
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
  const turn = generation
  const slow = options.slow ?? false
  if (options.audioUrl) {
    try {
      await playRecording(options.audioUrl, slow, turn)
      return
    } catch {
      // Fall through to the device voice, unless something newer took over.
      if (turn !== generation) return
    }
  }
  await speakJapanese(text, slow ? SLOW_RATE : 1)
}
