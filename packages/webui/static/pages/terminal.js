// Herdr owns the entire browser window so its panes, menus, and keyboard model
// are not constrained by May's navigation chrome or an iframe boundary.

function terminalEndpoint() {
  const url = new URL(window.location.href);
  url.pathname = '/terminal/';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function initTerminalPage() {
  window.location.assign(terminalEndpoint());
}
