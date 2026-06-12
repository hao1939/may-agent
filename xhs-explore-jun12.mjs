import puppeteer from 'puppeteer-core';

const SEARCHES = [
  // Hot topics from previous cycle + time-gating
  "AI agent 智能体 最新 2026 六月",
  "Claude Fable 5 Mythos 实测 最新",
  "DeepSeek V4 R2 最新 模型 六月",
  "Loop Engineering agent 循环工程 最新",
  "多智能体 multi-agent 协作 最新 2026",
  // Breaking / ecosystem
  "MiMo Code 小米 AI编程 开源 最新",
  "微信 AI agent WeChat 最新 六月",
  "AI编程 Claude Code Cursor 对比 最新",
  // Narratives
  "AI 社会分层 大模型 价格 最新 2026",
  "AI agent 安全 越狱 伪装 最新",
  // Skills & infra
  "SkillHub agent skill 技能 最新",
  "CLAUDE.md rules 规则 编程 最新",
  // Industry + jobs
  "AI 裁员 程序员 转型 就业 最新 2026",
  "AI 超级个体 一人公司 创业 最新",
  // Chinese models
  "Qwen 通义千问 Kimi 智谱 开源 最新 六月",
];

async function run() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109'
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });
  
  const allResults = {};
  
  for (const query of SEARCHES) {
    console.log(`\n========== SEARCHING: ${query} ==========`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 4000));
      
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 2000));
      }
      
      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        
        document.querySelectorAll('section.note-item, div.note-item, [class*="note-item"]').forEach(el => {
          const title = el.querySelector('[class*="title"], h3, [class*="desc"]')?.textContent?.trim();
          const likes = el.querySelector('[class*="like"], [class*="count"]')?.textContent?.trim();
          const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
          if (title && title.length > 5 && !seen.has(title)) {
            seen.add(title);
            items.push({ title: title.substring(0, 200), likes: likes || '?', author: author || '?' });
          }
        });
        
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
      
      const pageText = await page.evaluate(() => {
        return document.body?.innerText?.substring(0, 5000) || 'empty';
      });
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — @${p.author}`));
      }
      
      console.log(`\n--- Page Text Sample ---`);
      console.log(pageText.substring(0, 3000));
      
      allResults[query] = { posts, pageText: pageText.substring(0, 5000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }
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
