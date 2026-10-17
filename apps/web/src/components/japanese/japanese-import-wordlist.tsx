import {
  decodeJapaneseBytes,
  guessColumnRoles,
  parseWordList
} from "@folionote/japanese"
import type { ColumnRole, WordListFormat } from "@folionote/japanese"
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Radio,
  RadioGroup,
  TextField
} from "@heroui/react"
import { Upload01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ChangeEvent, DragEvent, ReactNode } from "react"
import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useDebounce } from "@/hooks/use-debounce"
import type {
  LexiconKind,
  LexiconLevel,
  MeaningLanguage
} from "@/lib/japanese-wordlist-import"
import {
  buildLexiconRows,
  defaultListName,
  headwordColumnCount,
  LEXICON_LEVELS,
  LEXICON_ROW_LIMIT,
  meaningLanguageFor
} from "@/lib/japanese-wordlist-import"
import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

import {
  JapaneseSegmented,
  NATIVE_SELECT_CLASS
} from "./japanese-reading-controls"

const PREVIEW_ROWS = 50
const VALIDATE_DEBOUNCE_MS = 500
const ROLES: ColumnRole[] = [
  "headword",
  "reading",
  "meaning",
  "pos",
  "unit",
  "ignore"
]
const MEANING_LANGUAGES: MeaningLanguage[] = ["zh", "en", "ja"]

type RowStatus = "ready" | "reading-filled" | "duplicate" | "error"
interface ValidationRow {
  index: number
  status: RowStatus
  reading: string | null
  message?: string
}
type RowFilter = "all" | "needs-look"
type Step = "file" | "map" | "save"

interface LoadedFile {
  name: string
  format: WordListFormat
  hasHeader: boolean
  columns: string[]
  rows: string[][]
  issues: number
}

const STATUS_CLASS: Record<RowStatus, string> = {
  ready: "text-muted-foreground",
  "reading-filled": "bg-primary/12 text-primary",
  duplicate: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
  error: "bg-danger/12 text-danger"
}
const STATUS_KEY: Record<RowStatus, string> = {
  ready: "japanese.import.wordlist.statusReady",
  "reading-filled": "japanese.import.wordlist.statusReadingFilled",
  duplicate: "japanese.import.wordlist.statusDuplicate",
  error: "japanese.import.wordlist.statusError"
}

const isConflict = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "CONFLICT"

function Steps({ current }: { current: Step }) {
  const { t } = useTranslation()
  const steps: { id: Step; label: string }[] = [
    { id: "file", label: t("japanese.import.wordlist.stepFile") },
    { id: "map", label: t("japanese.import.wordlist.stepMap") },
    { id: "save", label: t("japanese.import.wordlist.stepSave") }
  ]
  const currentIndex = steps.findIndex((step) => step.id === current)

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex
        const isDone = index < currentIndex
        return (
          <li className="flex items-center gap-2" key={step.id}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-muted-foreground/50">
                /
              </span>
            ) : null}
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5",
                isCurrent
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
                  isCurrent && "bg-primary text-primary-foreground",
                  isDone && "bg-primary/15 text-primary",
                  !(isCurrent || isDone) && "bg-surface-secondary"
                )}
              >
                {index + 1}
              </span>
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
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
        "flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-12 text-center transition-colors",
        isOver ? "border-primary bg-primary/8" : "border-border/70 bg-card/30"
      )}
      onDragLeave={() => setIsOver(false)}
      onDragOver={(event) => {
        event.preventDefault()
        setIsOver(true)
      }}
      onDrop={handleDrop}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
        <HugeiconsIcon className="size-6 text-primary" icon={Upload01Icon} />
      </span>
      <p className="font-display text-lg font-semibold">
        {t("japanese.import.wordlist.dropTitle")}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("japanese.import.wordlist.dropHint", {
          max: LEXICON_ROW_LIMIT.toLocaleString()
        })}
      </p>
      <input
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
        aria-label={t("japanese.import.wordlist.dropTitle")}
        className="sr-only"
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      <Button onPress={() => inputRef.current?.click()} variant="secondary">
        {t("japanese.import.wordlist.browse")}
      </Button>
    </div>
  )
}

function StatusCell({
  row,
  isChecking
}: {
  row: ValidationRow | undefined
  isChecking: boolean
}) {
  const { t } = useTranslation()
  if (!row) {
    return (
      <span className="text-xs text-muted-foreground/70">
        {isChecking ? t("japanese.import.wordlist.checking") : "—"}
      </span>
    )
  }
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
          STATUS_CLASS[row.status]
        )}
        data-row-status={row.status}
      >
        {t(STATUS_KEY[row.status])}
      </span>
      {row.status === "reading-filled" && row.reading ? (
        <span
          className="font-script-ja text-xs text-muted-foreground"
          lang="ja"
        >
          {row.reading}
        </span>
      ) : null}
      {row.status === "error" && row.message ? (
        <span className="text-[11px] text-danger">{row.message}</span>
      ) : null}
    </span>
  )
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

const FORMAT_KEY: Record<WordListFormat, string> = {
  csv: "japanese.import.wordlist.formatCsv",
  tsv: "japanese.import.wordlist.formatTsv",
  anki: "japanese.import.wordlist.formatAnki"
}

export function JapaneseWordListImport() {
  const { i18n, t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [roles, setRoles] = useState<ColumnRole[]>([])
  const [filter, setFilter] = useState<RowFilter>("all")
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [kind, setKind] = useState<LexiconKind>("book")
  const [level, setLevel] = useState<LexiconLevel | "">("")
  const [meaningLanguage, setMeaningLanguage] = useState<MeaningLanguage>(() =>
    meaningLanguageFor(i18n.resolvedLanguage ?? i18n.language)
  )

  const importRows = useMemo(
    () => (file ? buildLexiconRows(roles, file.rows) : []),
    [file, roles]
  )
  const debouncedRows = useDebounce(importRows, VALIDATE_DEBOUNCE_MS)
  const headwordColumns = headwordColumnCount(roles)
  const mappingValid = headwordColumns === 1
  const canValidate = mappingValid && debouncedRows.length > 0

  const validation = useQuery({
    ...orpc.japanese.lexicons.validate.queryOptions({
      input: { rows: debouncedRows }
    }),
    enabled: canValidate,
    retry: false,
    placeholderData: keepPreviousData,
    meta: { silentError: true }
  })
  const isChecking =
    mappingValid &&
    (debouncedRows !== importRows || validation.isFetching) &&
    importRows.length > 0
  const statusByRow = useMemo(() => {
    const map = new Map<number, ValidationRow>()
    if (canValidate && validation.data) {
      for (const row of validation.data.rows) map.set(row.index, row)
    }
    return map
  }, [canValidate, validation.data])
  const summary = canValidate ? validation.data?.summary : undefined
  const needsLook = useMemo(
    () =>
      [...statusByRow.values()].filter((row) => row.status !== "ready").length,
    [statusByRow]
  )

  const visibleRows = useMemo(() => {
    if (!file) return []
    const indexes = file.rows.map((_, index) => index)
    const filtered =
      filter === "needs-look"
        ? indexes.filter((index) => {
            const status = statusByRow.get(index)?.status
            return status !== undefined && status !== "ready"
          })
        : indexes
    return filtered.slice(0, PREVIEW_ROWS)
  }, [file, filter, statusByRow])

  const importMutation = useMutation({
    mutationFn: () =>
      orpc.japanese.lexicons.import.call({
        name: name.trim(),
        kind,
        level: level || undefined,
        meaningLanguage,
        rows: importRows
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: orpc.japanese.lexicons.key()
      })
      toast.success(t("japanese.import.wordlist.imported"))
      void navigate({
        to: "/japanese/lists/$lexiconId",
        params: { lexiconId: result.id }
      })
    },
    onError: (error) => {
      if (isConflict(error)) {
        setNameError(t("japanese.import.wordlist.nameConflict"))
        return
      }
      toast.error(t("japanese.import.wordlist.importFailed"))
    }
  })

  const handleFile = async (picked: File) => {
    const content = decodeJapaneseBytes(await picked.arrayBuffer(), picked.type)
    const parsed = parseWordList(content)
    setFile({
      name: picked.name,
      format: parsed.format,
      hasHeader: parsed.hasHeader,
      columns: parsed.columns,
      rows: parsed.rows,
      issues: parsed.issues.length
    })
    setRoles(guessColumnRoles(parsed.columns, parsed.rows))
    setFilter("all")
    setName((previous) => previous.trim() || defaultListName(picked.name))
    setNameError(null)
  }

  const handleRoleChange = (column: number, role: ColumnRole) => {
    setRoles((previous) =>
      previous.map((current, index) => (index === column ? role : current))
    )
  }

  const readyCount = summary?.ready ?? 0
  const canImport =
    file !== null &&
    mappingValid &&
    name.trim().length > 0 &&
    readyCount > 0 &&
    !isChecking &&
    !importMutation.isPending

  let step: Step = "file"
  if (file) step = importMutation.isPending ? "save" : "map"

  if (!file) {
    return (
      <div className="flex flex-col gap-6">
        <Steps current={step} />
        <DropZone
          onFile={(picked) => {
            void handleFile(picked)
          }}
        />
      </div>
    )
  }

  const tooManyRows = file.rows.length > LEXICON_ROW_LIMIT

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Steps current={step} />
        <Button
          onPress={() => {
            setFile(null)
            setRoles([])
          }}
          size="sm"
          variant="ghost"
        >
          {t("japanese.import.wordlist.back")}
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Table */}
        <section
          aria-labelledby="japanese-import-rows"
          className="flex min-w-0 flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                id="japanese-import-rows"
              >
                {t("japanese.import.wordlist.previewTitle", {
                  count: Math.min(PREVIEW_ROWS, file.rows.length)
                })}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
                {" · "}
                {t("japanese.import.wordlist.detected", {
                  format: t(FORMAT_KEY[file.format]),
                  rows: file.rows.length.toLocaleString()
                })}
                {" · "}
                {file.hasHeader
                  ? t("japanese.import.wordlist.headerDetected")
                  : t("japanese.import.wordlist.noHeader")}
                {file.issues > 0
                  ? ` · ${t("japanese.import.wordlist.parseIssues", { count: file.issues })}`
                  : null}
              </p>
            </div>
            <JapaneseSegmented
              label={t("japanese.import.wordlist.checkColumn")}
              onChange={setFilter}
              options={[
                {
                  value: "all",
                  label: t("japanese.import.wordlist.filterAll")
                },
                {
                  value: "needs-look",
                  label: t("japanese.import.wordlist.filterNeedsLook", {
                    count: needsLook
                  })
                }
              ]}
              value={filter}
            />
          </div>

          {mappingValid ? null : (
            <p
              className="rounded-2xl bg-danger/8 px-4 py-2.5 text-sm text-danger"
              role="alert"
            >
              {t("japanese.import.wordlist.headwordRequired")}
            </p>
          )}
          {tooManyRows ? (
            <p className="rounded-2xl bg-primary/8 px-4 py-2.5 text-sm">
              {t("japanese.import.wordlist.rowLimit", {
                max: LEXICON_ROW_LIMIT.toLocaleString()
              })}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead className="bg-surface-secondary/60 text-left">
                <tr>
                  <th className="w-10 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                    #
                  </th>
                  {file.columns.map((column, index) => (
                    <th
                      className="min-w-24 px-2 py-2 align-top"
                      key={`${index}-${column}`}
                      scope="col"
                    >
                      <span className="block truncate text-[11px] font-medium text-muted-foreground">
                        {column}
                      </span>
                      <select
                        aria-label={t("japanese.import.wordlist.roleLabel", {
                          column
                        })}
                        className={cn(
                          NATIVE_SELECT_CLASS,
                          "mt-1 min-h-8 px-2 py-0 text-xs sm:text-xs",
                          roles[index] === "headword" &&
                            "border-primary/40 bg-primary/8 font-medium"
                        )}
                        onChange={(event) =>
                          handleRoleChange(
                            index,
                            event.target.value as ColumnRole
                          )
                        }
                        value={roles[index] ?? "ignore"}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {t(`japanese.import.wordlist.role.${role}`)}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                  <th
                    className="min-w-40 px-3 py-2 text-[11px] font-medium text-muted-foreground"
                    scope="col"
                  >
                    {t("japanese.import.wordlist.checkColumn")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-sm text-muted-foreground"
                      colSpan={file.columns.length + 2}
                    >
                      {filter === "needs-look"
                        ? t("japanese.import.wordlist.filterEmpty")
                        : t("japanese.import.wordlist.empty")}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((rowIndex) => {
                    const row = file.rows[rowIndex] ?? []
                    return (
                      <tr className="align-top" key={rowIndex}>
                        <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                          {rowIndex + 1}
                        </td>
                        {file.columns.map((column, columnIndex) => (
                          <td
                            className={cn(
                              "max-w-56 truncate px-2 py-2",
                              roles[columnIndex] === "ignore" &&
                                "text-muted-foreground/60",
                              roles[columnIndex] === "headword" &&
                                "font-script-ja font-medium"
                            )}
                            key={`${columnIndex}-${column}`}
                            lang="ja"
                            title={row[columnIndex]}
                          >
                            {row[columnIndex] || (
                              <span className="text-muted-foreground/50">
                                —
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <StatusCell
                            isChecking={isChecking}
                            row={statusByRow.get(rowIndex)}
                          />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Save panel */}
        <aside className="flex flex-col gap-5 rounded-3xl border border-border/60 bg-card/40 p-5 lg:sticky lg:top-6 lg:self-start">
          <TextField
            isInvalid={nameError !== null}
            isRequired
            onChange={(value) => {
              setName(value)
              setNameError(null)
            }}
            value={name}
          >
            <Label>{t("japanese.import.wordlist.nameLabel")}</Label>
            <Input
              lang="ja"
              placeholder={t("japanese.import.wordlist.namePlaceholder")}
            />
            {nameError ? <FieldError>{nameError}</FieldError> : null}
          </TextField>

          <RadioGroup
            onChange={(value) => setKind(value as LexiconKind)}
            orientation="horizontal"
            value={kind}
          >
            <Label>{t("japanese.import.wordlist.kindLabel")}</Label>
            <Radio value="book">
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {t("japanese.import.wordlist.kindBook")}
              </Radio.Content>
              <Description>
                {t("japanese.import.wordlist.kindBookHint")}
              </Description>
            </Radio>
            <Radio value="deck">
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {t("japanese.import.wordlist.kindDeck")}
              </Radio.Content>
              <Description>
                {t("japanese.import.wordlist.kindDeckHint")}
              </Description>
            </Radio>
          </RadioGroup>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("japanese.import.wordlist.levelLabel")}
            <select
              className={NATIVE_SELECT_CLASS}
              onChange={(event) =>
                setLevel(event.target.value as LexiconLevel | "")
              }
              value={level}
            >
              <option value="">
                {t("japanese.import.wordlist.levelNone")}
              </option>
              {LEXICON_LEVELS.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" id="japanese-import-meanings">
              {t("japanese.import.wordlist.meaningLanguageLabel")}
            </span>
            <JapaneseSegmented
              className="self-start"
              label={t("japanese.import.wordlist.meaningLanguageLabel")}
              onChange={setMeaningLanguage}
              options={MEANING_LANGUAGES.map((language) => ({
                value: language,
                label: t(`japanese.library.meaningLanguage.${language}`)
              }))}
              value={meaningLanguage}
            />
          </div>

          <dl className="space-y-1.5 rounded-2xl bg-surface-secondary/60 px-4 py-3">
            <SummaryRow
              label={t("japanese.import.wordlist.summaryRows")}
              value={summary?.total ?? file.rows.length}
            />
            <SummaryRow
              label={t("japanese.import.wordlist.summaryReady")}
              value={summary?.ready ?? "—"}
            />
            <SummaryRow
              label={t("japanese.import.wordlist.summaryFilled")}
              value={summary?.readingsFilled ?? "—"}
            />
            <SummaryRow
              label={t("japanese.import.wordlist.summaryDuplicates")}
              value={summary?.duplicatesMerged ?? "—"}
            />
            <SummaryRow
              label={t("japanese.import.wordlist.summaryErrors")}
              value={
                <span className={cn(summary?.errors ? "text-danger" : "")}>
                  {summary?.errors ?? "—"}
                </span>
              }
            />
          </dl>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("japanese.import.wordlist.privacy")}
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button
              onPress={() => {
                setFile(null)
                setRoles([])
              }}
              variant="tertiary"
            >
              {t("japanese.import.wordlist.back")}
            </Button>
            <Button
              isDisabled={!canImport}
              onPress={() => importMutation.mutate()}
            >
              {importMutation.isPending
                ? t("japanese.import.wordlist.submitting")
                : t("japanese.import.wordlist.submit", { count: readyCount })}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
