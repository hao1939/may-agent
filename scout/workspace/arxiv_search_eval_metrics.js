async function searchArxiv() {
  const query = 'all:"large language model" AND all:"agent" AND all:"evaluation"';
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending`;
  
  try {
    const response = await fetch(url);
    const data = await response.text();
    console.log(data);
  } catch (error) {
    console.error('Error fetching from arXiv:', error);
  }
}

searchArxiv();
