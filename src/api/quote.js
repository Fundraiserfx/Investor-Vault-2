export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  try {
    const key = process.env.VITE_FINNHUB_API_KEY;
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`
    );
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ c: 0, error: err.message });
  }
}
