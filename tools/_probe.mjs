import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:5173/", { waitUntil:"networkidle" });
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const pick = (s) => { const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); const c=getComputedStyle(e); return {x:r.x,y:r.y,w:r.width,h:r.height,pos:c.position,top:c.top,bottom:c.bottom,height:c.height,transform:c.transform}; };
  return { header: pick('.topbar'), explore: pick('#explore'), shell: pick('#mapShell'), map: pick('#map'), panel: pick('#panel'), scroll: pick('#panelScroll'), bodyOverflow: getComputedStyle(document.body).overflow, scrollY: window.scrollY, innerH: innerHeight, vv: visualViewport ? {h:visualViewport.height, off:visualViewport.offsetTop} : null };
});
console.log(JSON.stringify(r,null,2));
await b.close();
