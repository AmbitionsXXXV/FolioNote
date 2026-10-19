export type JapaneseAnalyzerErrorCode =
  | "EMPTY_INPUT"
  | "INPUT_TOO_LONG"
  | "ENGINE_UNAVAILABLE"

export class JapaneseAnalyzerError extends Error {
  readonly code: JapaneseAnalyzerErrorCode

  constructor(
    code: JapaneseAnalyzerErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = "JapaneseAnalyzerError"
    this.code = code
  }
}
