import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, onFocus, ...props }, ref) => {
  // Handle selecting all text on focus for number inputs with value 0
  const handleFocus = (e) => {
    if (type === "number") {
      // Select all text so user can immediately type to replace
      e.target.select();
    }
    if (onFocus) {
      onFocus(e);
    }
  };

  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // Hide number input spinners
        type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        className
      )}
      ref={ref}
      onFocus={handleFocus}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
