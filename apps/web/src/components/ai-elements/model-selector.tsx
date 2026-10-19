import type { ModelProviderId } from "@folionote/model-list"
import { Button } from "@folionote/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@folionote/ui/command"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger
} from "@folionote/ui/dialog"
import { ArrowDown02Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps, ReactNode } from "react"
import { memo, useMemo, useState } from "react"

import { ProviderLogo } from "@/components/brand-logo"
import type {
  CatalogModel,
  CatalogProvider
} from "@/hooks/use-ai-model-catalog"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

export interface ModelSelectorOption {
  id: string
  name: string
  provider?: { id: string; name: string; logo?: string }
  type?: string
}

export interface ModelSelectorGroup {
  id: string
  name: string
  options: ModelSelectorOption[]
}

// ============================================================================
// Compound Components (Composable API inspired by model-select.tsx)
// ============================================================================

export type ModelSelectorRootProps = ComponentProps<typeof Dialog>

/**
 * Root component for composable ModelSelector pattern
 */
export const ModelSelectorRoot = (props: ModelSelectorRootProps) => (
  <Dialog {...props} />
)

export type ModelSelectorTriggerProps = ComponentProps<typeof DialogTrigger>

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
  <DialogTrigger {...props} />
)

export type ModelSelectorContentProps = ComponentProps<typeof DialogContent> & {
  title?: ReactNode
}

export const ModelSelectorContent = ({
  className,
  children,
  title = "Model Selector",
  ...props
}: ModelSelectorContentProps) => (
  <DialogContent className={cn("p-0", className)} {...props}>
    <DialogTitle className="sr-only">{title}</DialogTitle>
    <Command className="**:data-[slot=command-input-wrapper]:h-auto">
      {children}
    </Command>
  </DialogContent>
)

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>

export const ModelSelectorInput = ({
  className,
  ...props
}: ModelSelectorInputProps) => (
  <CommandInput className={cn("h-auto py-3.5", className)} {...props} />
)

export type ModelSelectorListProps = ComponentProps<typeof CommandList>

export const ModelSelectorList = (props: ModelSelectorListProps) => (
  <CommandList {...props} />
)

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => (
  <CommandEmpty {...props} />
)

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>

export const ModelSelectorGroup = (props: ModelSelectorGroupProps) => (
  <CommandGroup {...props} />
)

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>

export const ModelSelectorItem = (props: ModelSelectorItemProps) => (
  <CommandItem {...props} />
)

export type ModelSelectorSeparatorProps = ComponentProps<
  typeof CommandSeparator
>

export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <CommandSeparator {...props} />
)

export type ModelSelectorNameProps = ComponentProps<"span">

export const ModelSelectorName = ({
  className,
  ...props
}: ModelSelectorNameProps) => (
  <span className={cn("flex-1 truncate text-left", className)} {...props} />
)

// ============================================================================
// Utility Functions
// ============================================================================

const DEFAULT_MODEL_TYPES = ["chat", "image"]

/**
 * Convert catalog data to ModelSelector format (using enabled models only)
 */
export function createModelSelectorGroups(
  providers: CatalogProvider[],
  models: CatalogModel[],
  modelTypes: string[] = DEFAULT_MODEL_TYPES
): ModelSelectorGroup[] {
  const enabledProviders = providers.filter((p) => p.enabled)
  const groups: ModelSelectorGroup[] = []
  const modelTypeSet = new Set(modelTypes)

  for (const provider of enabledProviders) {
    const providerModels = models.filter(
      (model) =>
        model.providerId === provider.id &&
        model.enabled &&
        modelTypeSet.has(model.type)
    )

    if (providerModels.length > 0) {
      groups.push({
        id: provider.id,
        name: provider.name,
        options: providerModels.map((model) => ({
          id: model.id,
          name: model.displayName || model.id,
          provider: {
            id: provider.id,
            name: provider.name,
            logo: provider.logo
          },
          type: model.type
        }))
      })
    }
  }

  return groups
}

/**
 * Create filtered groups based on provider filter
 */
function createFilteredGroups(
  allGroups: ModelSelectorGroup[],
  provider?: ModelProviderId | "all"
): ModelSelectorGroup[] {
  if (provider === "all" || !provider) {
    return allGroups
  }

  return allGroups.filter((group) => group.id === provider)
}

/**
 * Find a selected option and its group from groups
 */
function findSelectedOption(
  groups: ModelSelectorGroup[],
  value: string | null
): { option: ModelSelectorOption; group: ModelSelectorGroup } | null {
  if (!value) {
    return null
  }

  for (const group of groups) {
    const match = group.options.find((option) => option.id === value)
    if (match) {
      return { option: match, group }
    }
  }

  return null
}

// ============================================================================
// Pre-composed Components (For convenience)
// ============================================================================

interface ModelSelectorProps {
  options?: ModelSelectorOption[]
  groups?: ModelSelectorGroup[]
  value: string | null
  onValueChange: (nextValue: string, providerId?: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  dialogTitle?: string
}

/**
 * Pre-composed Model Selector with built-in trigger and dialog.
 * Uses cmdk-based Command UI for searchable selection.
 * Selection does NOT close the dialog - user can freely switch between models.
 */
export function ModelSelector({
  options,
  groups,
  value,
  onValueChange,
  placeholder = "Select a model…",
  disabled = false,
  className,
  dialogTitle = "Select Model"
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)

  const resolvedGroups = useMemo<ModelSelectorGroup[]>(() => {
    if (groups && groups.length > 0) {
      return groups
    }
    return [
      {
        id: "default",
        name: "Models",
        options: options ?? []
      }
    ]
  }, [groups, options])

  const selected = useMemo(
    () => findSelectedOption(resolvedGroups, value),
    [resolvedGroups, value]
  )

  const handleSelect = (optionId: string, providerId?: string) => {
    onValueChange(optionId, providerId)
    // Don't close the dialog - allow user to freely switch models
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button
            className={cn("w-full justify-between", className)}
            disabled={disabled}
            type="button"
            variant="outline"
          />
        }
      >
        <span className="inline-flex min-w-0 flex-1 items-center gap-2">
          {selected?.option.provider ? (
            <ProviderLogo
              className="size-4 shrink-0"
              id={selected.option.provider.id}
              logo={selected.option.provider.logo}
              name={selected.option.provider.name}
            />
          ) : null}
          <ModelSelectorName className="truncate">
            {selected?.option.name ?? placeholder}
          </ModelSelectorName>
          {selected?.option.type === "image" && (
            <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] leading-none font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              Image
            </span>
          )}
        </span>
        <HugeiconsIcon
          className="size-4 shrink-0 text-muted-foreground"
          icon={ArrowDown02Icon}
        />
      </DialogTrigger>

      <DialogContent className="max-h-[80vh] gap-0 p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
        <Command
          className="**:data-[slot=command-input-wrapper]:h-auto"
          shouldFilter
        >
          <CommandInput
            autoFocus
            placeholder="Search models..."
            showCloseButton={false}
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No models found.</CommandEmpty>
            {resolvedGroups.map((group) => (
              <ModelSelectorGroupSection
                currentValue={value}
                group={group}
                key={group.id}
                onSelect={handleSelect}
              />
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

// Memoized group section to avoid re-renders
interface ModelSelectorGroupSectionProps {
  group: ModelSelectorGroup
  currentValue: string | null
  onSelect: (optionId: string, providerId: string) => void
}

const ModelSelectorGroupSection = memo(
  ({ group, currentValue, onSelect }: ModelSelectorGroupSectionProps) => {
    return (
      <CommandGroup heading={group.name}>
        {group.options.map((option) => (
          <ModelSelectorOptionItem
            isSelected={currentValue === option.id}
            key={option.id}
            onSelect={onSelect}
            option={option}
            providerId={group.id}
          />
        ))}
      </CommandGroup>
    )
  }
)

// Memoized option item
interface ModelSelectorOptionItemProps {
  option: ModelSelectorOption
  isSelected: boolean
  providerId: string
  onSelect: (optionId: string, providerId: string) => void
}

const ModelSelectorOptionItem = memo(
  ({
    option,
    isSelected,
    providerId,
    onSelect
  }: ModelSelectorOptionItemProps) => {
    return (
      <CommandItem
        className="flex items-center gap-2"
        onSelect={() => onSelect(option.id, providerId)}
        value={`${option.name} ${option.id}`}
      >
        {/* Checkmark indicator */}
        <span className="flex size-4 shrink-0 items-center justify-center">
          {isSelected ? (
            <HugeiconsIcon className="size-4 text-primary" icon={Tick02Icon} />
          ) : null}
        </span>

        {/* Logo */}
        {option.provider ? (
          <ProviderLogo
            className="size-4 shrink-0"
            id={option.provider.id}
            logo={option.provider.logo}
            name={option.provider.name}
          />
        ) : null}

        {/* Model name and ID */}
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate">{option.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {option.id}
          </span>
          {option.type === "image" && (
            <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] leading-none font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              Image
            </span>
          )}
        </span>
      </CommandItem>
    )
  }
)

// ============================================================================
// AI Model Selector (High-level component with catalog integration)
// ============================================================================

type AiModelSelectorProps = Omit<ModelSelectorProps, "options" | "groups"> & {
  provider?: ModelProviderId | "all"
  /** Catalog providers from useAiModelCatalog */
  catalogProviders: CatalogProvider[]
  /** Catalog models from useAiModelCatalog */
  catalogModels: CatalogModel[]
}

/**
 * Opinionated selector that ships with dynamic model catalog from server.
 * Only enabled models are shown.
 */
export function AiModelSelector({
  provider = "all",
  catalogProviders,
  catalogModels,
  ...props
}: AiModelSelectorProps) {
  const groups = useMemo(() => {
    const allGroups = createModelSelectorGroups(catalogProviders, catalogModels)
    return createFilteredGroups(allGroups, provider)
  }, [catalogProviders, catalogModels, provider])

  return <ModelSelector groups={groups} {...props} />
}
