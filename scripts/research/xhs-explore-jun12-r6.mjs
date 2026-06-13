import puppeteer from 'puppeteer-core';

// Round 6: Late evening June 12, 2026 — Fresh angles since R5
// Focus: what's brand new since ~18:00 UTC, gap filling, and under-explored verticals
const SEARCHES = [
  // What's trending right NOW (late night China time)
  "AI 最新 热门 今天 6月12日",
  "AI agent 智能体 最新消息 今天",
  
  // Loop Engineering — has discourse evolved past explainers?
  "Loop Engineering 实战 项目 部署",
  "循环工程 缺点 成本 限制",
  
  // WeChat AI — payment + developer experience
  "微信 AI agent 支付 接入 开发",
  "微信 智能体 小程序 接口 最新",
  
  // Claude / Anthropic — bans, pricing, alternatives
  "Claude 封号 中国 替代 六月",
  "Anthropic Claude Code 最新 更新",
  
  // DeepSeek — V4.1, competition, production issues
  "DeepSeek V4 生产 部署 问题",
  "deepseek 开源 模型 最新 发布",
  
  // Under-explored: Vertical agents (medical, legal, finance)
  "AI agent 医疗 健康 诊断 最新",
  "AI agent 法律 合同 律师",
  "AI agent 金融 量化 交易",
  
  // Under-explored: Education + Creative
  "AI 教育 学习 智能体 辅导",
  "AI 短视频 生成 创作 agent",
  
  // MCP protocol ecosystem
  "MCP 协议 工具 agent 最新 开源",
  
  // Embodied AI / Robotics agents
  "具身智能 机器人 agent 最新",
  
  // AI bubble / reflection
  "AI 泡沫 反思 冷静 2026",
  
  // Open source Chinese agent frameworks
  "AI agent 框架 开源 中国 2026",
  
  // Meta: How people use AI daily
  "AI 日常 工作 效率 工具 推荐",
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
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
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
      console.log(pageText.substring(0, 6000));

      allResults[query] = { posts, textLength: pageText.length, pageText: pageText.substring(0, 12000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }

    // Rate limit — generous delays
    if (qi < SEARCHES.length - 1) {
      const delay = 10000 + Math.random() * 6000;
      console.log(`\n  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Also grab explore page
  console.log('\n\n========== XHS EXPLORE/TRENDING ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await new Promise(r => setTimeout(r, 1500));
    }
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 8000) || 'empty');
    console.log(exploreText.substring(0, 6000));
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
