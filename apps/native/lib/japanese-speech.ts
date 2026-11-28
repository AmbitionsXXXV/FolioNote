import * as Speech from "expo-speech"

const JAPANESE_LANGUAGE = "ja-JP"

/**
 * Read Japanese text aloud with the system voice, stopping anything already
 * playing. Resolves when speech finishes or is stopped by the next call.
 */
export function speakJapanese(text: string, rate = 1): Promise<void> {
  Speech.stop()
  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language: JAPANESE_LANGUAGE,
      rate,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (error) =>
        reject(new Error(`Speech synthesis failed: ${error.message}`))
    })
  })
}
