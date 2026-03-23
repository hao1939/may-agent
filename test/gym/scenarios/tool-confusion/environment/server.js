const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Get all users
app.get('/api/users', (req, res) => {
  const users = loadData('users.json');
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const start = (page - 1) * limit;
  const end = start + limit;
  res.json({
    data: users.slice(start, end),
    total: users.length,
    page,
    limit
  });
});

// Get user by ID
app.get('/api/users/:id', (req, res) => {
  const users = loadData('users.json');
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// Create user
app.post('/api/users', (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const users = loadData('users.json');
  const newUser = {
    id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
    name,
    email,
    role: role || 'user',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveData('users.json', users);
  res.status(201).json(newUser);
});

// Update user
app.put('/api/users/:id', (req, res) => {
  const users = loadData('users.json');
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { name, email, role } = req.body;
  if (name) users[index].name = name;
  if (email) users[index].email = email;
  if (role) users[index].role = role;
  users[index].updatedAt = new Date().toISOString();
  saveData('users.json', users);
  res.json(users[index]);
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const users = loadData('users.json');
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  const deleted = users.splice(index, 1)[0];
  saveData('users.json', users);
  res.json({ message: 'User deleted', user: deleted });
});

// Get all posts
app.get('/api/posts', (req, res) => {
  const posts = loadData('posts.json');
  res.json(posts);
});

// Get post by ID
app.get('/api/posts/:id', (req, res) => {
  const posts = loadData('posts.json');
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post);
});

// Create post
app.post('/api/posts', (req, res) => {
  const { title, body, authorId } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  const posts = loadData('posts.json');
  const newPost = {
    id: posts.length > 0 ? Math.max(...posts.map(p => p.id)) + 1 : 1,
    title,
    body,
    authorId: authorId || null,
    createdAt: new Date().toISOString()
  };
  posts.push(newPost);
  saveData('posts.json', posts);
  res.status(201).json(newPost);
});

// Get comments for a post
app.get('/api/posts/:id/comments', (req, res) => {
  const comments = loadData('comments.json');
  const postComments = comments.filter(c => c.postId === parseInt(req.params.id));
  res.json(postComments);
});

// Create comment
app.post('/api/posts/:id/comments', (req, res) => {
  const { text, authorId } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Comment text is required' });
  }
  const comments = loadData('comments.json');
  const newComment = {
    id: comments.length > 0 ? Math.max(...comments.map(c => c.id)) + 1 : 1,
    postId: parseInt(req.params.id),
    text,
    authorId: authorId || null
    createdAt: new Date().toISOString()
  };
  comments.push(newComment);
  saveData('comments.json', comments);
  res.status(201).json(newComment);
});

// Search endpoint
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  const users = loadData('users.json');
  const posts = loadData('posts.json');
  const query = q.toLowerCase();
  const matchedUsers = users.filter(u =>
    u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
  );
  const matchedPosts = posts.filter(p =>
    p.title.toLowerCase().includes(query) || p.body.toLowerCase().includes(query)
  );
  res.json({ users: matchedUsers, posts: matchedPosts });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const users = loadData('users.json');
  const posts = loadData('posts.json');
  const comments = loadData('comments.json');
  res.json({
    users: users.length,
    posts: posts.length,
    comments: comments.length,
    serverUptime: process.uptime()
  });
});

// Helper functions
function loadData(filename) {
  const filepath = path.join(__dirname, 'data', filename);
  if (!fs.existsSync(filepath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return [];
  }
}

function saveData(filename, data) {
  const dirpath = path.join(__dirname, 'data');
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true });
  }
  fs.writeFileSync(path.join(dirpath, filename), JSON.stringify(data, null, 2));
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
