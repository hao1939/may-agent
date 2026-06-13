import puppeteer from 'puppeteer-core';

const SEARCHES = [
  "AI agent 智能体 最新 2026 六月",
  "Claude Code 编程 agent 最新 2026 六月",
  "DeepSeek V4 模型 最新 2026 六月",
  "多智能体 multi-agent loop 自进化 2026",
  "AI 裁员 失业 求职 转型 FDE 2026 六月",
  "SkillHub skills 生态 agent 2026 最新",
  "vibe coding 结束 harness loop engineering 2026",
  "Qwen 开源 模型 最新 2026 六月",
  "AI安全 对齐 agent 治理 2026",
  "Claude Fable Mythos 封号 降智 2026 六月"
];

async function run() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222/devtools/browser/' + 
      (await (await fetch('http://localhost:9222/json/version')).json()).webSocketDebuggerUrl.split('/').pop()
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  const allResults = {};
  
  for (const query of SEARCHES) {
    console.log(`\n=== SEARCHING: ${query} ===`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      
      // Scroll to load more content
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 1500));
      }
      
      // Extract post data
      const posts = await page.evaluate(() => {
        const items = [];
        // Try multiple selectors for XHS search results
        const cards = document.querySelectorAll('section.note-item, div.note-item, a.cover, [data-v-a264b01a], .feeds-page .note-item, section[class*="note"]');
        
        if (cards.length === 0) {
          // Fallback: get all visible text blocks that look like posts
          const allSections = document.querySelectorAll('section, article, [class*="note"], [class*="feed"]');
          allSections.forEach(el => {
            const title = el.querySelector('[class*="title"], h3, [class*="desc"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"], [class*="engagement"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
            if (title && title.length > 5) {
              items.push({ title: title.substring(0, 120), likes: likes || '?', author: author || '?' });
            }
          });
        } else {
          cards.forEach(card => {
            const title = card.querySelector('[class*="title"], .desc, h3')?.textContent?.trim();
            const likes = card.querySelector('[class*="like"], [class*="count"]')?.textContent?.trim();
            const author = card.querySelector('[class*="author"], [class*="name"]')?.textContent?.trim();
            if (title) {
              items.push({ title: title.substring(0, 120), likes: likes || '?', author: author || '?' });
            }
          });
        }
        return items;
      });
      
      if (posts.length === 0) {
        // Try getting page text for debugging
        const bodyText = await page.evaluate(() => {
          return document.body?.innerText?.substring(0, 2000) || 'empty';
        });
        console.log(`No structured posts found. Page text sample:\n${bodyText.substring(0, 800)}`);
      } else {
        console.log(`Found ${posts.length} posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — ${p.author}`));
      }
      
      allResults[query] = posts;
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = [];
    }
  }
  
  await page.close();
  console.log('\n=== DONE ===');
  console.log(`Total queries: ${SEARCHES.length}`);
  console.log(`Total posts found: ${Object.values(allResults).reduce((s, a) => s + a.length, 0)}`);
}

run().catch(e => console.error(e));
