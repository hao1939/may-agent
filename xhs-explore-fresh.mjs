import puppeteer from 'puppeteer-core';

const SEARCHES = [
  // Core agent/model topics - fresh angles
  "AI agent 智能体 2026 六月 最新",
  "Claude Fable 5 实测 体验 2026 六月",
  "DeepSeek V4 最新 模型 2026 六月",
  "Loop Engineering agent 循环 工程 2026",
  "多智能体 multi-agent 协作 2026 六月",
  // Industry/ecosystem
  "MiMo Code 小米 AI编程 2026 六月",
  "微信 AI agent WeChat 2026 最新",
  "AI agent 安全 伪装 事故 2026",
  // Paradigm/culture
  "AI 超级个体 一人公司 赚钱 2026",
  "Claude Code 规则文件 CLAUDE.md 2026",
  "AI编程 agent 对比评测 2026 六月",
  // Deeper tech
  "agent memory 记忆 经验 自进化 2026",
  "SkillHub skills 技能 生态 2026 最新",
  "Qwen 通义千问 开源 agent 2026 六月",
  "AI 裁员 程序员 转型 2026 六月",
];

async function run() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109'
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  const allResults = {};
  
  for (const query of SEARCHES) {
    console.log(`\n========== SEARCHING: ${query} ==========`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 4000));
      
      // Scroll to load more content
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => window.scrollBy(0, 900));
        await new Promise(r => setTimeout(r, 2000));
      }
      
      // Extract posts using multiple strategies
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
            items.push({ title: title.substring(0, 150), likes: likes || '?', author: author || '?' });
          }
        });
        
        // Strategy 2: sections/articles
        if (items.length < 3) {
          document.querySelectorAll('section, article, [class*="note"], [class*="feed"], [class*="card"]').forEach(el => {
            const title = el.querySelector('[class*="title"], h3, [class*="desc"], a[class*="cover"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"], [class*="engagement"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
            if (title && title.length > 5 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 150), likes: likes || '?', author: author || '?' });
            }
          });
        }
        
        return items;
      });
      
      // Also grab full page text for analysis
      const pageText = await page.evaluate(() => {
        return document.body?.innerText?.substring(0, 4000) || 'empty';
      });
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — @${p.author}`));
      }
      
      console.log(`\n--- Page Text Sample ---`);
      console.log(pageText.substring(0, 3000));
      
      allResults[query] = { posts, pageText: pageText.substring(0, 4000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }
  }
  
  await page.close();
  
  console.log('\n\n========== SUMMARY ==========');
  console.log(`Total queries: ${SEARCHES.length}`);
  let totalPosts = 0;
  for (const [q, data] of Object.entries(allResults)) {
    totalPosts += data.posts?.length || 0;
    console.log(`  [${data.posts?.length || 0} posts] ${q}`);
  }
  console.log(`Total structured posts found: ${totalPosts}`);
}

run().catch(e => console.error(e));
