import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "file:text-foreground placeholder:text-muted-foreground/70 h-10 w-full min-w-0 rounded-xl border bg-transparent px-4 py-2.5 text-base shadow-sm transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  {
    variants: {
      variant: {
        default:
          "border-input bg-background/50 backdrop-blur-sm focus:border-ring focus:ring-2 focus:ring-ring/20 hover:border-ring/50",
        glass:
          "glass glass-border focus:ring-2 focus:ring-ring/30 focus:border-ring/50 placeholder:text-muted-foreground/60",
        filled:
          "border-transparent bg-muted/50 focus:bg-background focus:border-ring focus:ring-2 focus:ring-ring/20",
        underline:
          "rounded-none border-x-0 border-t-0 border-b-2 bg-transparent px-0 focus:border-primary focus:ring-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Input({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant}
      className={cn(
        inputVariants({ variant }),
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input, inputVariants }
