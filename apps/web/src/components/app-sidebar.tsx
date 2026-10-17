import { Sidebar, useSidebar } from "@heroui-pro/react"
import {
  Activity01Icon,
  AiBrain01Icon,
  Atom02Icon,
  BookOpen01Icon,
  InboxIcon,
  LanguageSquareIcon,
  Link01Icon,
  Rocket01Icon,
  Search01Icon,
  Tag01Icon
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { BrandLockup } from "@/components/brand-lockup"
import { useCommandPalette } from "@/contexts/command-palette-context"

import UserMenu from "./user-menu"

interface NavItem {
  to: string
  labelKey: string
  icon: IconSvgElement
}

const mainNavItems: NavItem[] = [
  { to: "/activity", labelKey: "nav.activity", icon: Activity01Icon },
  { to: "/inbox", labelKey: "nav.inbox", icon: InboxIcon },
  { to: "/library", labelKey: "nav.library", icon: BookOpen01Icon }
]

const secondaryNavItems: NavItem[] = [
  { to: "/tags", labelKey: "nav.tags", icon: Tag01Icon },
  { to: "/sources", labelKey: "nav.sources", icon: Link01Icon },
  { to: "/graph", labelKey: "nav.graph", icon: Atom02Icon },
  { to: "/review", labelKey: "nav.review", icon: Rocket01Icon },
  { to: "/japanese", labelKey: "nav.japanese", icon: LanguageSquareIcon },
  { to: "/knowledge", labelKey: "nav.knowledge", icon: AiBrain01Icon }
]

function NavItems({ items }: { items: NavItem[] }) {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()

  return (
    <Sidebar.Menu>
      {items.map(({ to, labelKey, icon }) => (
        <Sidebar.MenuItem
          href={to}
          isCurrent={!!matchRoute({ to, fuzzy: true })}
          key={to}
          tooltip={t(labelKey)}
        >
          <Sidebar.MenuIcon>
            <HugeiconsIcon icon={icon} />
          </Sidebar.MenuIcon>
          <Sidebar.MenuLabel>{t(labelKey)}</Sidebar.MenuLabel>
        </Sidebar.MenuItem>
      ))}
    </Sidebar.Menu>
  )
}

function SearchButton() {
  const { t } = useTranslation()
  const { setOpen } = useCommandPalette()

  return (
    <button
      className="flex w-full items-center gap-3 rounded-[12px] border border-border/50 bg-surface-secondary/30 px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-secondary/50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      onClick={() => setOpen(true)}
      type="button"
    >
      <HugeiconsIcon className="size-4 shrink-0" icon={Search01Icon} />
      <span className="flex-1 text-left">{t("nav.search")}</span>
      <kbd className="pointer-events-none hidden h-5 items-center gap-1 rounded border border-border/40 bg-surface-secondary/40 px-1.5 font-mono text-[10px] font-medium text-muted/70 md:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  )
}

export function AppSidebar() {
  const { t } = useTranslation()
  const { isOpen } = useSidebar()
  const isCollapsed = !isOpen

  return (
    <Sidebar>
      <Sidebar.Header className="p-4">
        <Link className="flex items-center gap-3" to="/">
          <BrandLockup
            iconClassName="size-8"
            iconOnly={isCollapsed}
            wordmarkClassName="text-2xl"
          />
        </Link>
      </Sidebar.Header>

      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>
            {t("nav.sectionMain", "Main")}
          </Sidebar.GroupLabel>
          {!isCollapsed && (
            <div className="mb-1 px-2">
              <SearchButton />
            </div>
          )}
          <NavItems items={mainNavItems} />
        </Sidebar.Group>

        <Sidebar.Separator />

        <Sidebar.Group>
          <Sidebar.GroupLabel>
            {t("nav.sectionExplore", "Explore")}
          </Sidebar.GroupLabel>
          <NavItems items={secondaryNavItems} />
        </Sidebar.Group>
      </Sidebar.Content>

      <Sidebar.Footer>
        <UserMenu collapsed={isCollapsed} />
      </Sidebar.Footer>
    </Sidebar>
  )
}
