import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

let cachedEnv: Record<string, string> | null = null;

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {};

  const raw = fs.readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function loadLocalEnv() {
  if (cachedEnv) return cachedEnv;

  const cwd = process.cwd();
  cachedEnv = {
    ...parseEnvFile(path.join(cwd, ".env")),
  };

  return cachedEnv;
}

function readEnv(name: string) {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;

  const fromFile = loadLocalEnv()[name]?.trim();
  if (fromFile) return fromFile;

  return "";
}

function requireEnv(name: string) {
  const value = readEnv(name);
  if (value) return value;
  throw new Error(`Variável ${name} não encontrada no ambiente ou arquivos .env locais.`);
}

function getConfig() {
  return {
    loginEmail: requireEnv("E2E_LOGIN_EMAIL"),
    loginPassword: requireEnv("E2E_LOGIN_PASSWORD"),
  };
}

function buildRunId() {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `${timestamp}${random}`;
}

async function login(page: any, config: ReturnType<typeof getConfig>) {
  await page.goto("/login");
  await page.getByPlaceholder("email@prefeitura.rio").fill(config.loginEmail);
  await page.getByPlaceholder("********").fill(config.loginPassword);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page).toHaveURL(/\/map$/);
}

async function acceptBrowserDialog(page: any) {
  const dialogPromise = page.waitForEvent("dialog");
  return dialogPromise.then((dialog: any) => dialog.accept());
}

async function activateOrganizationFeature(page: any, featureCode: string) {
  const featureButton = page.getByTestId(`organization-feature-${featureCode}`);
  await expect(featureButton).toBeVisible();
  await featureButton.scrollIntoViewIfNeeded();

  if ((await featureButton.getAttribute("data-active")) === "true") {
    return;
  }

  await featureButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });

  await expect
    .poll(async () => featureButton.getAttribute("data-active"), {
      timeout: 5_000,
    })
    .toBe("true");
  await expect(featureButton).toHaveAttribute("aria-pressed", "true");
}

test("organization lifecycle test", async ({ page }) => {
  const config = getConfig();
  const runId = buildRunId();
  const organizationName = `Organizacao teste ${runId.slice(-4)}`;
  const updatedOrganizationName = `${organizationName} editada`;
  const acronym = `OT${runId.slice(-3)}`;
  const layerCodes = [
    "cameras",
    "cameras_inteligentes",
    "cameras_lpr",
    "radares",
  ];
  const extractionCodes = [
    "bairros_com_extracao_dados",
    "risp_com_extracao_dados",
    "aisp_com_extracao_dados",
    "cisp_com_extracao_dados",
  ];
  const toolCodes = [
    "gps",
    "desenhar_area",
  ];

  await login(page, config);

  await page.getByRole("button", { name: "ADMINISTRADOR", exact: true }).click();
  await expect(page.getByText("Administrador", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Organizações", exact: true }).click();
  await page.getByRole("button", { name: "Criar Organização", exact: true }).click();

  await page.getByPlaceholder("nome da organização").fill(organizationName);
  await page.getByRole("button", { name: /tipo da organização/i }).click();
  const organizationTypeOption = page.locator(".customSelectMenu .customSelectItem").first();
  await expect(organizationTypeOption).toBeVisible();
  await organizationTypeOption.click();

  await page.getByPlaceholder("sigla").fill(acronym);
  await page.getByRole("button", { name: /nível de jurisdição/i }).click();
  const jurisdictionOption = page.locator(".customSelectMenu .customSelectItem").first();
  await expect(jurisdictionOption).toBeVisible();
  await jurisdictionOption.click();

  const layersCount = page.getByTestId("organization-section-count-layers-layers");
  const extractionCount = page.getByTestId("organization-section-count-extraction-with-extraction");
  const toolsCount = page.getByTestId("organization-section-count-tools-tools");

  for (const featureCode of layerCodes) {
    await activateOrganizationFeature(page, featureCode);
  }
  await expect(layersCount).toHaveText("4 selecionada(s)");

  for (const featureCode of extractionCodes) {
    await activateOrganizationFeature(page, featureCode);
  }
  await expect(extractionCount).toHaveText("4 selecionada(s)");

  for (const featureCode of toolCodes) {
    await activateOrganizationFeature(page, featureCode);
  }
  await expect(toolsCount).toHaveText("2 selecionada(s)");

  await page.locator("button", { hasText: "Criar organização" }).last().click();
  await expect(page.getByText("Organização criada com sucesso.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerenciar Organizações", exact: true }).click();
  const manageSearch = page.getByPlaceholder("Filtrar por nome, tipo, sigla, jurisdição, ID ou feature");
  await manageSearch.fill(organizationName);

  const createdRow = page.locator(".adminRow").filter({ hasText: organizationName }).first();
  await expect(createdRow).toBeVisible();
  await expect(createdRow).toContainText("Câmeras");
  await expect(createdRow).toContainText("RISP com extração de dados");
  await expect(createdRow).toContainText("GPS");
  await createdRow.getByRole("button", { name: "Editar", exact: true }).click();

  await expect(page.getByText("Editar organização", { exact: true })).toBeVisible();
  await page.getByPlaceholder("nome da organização").fill(updatedOrganizationName);
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByText("Organização atualizada com sucesso.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerenciar Organizações", exact: true }).click();
  await manageSearch.fill(updatedOrganizationName);

  const updatedRow = page.locator(".adminRow").filter({ hasText: updatedOrganizationName }).first();
  await expect(updatedRow).toBeVisible();

  const deleteDialog = acceptBrowserDialog(page);
  await updatedRow.getByRole("button", { name: "Excluir", exact: true }).click();
  await deleteDialog;
  await expect(page.getByText("Organização excluída com sucesso.", { exact: true })).toBeVisible();
  await expect(page.locator(".adminRow").filter({ hasText: updatedOrganizationName })).toHaveCount(0);
});
