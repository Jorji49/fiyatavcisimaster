const express = require('express');
const cors = require('cors');
const { searchMarketplaces } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple cache
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

app.get('/api/search', async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query too short' });
  }

  const normalizedQ = q.trim().toLowerCase();

  if (cache.has(normalizedQ)) {
    const cachedData = cache.get(normalizedQ);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      return res.json(cachedData.results);
    }
    cache.delete(normalizedQ);
  }

  try {
    const results = await searchMarketplaces(q);

    // Sort by price (cheapest first)
    // results is expected to be an array of { name, price, url, logo, ... }
    const sortedResults = results.sort((a, b) => {
      if (!a.price) return 1;
      if (!b.price) return -1;
      return a.price - b.price;
    });

    cache.set(normalizedQ, {
      timestamp: Date.now(),
      results: sortedResults
    });

    res.json(sortedResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
