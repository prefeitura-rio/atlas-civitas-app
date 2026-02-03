import * as React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={
        "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm " +
        "placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black " +
        "disabled:opacity-50 " +
        className
      }
      {...props}
    />
  );
});
Input.displayName = "Input";
