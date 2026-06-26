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
    ...parseEnvFile(path.join(cwd, ".env"))
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
    organizationName: requireEnv("E2E_EXISTING_ORGANIZATION_QUERY"),
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

async function login(page: any, config: ReturnType<typeof getConfig>) {
  await page.goto("/login");
  await page.getByPlaceholder("email@prefeitura.rio").fill(config.loginEmail);
  await page.getByPlaceholder("********").fill(config.loginPassword);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page).toHaveURL(/\/map$/);
}

async function selectOrganization(page: any, organizationName: string) {
  await page.getByRole("button", { name: /órgão \/ organização/i }).click();

  const filterInput = page.getByPlaceholder("Filtrar organização...");
  await expect(filterInput).toBeVisible();
  await filterInput.fill(organizationName);

  const exactOption = page.locator(".customSelectItem").filter({ hasText: organizationName }).first();
  await expect(exactOption).toBeVisible();
  await exactOption.click();
}

async function acceptBrowserDialog(page: any) {
  const dialogPromise = page.waitForEvent("dialog");
  return dialogPromise.then((dialog: any) => dialog.accept());
}

test("user creation test", async ({ page }) => {
  const config = getConfig();
  const runId = buildRunId();
  const shortId = runId.slice(-4).toLowerCase();
  const fakeName = "Usuario de teste";
  const fakeEmail = `usuarioteste.${shortId}@prefeitura.rio`;
  const fakeCpf = buildCpf(runId);
  const fakeMatricula = `MAT${runId.slice(-6)}`;

  await login(page, config);

  await page.getByRole("button", { name: "ADMINISTRADOR", exact: true }).click();
  await expect(page.getByText("Administrador", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Usuários", exact: true }).click();
  await page.getByRole("button", { name: "Criar Usuário", exact: true }).click();

  await page.getByPlaceholder("email").fill(fakeEmail);
  await page.getByPlaceholder("nome completo").fill(fakeName);
  await page.getByPlaceholder("CPF").fill(fakeCpf);
  await page.getByPlaceholder("senha (mín 8)").fill(config.loginPassword);
  await selectOrganization(page, config.organizationName);

  await page.locator("button", { hasText: "Criar usuário" }).last().click();
  await expect(page.getByText("Usuário criado com sucesso.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerenciar Usuários", exact: true }).click();
  const manageSearch = page.getByPlaceholder("Filtrar por nome, CPF, matrícula ou órgão");
  await manageSearch.fill(fakeCpf);

  const createdUserRow = page.locator(".adminRow").filter({ hasText: fakeEmail }).first();
  await expect(createdUserRow).toBeVisible();
  await expect(createdUserRow).toContainText(`CPF: ${fakeCpf}`);
  await expect(createdUserRow).not.toContainText("Matrícula:");
  await createdUserRow.getByRole("button", { name: "Editar", exact: true }).click();

  await expect(page.getByText("Editar usuário", { exact: true })).toBeVisible();
  await page.getByPlaceholder("CPF").fill("");
  await page.getByPlaceholder("Matrícula").fill(fakeMatricula);

  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByText("Usuário atualizado com sucesso.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gerenciar Usuários", exact: true }).click();
  await manageSearch.fill(fakeMatricula);

  const updatedUserRow = page.locator(".adminRow").filter({ hasText: fakeEmail }).first();
  await expect(updatedUserRow).toBeVisible();
  await expect(updatedUserRow).toContainText(`Matrícula: ${fakeMatricula}`);
  await expect(updatedUserRow).not.toContainText("CPF:");

  const deactivateDialog = acceptBrowserDialog(page);
  await updatedUserRow.getByRole("button", { name: "Desativar", exact: true }).click();
  await deactivateDialog;
  await expect(updatedUserRow).toContainText("INATIVO");
  await expect(updatedUserRow.getByRole("button", { name: "Reativar", exact: true })).toBeVisible();

  const reactivateDialog = acceptBrowserDialog(page);
  await updatedUserRow.getByRole("button", { name: "Reativar", exact: true }).click();
  await reactivateDialog;
  await expect(updatedUserRow).toContainText("ATIVO");
  await expect(updatedUserRow.getByRole("button", { name: "Desativar", exact: true })).toBeVisible();
});
