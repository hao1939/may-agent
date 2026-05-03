const https = require('https');

function searchArxiv(query) {
  // Require precise matching of 'agent' and 'communication' and 'protocol'
  const url = `https://export.arxiv.org/api/query?search_query=%22agent+communication+protocol%22+OR+(all:agent+AND+all:communication+AND+all:protocol)&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log(data);
    });
  }).on('error', (e) => {
    console.error(e);
  });
}

searchArxiv();
