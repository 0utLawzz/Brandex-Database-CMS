import React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-[6px] font-mono font-bold uppercase tracking-widest nb-border nb-shadow nb-button disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-[#6C1C1F] text-[#F0E8D0]",
        secondary: "bg-[#0A6B52] text-white",
        accent: "bg-[#B0740E] text-white",
        destructive: "bg-red-600 text-white",
        outline: "bg-[#E8DFC7] text-[#0C0C0C]",
        ghost:
          "bg-transparent text-[#0C0C0C] nb-shadow-none border-transparent hover:bg-[#E8DFC7]",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-6 py-2.5 text-base",
        lg: "px-8 py-4 text-lg font-bold uppercase tracking-wider",
        icon: "p-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
