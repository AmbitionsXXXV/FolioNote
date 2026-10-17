import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { JapaneseArticleImport } from "@/components/japanese/japanese-import-article"
import { JapaneseWordListImport } from "@/components/japanese/japanese-import-wordlist"
import { JapaneseSegmented } from "@/components/japanese/japanese-reading-controls"

const importSearchSchema = z.object({
  type: z.enum(["article", "wordlist"]).catch("article")
})
type ImportType = z.infer<typeof importSearchSchema>["type"]

export const Route = createFileRoute("/_app/japanese/import")({
  component: JapaneseImportPage,
  validateSearch: importSearchSchema
})

function JapaneseImportPage() {
  const { t } = useTranslation()
  const { type } = Route.useSearch()
  const navigate = Route.useNavigate()

  const setType = (next: ImportType) => {
    void navigate({ search: { type: next }, replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("japanese.import.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("japanese.import.subtitle")}
          </p>
        </div>
        <JapaneseSegmented
          label={t("japanese.import.typeLabel")}
          onChange={setType}
          options={[
            { value: "article", label: t("japanese.import.typeArticle") },
            { value: "wordlist", label: t("japanese.import.typeWordList") }
          ]}
          size="md"
          value={type}
        />
      </header>

      {type === "article" ? (
        <JapaneseArticleImport />
      ) : (
        <JapaneseWordListImport />
      )}
    </div>
  )
}
