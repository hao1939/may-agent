import puppeteer from 'puppeteer-core';

const SEARCHES = [
  // Core: What's new today (Jun 12)
  "AI agent 智能体 最新 2026 六月",
  "Claude Fable 5 Mythos 实测 最新 六月",
  "DeepSeek V4 R2 最新 模型 六月 2026",
  // Hot paradigms
  "Loop Engineering agent 循环工程 最新 2026",
  "多智能体 multi-agent 协作 最新 2026",
  "harness engineering agent 架构 FDE 最新",
  // Breaking/ecosystem
  "MiMo Code 小米 AI编程 开源 最新",
  "AI编程 Claude Code Cursor 对比 最新 2026",
  "SkillHub agent skill 技能 最新 2026",
  // Narratives & society
  "AI模型社会分层 Claude Fable 2026 六月",
  "AI 裁员 程序员 转型 就业 最新 2026",
  "AI 超级个体 一人公司 创业 最新",
  // Chinese models & ecosystem
  "Qwen 通义千问 Kimi 智谱 开源 最新 六月",
  "微信 AI agent WeChat 最新 六月 2026",
  // Safety/alignment
  "AI agent 安全 越狱 伪装 对齐 最新 2026",
  // Vibe coding / coding culture
  "vibe coding 结束 AI编程 harness 2026 六月",
  // Open source Chinese projects
  "中文 开源 AI agent 框架 项目 最新",
  // New: what's freshly viral
  "AI 热门 爆款 最新 今日 六月",
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
      await new Promise(r => setTimeout(r, 4000));
      
      // Scroll to load more content
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 1500));
      }
      
      // Extract posts with multiple strategies
      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        
        // Strategy 1: note-item sections
        document.querySelectorAll('section.note-item, div.note-item, [class*="note-item"]').forEach(el => {
          const title = el.querySelector('[class*="title"], h3, [class*="desc"]')?.textContent?.trim();
          const likes = el.querySelector('[class*="like"], [class*="count"]')?.textContent?.trim();
          const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
          if (title && title.length > 5 && !seen.has(title)) {
            seen.add(title);
            items.push({ title: title.substring(0, 200), likes: likes || '?', author: author || '?' });
          }
        });
        
        // Strategy 2: fallback broader selectors
        if (items.length < 5) {
          document.querySelectorAll('section, article, [class*="note"], [class*="feed"], [class*="card"]').forEach(el => {
            const title = el.querySelector('[class*="title"], h3, [class*="desc"], a')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
            if (title && title.length > 8 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 200), likes: likes || '?', author: author || '?' });
            }
          });
        }
        
        return items;
      });
      
      // Get full page text for rich analysis
      const pageText = await page.evaluate(() => {
        return document.body?.innerText?.substring(0, 6000) || 'empty';
      });
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — @${p.author}`));
      }
      
      console.log(`\n--- Page Text Sample ---`);
      console.log(pageText.substring(0, 3500));
      
      allResults[query] = { posts, pageText: pageText.substring(0, 6000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }
  }
  
  // Also check the XHS Explore page for trending AI content
  console.log('\n\n========== BROWSING XHS EXPLORE PAGE ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await new Promise(r => setTimeout(r, 2000));
    }
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 5000) || 'empty');
    console.log('--- Explore Page Text ---');
    console.log(exploreText.substring(0, 3000));
    allResults['__EXPLORE__'] = { posts: [], pageText: exploreText.substring(0, 5000) };
  } catch (err) {
    console.log(`Explore page error: ${err.message}`);
  }
  
  await page.close();
  
  console.log('\n\n========== FINAL SUMMARY ==========');
  console.log(`Total queries: ${SEARCHES.length}`);
  let totalPosts = 0;
  for (const [q, data] of Object.entries(allResults)) {
    totalPosts += data.posts?.length || 0;
    console.log(`  [${data.posts?.length || 0} posts] ${q}`);
  }
  console.log(`Total structured posts found: ${totalPosts}`);
}

run().catch(e => console.error(e));
