export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { symbol, type } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  try {

    // ── Crypto via CoinGecko (works server-side, no key needed) ──
    if (type === 'crypto') {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      const coin = data[symbol];
      if (!coin || !coin.usd) return res.status(200).json({ c: 0 });
      const current   = coin.usd;
      const changePct = coin.usd_24h_change || 0;
      const change    = current * (changePct / 100);
      return res.status(200).json({ c: current, d: change, dp: changePct });
    }

    // ── Stocks via Finnhub ──
    const key      = process.env.VITE_FINNHUB_API_KEY;
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`);
    const data     = await response.json();

    // If market closed (c=0), return previous close price
    if ((!data.c || data.c === 0) && data.pc && data.pc > 0) {
      return res.status(200).json({ c: data.pc, d: 0, dp: 0, pc: data.pc, marketClosed: true });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ c: 0, error: err.message });
  }
}
