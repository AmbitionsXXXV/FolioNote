const JAPANESE_LANG = "ja-JP"

/** Browsers without the Web Speech API (and SSR) get no play buttons. */
export function isJapaneseSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  )
}

/**
 * The best installed Japanese voice. Voices load asynchronously in Chrome, so
 * an empty list just means "let the browser pick from the utterance's lang".
 */
function japaneseVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.replace("_", "-").startsWith("ja"))
  return voices.find((voice) => voice.localService) ?? voices[0]
}

/**
 * Read Japanese text aloud with the system voice, interrupting anything
 * already playing. Resolves when speech ends; rejects if the browser reports
 * an error other than being interrupted by the next call.
 */
export function speakJapanese(text: string, rate = 1): Promise<void> {
  if (!isJapaneseSpeechSupported())
    return Promise.reject(new Error("Speech synthesis is not supported"))
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = JAPANESE_LANG
  utterance.rate = rate
  const voice = japaneseVoice()
  if (voice) utterance.voice = voice
  return new Promise((resolve, reject) => {
    utterance.addEventListener("end", () => resolve())
    utterance.addEventListener("error", (event) => {
      if (event.error === "interrupted" || event.error === "canceled") {
        resolve()
        return
      }
      reject(new Error(`Speech synthesis failed: ${event.error}`))
    })
    synth.speak(utterance)
  })
}
