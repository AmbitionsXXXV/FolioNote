import { Button } from "@folionote/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@folionote/ui/dialog"
import { InputGroup, InputGroupAddon } from "@folionote/ui/input-group"
import {
  Cancel01Icon,
  Search01Icon,
  Tick02Icon
} from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { Command as CommandPrimitive } from "cmdk"
import type * as React from "react"

import { cn } from "@/lib/utils"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "etc-command flex size-full flex-col overflow-hidden",
        className
      )}
      data-slot="command"
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("etc-command-dialog overflow-hidden p-0", className)}
        showCloseButton={false}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  showCloseButton = false,
  onClose,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  showCloseButton?: boolean
  onClose?: () => void
}) {
  return (
    <div
      className="etc-command-input-wrapper relative px-3 pb-3"
      data-slot="command-input-wrapper"
    >
      <InputGroup className="etc-command-input-group relative gap-1.5">
        <CommandPrimitive.Input
          className={cn(
            "etc-command-input outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            showCloseButton && "pr-8",
            className
          )}
          data-slot="command-input"
          {...props}
        />
        <InputGroupAddon>
          <HugeiconsIcon
            className="etc-command-input-icon"
            icon={Search01Icon}
          />
        </InputGroupAddon>
        {showCloseButton && onClose && (
          <Button
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2"
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </InputGroup>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        "etc-command-list overflow-y-auto overflow-x-hidden",
        className
      )}
      data-slot="command-list"
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn("etc-command-empty", className)}
      data-slot="command-empty"
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn("etc-command-group", className)}
      data-slot="command-group"
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("etc-command-separator", className)}
      data-slot="command-separator"
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "etc-command-item group/command-item data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-slot="command-item"
      {...props}
    >
      {children}
      <HugeiconsIcon
        className="etc-command-item-indicator ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100"
        icon={Tick02Icon}
      />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("etc-command-shortcut", className)}
      data-slot="command-shortcut"
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator
}
