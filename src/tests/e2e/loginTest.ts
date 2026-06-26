import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type RealE2EConfig = {
  loginEmail: string;
  loginPassword: string;
  organizationName: string;
};

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
    ...parseEnvFile(path.join(cwd, ".env.local")),
    ...parseEnvFile(path.join(cwd, ".env.e2e.local")),
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

function getRealE2EConfig(): RealE2EConfig {
  return {
    loginEmail: requireEnv("E2E_LOGIN_EMAIL"),
    loginPassword: requireEnv("E2E_LOGIN_PASSWORD"),
    organizationName: requireEnv("E2E_EXISTING_ORGANIZATION_QUERY"),
  };
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

  const box = await termsBody.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 180));
    await page.mouse.down();
    await page.mouse.up();
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!(await disabledTermsRow.isVisible().catch(() => false))) break;

    await lastTermsPage.scrollIntoViewIfNeeded().catch(() => {});

    await termsBody.evaluate((element) => {
      const target = element as HTMLDivElement;
      target.scrollTop = target.scrollHeight;
      target.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 180));
      await page.mouse.wheel(0, Math.max(700, box.height));
    }

    await page.keyboard.press("End").catch(() => {});
    await page.keyboard.press("PageDown").catch(() => {});
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

  await expect(checkboxRow).toBeVisible();

  try {
    await checkbox.check();
  } catch {
    // Fallback: usa o row/input se o check() não conseguir concluir.
  }

  if (!(await checkbox.isChecked().catch(() => false))) {
    await checkboxRow.click({ force: true }).catch(() => {});
  }

  if (!(await checkbox.isChecked().catch(() => false))) {
    await checkboxInput.evaluate((element) => {
      const input = element as HTMLInputElement;
      if (input.disabled) {
        throw new Error("Checkbox de termos ainda está desabilitado.");
      }
      input.click();
    });
  }

  await expect(checkbox).toBeChecked();
  await expect(checkboxVisual).toHaveAttribute("data-checked", "true");
  await expect(acceptButton).toBeEnabled();
  await acceptButton.click();
  await expect(termsTitle).toBeHidden({ timeout: 15_000 });
}

async function loginIntoRealApp(page: Page) {
  const config = getRealE2EConfig();

  await page.goto("/login");
  await page.getByPlaceholder("email@prefeitura.rio").fill(config.loginEmail);
  await page.getByPlaceholder("********").fill(config.loginPassword);
  await page.getByRole("button", { name: "Login", exact: true }).click();

  try {
    await expect(page).not.toHaveURL(/\/login$/);
  } catch {
    const errorMessage = (await page.locator("main").textContent().catch(() => "")) || "";
    const normalized = errorMessage.replace(/\s+/g, " ").trim();
    throw new Error(
      normalized
        ? `Falha no login E2E: ${normalized}`
        : "Falha no login E2E: a aplicação permaneceu em /login."
    );
  }

  await acceptTermsIfVisible(page);
  await expect(page).toHaveURL(/\/map$/);
}

test("login test", async ({ page }) => {
  await loginIntoRealApp(page);

  await expect(page.getByRole("button", { name: "CENTRAL", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "PERFIL", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADMINISTRADOR", exact: true })).toBeVisible();

  await page.screenshot({
    path: "test-results/login-test-home.png",
    fullPage: true,
  });
});
