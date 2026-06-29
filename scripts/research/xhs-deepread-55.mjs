import puppeteer from 'puppeteer-core';

async function run() {
  const ver = await (await fetch('http://localhost:9222/json/version')).json();
  const browser = await puppeteer.connect({
    browserWSEndpoint: ver.webSocketDebuggerUrl
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  // Deep-read specific high-signal posts we identified
  const POSTS_TO_READ = [
    // "8B小模型+护栏=99%准确率？" - guardrails effect
    'https://www.xiaohongshu.com/search_result?keyword=8B%E5%B0%8F%E6%A8%A1%E5%9E%8B+%E6%8A%A4%E6%A0%8F+99&source=web_search_result_notes',
    // "Agent Eval 是近中期的技术护城河" - eval as moat
    'https://www.xiaohongshu.com/search_result?keyword=Agent+Eval+%E6%8A%80%E6%9C%AF%E6%8A%A4%E5%9F%8E%E6%B2%B3&source=web_search_result_notes',
    // Loop Engineering 最新
    'https://www.xiaohongshu.com/search_result?keyword=Loop+Engineering+%E6%9C%80%E6%96%B0+%E5%AE%9E%E6%88%98&source=web_search_result_notes'
  ];
  
  for (const url of POSTS_TO_READ) {
    console.log(`\n=== PAGE: ${decodeURIComponent(url.split('keyword=')[1]?.split('&')[0] || url)} ===`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 3000));
      
      // Scroll
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 700));
        await new Promise(r => setTimeout(r, 1500));
      }
      
      const content = await page.evaluate(() => {
        const items = [];
        // Try to get post titles and engagement
        document.querySelectorAll('section.note-item, [class*="note-item"], [data-note-id]').forEach(el => {
          const title = el.querySelector('[class*="title"], .title')?.textContent?.trim();
          const likes = el.querySelector('[class*="like-wrapper"] span, [class*="count"]')?.textContent?.trim();
          const author = el.querySelector('[class*="author"], [class*="name"]')?.textContent?.trim();
          if (title && title.length > 3) {
            items.push({ title: title.substring(0, 180), likes: likes || '?', author: author || '?' });
          }
        });
        
        if (items.length === 0) {
          // Try alternate selectors for feed items
          document.querySelectorAll('[class*="feeds-page"] a, [class*="note"] a').forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 8 && text.length < 200 && !items.find(i => i.title === text)) {
              items.push({ title: text.substring(0, 180), likes: '?', author: '?' });
            }
          });
        }
        
        return items.slice(0, 20);
      });
      
      content.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — ${p.author}`));
      if (content.length === 0) {
        const body = await page.evaluate(() => document.body?.innerText?.substring(0, 400));
        console.log('  Empty. Body:', body?.substring(0, 200));
      }
    } catch(e) {
      console.log(`  Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  
  await page.close();
}

run().catch(e => console.error('Fatal:', e));
