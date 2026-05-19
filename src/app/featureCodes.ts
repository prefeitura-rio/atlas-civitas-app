const FEATURE_CODE_ALIASES: Record<string, string> = {
  camera: "cameras",
  camera_inteligente: "cameras_inteligentes",
  camera_inteligentes: "cameras_inteligentes",
  camera_lpr: "cameras_lpr",
  lpr: "cameras_lpr",
  radar: "radares",
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractFeatureCode(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const raw = value as Record<string, unknown>;
  return cleanString(raw.code || raw.feature_code || raw.featureCode || raw.value);
}

function canonicalizeFeatureCode(value: string) {
  const compact = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");

  return FEATURE_CODE_ALIASES[compact] ?? compact;
}

export function normalizeFeatureCode(value: unknown) {
  const raw = extractFeatureCode(value);
  if (!raw) return "";
  return canonicalizeFeatureCode(raw.trim());
}

export function normalizeFeatureCodes(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const next: string[] = [];

  for (const item of value) {
    const code = normalizeFeatureCode(item);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    next.push(code);
  }

  return next;
}
