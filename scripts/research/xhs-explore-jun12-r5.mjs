import puppeteer from 'puppeteer-core';

// Round 5: Fresh angles — evening session June 12, 2026
// Focus: what changed in the last few hours, new emerging topics, model ecosystem shifts
const SEARCHES = [
  // Hot right now - real-time pulse
  "AI 今天 热门 最新 讨论 六月",
  "AI agent 智能体 最新 今日 热门",
  // Loop Engineering — has it evolved further?
  "Loop Engineering 实战 案例 教程",
  "循环工程 loop agent 最新 缺点 问题",
  // WeChat AI — payment angle is brand new
  "微信 AI 智能体 支付 最新",
  "微信 AI agent 开发者 接入 教程",
  // Claude / Anthropic — any new drama?
  "Claude 4.5 Fable Mythos 最新 六月",
  "Claude 封号 降智 API 六月 2026",
  // DeepSeek next moves
  "DeepSeek V4.1 下一代 最新 消息",
  "deepseek 开源 code agent 编程 最新",
  // MiMo / Xiaomi AI coding
  "MiMo 小米 AI 编程 code 最新",
  // Career / layoff fresh takes
  "AI 裁员 2026 六月 最新 程序员",
  "AI 转型 普通人 赚钱 副业 最新",
  // Safety governance — new policy
  "AI agent 安全 监管 政策 最新 2026",
  // Agent infrastructure — what's shipping
  "MCP 协议 agent 工具 最新 六月",
  "AI agent 框架 开源 中国 最新",
  // Under-explored: education, creative, vertical agents
  "AI agent 教育 学习 辅导 最新",
  "AI 创作 短视频 生成 agent",
  // Sentiment / meta-commentary
  "AI 泡沫 过热 冷静 反思 2026",
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
      await new Promise(r => setTimeout(r, 3500 + Math.random() * 2500));

      // Scroll to load more
      for (let i = 0; i < 7; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1200));
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
              items.push({ title: title.substring(0, 280), likes: likes || '?', author: author || '?' });
            }
          });
        }
        // Broader fallback
        if (items.length < 3) {
          document.querySelectorAll('section, article, [class*="card"], [class*="feed"]').forEach(el => {
            const title = el.querySelector('[class*="title"], h3, a, [class*="desc"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"]')?.textContent?.trim();
            if (title && title.length > 8 && title.length < 280 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 280), likes: likes || '?', author: author || '?' });
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
      const delay = 8000 + Math.random() * 6000;
      console.log(`\n  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Also check XHS explore/trending page
  console.log('\n\n========== XHS EXPLORE PAGE ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 700));
      await new Promise(r => setTimeout(r, 1500));
    }
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 10000) || 'empty');
    console.log('--- Explore Page ---');
    console.log(exploreText.substring(0, 6000));
    allResults['__EXPLORE__'] = { posts: [], pageText: exploreText.substring(0, 10000) };
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
