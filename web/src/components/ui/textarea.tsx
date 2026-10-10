import * as React from "react";
import { cn } from "../../lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-sm border border-rule-strong bg-paper-raised px-4 py-3 font-serif text-[1.05rem] leading-relaxed text-ink placeholder:text-muted/70",
      "focus:border-moss focus:outline-none",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
