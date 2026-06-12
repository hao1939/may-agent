import puppeteer from 'puppeteer-core';

const SEARCHES = [
  // Core AI agent trends — fresh queries
  "AI agent 智能体 最新 六月 2026",
  "Loop Engineering 循环工程 agent 最新 2026",
  "Claude Code 多agent 编程 最新 六月",
  // Model launches + ecosystem
  "DeepSeek V4 最新 更新 突破 六月",
  "Qwen 通义千问 3.7 开源 闭源 最新",
  "Claude Fable 5 Mythos 最新 反应",
  // Chinese ecosystem + tools
  "MiMo Code 小米 AI编程 最新",
  "微信 AI agent 小程序 最新 六月",
  "国产 AI 编程 工具 agent 2026",
  // Career + society
  "AI 裁员 失业 程序员 转型 2026 六月",
  "FDE 全栈开发 agent 岗位 最新",
  "AI 超级个体 一人公司 创业 2026",
  // Safety + governance
  "AI agent 安全 越狱 对齐 2026 最新",
  "AI 监管 治理 中国 政策 agent",
  // Skills + self-evolution
  "agent skills 技能 自进化 SkillHub 2026",
  "harness engineering 替代 loop 最新",
  // Viral + hot takes
  "AI 编程 vibe coding 结束 2026",
  "AI 热门 爆款 讨论 今天",
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
    console.log(`\n[${ qi + 1 }/${ SEARCHES.length }] ========== SEARCHING: ${query} ==========`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes&sort=general`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

      // Scroll to load more content
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.scrollBy(0, 600 + Math.random() * 400));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
      }

      // Extract posts via multiple selector strategies
      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        const selectors = [
          'section.note-item',
          'div.note-item',
          '[class*="note-item"]',
          'section[class*="note"]',
          '[class*="feeds-page"] section',
          '[class*="search-result"] section',
        ];
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(el => {
            const title = el.querySelector('[class*="title"], h3, [class*="desc"], a[class*="title"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"], [class*="engagement"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
            if (title && title.length > 5 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 250), likes: likes || '?', author: author || '?' });
            }
          });
        }
        // Broader fallback
        if (items.length < 3) {
          document.querySelectorAll('section, article, [class*="card"], [class*="feed"]').forEach(el => {
            const title = el.querySelector('[class*="title"], h3, a, [class*="desc"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"]')?.textContent?.trim();
            if (title && title.length > 8 && title.length < 250 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 250), likes: likes || '?', author: author || '?' });
            }
          });
        }
        return items;
      });

      // Full-page text dump for deeper content analysis
      const pageText = await page.evaluate(() => {
        return document.body?.innerText?.substring(0, 10000) || 'empty';
      });

      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i + 1}. [${p.likes}] ${p.title} — @${p.author}`));
      }
      console.log(`\n--- Page Text Excerpt (${pageText.length} chars) ---`);
      console.log(pageText.substring(0, 5000));
      
      allResults[query] = { posts, textLength: pageText.length, pageText: pageText.substring(0, 10000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }
    
    // Rate-limit between queries
    if (qi < SEARCHES.length - 1) {
      const delay = 4000 + Math.random() * 3000;
      console.log(`\n  (waiting ${(delay/1000).toFixed(1)}s before next query...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Explore trending / hot topics page
  console.log('\n\n========== XHS EXPLORE PAGE (General) ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(r => setTimeout(r, 1500));
    }
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 8000) || 'empty');
    console.log('--- Explore Page Text ---');
    console.log(exploreText.substring(0, 5000));
    allResults['__EXPLORE__'] = { posts: [], pageText: exploreText.substring(0, 8000) };
  } catch (err) {
    console.log(`Explore error: ${err.message}`);
  }

  await page.close();

  // Final summary
  console.log('\n\n========== FINAL SUMMARY ==========');
  console.log(`Total queries: ${SEARCHES.length}`);
  let totalPosts = 0;
  for (const [q, data] of Object.entries(allResults)) {
    totalPosts += data.posts?.length || 0;
    console.log(`  [${data.posts?.length || 0} posts, ${data.textLength || 0} chars] ${q}`);
  }
  console.log(`Total structured posts: ${totalPosts}`);
}

run().catch(e => console.error(e));
