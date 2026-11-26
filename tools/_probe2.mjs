import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:"id-ID" });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:5173/?view=tentang", { waitUntil:"networkidle" });
await p.waitForSelector("#tentang .dict");
const metrics = await p.evaluate(() => {
  const w=document.querySelector('.dict-wrap'), t=document.querySelector('.dict');
  return { wrap: w ? {cw:w.clientWidth, sw:w.scrollWidth} : null, table:{w:t.getBoundingClientRect().width, minw:getComputedStyle(t).minWidth, display:getComputedStyle(t).display}, cols: Array.from(t.querySelectorAll('th')).map(th=>({text:th.textContent,w:th.getBoundingClientRect().width})) };
});
console.log(JSON.stringify(metrics,null,2));
await p.locator('.dict-wrap').screenshot({ path:'design/screenshots/_dict.png' });
await p.goto("http://127.0.0.1:5173/?view=insight", { waitUntil:"networkidle" });
await p.waitForSelector('.scatter');
await p.evaluate(()=>document.getAnimations().forEach(a=>{try{a.finish()}catch{}}));
await p.locator('.panel-card').nth(3).screenshot({ path:'design/screenshots/_scatter-mobile.png' });
await p.locator('.panel-card--wide').screenshot({ path:'design/screenshots/_choro-mobile.png' });
await b.close();
