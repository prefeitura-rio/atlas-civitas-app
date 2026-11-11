import type { ButtonHTMLAttributes } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import "./admin-buttons.css";

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "default" | "small" | "icon" | "compactIcon";
  icon?: LucideIcon;
  loading?: boolean;
};

const variantClasses = {
  primary: "adminButtonPrimary",
  secondary: "adminButtonSecondary",
  danger: "adminButtonDanger",
  ghost: "adminButtonGhost",
};
const sizeClasses = {
  default: "",
  small: "adminButtonSmall",
  icon: "adminButtonIcon",
  compactIcon: "adminButtonCompactIcon",
};

export function AdminButton({
  variant = "secondary", size = "default", icon: Icon, loading = false,
  className, children, disabled, type = "button", ...props
}: AdminButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={["adminButton", variantClasses[variant], sizeClasses[size], className].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading
        ? <Loader2 size={16} className="adminButtonSpinner" aria-hidden="true" />
        : Icon && <Icon size={size === "compactIcon" ? 14 : 16} aria-hidden="true" />}
      {children}
    </button>
  );
}
