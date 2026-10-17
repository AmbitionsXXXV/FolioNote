import type { Word } from "@folionote/japanese"
import { splitArticle, decodeJapaneseBytes } from "@folionote/japanese"
import { Button, Input, Label, TextArea, TextField } from "@heroui/react"
import { Upload01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import type { ChangeEvent, DragEvent } from "react"
import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useDebounce } from "@/hooks/use-debounce"
import { useJapaneseLexiconLookup } from "@/hooks/use-japanese-lexicon-lookup"
import { contentBaseForms, firstArticleSentence } from "@/lib/japanese-article"
import { ALL_JAPANESE_POS_CATEGORIES } from "@/lib/japanese-typing"
import { htmlToArticleText } from "@/lib/japanese-wordlist-import"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

import { JapaneseAnalyzedSentenceView } from "./japanese-analyzed-sentence"
import { JapaneseAttribution } from "./japanese-attribution"
import { JapaneseLevelSpread } from "./japanese-level-spread"
import {
  isServiceUnavailable,
  JapaneseSegmented
} from "./japanese-reading-controls"

/** Matches japanese.articles.create / preview. */
export const ARTICLE_MAX_CHARS = 20_000
const SENTENCE_END = /[。！？!?\n]/
const EXCERPT_TITLE_CHARS = 24

/** First sentence, shortened, for articles saved without a title. */
function excerptTitle(text: string): string {
  const [firstSentence = ""] = text.split(SENTENCE_END)
  const sentence = firstSentence.trim()
  return sentence.length > EXCERPT_TITLE_CHARS
    ? `${sentence.slice(0, EXCERPT_TITLE_CHARS)}…`
    : sentence
}

const PREVIEW_DEBOUNCE_MS = 600
const PREVIEW_MIN_CHARS = 2
const PREVIEW_STALE_MS = 5 * 60 * 1000
const NEW_WORD_CHIPS = 12
const ALL_POS = new Set(ALL_JAPANESE_POS_CATEGORIES)
const HTML_FILE = /\.html?$/i
const FILE_EXTENSION = /\.[^.]+$/

type ArticleSource = "paste" | "url" | "file"
type PreviewStatus = "idle" | "analyzing" | "ready" | "unavailable" | "failed"

const STATUS_CLASS: Record<PreviewStatus, string> = {
  idle: "bg-surface-secondary text-muted-foreground",
  analyzing: "bg-surface-secondary text-foreground",
  ready: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  unavailable: "bg-primary/12 text-primary",
  failed: "bg-danger/12 text-danger"
}

function StatusPill({ status }: { status: PreviewStatus }) {
  const { t } = useTranslation()
  const labelKey: Record<PreviewStatus, string> = {
    idle: "japanese.import.article.statusIdle",
    analyzing: "japanese.import.article.statusAnalyzing",
    ready: "japanese.import.article.statusReady",
    unavailable: "japanese.import.article.statusUnavailable",
    failed: "japanese.import.article.statusFailed"
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        STATUS_CLASS[status]
      )}
      data-status={status}
      role="status"
    >
      {status === "analyzing" ? (
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-current"
        />
      ) : null}
      {t(labelKey[status])}
    </span>
  )
}

function StatTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 px-4 py-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">
        {value ?? "—"}
      </dd>
    </div>
  )
}

interface SourcePanelProps {
  source: ArticleSource
  url: string
  onUrlChange: (value: string) => void
  onFetch: () => void
  isFetching: boolean
  fetchError: string | null
  fileName: string | null
  onFile: (file: File) => void
}

function UrlSource({
  url,
  onUrlChange,
  onFetch,
  isFetching,
  fetchError
}: Pick<
  SourcePanelProps,
  "url" | "onUrlChange" | "onFetch" | "isFetching" | "fetchError"
>) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <TextField
        className="flex-1"
        isInvalid={fetchError !== null}
        onChange={onUrlChange}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onFetch()
          }
        }}
        type="url"
        value={url}
      >
        <Label>{t("japanese.import.article.urlLabel")}</Label>
        <Input
          inputMode="url"
          placeholder={t("japanese.import.article.urlPlaceholder")}
        />
      </TextField>
      <Button
        isDisabled={isFetching || url.trim().length === 0}
        onPress={onFetch}
        variant="secondary"
      >
        {isFetching
          ? t("japanese.import.article.fetching")
          : t("japanese.import.article.fetch")}
      </Button>
      {fetchError ? (
        <p className="text-xs text-danger sm:basis-full" role="alert">
          {fetchError}
        </p>
      ) : null}
    </div>
  )
}

function FileSource({
  fileName,
  onFile
}: Pick<SourcePanelProps, "fileName" | "onFile">) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOver, setIsOver] = useState(false)

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsOver(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onFile(file)
    event.target.value = ""
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors",
        isOver ? "border-primary bg-primary/8" : "border-border/70"
      )}
      onDragLeave={() => setIsOver(false)}
      onDragOver={(event) => {
        event.preventDefault()
        setIsOver(true)
      }}
      onDrop={handleDrop}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="size-5 text-muted-foreground"
        icon={Upload01Icon}
      />
      <p className="text-sm font-medium">
        {t("japanese.import.article.fileLabel")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("japanese.import.article.fileHint")}
      </p>
      <input
        accept=".txt,.md,.html,.htm,text/plain,text/markdown,text/html"
        aria-label={t("japanese.import.article.fileLabel")}
        className="sr-only"
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      <Button
        onPress={() => inputRef.current?.click()}
        size="sm"
        variant="outline"
      >
        {t("japanese.import.wordlist.browse")}
      </Button>
      {fileName ? (
        <p className="text-xs text-muted-foreground">
          {t("japanese.import.article.fileRead", { name: fileName })}
        </p>
      ) : null}
    </div>
  )
}

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function JapaneseArticleImport() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [source, setSource] = useState<ArticleSource>("paste")
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [url, setUrl] = useState("")
  const [truncated, setTruncated] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)

  const trimmedText = text.trim()
  const debouncedText = useDebounce(text, PREVIEW_DEBOUNCE_MS)
  const previewText = debouncedText.trim()
  const canPreview =
    previewText.length >= PREVIEW_MIN_CHARS &&
    previewText.length <= ARTICLE_MAX_CHARS
  const detectedTitle = useMemo(
    () => (trimmedText ? splitArticle(text).title : null),
    [text, trimmedText]
  )

  const preview = useQuery({
    ...orpc.japanese.articles.preview.queryOptions({
      input: { text: previewText }
    }),
    enabled: canPreview,
    retry: false,
    staleTime: PREVIEW_STALE_MS,
    placeholderData: keepPreviousData,
    meta: { silentError: true }
  })

  const firstSentence = useMemo(
    () =>
      canPreview && preview.data
        ? firstArticleSentence(previewText, preview.data.analysis)
        : null,
    [canPreview, preview.data, previewText]
  )
  const firstSentenceForms = useMemo(
    () => contentBaseForms([firstSentence?.analysis ?? null]),
    [firstSentence]
  )
  const lexicons = useJapaneseLexiconLookup(firstSentenceForms)
  const newBaseForms = useMemo(
    () =>
      new Set(firstSentenceForms.filter((form) => !lexicons.matches.has(form))),
    [firstSentenceForms, lexicons.matches]
  )

  let status: PreviewStatus = "idle"
  if (canPreview) {
    if (preview.isPending || preview.isFetching) {
      status = "analyzing"
    } else if (preview.isError) {
      status = isServiceUnavailable(preview.error) ? "unavailable" : "failed"
    } else {
      status = "ready"
    }
  }
  const stats = status === "ready" ? preview.data?.stats : undefined

  const fetchUrl = useMutation({
    mutationFn: (target: string) =>
      orpc.japanese.articles.fetchUrl.call({ url: target }),
    onSuccess: (fetched) => {
      setTitle((previous) => previous.trim() || fetched.title)
      setText(fetched.text)
      setTruncated(fetched.truncated)
      setSelectedWord(null)
    }
  })

  const create = useMutation({
    mutationFn: (input: {
      title: string
      text: string
      sourceType: ArticleSource
      sourceUrl?: string
    }) => orpc.japanese.articles.create.call(input),
    onSuccess: (article) => {
      queryClient.invalidateQueries({
        queryKey: orpc.japanese.articles.key()
      })
      toast.success(t("japanese.import.article.created"))
      void navigate({
        to: "/japanese/read/$articleId",
        params: { articleId: article.id }
      })
    },
    onError: () => {
      toast.error(t("japanese.import.article.createFailed"))
    }
  })

  const handleFile = async (file: File) => {
    const content = decodeJapaneseBytes(await file.arrayBuffer(), file.type)
    const isHtml = HTML_FILE.test(file.name) || file.type === "text/html"
    const parsed = isHtml
      ? htmlToArticleText(content)
      : { title: null, text: content }
    setText(parsed.text.slice(0, ARTICLE_MAX_CHARS))
    setTruncated(parsed.text.length > ARTICLE_MAX_CHARS)
    setFileName(file.name)
    setSelectedWord(null)
    setTitle(
      (previous) =>
        previous.trim() || parsed.title || file.name.replace(FILE_EXTENSION, "")
    )
  }

  const handleFetch = () => {
    const target = url.trim()
    if (!target) return
    fetchUrl.mutate(target)
  }

  const fallbackTitle = detectedTitle ?? excerptTitle(trimmedText)
  const canSubmit =
    trimmedText.length > 0 &&
    trimmedText.length <= ARTICLE_MAX_CHARS &&
    (title.trim().length > 0 || fallbackTitle.length > 0) &&
    !create.isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    const sourceUrl =
      source === "url" && isValidHttpUrl(url.trim()) ? url.trim() : undefined
    create.mutate({
      title: title.trim() || fallbackTitle,
      text,
      sourceType: source,
      sourceUrl
    })
  }

  const newWords = preview.data?.newWords ?? []
  const fetchError = fetchUrl.isError
    ? fetchUrl.error.message || t("japanese.import.article.fetchFailed")
    : null

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Source */}
        <section
          aria-labelledby="japanese-import-source"
          className="flex flex-col gap-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              id="japanese-import-source"
            >
              {t("japanese.import.article.sourceLabel")}
            </h2>
            <JapaneseSegmented
              label={t("japanese.import.article.sourceLabel")}
              onChange={setSource}
              options={[
                {
                  value: "paste",
                  label: t("japanese.import.article.sourcePaste")
                },
                { value: "url", label: t("japanese.import.article.sourceUrl") },
                {
                  value: "file",
                  label: t("japanese.import.article.sourceFile")
                }
              ]}
              value={source}
            />
          </div>

          {source === "url" ? (
            <UrlSource
              fetchError={fetchError}
              isFetching={fetchUrl.isPending}
              onFetch={handleFetch}
              onUrlChange={(value) => {
                setUrl(value)
                fetchUrl.reset()
              }}
              url={url}
            />
          ) : null}
          {source === "file" ? (
            <FileSource
              fileName={fileName}
              onFile={(file) => {
                void handleFile(file)
              }}
            />
          ) : null}

          <TextField onChange={setTitle} value={title}>
            <Label>{t("japanese.import.article.titleLabel")}</Label>
            <Input
              lang="ja"
              placeholder={
                detectedTitle ?? t("japanese.import.article.titlePlaceholder")
              }
            />
          </TextField>

          <TextField
            isInvalid={text.length > ARTICLE_MAX_CHARS}
            onChange={(value) => {
              setText(value)
              setTruncated(false)
              setSelectedWord(null)
            }}
            value={text}
          >
            <Label>{t("japanese.import.article.textLabel")}</Label>
            <TextArea
              className="min-h-64 font-script-ja text-base leading-relaxed"
              lang="ja"
              placeholder={t("japanese.import.article.textPlaceholder")}
              rows={12}
              style={{ resize: "vertical" }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  text.length > ARTICLE_MAX_CHARS && "font-medium text-danger"
                )}
              >
                {t("japanese.import.article.chars", {
                  count: text.length,
                  max: ARTICLE_MAX_CHARS.toLocaleString()
                })}
              </span>
              {truncated ? (
                <span className="text-primary">
                  {t("japanese.import.article.fetchTruncated", {
                    max: ARTICLE_MAX_CHARS.toLocaleString()
                  })}
                </span>
              ) : null}
            </div>
          </TextField>
        </section>

        {/* Preview */}
        <section
          aria-labelledby="japanese-import-preview"
          className="flex flex-col gap-5 rounded-3xl border border-border/60 bg-card/40 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              id="japanese-import-preview"
            >
              {t("japanese.import.article.previewTitle")}
            </h2>
            <StatusPill status={status} />
          </div>

          {status === "unavailable" ? (
            <p
              className="rounded-2xl bg-primary/8 px-4 py-3 text-sm text-foreground"
              role="alert"
            >
              {t("japanese.import.article.engineUnavailable")}
            </p>
          ) : null}
          {status === "failed" ? (
            <p
              className="rounded-2xl bg-danger/8 px-4 py-3 text-sm text-danger"
              role="alert"
            >
              {preview.error?.message ||
                t("japanese.import.article.previewFailed")}
            </p>
          ) : null}

          <dl className="grid grid-cols-3 gap-3">
            <StatTile
              label={t("japanese.import.article.statSentences")}
              value={stats?.sentences ?? null}
            />
            <StatTile
              label={t("japanese.import.article.statWords")}
              value={stats?.words ?? null}
            />
            <StatTile
              label={t("japanese.import.article.statNotInLists")}
              value={stats?.notInLists ?? null}
            />
          </dl>

          {stats ? <JapaneseLevelSpread levels={stats.levels} /> : null}
          <JapaneseAttribution />

          {firstSentence?.analysis ? (
            <div>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("japanese.import.article.firstSentence")}
              </h3>
              <div className="mt-2 overflow-x-auto">
                <JapaneseAnalyzedSentenceView
                  analysis={firstSentence.analysis}
                  enabledPosCategories={ALL_POS}
                  lexiconTags={lexicons.tags}
                  newBaseForms={newBaseForms}
                  onSelectWord={(word) =>
                    setSelectedWord((previous) =>
                      previous?.index === word.index ? null : word
                    )
                  }
                  selectedWordIndex={selectedWord?.index ?? null}
                  showFurigana
                  showRomaji={false}
                  unit="word"
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {selectedWord ? (
                  <>
                    <span className="font-script-ja text-sm text-foreground">
                      {selectedWord.baseForm}
                    </span>
                    {selectedWord.reading ? ` · ${selectedWord.reading}` : ""}
                    {" · "}
                    {t(
                      `review.japaneseTyping.posCategories.${selectedWord.pos}`
                    )}
                    {" · "}
                    <Link
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      search={{ q: selectedWord.baseForm }}
                      to="/japanese"
                    >
                      {t("japanese.reading.lookUp", {
                        word: selectedWord.baseForm
                      })}
                    </Link>
                  </>
                ) : (
                  t("japanese.import.article.newWordHint")
                )}
              </p>
            </div>
          ) : null}

          {status === "ready" ? (
            <div>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("japanese.import.article.newWordsTitle")}
              </h3>
              {newWords.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("japanese.import.article.newWordsNone")}
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {newWords.slice(0, NEW_WORD_CHIPS).map((word) => (
                    <li key={word.baseForm}>
                      <Link
                        className="inline-flex items-baseline gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-sm transition-colors hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                        lang="ja"
                        search={{ q: word.baseForm }}
                        to="/japanese"
                      >
                        <span className="font-script-ja">{word.baseForm}</span>
                        {word.reading && word.reading !== word.baseForm ? (
                          <span className="text-[11px] text-muted-foreground">
                            {word.reading}
                          </span>
                        ) : null}
                        {word.count > 1 ? (
                          <span className="text-[11px] text-muted-foreground">
                            ×{word.count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                  {newWords.length > NEW_WORD_CHIPS ? (
                    <li className="self-center text-xs text-muted-foreground">
                      {t("japanese.import.article.newWordsMore", {
                        count: newWords.length - NEW_WORD_CHIPS
                      })}
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-5">
        <Link
          className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          to="/japanese/library"
        >
          {t("japanese.import.article.cancel")}
        </Link>
        <Button isDisabled={!canSubmit} onPress={handleSubmit}>
          {create.isPending
            ? t("japanese.import.article.submitting")
            : t("japanese.import.article.submit")}
        </Button>
      </footer>
    </div>
  )
}
