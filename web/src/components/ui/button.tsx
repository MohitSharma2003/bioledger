import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-sans font-medium tracking-[0.02em] transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none",
  {
    variants: {
      variant: {
        default: "bg-forest text-paper-raised hover:bg-forest-2",
        outline:
          "border border-rule-strong bg-transparent text-forest hover:bg-sage",
        ghost: "bg-transparent text-forest hover:bg-sage",
        accent: "bg-ochre text-paper-raised hover:bg-terracotta",
        subtle: "bg-sage text-forest hover:bg-sage-deep",
      },
      size: {
        sm: "h-9 rounded-sm px-3 text-[0.82rem]",
        md: "h-11 rounded-sm px-5 text-[0.88rem]",
        lg: "h-[3.25rem] rounded-sm px-7 text-[0.95rem]",
        icon: "h-10 w-10 rounded-sm",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
