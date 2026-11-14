import { ArrowDown01Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { memo, useCallback, useState } from "react"

interface GeneratedImageProps {
  url: string
  mediaType: string
  messageId: string
  index: number
}

export const GeneratedImage = memo(
  ({ url, mediaType, messageId, index }: GeneratedImageProps) => {
    const [isLoading, setIsLoading] = useState(true)
    const [hasError, setHasError] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)

    const handleLoad = useCallback(() => {
      setIsLoading(false)
    }, [])

    const handleError = useCallback(() => {
      setIsLoading(false)
      setHasError(true)
    }, [])

    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => !prev)
    }, [])

    const handleDownload = useCallback(() => {
      const extension = mediaType.split("/").at(1) ?? "png"
      const link = document.createElement("a")
      link.href = url
      link.download = `generated-${messageId}-${index}.${extension}`
      link.click()
    }, [url, mediaType, messageId, index])

    if (hasError) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border border-border/40 bg-surface-secondary/20 text-xs text-muted-foreground">
          Failed to load
        </div>
      )
    }

    return (
      <div className="group relative">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-border/40 bg-surface-secondary/20">
            <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        ) : null}
        <button
          className={`max-h-96 cursor-pointer rounded-lg border border-border/40 bg-transparent p-0 ${isLoading ? "hidden" : "block"} ${isExpanded ? "max-h-none" : ""}`}
          onClick={toggleExpanded}
          type="button"
        >
          <img
            alt={`AI generated #${index + 1}`}
            className="max-h-96 rounded-lg object-contain transition-transform duration-200"
            onError={handleError}
            onLoad={handleLoad}
            src={url}
          />
        </button>
        {isLoading ? null : (
          <button
            aria-label="Download"
            className="absolute right-2 bottom-2 rounded-md bg-black/50 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100"
            onClick={handleDownload}
            type="button"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          </button>
        )}
      </div>
    )
  }
)

interface GeneratedImagesGridProps {
  images: Array<{ url: string; mediaType: string }>
  messageId: string
}

export const GeneratedImagesGrid = memo(
  ({ images, messageId }: GeneratedImagesGridProps) => {
    if (images.length === 0) return null

    return (
      <div
        className={`mt-2 grid gap-2 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {images.map((image, index) => (
          <GeneratedImage
            index={index}
            key={`${messageId}-img-${image.url.slice(-20)}`}
            mediaType={image.mediaType}
            messageId={messageId}
            url={image.url}
          />
        ))}
      </div>
    )
  }
)
