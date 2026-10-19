import {
  Button,
  Checkbox,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  Tooltip
} from "@heroui/react"
import {
  Copy01Icon,
  Delete02Icon,
  EyeIcon,
  Link01Icon,
  LockPasswordIcon,
  Mail01Icon,
  Share01Icon,
  Tick02Icon,
  TimeSetting01Icon,
  UserGroupIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { orpc } from "@/utils/orpc"

import { ConfirmDeleteDialog } from "./confirm-delete-dialog"

interface ShareDialogProps {
  entryId: string
  entryTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShareInfo {
  id: string
  shareToken: string
  hasPassword: boolean
  expiresAt: string | null
  showBranding: boolean
  isActive: boolean
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
}

/**
 * Expiration preset options
 */
const EXPIRATION_PRESETS = [
  { value: "never", label: "share.neverExpire" },
  { value: "1h", label: "share.expire1Hour" },
  { value: "1d", label: "share.expire1Day" },
  { value: "7d", label: "share.expire7Days" },
  { value: "30d", label: "share.expire30Days" }
] as const

/**
 * Calculate expiration date from preset
 */
function getExpirationDate(preset: string): string | undefined {
  if (preset === "never") {
    return undefined
  }

  const now = new Date()
  switch (preset) {
    case "1h": {
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    }
    case "1d": {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    }
    case "7d": {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
    case "30d": {
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    default: {
      return undefined
    }
  }
}

/**
 * Generate share URL from token
 */
function getShareUrl(shareToken: string): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  return `${baseUrl}/share/${shareToken}`
}

interface ShareListItemProps {
  share: ShareInfo
  isCopied: boolean
  isDeletePending: boolean
  onCopy: (share: ShareInfo) => void
  onDelete: (shareId: string) => void
  formatDate: (dateStr: string) => string
  isExpired: (expiresAt: string | null) => boolean
}

/**
 * Single existing-share row with copy/delete actions
 */
function ShareListItem({
  share,
  isCopied,
  isDeletePending,
  onCopy,
  onDelete,
  formatDate,
  isExpired
}: ShareListItemProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3",
        !share.isActive && "opacity-50",
        isExpired(share.expiresAt) && "border-danger/50"
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <HugeiconsIcon className="size-4 text-muted" icon={Link01Icon} />
          <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs">
            {share.shareToken.slice(0, 8)}...
          </code>
          {share.hasPassword && (
            <span title={t("share.passwordProtected")}>
              <HugeiconsIcon
                className="size-4 text-muted"
                icon={LockPasswordIcon}
              />
            </span>
          )}
          {isExpired(share.expiresAt) && (
            <span className="text-xs text-danger">{t("share.expired")}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <HugeiconsIcon className="size-3" icon={EyeIcon} />
            {share.viewCount} {t("share.views")}
          </span>
          {share.expiresAt && !isExpired(share.expiresAt) && (
            <span className="flex items-center gap-1">
              <HugeiconsIcon className="size-3" icon={TimeSetting01Icon} />
              {formatDate(share.expiresAt)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <Button
            isIconOnly
            onPress={() => onCopy(share)}
            size="sm"
            variant="ghost"
          >
            <HugeiconsIcon
              className="size-4"
              icon={isCopied ? Tick02Icon : Copy01Icon}
            />
          </Button>
          <Tooltip.Content>{t("share.copyLink")}</Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Button
            isDisabled={isDeletePending}
            isIconOnly
            onPress={() => onDelete(share.id)}
            size="sm"
            variant="ghost"
          >
            <HugeiconsIcon className="size-4 text-danger" icon={Delete02Icon} />
          </Button>
          <Tooltip.Content>{t("share.deleteLink")}</Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  )
}

interface ExistingSharesProps {
  shares: ShareInfo[] | undefined
  copiedId: string | null
  isDeletePending: boolean
  onCopy: (share: ShareInfo) => void
  onDelete: (shareId: string) => void
  formatDate: (dateStr: string) => string
  isExpired: (expiresAt: string | null) => boolean
}

/**
 * List of existing share links for the entry
 */
function ExistingShares({
  shares,
  copiedId,
  isDeletePending,
  onCopy,
  onDelete,
  formatDate,
  isExpired
}: ExistingSharesProps) {
  const { t } = useTranslation()

  if (!(shares && shares.length > 0)) {
    return null
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted uppercase">{t("share.existingLinks")}</p>
      <div className="space-y-2">
        {shares.map((share) => (
          <ShareListItem
            formatDate={formatDate}
            isCopied={copiedId === share.id}
            isDeletePending={isDeletePending}
            isExpired={isExpired}
            key={share.id}
            onCopy={onCopy}
            onDelete={onDelete}
            share={share}
          />
        ))}
      </div>
    </div>
  )
}

interface CreateShareFormProps {
  usePassword: boolean
  setUsePassword: (value: boolean) => void
  password: string
  setPassword: (value: string) => void
  expirationPreset: string
  setExpirationPreset: (value: string) => void
  showBranding: boolean
  setShowBranding: (value: boolean) => void
}

/**
 * Form for creating a new share link with password/expiry/branding options
 */
function CreateShareForm({
  usePassword,
  setUsePassword,
  password,
  setPassword,
  expirationPreset,
  setExpirationPreset,
  showBranding,
  setShowBranding
}: CreateShareFormProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-muted uppercase">{t("share.createNew")}</p>

      {/* Password protection */}
      <div className="space-y-2">
        <Checkbox
          id="use-password"
          isSelected={usePassword}
          onChange={setUsePassword}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Label className="cursor-pointer" htmlFor="use-password">
              {t("share.passwordProtection")}
            </Label>
          </Checkbox.Content>
        </Checkbox>
        {usePassword && (
          <TextField
            aria-label={t("share.passwordPlaceholder")}
            className="mt-2"
            minLength={4}
            onChange={setPassword}
            type="password"
            value={password}
          >
            <Input placeholder={t("share.passwordPlaceholder")} />
          </TextField>
        )}
      </div>

      {/* Expiration */}
      <Select
        onChange={(value) => {
          if (value) {
            setExpirationPreset(String(value))
          }
        }}
        value={expirationPreset}
        variant="secondary"
      >
        <Label>{t("share.expiration")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {EXPIRATION_PRESETS.map((preset) => (
              <ListBox.Item
                id={preset.value}
                key={preset.value}
                textValue={t(preset.label)}
              >
                {t(preset.label)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {/* Show branding */}
      <Checkbox
        id="show-branding"
        isSelected={showBranding}
        onChange={setShowBranding}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label className="cursor-pointer" htmlFor="show-branding">
            {t("share.showBranding")}
          </Label>
        </Checkbox.Content>
      </Checkbox>
    </div>
  )
}

interface CollaboratorInfo {
  id: string
  userId: string
  role: "editor" | "viewer"
  name: string
  email: string
  image: string | null
  createdAt: string
}

interface CollaboratorRowProps {
  collaborator: CollaboratorInfo
  isRemovePending: boolean
  onRoleChange: (userId: string, role: "editor" | "viewer") => void
  onRemove: (userId: string) => void
}

/**
 * Single collaborator row: name/email, role select, remove button
 */
function CollaboratorRow({
  collaborator,
  isRemovePending,
  onRoleChange,
  onRemove
}: CollaboratorRowProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">
          {collaborator.name}
        </span>
        <span className="truncate text-xs text-muted">
          {collaborator.email}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Select
          onChange={(value) => {
            if (value === "editor" || value === "viewer") {
              onRoleChange(collaborator.userId, value)
            }
          }}
          value={collaborator.role}
          variant="secondary"
        >
          <Select.Trigger className="h-8 text-xs">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="editor" textValue={t("share.roleEditor")}>
                {t("share.roleEditor")}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="viewer" textValue={t("share.roleViewer")}>
                {t("share.roleViewer")}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        <Tooltip>
          <Button
            isDisabled={isRemovePending}
            isIconOnly
            onPress={() => onRemove(collaborator.userId)}
            size="sm"
            variant="ghost"
          >
            <HugeiconsIcon className="size-4 text-danger" icon={Delete02Icon} />
          </Button>
          <Tooltip.Content>{t("share.removeCollaborator")}</Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  )
}

interface CollaboratorsSectionProps {
  collaborators: CollaboratorInfo[] | undefined
  inviteEmail: string
  setInviteEmail: (value: string) => void
  inviteRole: "editor" | "viewer"
  setInviteRole: (value: "editor" | "viewer") => void
  onInvite: () => void
  isInvitePending: boolean
  isRemovePending: boolean
  onRoleChange: (userId: string, role: "editor" | "viewer") => void
  onRemove: (userId: string) => void
}

/**
 * Invite-by-email form + roster of collaborators already invited to
 * real-time co-edit this entry. Requires the invitee to already have a
 * FolioNote account — there is no invite-to-signup flow yet.
 */
function CollaboratorsSection({
  collaborators,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  onInvite,
  isInvitePending,
  isRemovePending,
  onRoleChange,
  onRemove
}: CollaboratorsSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="flex items-center gap-1.5 text-xs text-muted uppercase">
        <HugeiconsIcon className="size-3.5" icon={UserGroupIcon} />
        {t("share.collaborators")}
      </p>

      {collaborators && collaborators.length > 0 ? (
        <div className="space-y-2">
          {collaborators.map((collaborator) => (
            <CollaboratorRow
              collaborator={collaborator}
              isRemovePending={isRemovePending}
              key={collaborator.id}
              onRemove={onRemove}
              onRoleChange={onRoleChange}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("share.noCollaborators")}</p>
      )}

      <div className="flex items-center gap-2">
        <TextField
          className="min-w-0 flex-1"
          onChange={setInviteEmail}
          onKeyDown={(event) => {
            if (event.key === "Enter" && inviteEmail.trim()) {
              onInvite()
            }
          }}
          type="email"
          value={inviteEmail}
        >
          <Input placeholder={t("share.emailPlaceholder")} />
        </TextField>
        <Select
          onChange={(value) => {
            if (value === "editor" || value === "viewer") {
              setInviteRole(value)
            }
          }}
          value={inviteRole}
          variant="secondary"
        >
          <Select.Trigger className="w-28 shrink-0 text-xs">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="editor" textValue={t("share.roleEditor")}>
                {t("share.roleEditor")}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="viewer" textValue={t("share.roleViewer")}>
                {t("share.roleViewer")}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        <Button
          isDisabled={isInvitePending || !inviteEmail.trim()}
          onPress={onInvite}
          size="sm"
        >
          <HugeiconsIcon className="size-4" icon={Mail01Icon} />
          {t("share.invite")}
        </Button>
      </div>
    </div>
  )
}

/**
 * ShareDialog component for managing entry share links
 */
export function ShareDialog({
  entryId,
  entryTitle,
  open,
  onOpenChange
}: ShareDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Form state for creating new share
  const [password, setPassword] = useState("")
  const [usePassword, setUsePassword] = useState(false)
  const [expirationPreset, setExpirationPreset] = useState("never")
  const [showBranding, setShowBranding] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [shareToDelete, setShareToDelete] = useState<string | null>(null)

  // Form state for inviting a collaborator
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")

  // Fetch existing shares for this entry
  const { data: shares } = useQuery({
    queryKey: ["shares", entryId],
    queryFn: () => orpc.shares.getByEntry.call({ entryId }),
    enabled: open
  })

  // Fetch existing collaborators for this entry
  const { data: collaborators } = useQuery({
    queryKey: ["collaborators", entryId],
    queryFn: () => orpc.collaborators.list.call({ entryId }),
    enabled: open
  })

  const inviteCollaboratorMutation = useMutation({
    mutationFn: (data: {
      entryId: string
      email: string
      role: "editor" | "viewer"
    }) => orpc.collaborators.invite.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators", entryId] })
      toast.success(t("share.inviteSent"))
      setInviteEmail("")
      setInviteRole("editor")
    },
    onError: (error) => {
      toast.error(error.message || t("share.inviteError"))
    }
  })

  const updateCollaboratorRoleMutation = useMutation({
    mutationFn: (data: {
      entryId: string
      userId: string
      role: "editor" | "viewer"
    }) => orpc.collaborators.updateRole.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators", entryId] })
    },
    onError: () => {
      toast.error(t("share.roleUpdateError"))
    }
  })

  const removeCollaboratorMutation = useMutation({
    mutationFn: (userId: string) =>
      orpc.collaborators.remove.call({ entryId, userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaborators", entryId] })
      toast.success(t("share.removed"))
    },
    onError: () => {
      toast.error(t("share.removeError"))
    }
  })

  // Create share mutation
  const createShareMutation = useMutation({
    mutationFn: (data: {
      entryId: string
      password?: string
      expiresAt?: string
      showBranding: boolean
    }) => orpc.shares.create.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shares", entryId] })
      toast.success(t("share.linkCreated"))
      // Reset form
      setPassword("")
      setUsePassword(false)
      setExpirationPreset("never")
    },
    onError: () => {
      toast.error(t("share.createError"))
    }
  })

  // Delete share mutation
  const deleteShareMutation = useMutation({
    mutationFn: (id: string) => orpc.shares.delete.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shares", entryId] })
      toast.success(t("share.linkDeleted"))
      setShareToDelete(null)
    },
    onError: () => {
      toast.error(t("share.deleteError"))
    }
  })

  // Handle delete share with confirmation
  const handleDeleteShare = useCallback((shareId: string) => {
    setShareToDelete(shareId)
  }, [])

  const handleConfirmDeleteShare = useCallback(() => {
    if (shareToDelete) {
      deleteShareMutation.mutate(shareToDelete)
    }
  }, [shareToDelete, deleteShareMutation])

  // Handle create share
  const handleCreateShare = useCallback(() => {
    createShareMutation.mutate({
      entryId,
      password: usePassword && password.length >= 4 ? password : undefined,
      expiresAt: getExpirationDate(expirationPreset),
      showBranding
    })
  }, [
    createShareMutation,
    entryId,
    password,
    usePassword,
    expirationPreset,
    showBranding
  ])

  // Handle copy link
  const handleCopyLink = useCallback(
    async (share: ShareInfo) => {
      const url = getShareUrl(share.shareToken)
      try {
        await navigator.clipboard.writeText(url)
        setCopiedId(share.id)
        toast.success(t("share.copied"))
        setTimeout(() => setCopiedId(null), 2000)
      } catch {
        toast.error(t("share.copyError"))
      }
    },
    [t]
  )

  // Format date for display
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date)
  }, [])

  // Check if share is expired
  const isExpired = useCallback((expiresAt: string | null) => {
    if (!expiresAt) {
      return false
    }
    return new Date(expiresAt) < new Date()
  }, [])

  const handleInvite = useCallback(() => {
    const email = inviteEmail.trim()
    if (!email) {
      return
    }
    inviteCollaboratorMutation.mutate({ entryId, email, role: inviteRole })
  }, [inviteCollaboratorMutation, entryId, inviteEmail, inviteRole])

  const handleRoleChange = useCallback(
    (userId: string, role: "editor" | "viewer") => {
      updateCollaboratorRoleMutation.mutate({ entryId, userId, role })
    },
    [updateCollaboratorRoleMutation, entryId]
  )

  const handleRemoveCollaborator = useCallback(
    (userId: string) => {
      removeCollaboratorMutation.mutate(userId)
    },
    [removeCollaboratorMutation]
  )

  return (
    <>
      <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <HugeiconsIcon className="size-5" icon={Share01Icon} />
                {t("share.title")}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  {t("share.description", {
                    title: entryTitle || t("entry.untitled")
                  })}
                </p>

                <ExistingShares
                  copiedId={copiedId}
                  formatDate={formatDate}
                  isDeletePending={deleteShareMutation.isPending}
                  isExpired={isExpired}
                  onCopy={handleCopyLink}
                  onDelete={handleDeleteShare}
                  shares={shares}
                />

                <CreateShareForm
                  expirationPreset={expirationPreset}
                  password={password}
                  setExpirationPreset={setExpirationPreset}
                  setPassword={setPassword}
                  setShowBranding={setShowBranding}
                  setUsePassword={setUsePassword}
                  showBranding={showBranding}
                  usePassword={usePassword}
                />

                <CollaboratorsSection
                  collaborators={collaborators}
                  inviteEmail={inviteEmail}
                  inviteRole={inviteRole}
                  isInvitePending={inviteCollaboratorMutation.isPending}
                  isRemovePending={removeCollaboratorMutation.isPending}
                  onInvite={handleInvite}
                  onRemove={handleRemoveCollaborator}
                  onRoleChange={handleRoleChange}
                  setInviteEmail={setInviteEmail}
                  setInviteRole={setInviteRole}
                />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={() => onOpenChange(false)} variant="outline">
                {t("common.cancel")}
              </Button>
              <Button
                isDisabled={
                  createShareMutation.isPending ||
                  (usePassword && password.length < 4)
                }
                onPress={handleCreateShare}
              >
                <HugeiconsIcon className="size-4" icon={Link01Icon} />
                {t("share.createLink")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <ConfirmDeleteDialog
        confirmText={t("share.deleteLink")}
        description={t("share.deleteConfirm")}
        isLoading={deleteShareMutation.isPending}
        onConfirm={handleConfirmDeleteShare}
        onOpenChange={(value) => !value && setShareToDelete(null)}
        open={!!shareToDelete}
        title={t("share.deleteLink")}
      />
    </>
  )
}
