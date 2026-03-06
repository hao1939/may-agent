import http from 'node:http';

const CDP_PORT = 9222;
const CDP_HOST = 'localhost';

async function test() {
  console.log("Starting test...");
  try {
    const tab = await getTab();
    console.log("Tab found:", tab.webSocketDebuggerUrl);
    
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    
    ws.onopen = () => {
        console.log("WS Open");
        ws.close();
    };
    ws.onerror = (e) => console.log("WS Error", e);
    ws.onclose = () => console.log("WS Close");
    
  } catch (e) {
    console.log("Error:", e);
  }
}

async function getTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://${CDP_HOST}:${CDP_PORT}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const tabs = JSON.parse(data);
        const xhsTab = tabs.find(t => t.url.includes('xiaohongshu.com') && t.type === 'page');
        resolve(xhsTab || tabs[0]);
      });
    }).on('error', reject);
  });
}

test();
