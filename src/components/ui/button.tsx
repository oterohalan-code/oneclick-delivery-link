import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Premium signature — black ink pill with shimmer + lift
        default:
          "btn-shimmer rounded-full bg-ink text-bone shadow-button hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0",
        premium:
          "btn-shimmer rounded-full bg-ink text-bone shadow-button hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0",
        // Glass / translucent
        glass:
          "rounded-full glass-strong text-ink hover:bg-white/85 hover:-translate-y-0.5 transition",
        // Outline elegant
        outline:
          "rounded-full border border-ink/80 bg-transparent text-ink hover:bg-ink hover:text-bone",
        // Subtle / secondary on light bg
        secondary:
          "rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/70",
        // Destructive
        destructive:
          "rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // Ghost minimal
        ghost: "rounded-full hover:bg-accent hover:text-accent-foreground",
        // Inline link with animated underline
        link: "text-ink underline-offset-4 hover:underline relative",
        // Ember accent — copper warmth, used sparingly
        ember:
          "btn-shimmer rounded-full bg-ember text-ember-foreground shadow-button hover:shadow-button-hover hover:-translate-y-0.5",
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
