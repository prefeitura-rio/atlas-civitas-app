import * as React from "react";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
};

export function Alert({ variant = "default", className = "", ...props }: AlertProps) {
  const base = "rounded-md border p-3 text-sm flex gap-2";
  const variants: Record<string, string> = {
    default: "border-zinc-200 bg-white text-zinc-900",
    destructive: "border-red-200 bg-red-50 text-red-900",
  };
  return <div className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function AlertTitle(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`font-semibold ${className}`} {...rest} />;
}

export function AlertDescription(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`opacity-90 ${className}`} {...rest} />;
}
