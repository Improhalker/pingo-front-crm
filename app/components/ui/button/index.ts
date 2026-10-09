import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

// shadcn-vue button adapted to PingoFin direction B: 44px controls, purple primary with the
// documented hover/active tokens, outline for secondary actions and a legible disabled state.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold transition-colors duration-[var(--motion-fast)] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active disabled:bg-muted disabled:text-muted-foreground disabled:border disabled:border-border',
        destructive:
          'bg-destructive text-destructive-foreground hover:brightness-95 disabled:bg-muted disabled:text-muted-foreground',
        outline:
          'border border-input bg-card text-foreground hover:bg-accent disabled:bg-muted disabled:text-muted-foreground disabled:border-border',
        ghost: 'text-foreground hover:bg-accent disabled:text-muted-foreground',
        link: 'text-primary underline underline-offset-4 hover:text-primary-hover',
      },
      size: {
        default: 'h-11 px-4 text-base',
        sm: 'h-9 gap-1.5 px-3 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
