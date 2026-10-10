import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-sm border border-rule-strong bg-paper-raised px-3.5 font-sans text-[0.9rem] text-ink placeholder:text-muted/70",
      "focus:border-moss focus:outline-none",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
