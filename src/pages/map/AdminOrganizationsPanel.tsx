import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  PenTool,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AdminOrganization, FeatureCatalogItem } from "./types";
import { fetchJson, inputStyle } from "./shared";
import { normalizeFeatureCode, normalizeFeatureCodes } from "../../app/featureCodes";
import cameraIcon from "@/assets/camera-icon.png";
import cameraIntelIcon from "@/assets/cameras-inteligentes-icon.png";
import cameraLprIcon from "@/assets/camera-lpr-icon.png";
import mapPinRed from "@/assets/map-pin-red.svg";
import radarIcon from "@/assets/radar-icon.png";

const ADMIN_PAGE_SIZE = 50;

type FeatureCardIconConfig =
  | { kind: "image"; src: string }
  | { kind: "lucide"; Icon: LucideIcon };

const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  cameras: "Câmeras",
  cameras_inteligentes: "Super Câmeras Inteligentes",
  cameras_lpr: "Câmeras LPR",
  radares: "Radares",
  bairros_com_extracao_dados: "Bairros com extração de dados",
  bairros_sem_extracao_dados: "Bairros sem extração de dados",
  risp_com_extracao_dados: "RISP com extração de dados",
  risp_sem_extracao_dados: "RISP sem extração de dados",
  aisp_com_extracao_dados: "AISP com extração de dados",
  aisp_sem_extracao_dados: "AISP sem extração de dados",
  cisp_com_extracao_dados: "CISP com extração de dados",
  cisp_sem_extracao_dados: "CISP sem extração de dados",
  risp: "RISP",
  aisp: "AISP",
  cisp: "CISP",
  gps: "GPS",
  desenhar_area: "Desenhar Área",
};

const FEATURE_CARD_ICONS: Partial<Record<string, FeatureCardIconConfig>> = {
  cameras: { kind: "image", src: cameraIcon },
  cameras_inteligentes: { kind: "image", src: cameraIntelIcon },
  cameras_lpr: { kind: "image", src: cameraLprIcon },
  radares: { kind: "image", src: radarIcon },
  bairros_com_extracao_dados: { kind: "lucide", Icon: Building2 },
  bairros_sem_extracao_dados: { kind: "lucide", Icon: Building2 },
  risp_com_extracao_dados: { kind: "lucide", Icon: Shield },
  risp_sem_extracao_dados: { kind: "lucide", Icon: Shield },
  aisp_com_extracao_dados: { kind: "lucide", Icon: ShieldAlert },
  aisp_sem_extracao_dados: { kind: "lucide", Icon: ShieldAlert },
  cisp_com_extracao_dados: { kind: "lucide", Icon: ShieldCheck },
  cisp_sem_extracao_dados: { kind: "lucide", Icon: ShieldCheck },
  risp: { kind: "lucide", Icon: Shield },
  aisp: { kind: "lucide", Icon: ShieldAlert },
  cisp: { kind: "lucide", Icon: ShieldCheck },
  gps: { kind: "image", src: mapPinRed },
  desenhar_area: { kind: "lucide", Icon: PenTool },
};

const FALLBACK_FEATURE_CATALOG: FeatureCatalogItem[] = [
  { code: "cameras", name: "Câmeras", category: "layer" },
  { code: "cameras_inteligentes", name: "Super Câmeras Inteligentes", category: "layer" },
  { code: "cameras_lpr", name: "Câmeras LPR", category: "layer" },
  { code: "radares", name: "Radares", category: "layer" },
  { code: "bairros_com_extracao_dados", name: "Bairros com extração de dados", category: "layer" },
  { code: "bairros_sem_extracao_dados", name: "Bairros sem extração de dados", category: "layer" },
  { code: "risp_com_extracao_dados", name: "RISP com extração de dados", category: "layer" },
  { code: "risp_sem_extracao_dados", name: "RISP sem extração de dados", category: "layer" },
  { code: "aisp_com_extracao_dados", name: "AISP com extração de dados", category: "layer" },
  { code: "aisp_sem_extracao_dados", name: "AISP sem extração de dados", category: "layer" },
  { code: "cisp_com_extracao_dados", name: "CISP com extração de dados", category: "layer" },
  { code: "cisp_sem_extracao_dados", name: "CISP sem extração de dados", category: "layer" },
  { code: "gps", name: "GPS", category: "tool" },
  { code: "desenhar_area", name: "Desenhar Área", category: "tool" },
];

const FALLBACK_ORGANIZATION_TYPES = [
  "Órgão Público",
  "Empresa",
  "Concessionária",
  "Fornecedora",
  "Parceira Tecnológica",
  "Instituição do Sistema de Justiça",
  "Força de Segurança",
  "Órgão de Emergência",
  "Secretaria",
];

const FALLBACK_JURISDICTION_LEVELS = ["Federal", "Estadual", "Municipal", "Privada"];
const BAIROS_FEATURE_FAMILY = "bairros";
const RISP_FEATURE_FAMILY = "risp";
const AISP_FEATURE_FAMILY = "aisp";
const CISP_FEATURE_FAMILY = "cisp";
const LAYERS_FEATURE_CODES = ["cameras", "cameras_inteligentes", "cameras_lpr", "radares"] as const;
const EXTRACTION_WITH_CODES = [
  "bairros_com_extracao_dados",
  "risp_com_extracao_dados",
  "aisp_com_extracao_dados",
  "cisp_com_extracao_dados",
] as const;
const EXTRACTION_WITHOUT_CODES = [
  "bairros_sem_extracao_dados",
  "risp_sem_extracao_dados",
  "aisp_sem_extracao_dados",
  "cisp_sem_extracao_dados",
] as const;
const TOOLS_FEATURE_CODES = ["gps", "desenhar_area"] as const;

type OrganizationForm = {
  name: string;
  organization_type: string;
  acronym: string;
  jurisdiction_level: string;
  feature_codes: string[];
};

const BAIRROS_FEATURE_CODES = [
  "bairros_com_extracao_dados",
  "bairros_sem_extracao_dados",
] as const;
const RISP_FEATURE_CODES = ["risp_com_extracao_dados", "risp_sem_extracao_dados"] as const;
const AISP_FEATURE_CODES = ["aisp_com_extracao_dados", "aisp_sem_extracao_dados"] as const;
const CISP_FEATURE_CODES = ["cisp_com_extracao_dados", "cisp_sem_extracao_dados"] as const;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sameFeatureCodes(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((code, index) => code === b[index]);
}

function isBairrosFeatureCode(code: string) {
  return BAIRROS_FEATURE_CODES.includes(code as (typeof BAIRROS_FEATURE_CODES)[number]);
}

function isRispFeatureCode(code: string) {
  return RISP_FEATURE_CODES.includes(code as (typeof RISP_FEATURE_CODES)[number]);
}

function isAispFeatureCode(code: string) {
  return AISP_FEATURE_CODES.includes(code as (typeof AISP_FEATURE_CODES)[number]);
}

function isCispFeatureCode(code: string) {
  return CISP_FEATURE_CODES.includes(code as (typeof CISP_FEATURE_CODES)[number]);
}

function normalizeOrganization(raw: any, idx = 0): AdminOrganization {
  const id = clean(raw?.id || raw?.organization_id || raw?.uuid || `org-${idx}`);
  return {
    id,
    name: clean(raw?.name || raw?.nome || `Organização ${idx + 1}`),
    organization_type: clean(raw?.organization_type || raw?.tipo_organizacao),
    acronym: clean(raw?.acronym || raw?.sigla),
    jurisdiction_level: clean(raw?.jurisdiction_level || raw?.nivel_jurisdicao),
    feature_codes: normalizeFeatureCodes(raw?.feature_codes),
    created_at: clean(raw?.created_at) || null,
    updated_at: clean(raw?.updated_at) || null,
  };
}

function normalizeFeatureCatalogItem(raw: any, idx = 0): FeatureCatalogItem {
  const code = normalizeFeatureCode(raw?.code || raw?.feature_code || raw?.id || `feature-${idx}`);
  const rawName = clean(raw?.name || raw?.label || code || `Feature ${idx + 1}`);
  return {
    code,
    name: getFeatureDisplayName(code, rawName),
    category: clean(raw?.category || raw?.group || "other").toLowerCase() || "other",
    description: clean(raw?.description) || null,
  };
}

function getFeatureDisplayName(code: string, fallback = "") {
  const normalized = normalizeFeatureCode(code);
  if (!normalized) return clean(fallback) || "-";

  const mapped = FEATURE_DISPLAY_NAMES[normalized];
  if (mapped) return mapped;

  const safeFallback = clean(fallback);
  if (safeFallback) return safeFallback;

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 4) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function normalizeCatalogValues(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return [...fallback];

  const seen = new Set<string>();
  const next: string[] = [];

  for (const item of value) {
    const normalized = clean(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }

  return next.length ? next : [...fallback];
}

function withCurrentValue(options: string[], currentValue: string) {
  const current = clean(currentValue);
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function featureCodesFromCatalog(codes: readonly string[], catalog: FeatureCatalogItem[]) {
  const wanted = new Set(codes);
  return catalog.filter((item) => wanted.has(item.code));
}

function featureFamilyKey(code: string) {
  const normalized = normalizeFeatureCode(code);
  if (isBairrosFeatureCode(normalized)) return BAIROS_FEATURE_FAMILY;
  if (normalized === "risp" || isRispFeatureCode(normalized)) return RISP_FEATURE_FAMILY;
  if (normalized === "aisp" || isAispFeatureCode(normalized)) return AISP_FEATURE_FAMILY;
  if (normalized === "cisp" || isCispFeatureCode(normalized)) return CISP_FEATURE_FAMILY;
  return "";
}

function sortFeatureCodes(codes: string[], catalog: FeatureCatalogItem[]) {
  const order = new Map(catalog.map((item, index) => [item.code, index]));
  return [...codes].sort((a, b) => {
    const diff = (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER);
    if (diff !== 0) return diff;
    return a.localeCompare(b, "pt-BR");
  });
}

function normalizeExclusiveFeatureCodes(codes: string[], catalog: FeatureCatalogItem[]) {
  const next: string[] = [];
  const seenFamilies = new Set<string>();

  for (const code of sortFeatureCodes(codes, catalog)) {
    const family = featureFamilyKey(code);

    if (family && seenFamilies.has(family)) continue;
    if (family) seenFamilies.add(family);
    next.push(code);
  }

  return next;
}

function getInitialForm(): OrganizationForm {
  return {
    name: "",
    organization_type: "",
    acronym: "",
    jurisdiction_level: "",
    feature_codes: [],
  };
}

function makeUpdatePayload(original: OrganizationForm | null, current: OrganizationForm) {
  const payload: Partial<OrganizationForm> = {};
  const keys: Array<keyof OrganizationForm> = [
    "name",
    "organization_type",
    "acronym",
    "jurisdiction_level",
  ];

  for (const key of keys) {
    const nextValue = clean(current[key]);
    const prevValue = clean(original?.[key] ?? "");
    if (nextValue && nextValue !== prevValue) {
      payload[key] = nextValue as never;
    }
  }

  if (!sameFeatureCodes(original?.feature_codes || [], current.feature_codes)) {
    payload.feature_codes = current.feature_codes;
  }

  return payload;
}

export function AdminOrganizationsPanel({
  apiBase,
  token,
  isMobile,
}: {
  apiBase: string;
  token: string;
  isMobile: boolean;
}) {
  const ORGS_URL = `${apiBase}/organizations`;
  const FEATURE_CATALOG_URL = `${apiBase}/organizations/feature-catalog`;
  const ORGANIZATION_CATALOGS_URL = `${apiBase}/organizations/catalogs`;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [organizationCatalogsLoading, setOrganizationCatalogsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [catalogErr, setCatalogErr] = useState<string | null>(null);
  const [organizationCatalogsErr, setOrganizationCatalogsErr] = useState<string | null>(null);
  const [items, setItems] = useState<AdminOrganization[]>([]);
  const [featureCatalog, setFeatureCatalog] = useState<FeatureCatalogItem[]>([]);
  const [organizationTypes, setOrganizationTypes] = useState<string[]>(FALLBACK_ORGANIZATION_TYPES);
  const [jurisdictionLevels, setJurisdictionLevels] = useState<string[]>(FALLBACK_JURISDICTION_LEVELS);

  const [orgTab, setOrgTab] = useState<"create" | "manage">("create");
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<OrganizationForm>(getInitialForm);
  const [originalForm, setOriginalForm] = useState<OrganizationForm | null>(null);
  const [manageFilter, setManageFilter] = useState("");
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(ADMIN_PAGE_SIZE);
  const [organizationTypeOpen, setOrganizationTypeOpen] = useState(false);
  const [jurisdictionLevelOpen, setJurisdictionLevelOpen] = useState(false);
  const organizationTypeWrapRef = useRef<HTMLDivElement | null>(null);
  const jurisdictionLevelWrapRef = useRef<HTMLDivElement | null>(null);

  const catalogItems = useMemo(() => {
    const source = featureCatalog.length ? [...featureCatalog, ...FALLBACK_FEATURE_CATALOG] : FALLBACK_FEATURE_CATALOG;
    return source.filter((item, index, array) => array.findIndex((candidate) => candidate.code === item.code) === index);
  }, [featureCatalog]);

  const layersItems = useMemo(() => featureCodesFromCatalog(LAYERS_FEATURE_CODES, catalogItems), [catalogItems]);
  const extractionWithItems = useMemo(() => featureCodesFromCatalog(EXTRACTION_WITH_CODES, catalogItems), [catalogItems]);
  const extractionWithoutItems = useMemo(() => featureCodesFromCatalog(EXTRACTION_WITHOUT_CODES, catalogItems), [catalogItems]);
  const toolsItems = useMemo(() => featureCodesFromCatalog(TOOLS_FEATURE_CODES, catalogItems), [catalogItems]);

  const organizationTypeOptions = useMemo(
    () => withCurrentValue(organizationTypes, form.organization_type),
    [organizationTypes, form.organization_type]
  );

  const jurisdictionLevelOptions = useMemo(
    () => withCurrentValue(jurisdictionLevels, form.jurisdiction_level),
    [jurisdictionLevels, form.jurisdiction_level]
  );

  function setField<K extends keyof OrganizationForm>(key: K, value: OrganizationForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFeature(code: string) {
    setForm((prev) => {
      const exists = prev.feature_codes.includes(code);
      const family = featureFamilyKey(code);
      let nextCodes = exists ? prev.feature_codes.filter((item) => item !== code) : [...prev.feature_codes, code];

      if (!exists && family) {
        nextCodes = nextCodes.filter((item) => featureFamilyKey(item) !== family || item === code);
      }

      return {
        ...prev,
        feature_codes: normalizeExclusiveFeatureCodes(nextCodes, catalogItems),
      };
    });
  }

  function resetForm(opts?: { clearMessages?: boolean }) {
    setId(null);
    setForm(getInitialForm());
    setOriginalForm(null);
    setOrganizationTypeOpen(false);
    setJurisdictionLevelOpen(false);
    if (opts?.clearMessages !== false) {
      setErr(null);
      setSuccess(null);
    }
  }

  function applyOrganization(org: AdminOrganization) {
    const normalized: OrganizationForm = {
      name: clean(org.name),
      organization_type: clean(org.organization_type),
      acronym: clean(org.acronym),
      jurisdiction_level: clean(org.jurisdiction_level),
      feature_codes: normalizeExclusiveFeatureCodes(normalizeFeatureCodes(org.feature_codes), catalogItems),
    };
    setId(clean(org.id) || null);
    setForm(normalized);
    setOriginalForm(normalized);
    setOrganizationTypeOpen(false);
    setJurisdictionLevelOpen(false);
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await fetchJson<any>(ORGS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
        ? data.results
        : [];

      setItems(list.map((raw: any, idx: number) => normalizeOrganization(raw, idx)));
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar organizações");
    } finally {
      setLoading(false);
    }
  }

  async function loadFeatureCatalog() {
    setCatalogErr(null);
    setCatalogLoading(true);
    try {
      const data = await fetchJson<any>(FEATURE_CATALOG_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
        ? data.results
        : [];

      setFeatureCatalog(list.map((raw: any, idx: number) => normalizeFeatureCatalogItem(raw, idx)));
    } catch (e: any) {
      setCatalogErr(e?.message || "Erro ao carregar catálogo de features");
      setFeatureCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadOrganizationCatalogs() {
    setOrganizationCatalogsErr(null);
    setOrganizationCatalogsLoading(true);
    try {
      const data = await fetchJson<any>(ORGANIZATION_CATALOGS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setOrganizationTypes(normalizeCatalogValues(data?.organization_types, FALLBACK_ORGANIZATION_TYPES));
      setJurisdictionLevels(normalizeCatalogValues(data?.jurisdiction_levels, FALLBACK_JURISDICTION_LEVELS));
    } catch (e: any) {
      setOrganizationCatalogsErr(e?.message || "Erro ao carregar catálogos da organização");
      setOrganizationTypes([...FALLBACK_ORGANIZATION_TYPES]);
      setJurisdictionLevels([...FALLBACK_JURISDICTION_LEVELS]);
    } finally {
      setOrganizationCatalogsLoading(false);
    }
  }

  async function loadOne(orgId: string) {
    if (!orgId) return;
    setErr(null);
    setDetailLoading(true);
    try {
      const data = await fetchJson<any>(`${ORGS_URL}/${encodeURIComponent(orgId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      applyOrganization(normalizeOrganization(data));
    } catch {
      // Mantém dados já conhecidos caso o detalhe não exista.
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadFeatureCatalog();
    void loadOrganizationCatalogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;

      const typeEl = organizationTypeWrapRef.current;
      const jurisdictionEl = jurisdictionLevelWrapRef.current;

      if (typeEl && !typeEl.contains(target)) setOrganizationTypeOpen(false);
      if (jurisdictionEl && !jurisdictionEl.contains(target)) setJurisdictionLevelOpen(false);
    }

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  useEffect(() => {
    setPage(1);
    setMobileCount(ADMIN_PAGE_SIZE);
  }, [items.length, manageFilter]);

  const filteredItems = useMemo(() => {
    const q = manageFilter.trim().toLowerCase();
    if (!q) return items;

    return items.filter((org) => {
      return (
        clean(org.id).toLowerCase().includes(q) ||
        clean(org.name).toLowerCase().includes(q) ||
        clean(org.organization_type).toLowerCase().includes(q) ||
        clean(org.acronym).toLowerCase().includes(q) ||
        clean(org.jurisdiction_level).toLowerCase().includes(q) ||
        org.feature_codes.some((code) => code.includes(q) || getFeatureDisplayName(code).toLowerCase().includes(q))
      );
    });
  }, [items, manageFilter]);

  async function save() {
    setErr(null);
    setSuccess(null);

    const editingId = id;
    const current: OrganizationForm = {
      name: clean(form.name),
      organization_type: clean(form.organization_type),
      acronym: clean(form.acronym),
      jurisdiction_level: clean(form.jurisdiction_level),
      feature_codes: normalizeExclusiveFeatureCodes(normalizeFeatureCodes(form.feature_codes), catalogItems),
    };

    if (!editingId) {
      if (!current.name || !current.organization_type || !current.acronym || !current.jurisdiction_level) {
        setErr("Preencha todos os campos: nome, tipo, sigla e nível de jurisdição.");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        const payload = makeUpdatePayload(originalForm, current);
        if (!Object.keys(payload).length) {
          setSuccess("Nenhuma alteração para salvar.");
          setSaving(false);
          return;
        }

        await fetchJson(`${ORGS_URL}/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(ORGS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(current),
        });
      }

      setSuccess(editingId ? "Organização atualizada com sucesso." : "Organização criada com sucesso.");
      await load();
      if (editingId) {
        await loadOne(editingId);
      } else {
        resetForm({ clearMessages: false });
      }
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar organização");
    } finally {
      setSaving(false);
    }
  }

  function pick(org: AdminOrganization) {
    setOrgTab("create");
    applyOrganization(org);
    if (org.id) {
      void loadOne(org.id);
    }
  }

  async function removeOrganization(org: AdminOrganization) {
    const orgId = clean(org.id);
    if (!orgId) return;

    const displayName = clean(org.name) || orgId;
    const ok = confirm(`Excluir organização "${displayName}"?`);
    if (!ok) return;

    setErr(null);
    setSuccess(null);

    try {
      await fetchJson(`${ORGS_URL}/${encodeURIComponent(orgId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (id === orgId) {
        resetForm({ clearMessages: false });
      }
      setSuccess("Organização excluída com sucesso.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Erro ao excluir organização");
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {!isMobile ? (
        <div className="tabsRail tabsRailSection tabsRailCompact">
          <button className={`subTab ${orgTab === "create" ? "subTabActive" : ""}`} onClick={() => setOrgTab("create")}>
            Criar Organização
          </button>
          <button className={`subTab ${orgTab === "manage" ? "subTabActive" : ""}`} onClick={() => setOrgTab("manage")}>
            Gerenciar Organizações
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 16,
            border: "1px solid rgba(10,40,75,0.08)",
            background: "rgba(255,255,255,0.88)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "rgba(10,40,75,0.58)" }}>MODO</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "create" as const, label: "Criar Organização" },
              { key: "manage" as const, label: "Gerenciar Organizações" },
            ].map((option) => {
              const active = orgTab === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setOrgTab(option.key)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: active ? "1px solid rgba(10,40,75,0.16)" : "1px solid rgba(15,23,42,0.12)",
                    background: active ? "rgba(10,40,75,0.10)" : "rgba(255,255,255,0.96)",
                    color: active ? "#0a284b" : "rgba(10,40,75,0.76)",
                    fontSize: 11,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {orgTab === "create" && (
        <div
          className="adminCard"
          style={{
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,255,255,0.90)",
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>
            {id ? "Editar organização" : "Criar organização"}
          </div>

          <div
            className="adminGrid2"
            style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}
          >
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="nome da organização"
              style={inputStyle()}
            />
            <div className="customSelect" ref={organizationTypeWrapRef}>
              <button
                type="button"
                className="customSelectBtn"
                onClick={() => {
                  setOrganizationTypeOpen((v) => {
                    const next = !v;
                    if (next) setJurisdictionLevelOpen(false);
                    return next;
                  });
                }}
                style={{ fontWeight: 500 }}
              >
                <span>{form.organization_type || (organizationCatalogsLoading ? "Carregando tipos..." : "tipo da organização")}</span>
                <span className="customSelectChevron" />
              </button>
              {organizationTypeOpen && (
                <div className="customSelectMenu">
                  {organizationTypeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`customSelectItem ${form.organization_type === option ? "customSelectItemActive" : ""}`}
                      onClick={() => {
                        setField("organization_type", option);
                        setOrganizationTypeOpen(false);
                      }}
                      style={{ fontWeight: 500 }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              value={form.acronym}
              onChange={(e) => setField("acronym", e.target.value)}
              placeholder="sigla"
              style={inputStyle()}
            />
            <div className="customSelect" ref={jurisdictionLevelWrapRef}>
              <button
                type="button"
                className="customSelectBtn"
                onClick={() => {
                  setJurisdictionLevelOpen((v) => {
                    const next = !v;
                    if (next) setOrganizationTypeOpen(false);
                    return next;
                  });
                }}
                style={{ fontWeight: 500 }}
              >
                <span>
                  {form.jurisdiction_level || (organizationCatalogsLoading ? "Carregando níveis..." : "nível de jurisdição")}
                </span>
                <span className="customSelectChevron" />
              </button>
              {jurisdictionLevelOpen && (
                <div className="customSelectMenu">
                  {jurisdictionLevelOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`customSelectItem ${form.jurisdiction_level === option ? "customSelectItemActive" : ""}`}
                      onClick={() => {
                        setField("jurisdiction_level", option);
                        setJurisdictionLevelOpen(false);
                      }}
                      style={{ fontWeight: 500 }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {organizationCatalogsErr && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#92400e" }}>
              {organizationCatalogsErr}. Usando catálogo local para os campos da organização.
            </div>
          )}

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {catalogErr && (
              <div style={{ fontSize: 11, color: "#92400e" }}>
                {catalogErr}. Usando catálogo local para edição.
              </div>
            )}

            {[
              {
                key: "layers",
                columns: "1fr",
                sections: [{ key: "layers", title: "Camadas", items: layersItems, columns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }],
              },
                {
                  key: "extraction",
                  columns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                  sections: [
                  { key: "without-extraction", title: "Sem extração de dados", items: extractionWithoutItems, columns: "1fr" },
                  { key: "with-extraction", title: "Com extração de dados", items: extractionWithItems, columns: "1fr", tone: "danger" },
                  ],
                },
              {
                key: "tools",
                columns: "1fr",
                sections: [{ key: "tools", title: "Ferramentas", items: toolsItems, columns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }],
              },
            ].map((group) => (
              <div
                key={group.key}
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: group.columns,
                }}
              >
                {group.sections.map((section) => (
                  <div
                    key={section.title}
                    style={{
                      padding: 8,
                      borderRadius: 14,
                      border:
                        section.title === "Ferramentas"
                          ? "1px solid rgba(0,0,0,0.08)"
                          : group.key === "extraction"
                            ? "1px solid rgba(0,0,0,0.08)"
                            : "1px solid rgba(0,0,0,0.08)",
                      background:
                        group.key === "extraction"
                          ? section.tone === "danger"
                            ? "linear-gradient(180deg, rgba(254,242,242,0.96) 0%, rgba(255,241,241,0.88) 100%)"
                            : "rgba(248,250,252,0.86)"
                          : "rgba(248,250,252,0.86)",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color:
                            group.key === "extraction"
                              ? section.tone === "danger"
                                ? "#991b1b"
                                : "rgba(0,0,0,0.78)"
                              : "rgba(0,0,0,0.78)",
                        }}
                      >
                        {section.title}
                      </div>
                      <div
                        data-testid={`organization-section-count-${group.key}-${section.key}`}
                        style={{ fontSize: 11, opacity: 0.72 }}
                      >
                        {catalogLoading ? "Carregando catálogo..." : `${section.items.filter((item) => form.feature_codes.includes(item.code)).length} selecionada(s)`}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 6,
                        gridTemplateColumns: section.columns,
                      }}
                    >
                      {section.items.map((feature) => {
                        const active = form.feature_codes.includes(feature.code);
                        const icon = FEATURE_CARD_ICONS[feature.code] || { kind: "lucide", Icon: Building2 };
                        const isDesenharArea = feature.code === "desenhar_area";
                        return (
                          <div
                            key={feature.code}
                            style={
                              isMobile && isDesenharArea
                                ? {
                                    display: "grid",
                                    gap: 4,
                                    gridTemplateRows: "12px 48px",
                                    width: "100%",
                                  }
                                : { position: "relative", overflow: "visible", width: "100%" }
                            }
                            >
                            {isMobile && isDesenharArea ? (
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 900,
                                  color: "#991b1b",
                                  lineHeight: 1.1,
                                  whiteSpace: "nowrap",
                                  pointerEvents: "none",
                                  alignSelf: "end",
                                }}
                              >
                                Com extração de dados
                              </div>
                            ) : (
                              isDesenharArea && (
                                <div
                                  style={{
                                    position: "absolute",
                                    left: 2,
                                    top: -16,
                                    fontSize: 11,
                                    fontWeight: 900,
                                    color: "#991b1b",
                                    lineHeight: 1.1,
                                    whiteSpace: "nowrap",
                                    pointerEvents: "none",
                                  }}
                                >
                                  Com extração de dados
                                </div>
                              )
                            )}
                            <button
                              type="button"
                              onClick={() => toggleFeature(feature.code)}
                              data-testid={`organization-feature-${feature.code}`}
                              data-feature-code={feature.code}
                              data-active={active ? "true" : "false"}
                              aria-pressed={active}
                              style={{
                                position: "relative",
                                textAlign: "left",
                                width: "100%",
                                minWidth: 0,
                                boxSizing: "border-box",
                                padding: isMobile ? "11px 13px" : "11px 12px",
                                height: 48,
                                borderRadius: 10,
                                border: isDesenharArea
                                  ? active
                                    ? "1px solid rgba(185,28,28,0.34)"
                                    : "1px solid rgba(220,38,38,0.12)"
                                  : active
                                    ? group.key === "extraction"
                                      ? section.tone === "danger"
                                        ? "1px solid rgba(185,28,28,0.34)"
                                        : "1px solid rgba(37,99,235,0.32)"
                                      : "1px solid rgba(37,99,235,0.32)"
                                    : "1px solid rgba(0,0,0,0.10)",
                                background: active
                                  ? isDesenharArea
                                    ? "rgba(254,226,226,0.90)"
                                    : group.key === "extraction" && section.tone === "danger"
                                      ? "rgba(254,226,226,0.92)"
                                      : "rgba(219,234,254,0.82)"
                                  : isDesenharArea
                                    ? "linear-gradient(180deg, rgba(254,242,242,0.96) 0%, rgba(255,241,241,0.88) 100%)"
                                    : "rgba(255,255,255,0.92)",
                                color: "rgba(15,23,42,0.88)",
                                cursor: "pointer",
                                display: "grid",
                                gap: 0,
                              }}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 999,
                                    border: "1px solid rgba(15,23,42,0.10)",
                                    background: "rgba(255,255,255,0.88)",
                                    display: "grid",
                                    placeItems: "center",
                                    flex: "0 0 auto",
                                    color: active ? "#0f172a" : "rgba(15,23,42,0.68)",
                                  }}
                                >
                                  {icon.kind === "image" ? (
                                    <img src={icon.src} alt="" style={{ width: 10, height: 10, objectFit: "contain", opacity: 0.9 }} />
                                  ) : (
                                    <icon.Icon size={11} strokeWidth={2.1} />
                                  )}
                                </span>
                                <span style={{ fontSize: isMobile ? 12.5 : 12, fontWeight: 900, lineHeight: 1.1 }}>{feature.name}</span>
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(10,40,75,0.18)",
                background: "rgba(10,40,75,0.92)",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 900,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Salvando..." : id ? "Salvar alterações" : "Criar organização"}
            </button>

            <button
              onClick={() => resetForm()}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(10,40,75,0.82)",
                background: "rgba(255,255,255,0.96)",
                cursor: "pointer",
                fontWeight: 900,
                color: "#0a284b",
              }}
            >
              Limpar
            </button>
          </div>

          {detailLoading && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Carregando detalhes...</div>}
          {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
          {success && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#166534" }}>{success}</div>}
        </div>
      )}

      {orgTab === "manage" && (
        <div
          className="adminCard"
          style={{
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,255,255,0.90)",
            border: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Organizações</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {loading ? "Carregando..." : `${filteredItems.length} de ${items.length} itens`}
            </div>
          </div>

          <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={manageFilter}
              onChange={(e) => setManageFilter(e.target.value)}
              placeholder="Filtrar por nome, tipo, sigla, jurisdição, ID ou feature"
              style={{ ...inputStyle(), flex: 1, minWidth: 0 }}
            />
            <button
              onClick={() => {
                void load();
                void loadFeatureCatalog();
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "1px solid rgba(10,40,75,0.82)",
                background: "rgba(255,255,255,0.96)",
                cursor: "pointer",
                color: "#0a284b",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
              title="Recarregar organizações e catálogo"
              aria-label="Recarregar organizações e catálogo"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div
            className="scrollbarHidden"
            style={{ display: "grid", gap: 8, maxHeight: "50vh", overflow: "auto" }}
            onScroll={(e) => {
              if (!isMobile) return;
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                setMobileCount((v) => v + ADMIN_PAGE_SIZE);
              }
            }}
          >
            {(isMobile
              ? filteredItems.slice(0, mobileCount)
              : filteredItems.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE)
            ).map((org) => (
              <div
                key={org.id}
                className="adminRow"
                style={{
                  border: "1px solid rgba(0,0,0,0.10)",
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.75)",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 13,
                        whiteSpace: "normal",
                        overflow: "visible",
                        textOverflow: "clip",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {org.name || "Organização"}
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 800,
                        border: "1px solid rgba(15,23,42,0.14)",
                        background: "rgba(241,245,249,0.95)",
                        color: "#334155",
                      }}
                    >
                      {org.acronym || "-"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.75,
                      marginTop: 2,
                      whiteSpace: "normal",
                      overflow: "visible",
                      textOverflow: "clip",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    Tipo: {org.organization_type || "-"} • Jurisdição: {org.jurisdiction_level || "-"}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {org.feature_codes.length ? (
                      org.feature_codes.map((code) => (
                        <span
                          key={code}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: 999,
                            padding: "2px 8px",
                            fontSize: 10,
                            fontWeight: 800,
                            border: "1px solid rgba(37,99,235,0.16)",
                            background: "rgba(219,234,254,0.92)",
                            color: "#1d4ed8",
                          }}
                        >
                          {getFeatureDisplayName(code)}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 11, opacity: 0.68 }}>Sem features configuradas</span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.68,
                      marginTop: 6,
                      whiteSpace: "normal",
                      overflow: "visible",
                      textOverflow: "clip",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    {org.created_at ? `Criada em ${formatDateTime(org.created_at)}` : ""}
                    {org.updated_at ? ` • Atualizada em ${formatDateTime(org.updated_at)}` : ""}
                  </div>
                </div>

                <button
                  onClick={() => pick(org)}
                  className="adminRowBtn"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(10,40,75,0.82)",
                    background: "rgba(255,255,255,0.96)",
                    cursor: "pointer",
                    fontWeight: 900,
                    color: "#0a284b",
                    flex: "0 0 auto",
                  }}
                >
                  Editar
                </button>

                <button
                  onClick={() => void removeOrganization(org)}
                  className="adminRowBtn"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(239,68,68,0.12)",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontWeight: 900,
                    flex: "0 0 auto",
                  }}
                >
                  Excluir
                </button>
              </div>
            ))}

            {!filteredItems.length && !loading && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Nenhuma organização encontrada para esse filtro.</div>
            )}
          </div>

          {!isMobile && filteredItems.length > ADMIN_PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
              <button
                className="btnGhost"
                onClick={() => setPage((v) => Math.max(1, v - 1))}
                disabled={page <= 1}
                style={{ opacity: page <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Página {page} de {Math.max(1, Math.ceil(filteredItems.length / ADMIN_PAGE_SIZE))}
              </div>
              <button
                className="btnGhost"
                onClick={() => setPage((v) => Math.min(Math.ceil(filteredItems.length / ADMIN_PAGE_SIZE), v + 1))}
                disabled={page >= Math.ceil(filteredItems.length / ADMIN_PAGE_SIZE)}
                style={{ opacity: page >= Math.ceil(filteredItems.length / ADMIN_PAGE_SIZE) ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          )}

          {err && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#991b1b" }}>{err}</div>}
          {success && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, color: "#166534" }}>{success}</div>}
        </div>
      )}
    </div>
  );
}
