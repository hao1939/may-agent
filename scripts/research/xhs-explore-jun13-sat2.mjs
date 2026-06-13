import puppeteer from 'puppeteer-core';

// June 13, 2026 — Saturday afternoon batch 2
const SEARCHES = [
  // DeepSeek — hot topic
  "DeepSeek 最新 开源 模型",
  // Multimodal / video AI  
  "AI 视频 图片 生成 最新 工具",
  // Chinese AI companies
  "国产AI 大模型 最新 排名",
  // Side hustle / monetization latest
  "AI 副业 变现 最新 经验",
  // Open source trending
  "开源 AI 项目 GitHub 趋势 最新",
];

const WS = 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109';

async function run() {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });

  for (let qi = 0; qi < SEARCHES.length; qi++) {
    const query = SEARCHES[qi];
    console.log(`\n[${qi+1}/${SEARCHES.length}] ========== ${query} ==========`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes&sort=general&type=51`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000 + Math.random() * 3000));

      const pageTitle = await page.title();
      if (pageTitle.includes('Security') || pageTitle.includes('Verification') || pageTitle.includes('Login')) {
        console.log(`⚠️ BLOCKED: Page title = "${pageTitle}". Skipping.`);
        await new Promise(r => setTimeout(r, 20000 + Math.random() * 10000));
        continue;
      }

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
      }

      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        document.querySelectorAll('section.note-item, section, div[class*="note"]').forEach(el => {
          const titleEl = el.querySelector('.title span, .title, h3, [class*="title"]');
          const likesEl = el.querySelector('.like-wrapper .count, .count, [class*="like"] .count');
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

      if (posts.length > 0) {
        console.log(`Found ${posts.length} structured posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — @${p.author}`));
      } else {
        const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || 'empty');
        console.log('No structured posts. Text excerpt:');
        console.log(pageText.split('\n').filter(l => l.trim().length > 3).slice(0, 30).join('\n'));
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }

    if (qi < SEARCHES.length - 1) {
      const delay = 15000 + Math.random() * 10000;
      console.log(`  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Explore page
  console.log('\n\n========== XHS EXPLORE ==========');
  try {
    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
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
    console.log(`Found ${explorePosts.length} posts`);
    explorePosts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — @${p.author}`));
  } catch (err) {
    console.log(`Explore error: ${err.message}`);
  }

  await page.close();
}

run().catch(e => console.error(e));
