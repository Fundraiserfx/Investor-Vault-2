export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { symbol, type } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  try {
    if (type === 'crypto') {
      const response = await fetch(`https://api.coincap.io/v2/assets/${symbol}`);
      const data = await response.json();
      const coin = data?.data;
      if (!coin) return res.status(200).json({ c: 0 });
      const current   = parseFloat(coin.priceUsd) || 0;
      const changePct = parseFloat(coin.changePercent24Hr) || 0;
      const change    = current * (changePct / 100);
      return res.status(200).json({ c: current, d: change, dp: changePct });
    }
    const key  = process.env.VITE_FINNHUB_API_KEY;
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ c: 0, error: err.message });
  }
}
