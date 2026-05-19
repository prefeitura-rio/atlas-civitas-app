import type { UserRole } from "./roles";

export type FeatureCode = string;

export type Camera = {
  id?: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  uf: string;
  streaming_url?: string | null;
  stream_url?: string | null;
  is_active: boolean;
};

export type CameraIntel = {
  id?: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  responsavel?: string | null;
  direction?: string | null;
  external_camera_id?: string | null;
  streaming_url?: string | null;
  is_active?: boolean;
  source_file?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CameraLpr = {
  id?: string;
  id_ponto_coleta?: string | number | null;
  origem_equipamento?: string | null;
  local?: string | null;
  code: string;
  name: string;
  lat: number;
  lng: number;
  latitude?: number | null;
  longitude?: number | null;
  neighborhood?: string | null;
  bairro?: string | null;
  direction?: string | null;
  sentido?: string | null;
  is_active?: boolean;
  status_ativo?: boolean | number | string | null;
  source_file?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Radar = {
  id?: string;
  id_ponto_coleta?: string | number | null;
  origem_equipamento?: string | null;
  local?: string | null;
  codcet: string;

  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;

  bairro?: string | null;
  logradouro?: string | null;
  localidade?: string | null;
  sentido?: string | null;
  status?: string | null;
  status_ativo?: boolean | number | string | null;
  is_active?: boolean;

  updated_at?: string | null;
  data_atualizacao?: string | null;
};

export type Me = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  roles?: string[] | null;
  matricula?: string | null;
  is_active: boolean;
  organization_id?: string | null;
  organization_name?: string | null;
  feature_codes: FeatureCode[];
  expires_at?: string | null;
  last_login_at?: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  cpf?: string | null;
  matricula?: string | null;
  unidade?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  orgao?: string | null;
  is_active: boolean;
  created_at?: string;
  expires_at?: string | null;
  last_login_at?: string | null;
  accepted_terms_version?: string | null;
  terms_accepted_at?: string | null;
};

export type AdminOrganization = {
  id: string;
  name: string;
  organization_type: string;
  acronym: string;
  jurisdiction_level: string;
  feature_codes: FeatureCode[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type FeatureCatalogItem = {
  code: FeatureCode;
  name: string;
  category: string;
  description?: string | null;
};

export type SmartCameraSessionResponse = {
  session_url?: string | null;
  external_camera_id?: string | null;
  camera_id?: string | null;
  result?: string | null;
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
    id_ponto_coleta?: string;
    local?: string;
    bairro?: string;
    sentido?: string;
    origem_equipamento?: string;
  } | null;
};
