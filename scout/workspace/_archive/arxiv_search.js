const https = require('https');

https.get('https://export.arxiv.org/api/query?search_query=all:%22multi-agent%22&sortBy=submittedDate&sortOrder=desc&max_results=5', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const titles = data.match(/<title>([^<]+)<\/title>/g).map(t => t.replace(/<\/?title>/g, ''));
    console.log(titles.slice(1).join('\n'));
  });
});
