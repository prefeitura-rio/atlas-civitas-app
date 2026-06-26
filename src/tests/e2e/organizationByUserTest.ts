import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

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

function calculateCpfDigit(digits: number[]) {
  const factorStart = digits.length + 1;
  const total = digits.reduce((sum, digit, index) => {
    return sum + digit * (factorStart - index);
  }, 0);
  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

function buildCpf(seed: string) {
  const sourceDigits = seed.replace(/\D/g, "").padStart(9, "7").slice(-9);
  const baseDigits = sourceDigits.split("").map(Number);

  if (baseDigits.every((digit) => digit === baseDigits[0])) {
    baseDigits[8] = (baseDigits[8] + 1) % 10;
  }

  const firstDigit = calculateCpfDigit(baseDigits);
  const secondDigit = calculateCpfDigit([...baseDigits, firstDigit]);
  return [...baseDigits, firstDigit, secondDigit].join("");
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("email@prefeitura.rio").fill(email);
  await page.getByPlaceholder("********").fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function acceptTermsIfVisible(page: Page) {
  const termsTitle = page.getByRole("heading", { name: "TERMOS E CONDIÇÕES" });
  await page.waitForTimeout(300);

  if (!(await termsTitle.isVisible().catch(() => false))) return;

  const termsPage = page.locator(".termsPage").first();
  const termsBody = page.getByTestId("terms-scroll-container");
  const lastTermsPage = page.locator(".termsPage").last();
  const checkbox = page.getByRole("checkbox", { name: "Concordo com os termos e condições" });
  const checkboxRow = page.getByTestId("terms-agree-row");
  const checkboxInput = checkboxRow.locator('input[type="checkbox"]');
  const checkboxVisual = checkboxRow.locator(".termsCheck");
  const acceptButton = page.getByTestId("terms-accept-button");
  const termsHint = page.getByText("Role até o final do documento para habilitar o aceite.", { exact: true });
  const disabledTermsRow = page.locator(".termsRowDisabled");

  await termsPage.waitFor({ state: "visible" });
  await page.waitForTimeout(5000);
  await expect(termsBody).toBeVisible();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!(await disabledTermsRow.isVisible().catch(() => false))) break;

    await lastTermsPage.scrollIntoViewIfNeeded().catch(() => {});
    await termsBody.evaluate((element) => {
      const target = element as HTMLDivElement;
      target.scrollTop = target.scrollHeight;
      target.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.keyboard.press("End").catch(() => {});
    await page.keyboard.press("PageDown").catch(() => {});
    await page.waitForTimeout(220);
  }

  await expect
    .poll(async () => {
      const enabled = await checkbox.isEnabled().catch(() => false);
      const hintVisible = await termsHint.isVisible().catch(() => false);
      const rowDisabled = await disabledTermsRow.isVisible().catch(() => false);
      return enabled && !hintVisible && !rowDisabled;
    }, {
      timeout: 15_000,
    })
    .toBe(true);

  try {
    await checkbox.check();
  } catch {}

  if (!(await checkbox.isChecked().catch(() => false))) {
    await checkboxRow.click({ force: true }).catch(() => {});
  }

  if (!(await checkbox.isChecked().catch(() => false))) {
    await checkboxInput.evaluate((element) => {
      const input = element as HTMLInputElement;
      if (input.disabled) throw new Error("Checkbox de termos ainda está desabilitado.");
      input.click();
    });
  }

  await expect(checkbox).toBeChecked();
  await expect(checkboxVisual).toHaveAttribute("data-checked", "true");
  await expect(acceptButton).toBeEnabled();
  await acceptButton.click();
  await expect(termsTitle).toBeHidden({ timeout: 15_000 });
}

async function loginIntoMap(page: Page, email: string, password: string) {
  await login(page, email, password);
  await acceptTermsIfVisible(page);
  await expect(page).toHaveURL(/\/map$/);
}

async function activateOrganizationFeature(page: Page, featureCode: string) {
  const featureButton = page.getByTestId(`organization-feature-${featureCode}`);
  await expect(featureButton).toBeVisible();
  await featureButton.scrollIntoViewIfNeeded();

  if ((await featureButton.getAttribute("data-active")) === "true") return;

  await featureButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });

  await expect
    .poll(async () => featureButton.getAttribute("data-active"), {
      timeout: 5_000,
    })
    .toBe("true");
}

async function selectOrganization(page: Page, organizationName: string) {
  await page.getByRole("button", { name: /órgão \/ organização/i }).click();
  const filterInput = page.getByPlaceholder("Filtrar organização...");
  await expect(filterInput).toBeVisible();
  await filterInput.fill(organizationName);

  const exactOption = page.locator(".customSelectItem").filter({ hasText: organizationName }).first();
  await expect(exactOption).toBeVisible();
  await exactOption.click();
}

test("organization by user test", async ({ page }) => {
  const config = getConfig();
  const runId = buildRunId();
  const shortId = runId.slice(-4).toLowerCase();
  const organizationName = `Organizacao teste ${shortId}`;
  const acronym = `OU${runId.slice(-3)}`;
  const userName = "Usuario de teste";
  const userEmail = `usuarioteste.${shortId}@prefeitura.rio`;
  const userCpf = buildCpf(runId);

  const selectedOrganizationFeatureCodes = [
    "cameras",
    "radares",
    "bairros_com_extracao_dados",
    "gps",
  ];

  await loginIntoMap(page, config.loginEmail, config.loginPassword);

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

  for (const featureCode of selectedOrganizationFeatureCodes) {
    await activateOrganizationFeature(page, featureCode);
  }
  await expect(layersCount).toHaveText("2 selecionada(s)");
  await expect(extractionCount).toHaveText("1 selecionada(s)");
  await expect(toolsCount).toHaveText("1 selecionada(s)");

  await page.locator("button", { hasText: "Criar organização" }).last().click();
  await expect(page.getByText("Organização criada com sucesso.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerenciar Organizações", exact: true }).click();
  const organizationSearch = page.getByPlaceholder("Filtrar por nome, tipo, sigla, jurisdição, ID ou feature");
  await organizationSearch.fill(organizationName);
  const createdOrganizationRow = page.locator(".adminRow").filter({ hasText: organizationName }).first();
  await expect(createdOrganizationRow).toBeVisible();
  await expect(createdOrganizationRow).toContainText("Câmeras");
  await expect(createdOrganizationRow).toContainText("Radares");
  await expect(createdOrganizationRow).toContainText("Bairros com extração de dados");
  await expect(createdOrganizationRow).toContainText("GPS");

  await page.getByRole("button", { name: "Usuários", exact: true }).click();
  await page.getByRole("button", { name: "Criar Usuário", exact: true }).click();
  await page.getByPlaceholder("email").fill(userEmail);
  await page.getByPlaceholder("nome completo").fill(userName);
  await page.getByPlaceholder("CPF").fill(userCpf);
  await page.getByPlaceholder("senha (mín 8)").fill(config.loginPassword);
  await selectOrganization(page, organizationName);
  await page.locator("button", { hasText: "Criar usuário" }).last().click();
  await expect(page.getByText("Usuário criado com sucesso.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerenciar Usuários", exact: true }).click();
  const userSearch = page.getByPlaceholder("Filtrar por nome, CPF, matrícula ou órgão");
  await userSearch.fill(userEmail);
  const createdUserRow = page.locator(".adminRow").filter({ hasText: userEmail }).first();
  await expect(createdUserRow).toBeVisible();
  await expect(createdUserRow).toContainText(organizationName);

  await page.getByRole("button", { name: "SAIR", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await loginIntoMap(page, userEmail, config.loginPassword);

  await page.getByRole("button", { name: "CENTRAL", exact: true }).click();
  const dock = page.locator(".dock").first();
  await expect(dock).toBeVisible();
  await expect(dock.getByText("Camadas", { exact: true })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Câmeras", exact: true })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Radares", exact: true })).toBeVisible();
  await expect(dock.getByRole("button", { name: "Bairros", exact: true })).toBeVisible();
  await expect(dock.getByRole("button", { name: "GPS", exact: true })).toBeVisible();

  await expect(dock.getByRole("button", { name: "Super Câmeras Inteligentes", exact: true })).toHaveCount(0);
  await expect(dock.getByRole("button", { name: "LPR", exact: true })).toHaveCount(0);
  await expect(dock.getByRole("button", { name: "RISP", exact: true })).toHaveCount(0);
  await expect(dock.getByRole("button", { name: "AISP", exact: true })).toHaveCount(0);
  await expect(dock.getByRole("button", { name: "CISP", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "PERFIL", exact: true }).click();
  await expect(page.getByText(organizationName, { exact: true })).toBeVisible();
});
