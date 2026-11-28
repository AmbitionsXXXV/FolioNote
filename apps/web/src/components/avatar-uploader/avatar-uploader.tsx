import {
  AVATAR_CROPPER_MAX_ZOOM,
  AVATAR_CROPPER_MIN_ZOOM,
  AVATAR_CROPPER_ZOOM_STEP
} from "@folionote/constants"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@folionote/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@folionote/ui/avatar"
import { Button } from "@folionote/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@folionote/ui/dialog"
import { Slider } from "@folionote/ui/slider"
import { Spinner } from "@folionote/ui/spinner"
import { formatTimeWithI18n } from "@folionote/utils"
import {
  Alert01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  Image01Icon,
  ImageUploadIcon,
  Tick01Icon,
  Time02Icon,
  UserCircleIcon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useImperativeHandle, useRef, useState } from "react"
import Cropper from "react-easy-crop"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import {
  useAvatarCropper,
  useAvatarDelete,
  useAvatarRateLimit,
  useAvatarUpload,
  useAvatarValidation
} from "./hooks"
import type {
  AvatarSizeConfig,
  AvatarUploaderProps,
  AvatarUploaderRef
} from "./types"
import { getInitials } from "./utils"

const SIZE_CONFIG: Record<"default" | "sm" | "lg", AvatarSizeConfig> = {
  default: { avatar: "size-16", icon: "size-6" },
  sm: { avatar: "size-24", icon: "size-10" },
  lg: { avatar: "size-32", icon: "size-12" }
}

type AvatarUploaderComponentProps = AvatarUploaderProps & {
  ref?: React.Ref<AvatarUploaderRef>
}

function AvatarUploader({
  currentImageUrl,
  userName,
  size = "lg",
  readonly = false,
  onAvatarChange,
  className,
  avatarClassName,
  ref
}: AvatarUploaderComponentProps): React.ReactElement {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { rateLimitStatus, refetchRateLimit, countdown, isRateLimited } =
    useAvatarRateLimit()
  const { uploadMutation, previewUrl, setPreviewUrl } = useAvatarUpload(
    onAvatarChange,
    refetchRateLimit
  )
  const { deleteMutation } = useAvatarDelete(onAvatarChange, refetchRateLimit)
  const {
    cropDialogOpen,
    setCropDialogOpen,
    cropImageSrc,
    crop,
    setCrop,
    zoom,
    setZoom,
    onCropComplete,
    handleCropConfirm,
    handleCropCancel,
    openCropper
  } = useAvatarCropper(uploadMutation, setPreviewUrl)
  const { validateFile, config } = useAvatarValidation()

  const isLoading = uploadMutation.isPending || deleteMutation.isPending
  const sizes = SIZE_CONFIG[size ?? "default"]
  const displayUrl = previewUrl || currentImageUrl

  const getFormattedRateLimit = useCallback((): {
    value: number
    unit: string
  } => {
    const seconds =
      countdown !== null
        ? countdown
        : Math.ceil((rateLimitStatus?.resetInMs ?? 0) / 1000)
    return formatTimeWithI18n(seconds, t, { maxUnit: "hour" })
  }, [countdown, rateLimitStatus?.resetInMs, t])

  const handleFileSelect = useCallback(
    (file: File) => {
      if (isRateLimited) {
        const { value, unit } = getFormattedRateLimit()
        toast.error(t("avatar.rateLimitedWait", { value, unit }))
        return
      }

      const error = validateFile(file)
      if (error) {
        toast.error(error)
        return
      }

      openCropper(file)
    },
    [validateFile, isRateLimited, getFormattedRateLimit, t, openCropper]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
      e.target.value = ""
    },
    [handleFileSelect]
  )

  const handleDragEvent = useCallback(
    (e: React.DragEvent, dragging: boolean) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(dragging)
    },
    []
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleOpen = useCallback(() => {
    if (readonly || isLoading) {
      return
    }

    if (displayUrl) {
      setActionDialogOpen(true)
    } else {
      triggerFileInput()
    }
  }, [readonly, isLoading, displayUrl, triggerFileInput])

  const handleReupload = useCallback(() => {
    setActionDialogOpen(false)
    triggerFileInput()
  }, [triggerFileInput])

  const handleDeleteClick = useCallback(() => {
    setActionDialogOpen(false)
    setDeleteDialogOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    deleteMutation.mutate()
    setDeleteDialogOpen(false)
  }, [deleteMutation])

  const handleZoomChange = useCallback(
    (value: number | readonly number[]) => {
      const newZoom = Array.isArray(value) ? (value[0] ?? 1) : value
      setZoom(newZoom)
    },
    [setZoom]
  )

  useImperativeHandle(ref, () => ({ open: handleOpen }))

  return (
    <div className={cn("relative inline-flex", className)}>
      <input
        accept={config?.allowedTypes.join(",")}
        aria-label={t("avatar.reupload")}
        className="hidden"
        onChange={handleInputChange}
        ref={fileInputRef}
        type="file"
      />

      <div
        aria-label={userName ? `${userName}'s avatar` : "Avatar"}
        className={cn(
          "group relative rounded-full transition-all",
          isDragging && "ring-2 ring-primary ring-offset-2"
        )}
        onDragLeave={readonly ? undefined : (e) => handleDragEvent(e, false)}
        onDragOver={readonly ? undefined : (e) => handleDragEvent(e, true)}
        onDrop={readonly ? undefined : handleDrop}
        role="img"
      >
        <Avatar className={cn("rounded-full", avatarClassName)} size={size}>
          {displayUrl && (
            <AvatarImage alt={userName || "Avatar"} src={displayUrl} />
          )}
          <AvatarFallback className="bg-primary/10 text-primary">
            {userName ? (
              <span className="font-medium">{getInitials(userName)}</span>
            ) : (
              <HugeiconsIcon className={sizes.icon} icon={UserCircleIcon} />
            )}
          </AvatarFallback>
        </Avatar>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <Spinner className="size-8 text-white" />
          </div>
        )}
      </div>

      <ActionDialog
        countdown={countdown}
        isRateLimited={isRateLimited}
        onDeleteClick={handleDeleteClick}
        onOpenChange={setActionDialogOpen}
        onReupload={handleReupload}
        open={actionDialogOpen}
        rateLimitStatus={rateLimitStatus}
      />

      <CropDialog
        crop={crop}
        isUploading={uploadMutation.isPending}
        onCancel={handleCropCancel}
        onCropChange={setCrop}
        onCropComplete={onCropComplete}
        onOpenChange={setCropDialogOpen}
        onSubmit={handleCropConfirm}
        onZoomChange={handleZoomChange}
        open={cropDialogOpen}
        src={cropImageSrc}
        zoom={zoom}
      />

      <DeleteDialog
        isDeleting={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
      />
    </div>
  )
}

interface ActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isRateLimited: boolean
  countdown: number | null
  rateLimitStatus?: { remaining: number; limit: number } | null
  onReupload: () => void
  onDeleteClick: () => void
}

function ActionDialog({
  open,
  onOpenChange,
  isRateLimited,
  countdown,
  rateLimitStatus,
  onReupload,
  onDeleteClick
}: ActionDialogProps): React.ReactElement {
  const { t } = useTranslation()

  const formattedTime =
    countdown !== null
      ? formatTimeWithI18n(countdown, t, { maxUnit: "hour" })
      : null

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon className="size-5" icon={Edit02Icon} />
            {t("avatar.actions")}
          </DialogTitle>
          <DialogDescription>
            {t("avatar.actionsDescription")}
          </DialogDescription>
        </DialogHeader>

        {isRateLimited && countdown !== null && formattedTime && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <HugeiconsIcon className="size-4 shrink-0" icon={Time02Icon} />
            <span>
              {t("avatar.rateLimitedWait", {
                value: formattedTime.value,
                unit: formattedTime.unit
              })}
            </span>
          </div>
        )}

        {rateLimitStatus && !isRateLimited && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon className="size-3" icon={Time02Icon} />
            <span>
              {t("avatar.remainingUploads", {
                remaining: rateLimitStatus.remaining,
                limit: rateLimitStatus.limit
              })}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            className="w-full justify-start"
            disabled={isRateLimited}
            onClick={onReupload}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon className="mr-2 size-4" icon={ImageUploadIcon} />
            {t("avatar.reupload")}
          </Button>
          <Button
            className="w-full justify-start"
            onClick={onDeleteClick}
            type="button"
            variant="destructive"
          >
            <HugeiconsIcon className="mr-2 size-4" icon={Delete02Icon} />
            {t("avatar.delete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface CropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string | null
  crop: { x: number; y: number }
  zoom: number
  isUploading: boolean
  onCropChange: (crop: { x: number; y: number }) => void
  onZoomChange: (value: number | readonly number[]) => void
  onCropComplete: (
    croppedArea: { x: number; y: number; width: number; height: number },
    croppedAreaPixels: { x: number; y: number; width: number; height: number }
  ) => void
  onSubmit: () => void
  onCancel: () => void
}

function CropDialog({
  open,
  onOpenChange,
  src,
  crop,
  zoom,
  isUploading,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onSubmit,
  onCancel
}: CropDialogProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon className="size-5" icon={Image01Icon} />
            {t("avatar.cropTitle")}
          </DialogTitle>
          <DialogDescription>{t("avatar.cropDescription")}</DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-surface-secondary">
          {src && (
            <Cropper
              aspect={1}
              crop={crop}
              cropShape="round"
              image={src}
              onCropChange={onCropChange}
              onCropComplete={onCropComplete}
              onZoomChange={(z) => onZoomChange(z)}
              showGrid={false}
              zoom={zoom}
            />
          )}
        </div>

        <div className="flex items-center gap-4 px-2">
          <span className="text-sm text-muted-foreground">
            {t("avatar.zoom")}
          </span>
          <Slider
            className="w-32"
            max={AVATAR_CROPPER_MAX_ZOOM}
            min={AVATAR_CROPPER_MIN_ZOOM}
            onValueChange={onZoomChange}
            step={AVATAR_CROPPER_ZOOM_STEP}
            value={[zoom]}
          />
          <span className="w-12 text-right text-sm text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            <HugeiconsIcon className="mr-2 size-4" icon={Cancel01Icon} />
            {t("common.cancel")}
          </Button>
          <Button disabled={isUploading} onClick={onSubmit} type="button">
            {isUploading ? (
              <Spinner className="mr-2 size-4" />
            ) : (
              <HugeiconsIcon className="mr-2 size-4" icon={Tick01Icon} />
            )}
            {isUploading ? t("avatar.uploading") : t("avatar.cropAndUpload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDeleting: boolean
  onConfirm: () => void
}

function DeleteDialog({
  open,
  onOpenChange,
  isDeleting,
  onConfirm
}: DeleteDialogProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <HugeiconsIcon
              className="size-5 text-destructive"
              icon={Alert01Icon}
            />
            {t("avatar.deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("avatar.deleteConfirmation")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {isDeleting ? (
              <Spinner className="mr-2 size-4" />
            ) : (
              <HugeiconsIcon className="mr-2 size-4" icon={Delete02Icon} />
            )}
            {isDeleting ? t("avatar.deleting") : t("avatar.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

AvatarUploader.displayName = "AvatarUploader"

export { AvatarUploader }
export default AvatarUploader
