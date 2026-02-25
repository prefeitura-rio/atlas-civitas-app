import type { UserRole } from "./roles";

export type Camera = {
  id?: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  uf: string;
  stream_url?: string | null;
  is_active: boolean;
};

export type CameraIntel = {
  id?: string;
  ip?: string | null;
  code: string;
  name: string;
  lat: number;
  lng: number;
  direction?: string | null;
  is_active?: boolean;
  source_file?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CameraLpr = {
  id?: string;
  ip?: string | null;
  code: string;
  name: string;
  lat: number;
  lng: number;
  direction?: string | null;
  is_active?: boolean;
  source_file?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Radar = {
  id?: string;
  codcet: string;

  lat?: number | null;
  lng?: number | null;

  empresa?: string | null;
  bairro?: string | null;
  logradouro?: string | null;
  localidade?: string | null;
  sentido?: string | null;

  velofisc?: number | null;
  numero_equipamento?: string | null;

  status?: string | null;
  is_active?: boolean;

  updated_at?: string | null;
  data_atualizacao?: string | null;
};

export type Me = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  expires_at?: string | null;
  last_login_at?: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  cpf?: string | null;
  birth_date?: string | null;
  matricula?: string | null;
  unidade?: string | null;
  orgao?: string | null;
  is_active: boolean;
  created_at?: string;
  expires_at?: string | null;
  last_login_at?: string | null;
  accepted_terms_version?: string | null;
  terms_accepted_at?: string | null;
};

export type AdminLog = {
  id: string;
  created_at: string;
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;

  action: string;
  entity_type?: string | null;
  entity_id?: string | null;

  meta?: any;
  ip?: string | null;
  user_agent?: string | null;

  message: string;
  target?: {
    email?: string;
    name?: string;
    code?: string;
    codcet?: string;
  } | null;
};
