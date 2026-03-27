/**
 * Markdown Renderer — converts user-submitted markdown to safe HTML.
 * 
 * IMPORTANT: This renders user-generated content that will be displayed
 * in a web page. Output MUST be sanitized to prevent XSS.
 */

const { marked } = require('marked');

// Configure marked options (sanitize option is deprecated/removed in v4+)
marked.setOptions({
  smartLists: true,
  smartypants: true
});

/**
 * Sanitize HTML by stripping all raw HTML tags from input.
 * This prevents XSS by removing <script>, <img onerror=...>, etc.
 * before the markdown parser sees them.
 */
function sanitizeHtml(input) {
  // Remove all HTML tags from the input to prevent XSS.
  // This strips <script>, <img>, <div>, etc. — any raw HTML.
  // Markdown syntax (**bold**, *italic*, [links]()) is preserved.
  return input.replace(/<[^>]*>/g, '');
}

function renderMarkdown(input) {
  const sanitized = sanitizeHtml(input);
  let html = marked.parse(sanitized);
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
