import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Premium signature — primary pill with shimmer + lift (auto-adapts dark)
        default:
          "btn-shimmer rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary active:text-primary-foreground shadow-button hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0",
        premium:
          "btn-shimmer rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary active:text-primary-foreground shadow-button hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0",
        // Glass / translucent — guarantee contrast in all states
        glass:
          "rounded-full glass-strong text-foreground hover:text-foreground active:text-foreground hover:-translate-y-0.5 transition border-2 border-foreground/20 hover:border-foreground/40 hover:bg-[var(--glass-bg-strong)]",
        // Outline elegant — invert on hover but keep readable on focus/active
        outline:
          "rounded-full border border-foreground/80 bg-transparent text-foreground hover:bg-foreground hover:text-background active:bg-foreground active:text-background focus-visible:bg-foreground focus-visible:text-background",
        // Subtle / secondary
        secondary:
          "rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:text-secondary-foreground active:text-secondary-foreground",
        // Destructive
        destructive:
          "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground active:text-destructive-foreground shadow-sm",
        // Ghost minimal — keep text legible against hover background
        ghost:
          "rounded-full text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent active:text-accent-foreground",
        // Inline link with animated underline
        link: "text-foreground underline-offset-4 hover:underline hover:text-foreground active:text-foreground relative",
        // Ember accent — copper warmth, used sparingly
        ember:
          "btn-shimmer rounded-full bg-ember text-ember-foreground hover:bg-ember/90 hover:text-ember-foreground active:text-ember-foreground shadow-button hover:shadow-button-hover hover:-translate-y-0.5",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-7 text-[15px]",
        xl: "h-14 px-9 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
