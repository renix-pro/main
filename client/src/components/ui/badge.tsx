import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "pill pill-pending",
        secondary: "rounded-lg border border-subtle bg-transparent",
        destructive: "pill pill-declined",
        outline: "rounded-lg border border-subtle bg-transparent",
        draft: "pill pill-draft",
        pending: "pill pill-pending",
        approved: "pill pill-approved",
        declined: "pill pill-declined",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
