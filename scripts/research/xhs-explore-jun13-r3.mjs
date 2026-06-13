import puppeteer from 'puppeteer-core';

// June 13, 2026 — Round 3 (Friday late evening Beijing time)
// Focus on latest trending topics and fresh weekend content
const SEARCHES = [
  // Hot right now — broad AI pulse
  "AI 热门 最新 今天",
  "AI agent 智能体 2026 最新进展",
  
  // Claude 5 / Fable 5 — the big launch everyone's talking about
  "Claude 5 Fable 最新 评测 体验",
  "Anthropic 最新 模型 2026",
  
  // DeepSeek latest — V4 ecosystem
  "DeepSeek V4 最新消息",
  "DeepSeek 开源 最新",
  
  // Chinese AI agents & frameworks
  "国产 AI agent 框架 2026",
  "AI 多智能体 协作 最新",
  
  // Coding agents — the hottest tool category
  "AI 编程 agent 工具 最新",
  "Cursor Claude Code Codex 对比",
  
  // AI workflow & automation
  "AI 自动化 工作流 2026",
  "AI 办公 效率工具 推荐",
  
  // Memory / context management — technical deep dive
  "AI agent 记忆 上下文 管理",
  
  // MCP protocol & tool-use
  "MCP 协议 最新 工具",
  
  // AI side hustle & monetization
  "AI 副业 赚钱 最新 2026",
  
  // AI regulation & industry
  "AI 行业 趋势 2026 下半年",
  
  // Multimodal & video gen
  "AI 视频生成 Sora 可灵 2026",
  
  // WeChat + AI integration
  "微信 AI agent 最新",
  
  // Open source Chinese models
  "开源大模型 最新 排行 2026",
  
  // AI education trends
  "AI 学习 入门 路线图 2026",
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
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

      // Scroll to load more
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
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

      // Full text dump as backup
      const pageText = await page.evaluate(() => {
        return document.body?.innerText?.substring(0, 12000) || 'empty';
      });

      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — @${p.author}`));
      } else {
        console.log('No structured posts found. Page text excerpt:');
        console.log(pageText.substring(0, 3000));
      }

      allResults[query] = { posts, textLength: pageText.length, pageText: pageText.substring(0, 12000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }

    // Rate limit — generous delays
    if (qi < SEARCHES.length - 1) {
      const delay = 8000 + Math.random() * 5000;
      console.log(`  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Explore/trending page
  console.log('\n\n========== XHS EXPLORE / TRENDING ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await new Promise(r => setTimeout(r, 1500));
    }
    const explorePosts = await page.evaluate(() => {
      const items = [];
      const seen = new Set();
      document.querySelectorAll('section.note-item, section').forEach(el => {
        const title = el.querySelector('.title span, .title, h3')?.textContent?.trim();
        const likes = el.querySelector('.like-wrapper .count, .count')?.textContent?.trim();
        const author = el.querySelector('.author .name, .name')?.textContent?.trim();
        if (title && title.length > 5 && !seen.has(title)) {
          seen.add(title);
          items.push({ title: title.substring(0, 300), likes: likes || '?', author: author || '?' });
        }
      });
      return items;
    });
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 8000) || 'empty');
    console.log(`Explore: ${explorePosts.length} posts found`);
    explorePosts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — @${p.author}`));
    console.log('\n--- Explore text excerpt ---');
    console.log(exploreText.substring(0, 4000));
    allResults['__EXPLORE__'] = { posts: explorePosts, pageText: exploreText };
  } catch (err) {
    console.log(`Explore error: ${err.message}`);
  }

  await page.close();

  // Summary
  console.log('\n\n========== SUMMARY ==========');
  let totalPosts = 0;
  for (const [q, data] of Object.entries(allResults)) {
    totalPosts += data.posts?.length || 0;
    console.log(`  [${(data.posts?.length || 0).toString().padStart(3)} posts, ${(data.textLength || data.pageText?.length || 0).toString().padStart(5)} chars] ${q}`);
  }
  console.log(`\nTotal structured posts: ${totalPosts}`);
}

run().catch(e => console.error(e));
