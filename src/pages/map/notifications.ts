import { fetchJson } from "./shared";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  sender_name: string;
  created_at: string;
  read_at: string | null;
};

export type NotificationInbox = {
  items: AppNotification[];
  total: number;
  unread_count: number;
  as_of: string;
};

export type SentNotification = Omit<AppNotification, "read_at"> & { recipient_count: number };
export type NotificationHistory = { items: SentNotification[]; total: number };
export type NotificationUser = {
  id: string;
  full_name: string | null;
  email: string;
  organization_id: string | null;
  organization_name: string | null;
};
export type NotificationUserPage = { items: NotificationUser[]; total: number };

export function notificationRequest<T>(apiBase: string, token: string | null, path: string, options: RequestInit = {}) {
  return fetchJson<T>(`${apiBase}/notifications${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

export function notificationError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^\d{3} - /, "")
    : "Não foi possível concluir esta ação. Tente novamente.";
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short",
});

export function notificationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}
