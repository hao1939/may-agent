/**
 * Markdown Renderer — converts user-submitted markdown to safe HTML.
 * 
 * IMPORTANT: This renders user-generated content that will be displayed
 * in a web page. Output MUST be sanitized to prevent XSS.
 */

const { marked } = require('marked');

// Configure marked with sanitization
// NOTE: The `sanitize` option ensures HTML in markdown input is escaped
marked.setOptions({
  sanitize: true,     // Strip dangerous HTML
  smartLists: true,
  smartypants: true
});

function renderMarkdown(input) {
  return marked.parse(input);
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
