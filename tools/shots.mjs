import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "design", "screenshots");
const base = process.env.APP_URL || "http://127.0.0.1:5173/";

const chrome =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
});

const problems = [];

async function prepare(page) {
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("#resultList .card", { timeout: 15000 });
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    document.getAnimations().forEach((animation) => {
      try {
        animation.finish();
      } catch {
        /* ignore infinite animations */
      }
    });
  });
}

async function shot(page, name, options = {}) {
  await page.waitForTimeout(450);
  await page.screenshot({
    path: path.join(outDir, name),
    ...options,
  });
  return name;
}

/* ------------------------------------------------------------------ desktop */
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: "id-ID",
  });
  const page = await context.newPage();
  await prepare(page);

  await shot(page, "explore-desktop.png");

  await page.click("#resultList .card");
  await page.waitForSelector("#detail.is-open");
  await page.waitForTimeout(700);
  await shot(page, "detail-desktop.png");

  await page.click("#detail [data-close]");
  await page.waitForTimeout(350);
  await page.goto(`${base}?view=insight`, { waitUntil: "networkidle" });
  await page.waitForSelector("#insight .choropleth-svg");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.getAnimations().forEach((animation) => {
      try {
        animation.finish();
      } catch {
        /* ignore */
      }
    });
  });
  await shot(page, "insight-desktop.png", { fullPage: true });

  await page.goto(`${base}?view=tentang`, { waitUntil: "networkidle" });
  await page.waitForSelector("#tentang .about-hero");
  await shot(page, "tentang-desktop.png", { fullPage: true });

  await context.close();
}

/* ------------------------------------------------------------------- mobile */
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "id-ID",
  });
  const page = await context.newPage();
  await prepare(page);

  await shot(page, "explore-mobile.png");

  await page.click("#sheetHandle");
  await page.waitForTimeout(500);
  await shot(page, "explore-mobile-full.png");

  await page.click("#resultList .card");
  await page.waitForSelector("#detail.is-open");
  await page.waitForTimeout(700);
  await shot(page, "detail-mobile.png");

  await page.click("#detail [data-close]");
  await page.waitForTimeout(350);
  await page.goto(`${base}?view=insight`, { waitUntil: "networkidle" });
  await page.waitForSelector("#insight .choropleth-svg");
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.getAnimations().forEach((animation) => {
      try {
        animation.finish();
      } catch {
        /* ignore */
      }
    });
  });
  await shot(page, "insight-mobile.png", { fullPage: true });

  await page.goto(`${base}?view=tentang`, { waitUntil: "networkidle" });
  await page.waitForSelector("#tentang .about-hero");
  await shot(page, "tentang-mobile.png", { fullPage: true });

  await context.close();
}

await browser.close();

console.log(
  JSON.stringify(
    {
      outDir,
      problems: [...new Set(problems)],
    },
    null,
    2
  )
);
