import puppeteer from 'puppeteer-core';

const SEARCHES = [
  // Today's hottest — June 12, 2026
  "AI agent 最新 今日 热门 2026 六月",
  "Claude Fable 5 Mythos 最新动态 六月12",
  "DeepSeek V4 R2 最新 模型 六月",
  // Paradigm evolution
  "Loop Engineering agent 循环 最新",
  "多智能体 multi-agent 协作 2026",
  "harness engineering 过时 最新",
  // Chinese ecosystem fresh
  "MiMo Code 小米 AI编程 开源",
  "微信 AI agent 智能体 最新",
  "Qwen 通义千问 3.7 开源 最新",
  // Career & society
  "AI 裁员 程序员 转型 就业 最新",
  "AI 超级个体 创业 2026",
  "FDE 全栈开发工程师 AI 最新",
  // Safety & regulation
  "AI agent 安全 对齐 越狱 最新",
  "AI 监管 政策 中国 2026",
  // Tools landscape
  "Claude Code Cursor Codex 对比 最新",
  "AI编程 工具 测评 2026 六月",
  // Skills & capability
  "agent skills 技能 自进化 2026",
  "Skill Zoo SkillOpt 开源",
  // Fresh viral
  "AI 爆款 热门 今天 六月",
  "Anthropic 道歉 争议 最新",
];

const WS = 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109';

async function run() {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });
  
  const allResults = {};
  
  for (const query of SEARCHES) {
    console.log(`\n========== SEARCHING: ${query} ==========`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes&sort=general`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3500));
      
      // Scroll to load more
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 700));
        await new Promise(r => setTimeout(r, 1200));
      }
      
      // Extract posts
      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        
        // Try multiple selector strategies
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
      
      // Get page text for content analysis
      const pageText = await page.evaluate(() => {
        return document.body?.innerText?.substring(0, 8000) || 'empty';
      });
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — @${p.author}`));
      }
      
      console.log(`\n--- Page Text (${pageText.length} chars) ---`);
      console.log(pageText.substring(0, 4000));
      
      allResults[query] = { posts, textLength: pageText.length, pageText: pageText.substring(0, 8000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }
  }
  
  // Check XHS Explore/trending page
  console.log('\n\n========== XHS EXPLORE PAGE ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(r => setTimeout(r, 1500));
    }
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 6000) || 'empty');
    console.log('--- Explore Page Text ---');
    console.log(exploreText.substring(0, 4000));
    allResults['__EXPLORE__'] = { posts: [], pageText: exploreText.substring(0, 6000) };
  } catch (err) {
    console.log(`Explore error: ${err.message}`);
  }

  // Check XHS hot/trending topics
  console.log('\n\n========== XHS HOT TOPICS ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore?channel_id=homefeed.hot_topics', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    const hotText = await page.evaluate(() => document.body?.innerText?.substring(0, 5000) || 'empty');
    console.log(hotText.substring(0, 3000));
    allResults['__HOT__'] = { posts: [], pageText: hotText.substring(0, 5000) };
  } catch (err) {
    console.log(`Hot topics error: ${err.message}`);
  }
  
  await page.close();
  
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
