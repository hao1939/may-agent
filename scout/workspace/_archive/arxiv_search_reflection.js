async function searchArxiv() {
  try {
    const url = 'http://export.arxiv.org/api/query?search_query=all:"llm+agent+reflection"&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending';
    const response = await fetch(url);
    const data = await response.text();
    console.log(data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
searchArxiv();
