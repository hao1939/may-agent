import puppeteer from 'puppeteer-core';

const SEARCHES = [
  "agent 评估工程 eval engineering 2026",
  "agent 护栏 guardrails 小模型 生产 部署",
  "agent 国产 DeepSeek Qwen 全栈 替代",
  "agent loop工程 context engineering 最新",
  "Claude Code cursor 吞噬 替代 平台",
  "agent 落地 ROI 踩坑 成本 2026",
  "agent 记忆 memory 遗忘 context rot",
  "agent 安全 skill security 攻击 防御"
];

async function run() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222/devtools/browser/a414c42d-4b81-4a3a-a394-5618618f16ff'
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  const allResults = [];
  
  for (const query of SEARCHES) {
    console.log(`\n=== SEARCHING: ${query} ===`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      await new Promise(r => setTimeout(r, 3000));
      
      // Scroll to load more
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => window.scrollBy(0, 900));
        await new Promise(r => setTimeout(r, 2000));
      }
      
      const posts = await page.evaluate(() => {
        const items = [];
        const sections = document.querySelectorAll('section.note-item, [class*="note-item"], [data-note-id]');
        if (sections.length > 0) {
          sections.forEach(el => {
            const title = el.querySelector('[class*="title"], .title, a.title')?.textContent?.trim();
            const desc = el.querySelector('[class*="desc"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like-wrapper"] span, [class*="count"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"]')?.textContent?.trim();
            if (title && title.length > 3) {
              items.push({ title: title.substring(0, 150), desc: (desc || '').substring(0, 100), likes: likes || '?', author: author || '?' });
            }
          });
        }
        
        // Fallback: try broader selectors
        if (items.length === 0) {
          document.querySelectorAll('a[href*="/explore/"], a[href*="/search_result/"]').forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 10 && text.length < 200) {
              items.push({ title: text.substring(0, 150), desc: '', likes: '?', author: '?' });
            }
          });
        }
        
        // Another fallback
        if (items.length === 0) {
          const allText = document.querySelectorAll('[class*="note"], [class*="card"], [class*="feed-item"]');
          allText.forEach(el => {
            const text = el.textContent?.trim().substring(0, 200);
            if (text && text.length > 20) {
              items.push({ title: text.substring(0, 150), desc: '', likes: '?', author: '?' });
            }
          });
        }
        
        return items.slice(0, 25);
      });
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} posts:`);
        posts.forEach((p, i) => {
          console.log(`  ${i+1}. [${p.likes}❤] ${p.title}`);
          if (p.author !== '?') console.log(`     by ${p.author}`);
        });
        allResults.push({ query, posts });
      } else {
        // Check if login wall or empty
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500));
        console.log('No posts found. Page text:', bodyText?.substring(0, 200));
        allResults.push({ query, posts: [], note: bodyText?.substring(0, 200) });
      }
    } catch(e) {
      console.log(`Error: ${e.message}`);
      allResults.push({ query, posts: [], error: e.message });
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n\n=== SUMMARY ===');
  console.log(`Total queries: ${SEARCHES.length}`);
  console.log(`Queries with results: ${allResults.filter(r => r.posts.length > 0).length}`);
  console.log(`Total posts found: ${allResults.reduce((sum, r) => sum + r.posts.length, 0)}`);
  
  await page.close();
}

run().catch(e => console.error('Fatal:', e));
