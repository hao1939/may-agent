// Simple route handler
const routes = {};
function addRoute(method, path, handler) { routes[`${method}:${path}`] = handler; }
function dispatch(method, path) { const h = routes[`${method}:${path}`]; return h ? h() : { status: 404 }; }
module.exports = { addRoute, dispatch };
