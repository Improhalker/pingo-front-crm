import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Badge } from './Badge.vue'

// Status badges always carry text; color and icon only reinforce it (DESIGN_SYSTEM.md §2).
export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-2.5 py-1 text-sm font-semibold leading-tight [&>svg]:size-4 [&>svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-brand-subtle text-brand-subtle-foreground',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        danger: 'bg-danger-subtle text-danger',
        info: 'bg-info-subtle text-info',
        highlight: 'bg-highlight text-highlight-foreground',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
export type BadgeVariants = VariantProps<typeof badgeVariants>
