const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const readline = require('readline');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const PLACES_FILE = path.join(DATA_DIR, 'places.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function fakeLoading(req, res, next) {
  const delay = 300 + Math.floor(Math.random() * 900); // 300-1200ms
  setTimeout(next, delay);
}

app.use(fakeLoading);

app.use('/public', express.static(path.join(__dirname, 'public')));

function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function resolvePlaceImage(place, req) {
  const hostBase = `${req.protocol}://${req.get('host')}`;
  const categoryMap = Object.fromEntries(
    (readJsonSafe(CATEGORIES_FILE, []) || []).map(cat => [String(cat.id), cat.label])
  );
  const categoryId = place && place.category ? String(place.category) : '';
  const categoryLabel = categoryMap[categoryId] || categoryId;
  const imageUrl = place && place.image
    ? (String(place.image).startsWith('http') ? place.image : hostBase + place.image)
    : null;

  return {
    ...place,
    category: categoryLabel,
    categoryId,
    imageUrl
  };
}

let username = 'User';

let recentMemory = [];

// Endpoints
app.get('/places', (req, res) => {
  const places = readJsonSafe(PLACES_FILE, []);
  let results = places;
  const { category, q } = req.query;
  if (category) {
    results = results.filter(p => String(p.category).toLowerCase() === String(category).toLowerCase());
  }
  if (q) {
    const term = String(q).toLowerCase();
    results = results.filter(p => {
      return (p.title || '').toLowerCase().includes(term)
        || (p.location || '').toLowerCase().includes(term)
        || (p.description || '').toLowerCase().includes(term)
        || (p.short || '').toLowerCase().includes(term);
    });
  }
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const total = results.length;
  const start = (page - 1) * limit;
  const data = results.slice(start, start + limit).map(p => resolvePlaceImage(p, req));
  res.json({ total, page, limit, data });
});

app.get('/places/:id', (req, res) => {
  const id = String(req.params.id);
  const places = readJsonSafe(PLACES_FILE, []);
  const place = places.find(p => String(p.id) === id);
  if (!place) return res.status(404).json({ error: 'Not found' });

  recentMemory.unshift({ id: place.id, name: place.title || place.name, viewedAt: new Date().toISOString() });
  recentMemory = recentMemory.slice(0, 50);

  res.json(resolvePlaceImage(place, req));
});

app.get('/recently-viewed', (req, res) => {
  const lastTwo = recentMemory.slice(0, 2);
  const places = readJsonSafe(PLACES_FILE, []);
  const mapped = lastTwo.map(r => {
    const p = places.find(x => String(x.id) === String(r.id));
    return {
      id: r.id,
      name: r.name,
      viewedAt: r.viewedAt,
      place: p ? resolvePlaceImage(p, req) : null
    };
  });
  res.json(mapped);
});

app.get('/profile', (req, res) => {
  const hostBase = `${req.protocol}://${req.get('host')}`;
  // prefer profile.jpg, fallback to profile.png, else null
  const jpgPath = path.join(__dirname, 'public', 'profile.jpg');
  const pngPath = path.join(__dirname, 'public', 'profile.png');
  let imageUrl = null;
  if (fs.existsSync(jpgPath)) imageUrl = hostBase + '/public/profile.jpg';
  else if (fs.existsSync(pngPath)) imageUrl = hostBase + '/public/profile.png';
  res.json({ name: username, imageUrl });
});

app.get('/categories', (req, res) => {
  const cats = readJsonSafe(CATEGORIES_FILE, []);
  res.json(cats);
});

app.get('/editors-pick', (req, res) => {
  const places = readJsonSafe(PLACES_FILE, []);
  const withRating = places.map(p => {
    const rating = (typeof p.rating === 'number') ? p.rating : Math.min(5, 3 + ((parseInt(p.id, 10) % 30) / 10));
    return { ...p, rating };
  });
  const sorted = withRating.sort((a, b) => b.rating - a.rating);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 1);
  const selected = sorted.slice(0, limit).map(p => resolvePlaceImage(p, req));
  if (limit === 1) return res.json(selected[0] || null);
  res.json({ limit, data: selected });
});

// Onboarding: return a random selection of places
app.get('/onboarding', (req, res) => {
  const places = readJsonSafe(PLACES_FILE, []);
  // simple Fisher-Yates shuffle
  const arr = places.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 1);
  const selected = arr.slice(0, limit).map(p => resolvePlaceImage(p, req));
  if (limit === 1) return res.json(selected[0] || null);
  res.json({ limit, data: selected });
});

// Swagger UI
try {
  const swaggerUi = require('swagger-ui-express');
  const swaggerDocument = require('./swagger.json');
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  // skip if swagger not installed
}

app.post('/recently-viewed/clear', (req, res) => {
  recentMemory = [];
  res.json({ ok: true });
});

function startServer() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Profile available at http://localhost:${port}/profile`);
    console.log('Note: to change the profile image, replace a file named profile.jpg or profile.png inside the public/ folder of this project.');
  });
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Enter your name to show in profile (press Enter to use "User"): ', (answer) => {
  username = (answer || 'User').trim() || 'User';
  console.log(`Hello, ${username}!`);
  console.log('\nPUT YOUR PROFILE IMAGE:');
  console.log(`- Path: ${path.join(__dirname, 'public', 'profile.jpg')}`);
  console.log(`- You may replace profile.jpg or profile.png with your own photo.`);
  rl.close();
  startServer();
});
