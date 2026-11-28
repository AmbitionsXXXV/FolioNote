import { Loading02Icon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <HugeiconsIcon className="animate-spin" icon={Loading02Icon} size={24} />
    </div>
  )
}
