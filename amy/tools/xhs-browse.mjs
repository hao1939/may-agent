#!/usr/bin/env node

import http from 'node:http';

const CDP_PORT = 9222;
const CDP_HOST = 'localhost';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];

  if (!command) {
    console.error(JSON.stringify({ status: 'error', error: 'No command provided' }));
    process.exit(1);
  }

  try {
    const tab = await getOrCreateXHSTab();
    if (!tab) throw new Error('Could not find or create XHS tab');

    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = (e) => reject(new Error('WebSocket connection failed'));
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
    });

    const send = (method, params) => {
      return new Promise((resolve, reject) => {
        const id = Date.now() + Math.random();
        const handler = (msg) => {
          const data = JSON.parse(msg.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            if (data.error) reject(data.error);
            else resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await send('Runtime.enable');

    let result;
    if (command === 'feed') {
      result = await handleFeed(send);
    } else if (command === 'search') {
      result = await handleSearch(send, param);
    } else if (command === 'read') {
      result = await handleRead(send, param);
    } else {
      throw new Error(`Unknown command: ${command}`);
    }

    console.log(JSON.stringify({ status: 'success', data: result }, null, 2));
    ws.close();
    process.exit(0);

  } catch (err) {
    console.error(JSON.stringify({ status: 'error', error: err.message, stack: err.stack }));
    process.exit(1);
  }
}

async function getOrCreateXHSTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://${CDP_HOST}:${CDP_PORT}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(data);
          const xhsTab = tabs.find(t => t.url.includes('xiaohongshu.com') && t.type === 'page');
          
          if (xhsTab) {
            resolve(xhsTab);
          } else {
            http.get(`http://${CDP_HOST}:${CDP_PORT}/json/new?https://www.xiaohongshu.com/explore`, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                resolve(JSON.parse(data));
              });
            }).on('error', reject);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function navigate(send, url) {
  await send('Page.navigate', { url });
  await new Promise(resolve => setTimeout(resolve, 3000));
}

async function evaluate(send, expression) {
  const res = await send('Runtime.evaluate', { 
    expression, 
    returnByValue: true,
    awaitPromise: true 
  });
  
  if (res.exceptionDetails) {
    throw new Error(`JS Error: ${res.exceptionDetails.text}`);
  }
  return res.result.value;
}

async function handleFeed(send) {
  const currentUrl = await evaluate(send, 'window.location.href');
  if (!currentUrl.includes('/explore')) {
    await navigate(send, 'https://www.xiaohongshu.com/explore');
  } else {
     await evaluate(send, 'window.scrollTo(0, 1000)');
     await new Promise(r => setTimeout(r, 1500));
  }

  return await evaluate(send, `
    (function() {
      const items = [];
      const sections = document.querySelectorAll('section');
      
      sections.forEach(sec => {
        const anchor = sec.querySelector('a[href*="/explore/"]');
        if (!anchor) return;
        
        const titleEl = sec.querySelector('.title span') || sec.querySelector('.title') || sec.querySelector('h3');
        const authorEl = sec.querySelector('.author') || sec.querySelector('.name');
        const likeEl = sec.querySelector('.like-wrapper .count');
        const imgEl = sec.querySelector('img');

        const href = anchor.getAttribute('href');
        const id = href ? href.split('/').pop() : '';

        items.push({
          id,
          title: titleEl ? titleEl.innerText.trim() : '',
          author: authorEl ? authorEl.innerText.trim() : '',
          likes: likeEl ? likeEl.innerText.trim() : '0',
          cover: imgEl ? imgEl.src : '',
          link: anchor.href
        });
      });
      
      return items;
    })()
  `);
}

async function handleSearch(send, keyword) {
  const encoded = encodeURIComponent(keyword);
  const url = 'https://www.xiaohongshu.com/search_result?keyword=' + encoded + '&source=web_search_result_notes';
  await navigate(send, url);
  
  return await evaluate(send, `
    (function() {
      const items = [];
      const sections = document.querySelectorAll('section');
      
      sections.forEach(sec => {
        const anchor = sec.querySelector('a[href*="/explore/"]');
        if (!anchor) return;
        
        const titleEl = sec.querySelector('.title span') || sec.querySelector('.title');
        const authorEl = sec.querySelector('.author') || sec.querySelector('.name');
        const likeEl = sec.querySelector('.like-wrapper .count');
        
        const href = anchor.getAttribute('href');
        const id = href ? href.split('/').pop() : '';

        items.push({
          id,
          title: titleEl ? titleEl.innerText.trim() : '',
          author: authorEl ? authorEl.innerText.trim() : '',
          likes: likeEl ? likeEl.innerText.trim() : '0',
          link: anchor.href
        });
      });
      
      return items;
    })()
  `);
}

async function handleRead(send, url) {
  if (!url.startsWith('http')) {
     url = 'https://www.xiaohongshu.com/explore/' + url;
  }
  await navigate(send, url);

  return await evaluate(send, `
    (function() {
      const titleEl = document.querySelector('#detail-title') || document.querySelector('.title');
      const descEl = document.querySelector('#detail-desc') || document.querySelector('.desc');
      const authorEl = document.querySelector('.author-container .name');
      const dateEl = document.querySelector('.date');
      const tagEls = document.querySelectorAll('#detail-desc a[href*="/topic"]');
      
      const tags = Array.from(tagEls).map(el => el.innerText.trim());
      
      const comments = [];
      const commentEls = document.querySelectorAll('.comment-item');
      commentEls.forEach(el => {
         const content = el.querySelector('.content');
         const author = el.querySelector('.author');
         if(content) {
             comments.push({
                 author: author ? author.innerText.trim() : 'Unknown',
                 text: content.innerText.trim()
             });
         }
      });

      return {
        title: titleEl ? titleEl.innerText.trim() : '',
        description: descEl ? descEl.innerText.trim() : '',
        author: authorEl ? authorEl.innerText.trim() : '',
        date: dateEl ? dateEl.innerText.trim() : '',
        tags,
        comments
      };
    })()
  `);
}

main();
