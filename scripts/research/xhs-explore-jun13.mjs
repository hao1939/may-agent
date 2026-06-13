import puppeteer from 'puppeteer-core';

// June 13, 2026 fresh exploration — ~06:00 Beijing time
// Focus: overnight developments, fresh morning content, gaps from prior rounds
const SEARCHES = [
  // What's fresh right NOW (early morning China)
  "AI 最新 6月13日",
  "AI agent 最新消息 今天",
  
  // DeepSeek latest — any overnight updates, V4 status
  "DeepSeek 最新 消息 今天",
  "deepseek v4 bug 问题 反馈",
  
  // Kimi / Moonshot — major competitor often underexplored
  "Kimi AI 最新 更新 2026",
  
  // Claude Code vs Codex — tool comparison (high interest area)
  "Claude Code Codex 对比 最新",
  "Claude Code 教程 实战 最新",
  
  // AI career & job market — always hot topic
  "AI 找工作 求职 2026 最新",
  "AI 裁员 失业 最新 2026",
  
  // Self-evolving agents / autonomous agents
  "AI 自进化 自主 agent 最新",
  "AI agent 自我改进 自动化",
  
  // Embodied AI / robotics — underexplored in prior rounds
  "具身智能 机器人 agent 2026",
  "人形机器人 AI 最新",
  
  // Apple WWDC & AI integration
  "苹果 AI WWDC 2026 最新",
  
  // Cursor / IDE AI tools — developer tooling
  "Cursor AI 编程 最新 2026",
  "AI 编程 工具 推荐 最新",
  
  // Agent security & safety
  "AI agent 安全 攻击 防御",
  
  // Agent monetization / business models
  "AI agent 变现 赚钱 商业模式",
  
  // Open-source LLM ecosystem
  "开源大模型 最新 发布 2026",
  
  // Multi-agent systems
  "多智能体 multi-agent 协作 最新",
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
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes&sort=general`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

      // Scroll to load more content
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
      }

      // Extract structured posts
      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        const selectors = [
          'section.note-item', 'div.note-item', '[class*="note-item"]',
          'section[class*="note"]', '[class*="feeds-page"] section',
          '[class*="search-result"] section'
        ];
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(el => {
            const title = el.querySelector('[class*="title"], h3, [class*="desc"], a[class*="title"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"], [class*="engagement"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
            if (title && title.length > 5 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 300), likes: likes || '?', author: author || '?' });
            }
          });
        }
        // Broader fallback
        if (items.length < 3) {
          document.querySelectorAll('section, article, [class*="card"], [class*="feed"]').forEach(el => {
            const title = el.querySelector('[class*="title"], h3, a, [class*="desc"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"]')?.textContent?.trim();
            if (title && title.length > 8 && title.length < 300 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 300), likes: likes || '?', author: author || '?' });
            }
          });
        }
        return items;
      });

      // Full text dump
      const pageText = await page.evaluate(() => {
        return document.body?.innerText?.substring(0, 12000) || 'empty';
      });

      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — @${p.author}`));
      }
      console.log(`\n--- Page Text (${pageText.length} chars) ---`);
      console.log(pageText.substring(0, 5000));

      allResults[query] = { posts, textLength: pageText.length, pageText: pageText.substring(0, 12000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }

    // Rate limit
    if (qi < SEARCHES.length - 1) {
      const delay = 8000 + Math.random() * 5000;
      console.log(`\n  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Also grab explore/trending page
  console.log('\n\n========== XHS EXPLORE/TRENDING ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await new Promise(r => setTimeout(r, 1500));
    }
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 8000) || 'empty');
    console.log(exploreText.substring(0, 5000));
    allResults['__EXPLORE__'] = { posts: [], pageText: exploreText.substring(0, 8000) };
  } catch (err) {
    console.log(`Explore error: ${err.message}`);
  }

  await page.close();

  // Summary
  console.log('\n\n========== SUMMARY ==========');
  let totalPosts = 0;
  for (const [q, data] of Object.entries(allResults)) {
    totalPosts += data.posts?.length || 0;
    console.log(`  [${data.posts?.length || 0} posts, ${data.textLength || 0} chars] ${q}`);
  }
  console.log(`Total structured posts: ${totalPosts}`);
}

run().catch(e => console.error(e));
