import puppeteer from 'puppeteer-core';

// June 13, 2026 — Round 2, ~10:00 AM Beijing time (Saturday morning)
// Fresh angles since the ~06:00 run, weekend content patterns
const SEARCHES = [
  // Saturday morning hot topics
  "AI 最新 今天 热门",
  "AI agent 智能体 最新 6月13",
  
  // DeepSeek — any weekend updates, V4 status
  "DeepSeek 最新 今天",
  "DeepSeek V4 问题 体验",
  
  // Claude Code — very hot developer topic
  "Claude Code 最新 使用 体验",
  "Claude Code vs Cursor 2026",
  
  // Chinese AI models — Kimi, Qwen, GLM
  "Kimi k2 最新 测评",
  "通义千问 Qwen 最新 2026",
  "智谱 GLM 最新 agent",
  
  // AI video/image generation — Sora, Kling, etc
  "AI 视频生成 Sora Kling 最新",
  "AI 绘画 生图 最新 2026",
  
  // AI education & learning resources
  "AI agent 入门 学习 教程 2026",
  "大模型 学习路线 2026",
  
  // AI + WeChat ecosystem
  "微信 AI 功能 最新 更新",
  
  // AI startup scene
  "AI 创业 2026 最新 融资",
  
  // Weekend lifestyle AI content
  "AI 工具 推荐 效率 生活",
  "AI 副业 赚钱 2026",
  
  // Multi-modal AI
  "多模态 AI 最新 进展 2026",
  
  // AI regulation & policy
  "AI 监管 政策 中国 2026",
  
  // OpenAI / GPT latest
  "OpenAI GPT 最新 消息 2026",
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
        return document.body?.innerText?.substring(0, 15000) || 'empty';
      });

      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — @${p.author}`));
      }
      console.log(`\n--- Page Text (${pageText.length} chars) ---`);
      console.log(pageText.substring(0, 6000));

      allResults[query] = { posts, textLength: pageText.length, pageText: pageText.substring(0, 15000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], pageText: '', error: err.message };
    }

    // Rate limit — generous delays for weekend morning
    if (qi < SEARCHES.length - 1) {
      const delay = 10000 + Math.random() * 6000;
      console.log(`\n  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Also grab explore page for weekend morning trending
  console.log('\n\n========== XHS EXPLORE/TRENDING (Saturday Morning) ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await new Promise(r => setTimeout(r, 1500));
    }
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 10000) || 'empty');
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
