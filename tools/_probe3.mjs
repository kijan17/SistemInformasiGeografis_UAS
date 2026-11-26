import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:5173/?view=tentang", { waitUntil:"networkidle" });
await p.waitForSelector("#tentang .dict");
console.log(JSON.stringify(await p.evaluate(() => {
  const w=document.querySelector('.dict-wrap'), t=document.querySelector('.dict');
  return { docScrollW: document.documentElement.scrollWidth, innerW: innerWidth, wrap:{cw:w.clientWidth,sw:w.scrollWidth}, tableW:t.getBoundingClientRect().width };
}),null,2));
await p.locator('.dict-wrap').screenshot({ path:'design/screenshots/_dict.png' });
await b.close();
