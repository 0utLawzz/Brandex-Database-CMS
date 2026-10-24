import React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "font-mono text-sm font-bold uppercase tracking-widest text-[#0C0C0C]",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
