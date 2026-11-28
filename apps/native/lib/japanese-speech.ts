import * as Speech from "expo-speech"

const JAPANESE_LANGUAGE = "ja-JP"

let voicePick: Promise<string | undefined> | null = null

/**
 * The best Japanese voice on this device: an "Enhanced" one the reader has
 * downloaded in iOS Settings beats the compact default.
 */
const pickJapaneseVoice = () => {
  voicePick ??= Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const japanese = voices.filter((voice) =>
        voice.language.startsWith(JAPANESE_LANGUAGE)
      )
      const enhanced = japanese.find(
        (voice) => voice.quality === Speech.VoiceQuality.Enhanced
      )
      return (enhanced ?? japanese[0])?.identifier
    })
    .catch(() => undefined)
  return voicePick
}

/** True when the device only has the compact Japanese voice. */
export const hasOnlyBasicJapaneseVoice = async (): Promise<boolean> => {
  try {
    const voices = await Speech.getAvailableVoicesAsync()
    return !voices.some(
      (voice) =>
        voice.language.startsWith(JAPANESE_LANGUAGE) &&
        voice.quality === Speech.VoiceQuality.Enhanced
    )
  } catch {
    return false
  }
}

/**
 * Read Japanese text aloud with the system voice, stopping anything already
 * playing. Resolves when speech finishes or is stopped by the next call.
 * `onWord` gets the character offset of each word as the voice reaches it.
 */
export async function speakJapanese(
  text: string,
  rate = 1,
  onWord?: (charIndex: number) => void
): Promise<void> {
  Speech.stop()
  const voice = await pickJapaneseVoice()
  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language: JAPANESE_LANGUAGE,
      voice,
      rate,
      onBoundary: onWord
        ? (event: { charIndex: number }) => onWord(event.charIndex)
        : undefined,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (error) =>
        reject(new Error(`Speech synthesis failed: ${error.message}`))
    })
  })
}
