import puppeteer from 'puppeteer-core';

// June 13, 2026 — Evening session (~7:20 PM Beijing time / Saturday evening peak)
// Focus: Fresh weekend activity, new model drops, community hot debates
const SEARCHES = [
  // Freshest AI content 
  "AI 最新 今天 热门 讨论 2026",
  
  // Agent engineering evolution — follow up on Loop Engineering from afternoon
  "Loop Engineering agent 循环工程 最新",
  "agent 框架 开源 最新 2026 六月",
  
  // Model launches — Kimi-K2.7-Code, DeepSeek V4.1, GPT-5.6
  "Kimi K2 code 开源 编程 最新",
  "DeepSeek V4.1 最新 测评 2026",
  "GPT 5.6 评测 对比 最新",
  
  // Claude Code + coding agent ecosystem
  "Claude Code agent 最新 技巧 2026六月",
  "AI编程 coding agent 对比 2026",
  
  // Chinese AI ecosystem — Qwen, Doubao, Zhipu
  "通义千问 Qwen 最新 更新 2026",
  "豆包 字节 AI 最新 2026",
  
  // AI safety and regulation — China-specific
  "AI 监管 治理 安全 中国 2026",
  
  // Super individual / one-person company — lifestyle trend
  "超级个体 AI 一人公司 独立开发者 最新",
  
  // Agent memory and context — technical frontier
  "agent 记忆 memory 上下文 技术 2026",
  
  // Weekend/lifestyle AI crossover
  "AI 副业 赚钱 实战 2026 最新",
  
  // Apple WWDC AI announcements
  "苹果 Apple AI WWDC 2026 最新",
];

const WS = 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109';

async function run() {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });

  const allResults = {};
  let totalPosts = 0;
  let successfulQueries = 0;

  for (let qi = 0; qi < SEARCHES.length; qi++) {
    const query = SEARCHES[qi];
    console.log(`\n[${qi+1}/${SEARCHES.length}] ========== ${query} ==========`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes&sort=general&type=51`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

      // Check for captcha/login wall
      const pageTitle = await page.title();
      if (pageTitle.includes('Security') || pageTitle.includes('Verification') || pageTitle.includes('Login')) {
        console.log(`⚠️ BLOCKED: Page title = "${pageTitle}". Skipping.`);
        allResults[query] = { posts: [], blocked: true };
        await new Promise(r => setTimeout(r, 12000 + Math.random() * 8000));
        continue;
      }

      // Scroll to load more content
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
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
        return document.body?.innerText?.substring(0, 15000) || 'empty';
      });

      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — @${p.author}`));
        successfulQueries++;
      } else {
        console.log('No structured posts found. Page text excerpt:');
        const lines = pageText.split('\n').filter(l => l.trim().length > 3);
        console.log(lines.slice(0, 40).join('\n'));
        if (pageText.length > 500) successfulQueries++;
      }

      totalPosts += posts.length;
      allResults[query] = { posts, textLength: pageText.length, pageText: pageText.substring(0, 15000) };
    } catch (err) {
      console.log(`Error: ${err.message}`);
      allResults[query] = { posts: [], error: err.message };
    }

    // Rate limit — generous delays for Saturday evening
    if (qi < SEARCHES.length - 1) {
      const delay = 8000 + Math.random() * 7000;
      console.log(`  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Also grab the explore/trending page
  console.log('\n\n========== XHS EXPLORE / TRENDING PAGE ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    for (let i = 0; i < 6; i++) {
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
      console.log(exploreText.substring(0, 4000));
    }
    allResults['__EXPLORE__'] = { posts: explorePosts, pageText: exploreText };
    totalPosts += explorePosts.length;
  } catch (err) {
    console.log(`Explore error: ${err.message}`);
  }

  await page.close();

  // Summary
  console.log('\n\n========== SUMMARY ==========');
  let blockedCount = 0;
  for (const [q, data] of Object.entries(allResults)) {
    if (data.blocked) blockedCount++;
    const status = data.blocked ? '🚫' : data.error ? '❌' : `✅ ${(data.posts?.length || 0)} posts (${(data.textLength||0)} chars)`;
    console.log(`  [${status}] ${q}`);
  }
  console.log(`\nTotal structured posts: ${totalPosts}`);
  console.log(`Blocked queries: ${blockedCount}`);
  console.log(`Successful queries: ${successfulQueries}/${SEARCHES.length}`);
}

run().catch(e => console.error(e));
