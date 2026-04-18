/**
 * Markdown Renderer — converts user-submitted markdown to safe HTML.
 * 
 * IMPORTANT: This renders user-generated content that will be displayed
 * in a web page. Output MUST be sanitized to prevent XSS.
 */

const { marked } = require('marked');

// Configure marked options
marked.setOptions({
  sanitize: true,   // Enable HTML sanitization for security
  smartLists: true,
  smartypants: true
});

function renderMarkdown(input) {
  // marked.parse handles sanitization via the sanitize option above
  let html = marked.parse(input);
  // Also neutralize javascript: protocol URLs that markdown links can create
  html = html.replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"');
  return html;
}

// Demo: render some user content
const userContent = `
# Hello World

This is **bold** and *italic*.

<script>alert('XSS')</script>

Here is a [link](https://example.com).

<img src=x onerror="alert('XSS2')">
`;

const html = renderMarkdown(userContent);
console.log(html);

module.exports = { renderMarkdown };
