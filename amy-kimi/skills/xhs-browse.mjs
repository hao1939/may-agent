#!/usr/bin/env node
/**
 * XHS Browser - Xiaohongshu content fetcher
 * Uses Puppeteer with authenticated cookies
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_FILE = path.join(__dirname, '.xhs_cookies.json');
const WS_ENDPOINT_FILE = '/tmp/chrome-ws-endpoint';

async function getBrowser() {
  // Try to connect to existing Chrome
  if (fs.existsSync(WS_ENDPOINT_FILE)) {
    const wsEndpoint = fs.readFileSync(WS_ENDPOINT_FILE, 'utf8').trim();
    try {
      return await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    } catch (e) {
      console.error('Failed to connect to existing Chrome:', e.message);
    }
  }
  
  // Launch new Chrome
  return await puppeteer.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--remote-debugging-port=9222',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
}

async function loadCookies(page) {
  if (fs.existsSync(COOKIE_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
    await page.setCookie(...cookies);
    return true;
  }
  return false;
}

async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
}

async function fetchFeed(count = 5) {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await loadCookies(page);
    
    // Go to XHS explore page
    await page.goto('https://www.xiaohongshu.com/explore', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for content to load
    await page.waitForSelector('.note-item, .feeds-page', { timeout: 10000 });
    
    // Extract posts
    const posts = await page.evaluate((n) => {
      const items = document.querySelectorAll('.note-item, .feed-item');
      return Array.from(items).slice(0, n).map(item => {
        const titleEl = item.querySelector('.title, .note-title, h3');
        const descEl = item.querySelector('.desc, .note-desc');
        const authorEl = item.querySelector('.author, .user-name');
        const linkEl = item.querySelector('a');
        
        return {
          title: titleEl?.textContent?.trim() || '',
          desc: descEl?.textContent?.trim() || '',
          author: authorEl?.textContent?.trim() || '',
          url: linkEl?.href || ''
        };
      });
    }, count);
    
    await saveCookies(page);
    await page.close();
    
    return posts;
  } finally {
    // Don't close if we connected to existing browser
    if (!fs.existsSync(WS_ENDPOINT_FILE)) {
      await browser.close();
    }
  }
}

async function search(keyword, count = 5) {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await loadCookies(page);
    
    const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.waitForSelector('.note-item, .search-result-item', { timeout: 10000 });
    
    const posts = await page.evaluate((n) => {
      const items = document.querySelectorAll('.note-item, .search-result-item');
      return Array.from(items).slice(0, n).map(item => {
        const titleEl = item.querySelector('.title, h3, .note-title');
        const descEl = item.querySelector('.desc, .note-desc');
        const authorEl = item.querySelector('.author, .user-name');
        const linkEl = item.querySelector('a');
        
        return {
          title: titleEl?.textContent?.trim() || '',
          desc: descEl?.textContent?.trim() || '',
          author: authorEl?.textContent?.trim() || '',
          url: linkEl?.href || ''
        };
      });
    }, count);
    
    await saveCookies(page);
    await page.close();
    
    return posts;
  } finally {
    if (!fs.existsSync(WS_ENDPOINT_FILE)) {
      await browser.close();
    }
  }
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === '--feed') {
  const count = parseInt(args[1]) || 5;
  fetchFeed(count).then(posts => {
    console.log(JSON.stringify(posts, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
} else if (command === '--search') {
  const keyword = args[1];
  const count = parseInt(args[2]) || 5;
  if (!keyword) {
    console.error('Usage: xhs-browse.mjs --search <keyword> [count]');
    process.exit(1);
  }
  search(keyword, count).then(posts => {
    console.log(JSON.stringify(posts, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
} else {
  console.log('Usage:');
  console.log('  xhs-browse.mjs --feed [count]     # Fetch feed posts');
  console.log('  xhs-browse.mjs --search <kw> [n]  # Search posts');
  process.exit(1);
}
