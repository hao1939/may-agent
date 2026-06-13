import puppeteer from 'puppeteer-core';

// June 13, 2026 — Round 3b: remaining queries + deep dives
const SEARCHES = [
  // Remaining from batch 1
  "AI 行业 趋势 2026 下半年",
  "AI 视频生成 Sora 可灵 2026",
  "微信 AI agent 最新",
  "开源大模型 最新 排行 2026",
  "AI 学习 入门 路线图 2026",
  
  // New targeted queries based on Round 3a signals
  "Claude fable 5 评测 体验",
  "Loop Engineering agent 循环",
  "Evolva 自进化 agent 框架",
  "AI 安全 agent 攻防",
  "vibe coding 2026 趋势",
];

const WS = 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109';

async function run() {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });

  const allResults = {};

  for (let qi = 0; qi < SEARCHES.length; qi++) {
    const query = SEARCHES[qi];
    console.log(`\n[${qi+1}/${SEARCHES.length}] ========== ${query} ==========`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes&sort=general&type=51`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));

      // Scroll to load more
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 1200));
      }

      // Extract structured posts
      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        document.querySelectorAll('section.note-item, section').forEach(el => {
          const titleEl = el.querySelector('.title span, .title, h3, [class*="title"]');
          const likesEl = el.querySelector('.like-wrapper .count, .count, [class*="like"]');
          const authorEl = el.querySelector('.author .name, .name, [class*="author"]');
          const title = titleEl?.textContent?.trim();
          const likes = likesEl?.textContent?.trim();
          const author = authorEl?.textContent?.trim();
          if (title && title.length > 5 && !seen.has(title)) {
            seen.add(title);
            items.push({ title: title.substring(0, 300), likes: likes || '?', author: author || '?' });
          }
        });
        return items;
      });

      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — @${p.author}`));
      } else {
        const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || 'empty');
        console.log('No structured posts. Text: ' + pageText.substring(0, 500));
      }

      allResults[query] = { posts };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], error: err.message };
    }

    // Generous delay to avoid rate limiting
    if (qi < SEARCHES.length - 1) {
      const delay = 12000 + Math.random() * 8000;
      console.log(`  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  await page.close();

  // Summary
  console.log('\n\n========== SUMMARY ==========');
  let totalPosts = 0;
  for (const [q, data] of Object.entries(allResults)) {
    totalPosts += data.posts?.length || 0;
    console.log(`  [${(data.posts?.length || 0).toString().padStart(3)} posts] ${q}`);
  }
  console.log(`\nTotal structured posts: ${totalPosts}`);
}

run().catch(e => console.error(e));
