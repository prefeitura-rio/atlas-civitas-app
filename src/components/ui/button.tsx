import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "destructive" | "outline";
};

export function Button({ variant = "default", className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition " +
    "disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    default: "bg-black text-white hover:opacity-90",
    destructive: "bg-red-600 text-white hover:opacity-90",
    outline: "border border-zinc-300 bg-white hover:bg-zinc-50",
  };

  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
