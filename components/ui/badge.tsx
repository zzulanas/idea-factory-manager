import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm shadow-primary/25 [a&]:hover:bg-primary/90 [a&]:hover:shadow-md",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-white shadow-sm shadow-destructive/25 [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border/50 text-foreground bg-background/50 backdrop-blur-sm [a&]:hover:bg-accent/50 [a&]:hover:text-accent-foreground [a&]:hover:border-accent/50",
        glass:
          "glass glass-border text-foreground [a&]:hover:shadow-md",
        gradient:
          "border-transparent bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/25 [a&]:hover:shadow-md",
        success:
          "border-transparent bg-emerald-500/90 text-white shadow-sm shadow-emerald-500/25 [a&]:hover:bg-emerald-500",
        warning:
          "border-transparent bg-amber-500/90 text-white shadow-sm shadow-amber-500/25 [a&]:hover:bg-amber-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
