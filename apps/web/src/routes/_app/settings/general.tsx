import { AccountSetting01Icon } from "@hugeicons/core-free-icons"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { PageHeader } from "@/components/page-header"
import {
  ApiEnvironmentSettings,
  AppearanceSettings,
  DangerZone,
  LanguageSettings,
  ProfileCard
} from "@/components/profile"
import { Reveal } from "@/components/reveal"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/_app/settings/general")({
  component: GeneralSettingsPage
})

function GeneralSettingsPage() {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    await authClient.signOut()
    router.navigate({ to: "/", reloadDocument: true })
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        description={t("settings.general.description")}
        icon={AccountSetting01Icon}
        title={t("settings.general.title")}
      />

      <div className="space-y-5">
        <Reveal delay={60}>
          <ProfileCard />
        </Reveal>
        <Reveal delay={120}>
          <AppearanceSettings mounted={mounted} />
        </Reveal>
        <Reveal delay={180}>
          <LanguageSettings />
        </Reveal>
        {import.meta.env.MODE === "development" && (
          <Reveal delay={240}>
            <ApiEnvironmentSettings />
          </Reveal>
        )}
        <Reveal delay={300}>
          <DangerZone onSignOut={handleSignOut} />
        </Reveal>
      </div>
    </div>
  )
}
