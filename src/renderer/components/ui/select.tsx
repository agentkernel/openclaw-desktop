import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.SelectGroup

const SelectValue = SelectPrimitive.SelectValue

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.SelectTrigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.SelectTrigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.SelectTrigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.SelectIcon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.SelectIcon>
  </SelectPrimitive.SelectTrigger>
))
SelectTrigger.displayName = SelectPrimitive.SelectTrigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.SelectScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.SelectScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.SelectScrollUpButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className,
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.SelectScrollUpButton>
))
SelectScrollUpButton.displayName =
  SelectPrimitive.SelectScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.SelectScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.SelectScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.SelectScrollDownButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className,
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.SelectScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.SelectScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.SelectContent>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.SelectContent>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.SelectPortal>
    <SelectPrimitive.SelectContent
      ref={ref}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-input bg-background text-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.SelectViewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.SelectViewport>
      <SelectScrollDownButton />
    </SelectPrimitive.SelectContent>
  </SelectPrimitive.SelectPortal>
))
SelectContent.displayName = SelectPrimitive.SelectContent.displayName

const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.SelectLabel>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.SelectLabel>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.SelectLabel
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.SelectLabel.displayName

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.SelectItem>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.SelectItem>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.SelectItem
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.SelectItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.SelectItemIndicator>
    </span>

    <SelectPrimitive.SelectItemText>{children}</SelectPrimitive.SelectItemText>
  </SelectPrimitive.SelectItem>
))
SelectItem.displayName = SelectPrimitive.SelectItem.displayName

const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.SelectSeparator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.SelectSeparator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.SelectSeparator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.SelectSeparator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
