export const USER_ROLES = ["admin", "user", "user_stream"] as const;

export type UserRole = (typeof USER_ROLES)[number];

const ROLE_SET = new Set<string>(USER_ROLES);

export function isUserRole(value: unknown): value is UserRole {
  if (typeof value !== "string") return false;
  return ROLE_SET.has(value.trim().toLowerCase());
}

export function normalizeRole(value: unknown): UserRole {
  if (typeof value !== "string") return "user";
  const normalized = value.trim().toLowerCase();
  return (ROLE_SET.has(normalized) ? normalized : "user") as UserRole;
}

export function roleLabel(role: unknown): string {
  const normalized = normalizeRole(role);
  if (normalized === "admin") return "Administrador";
  if (normalized === "user_stream") return "Usuário com streaming";
  return "Usuário sem streaming";
}

export function isAdminRole(role: unknown): boolean {
  return normalizeRole(role) === "admin";
}

export function canAccessStreaming(role: unknown): boolean {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "user_stream";
}
