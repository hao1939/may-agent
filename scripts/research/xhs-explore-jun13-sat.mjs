import puppeteer from 'puppeteer-core';

// June 13, 2026 — Saturday afternoon (1 PM Beijing time)
// Weekend content + fresh updates since last night
const SEARCHES = [
  // 1. Fable 5 aftermath — what happened overnight?
  "Claude Fable 5 最新消息 今天",
  "Anthropic 道歉 后续",
  
  // 2. Weekend trending AI content
  "AI 热搜 周末 最新",
  "AI 今日 热门 讨论",
  
  // 3. DeepSeek weekend updates
  "DeepSeek 最新 今天 2026",
  "DeepSeek R3 V4 消息",
  
  // 4. AI coding tools — weekend comparison content
  "Claude Code vs Codex 最新 对比 2026",
  "AI 编程 助手 排行 推荐 6月",
  
  // 5. Chinese AI ecosystem — models & companies
  "国产大模型 排行 六月 2026",
  "智谱 通义 文心 豆包 最新",
  
  // 6. AI robotics & embodied AI — rising topic
  "AI 机器人 具身智能 2026",
  "人形机器人 AI 最新进展",
  
  // 7. AI regulation & policy
  "AI 监管 政策 2026 最新",
  "大模型 备案 合规 2026",
  
  // 8. Agentic apps & real-world use
  "AI agent 实际应用 落地 案例",
  "AI 工具 推荐 实用 2026",
  
  // 9. Multi-modal AI — image/video generation
  "AI 生图 Midjourney 可灵 最新 2026",
  "AI 短视频 制作 工具 最新",
  
  // 10. Developer community hot topics
  "AI 开发者 工具 最新动态",
  "AI 开源项目 推荐 本周",
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
      await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));

      // Check for captcha/login wall
      const pageTitle = await page.title();
      if (pageTitle.includes('Security') || pageTitle.includes('Verification') || pageTitle.includes('Login')) {
        console.log(`⚠️ BLOCKED: Page title = "${pageTitle}". Skipping.`);
        allResults[query] = { posts: [], blocked: true };
        // Wait longer before next attempt
        await new Promise(r => setTimeout(r, 15000 + Math.random() * 10000));
        continue;
      }

      // Scroll to load more content
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 1200));
      }

      // Extract structured posts
      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        document.querySelectorAll('section.note-item, section, div[class*="note"], a[class*="cover"]').forEach(el => {
          const titleEl = el.querySelector('.title span, .title, h3, [class*="title"]');
          const likesEl = el.querySelector('.like-wrapper .count, .count, [class*="like"] .count, [class*="count"]');
          const authorEl = el.querySelector('.author .name, .name, [class*="author"] .name');
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
        // Print non-empty lines from page text
        const lines = pageText.split('\n').filter(l => l.trim().length > 3);
        console.log(lines.slice(0, 40).join('\n'));
      }

      allResults[query] = { posts, textLength: pageText.length, pageText: pageText.substring(0, 12000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], error: err.message };
    }

    // Rate limit — generous delays (12-20 seconds)
    if (qi < SEARCHES.length - 1) {
      const delay = 12000 + Math.random() * 8000;
      console.log(`  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Also grab the explore/trending page
  console.log('\n\n========== XHS EXPLORE / TRENDING PAGE ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 600 + Math.random() * 400));
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    }
    const explorePosts = await page.evaluate(() => {
      const items = [];
      const seen = new Set();
      document.querySelectorAll('section.note-item, section, div[class*="note"]').forEach(el => {
        const title = el.querySelector('.title span, .title, h3, [class*="title"]')?.textContent?.trim();
        const likes = el.querySelector('.like-wrapper .count, .count')?.textContent?.trim();
        const author = el.querySelector('.author .name, .name')?.textContent?.trim();
        if (title && title.length > 5 && !seen.has(title)) {
          seen.add(title);
          items.push({ title: title.substring(0, 300), likes: likes || '?', author: author || '?' });
        }
      });
      return items;
    });
    const exploreText = await page.evaluate(() => document.body?.innerText?.substring(0, 10000) || 'empty');
    console.log(`Explore: ${explorePosts.length} posts found`);
    explorePosts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — @${p.author}`));
    if (explorePosts.length === 0) {
      console.log('\n--- Explore text excerpt ---');
      console.log(exploreText.substring(0, 3000));
    }
    allResults['__EXPLORE__'] = { posts: explorePosts, pageText: exploreText };
  } catch (err) {
    console.log(`Explore error: ${err.message}`);
  }

  await page.close();

  // Summary
  console.log('\n\n========== SUMMARY ==========');
  let totalPosts = 0;
  let blockedCount = 0;
  for (const [q, data] of Object.entries(allResults)) {
    totalPosts += data.posts?.length || 0;
    if (data.blocked) blockedCount++;
    const status = data.blocked ? '🚫' : data.error ? '❌' : `✅ ${(data.posts?.length || 0)} posts`;
    console.log(`  [${status}] ${q}`);
  }
  console.log(`\nTotal structured posts: ${totalPosts}`);
  console.log(`Blocked queries: ${blockedCount}`);
  console.log(`Successful queries: ${SEARCHES.length - blockedCount}`);
}

run().catch(e => console.error(e));
