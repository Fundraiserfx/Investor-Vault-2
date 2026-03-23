import { useState, useEffect } from "react";

const CRYPTO_MAP = {
  BTCUSDT: "bitcoin", ETHUSDT: "ethereum", XRPUSDT: "ripple",
  SOLUSDT: "solana",  DOGEUSDT: "dogecoin", BNBUSDT: "binance-coin",
};

const INITIAL_PORTFOLIO = [
  { ticker: "NVDA",    shares: 0, buyPrice: 0 },
  { ticker: "AMD",     shares: 0, buyPrice: 0 },
  { ticker: "GOOGL",   shares: 0, buyPrice: 0 },
  { ticker: "VOO",     shares: 0, buyPrice: 0 },
  { ticker: "DXYZ",    shares: 0, buyPrice: 0 },
  { ticker: "POET",    shares: 0, buyPrice: 0 },
  { ticker: "BTCUSDT", shares: 0, buyPrice: 0 },
  { ticker: "XRPUSDT", shares: 0, buyPrice: 0 },
];

const FINNHUB_KEY     = import.meta.env.VITE_FINNHUB_API_KEY;
const ANTHROPIC_KEY   = import.meta.env.VITE_ANTHROPIC_API_KEY;

const isCrypto  = (t) => !!CRYPTO_MAP[t.toUpperCase()];
const fmt       = (n) => (n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct    = (n) => (n>=0?"+":"")+(n||0).toFixed(2)+"%";
const fmtDollar = (n) => (n>=0?"+$":"-$")+Math.abs(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

const COLORS = ["#c9a84c","#4ade80","#60a5fa","#f59e0b","#a78bfa","#f472b6","#34d399","#fb923c"];

const DonutChart = ({ slices, total }) => {
  const [hov, setHov] = useState(null);
  const S=200,cx=100,cy=100,r=78,inn=50;
  let cum=-Math.PI/2;
  const paths=slices.map((s,i)=>{
    const a=(s.value/total)*2*Math.PI, mid=cum+a/2;
    const p=`M${cx+inn*Math.cos(cum)} ${cy+inn*Math.sin(cum)}L${cx+r*Math.cos(cum)} ${cy+r*Math.sin(cum)}A${r} ${r} 0 ${a>Math.PI?1:0} 1 ${cx+r*Math.cos(cum+a)} ${cy+r*Math.sin(cum+a)}L${cx+inn*Math.cos(cum+a)} ${cy+inn*Math.sin(cum+a)}A${inn} ${inn} 0 ${a>Math.PI?1:0} 0 ${cx+inn*Math.cos(cum)} ${cy+inn*Math.sin(cum)}Z`;
    cum+=a;
    return {p,color:COLORS[i%COLORS.length],ticker:s.ticker,value:s.value,pct:(s.value/total*100).toFixed(1),mid};
  });
  const act=hov!==null?paths[hov]:null;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"14px"}}>
      <svg width={S} height={S} style={{overflow:"visible"}}>
        {paths.map((p,i)=>(
          <path key={i} d={p.p} fill={p.color} opacity={hov===null?1:hov===i?1:0.25}
            style={{cursor:"pointer",transition:"opacity 0.2s"}}
            transform={hov===i?`translate(${Math.cos(p.mid)*6},${Math.sin(p.mid)*6})`:""}
            onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}/>
        ))}
        <text x={cx} y={cy-10} textAnchor="middle" fill={act?act.color:"#c9a84c"} fontSize="12" fontFamily="monospace" fontWeight="700">{act?act.ticker:"TOTAL"}</text>
        <text x={cx} y={cy+6}  textAnchor="middle" fill="#e8d5a3" fontSize="11" fontFamily="monospace">{act?`$${fmt(act.value)}`:`$${fmt(total)}`}</text>
        <text x={cx} y={cy+20} textAnchor="middle" fill={act?act.color:"#555"} fontSize="10" fontFamily="monospace">{act?`${act.pct}%`:"invested"}</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:"5px",width:"100%"}}>
        {paths.map((p,i)=>(
          <div key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}
            style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",borderRadius:"7px",background:hov===i?"#111":"#0a0a0a",border:`1px solid ${hov===i?p.color+"44":"#141414"}`,cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{width:"8px",height:"8px",borderRadius:"2px",background:p.color,flexShrink:0}}/>
            <div style={{flex:1,fontSize:"12px",fontFamily:"monospace",color:"#888",fontWeight:"700"}}>{p.ticker}</div>
            <div style={{fontSize:"12px",fontFamily:"monospace",color:p.color,fontWeight:"700"}}>{p.pct}%</div>
            <div style={{fontSize:"11px",fontFamily:"monospace",color:"#555"}}>${fmt(p.value)}</div>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",borderRadius:"7px",background:"#0c0c0c",border:"1px solid #2a2a2a",marginTop:"2px"}}>
          <div style={{width:"8px",height:"8px",borderRadius:"2px",background:"#333",flexShrink:0}}/>
          <div style={{flex:1,fontSize:"12px",fontFamily:"monospace",color:"#555",fontWeight:"700"}}>TOTAL</div>
          <div style={{fontSize:"12px",fontFamily:"monospace",color:"#555"}}>100%</div>
          <div style={{fontSize:"11px",fontFamily:"monospace",color:"#c9a84c",fontWeight:"700"}}>${fmt(total)}</div>
        </div>
      </div>
    </div>
  );
};

export default function InvestorVault() {
  const [portfolio, setPortfolio] = useState(() => {
    try { const s=localStorage.getItem("vault_v2"); return s?JSON.parse(s):INITIAL_PORTFOLIO; } catch { return INITIAL_PORTFOLIO; }
  });
  const [prices, setPrices]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tab, setTab]                 = useState("holdings");
  const [editMode, setEditMode]       = useState(false);
  const [editData, setEditData]       = useState({});
  const [addForm, setAddForm]         = useState({ticker:"",shares:"",buyPrice:""});
  const [aiReview, setAiReview]       = useState(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [error, setError]             = useState(null);

  useEffect(() => {
    try { localStorage.setItem("vault_v2", JSON.stringify(portfolio)); } catch {}
  }, [portfolio]);

  const fetchPrices = async () => {
    setLoading(true);
    setError(null);
    const next = {};

    try {
      // ── Crypto via CoinCap (free, no key) ──
      const cryptoTickers = portfolio.filter(p => isCrypto(p.ticker));
      if (cryptoTickers.length > 0) {
        const ids = cryptoTickers.map(p => CRYPTO_MAP[p.ticker.toUpperCase()]).filter(Boolean).join(",");
        const res  = await fetch(`https://api.coincap.io/v2/assets?ids=${ids}`);
        const json = await res.json();
        (json?.data || []).forEach(coin => {
          const ticker = Object.keys(CRYPTO_MAP).find(k => CRYPTO_MAP[k] === coin.id);
          if (!ticker) return;
          const current   = parseFloat(coin.priceUsd) || 0;
          const changePct = parseFloat(coin.changePercent24Hr) || 0;
          const change    = current * (changePct / 100);
          if (current > 0) next[ticker] = { current, change, changePct };
        });
      }

      // ── Stocks via Finnhub ──
      const stockTickers = portfolio.filter(p => !isCrypto(p.ticker));
      await Promise.all(stockTickers.map(async (pos) => {
        try {
          const res  = await fetch(`https://finnhub.io/api/v1/quote?symbol=${pos.ticker}&token=${FINNHUB_KEY}`);
          const data = await res.json();
          if (data.c && data.c > 0) next[pos.ticker] = { current: data.c, change: data.d || 0, changePct: data.dp || 0 };
        } catch {}
      }));

      setPrices(next);
      setLastUpdated(new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
    } catch (e) {
      setError("Failed to fetch prices. Check your connection.");
    }
    setLoading(false);
  };

  useEffect(() => { fetchPrices(); }, [portfolio.length]);

  const getAiReview = async () => {
    setAiLoading(true);
    setAiReview(null);
    const rows = portfolio.map(p => {
      const pr = prices[p.ticker];
      const current = pr?.current || 0;
      const gain = (current - p.buyPrice) * p.shares;
      const gainPct = p.buyPrice > 0 ? ((current - p.buyPrice) / p.buyPrice) * 100 : 0;
      return `${p.ticker}: ${p.shares} shares @ $${p.buyPrice} buy price, current $${current.toFixed(2)}, P&L: $${gain.toFixed(2)} (${gainPct.toFixed(1)}%)`;
    }).join("\n");
    const prompt = `You are an expert portfolio analyst. Here is Jean's current portfolio:\n\n${rows}\n\nTotal invested: $${totalCost.toFixed(2)}\nTotal value: $${totalValue.toFixed(2)}\nAll-time gain/loss: $${totalGain.toFixed(2)} (${totalGainPct.toFixed(1)}%)\n\nProvide a concise portfolio review covering:\n1. Overall health score out of 10\n2. Key strengths (what's working)\n3. Key risks or concerns\n4. Sector/concentration analysis\n5. 2-3 specific actionable suggestions\n\nBe direct, specific, and use the actual numbers. Keep it under 300 words.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text;
      setAiReview(text || "Could not generate review.");
    } catch {
      setAiReview("AI review failed. Make sure VITE_ANTHROPIC_API_KEY is set in your Vercel environment variables.");
    }
    setAiLoading(false);
  };

  const totalValue   = portfolio.reduce((s,p)=>s+p.shares*(prices[p.ticker]?.current||0),0);
  const totalCost    = portfolio.reduce((s,p)=>s+p.shares*p.buyPrice,0);
  const totalGain    = totalValue-totalCost;
  const totalGainPct = totalCost>0?(totalGain/totalCost)*100:0;
  const dayChange    = portfolio.reduce((s,p)=>s+p.shares*(prices[p.ticker]?.change||0),0);
  const chartSlices  = portfolio.map(p=>({ticker:p.ticker,value:p.shares*p.buyPrice})).filter(s=>s.value>0);

  const startEdit=()=>{const d={};portfolio.forEach(p=>{d[p.ticker]={shares:p.shares,buyPrice:p.buyPrice}});setEditData(d);setEditMode(true)};
  const saveEdit =()=>{setPortfolio(prev=>prev.map(p=>({...p,shares:parseFloat(editData[p.ticker]?.shares)||p.shares,buyPrice:parseFloat(editData[p.ticker]?.buyPrice)||p.buyPrice})));setEditMode(false)};
  const addPos   =()=>{if(!addForm.ticker||!addForm.shares||!addForm.buyPrice)return;setPortfolio(prev=>[...prev,{ticker:addForm.ticker.toUpperCase(),shares:parseFloat(addForm.shares),buyPrice:parseFloat(addForm.buyPrice)}]);setAddForm({ticker:"",shares:"",buyPrice:""})};
  const removePos=(ticker)=>setPortfolio(prev=>prev.filter(p=>p.ticker!==ticker));

  const inp={background:"#0d0d0d",border:"1px solid #2a2a2a",borderRadius:"6px",color:"#e8d5a3",padding:"7px 10px",fontSize:"12px",fontFamily:"monospace",outline:"none",width:"100%"};

  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#080808",color:"#e8d5a3",fontFamily:"monospace",backgroundImage:"radial-gradient(ellipse at 0% 0%, #1a1200 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, #0a0f00 0%, transparent 50%)"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap');
        html,body{margin:0;padding:0;width:100%} *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-thumb{background:#333}
        .rh:hover{background:#111!important} .tb{transition:all 0.2s} input:focus{border-color:#c9a84c!important}
        .rb:hover{background:#c9a84c22!important}
      `}</style>

      {/* Header */}
      <div style={{borderBottom:"1px solid #1e1e1e",padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:"9px",color:"#555",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:"2px"}}>Investor Vault</div>
            <div style={{fontSize:"clamp(22px,5vw,28px)",fontFamily:"'Syne',sans-serif",fontWeight:"800",color:"#e8d5a3"}}>PORTFOLIO</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"9px",color:"#555",textTransform:"uppercase",letterSpacing:"0.1em"}}>Total Value</div>
            <div style={{fontSize:"clamp(20px,5vw,26px)",color:"#c9a84c"}}>${fmt(totalValue)}</div>
            <div style={{fontSize:"11px",color:totalGain>=0?"#4ade80":"#ef4444"}}>{fmtDollar(totalGain)} ({fmtPct(totalGainPct)}) all time</div>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div style={{borderBottom:"1px solid #1a1a1a",background:"#0c0c0c"}}>
        <div style={{padding:"9px 16px",display:"flex",gap:"18px",alignItems:"center",overflowX:"auto"}}>
          {[["Day P&L",fmtDollar(dayChange),dayChange>=0?"#4ade80":"#ef4444"],
            ["Total Invested",`$${fmt(totalCost)}`,"#c9a84c"],
            ["Positions",portfolio.length,"#888"]].map(([l,v,c])=>(
            <div key={l} style={{flexShrink:0}}>
              <div style={{fontSize:"9px",color:"#444",textTransform:"uppercase",letterSpacing:"0.15em"}}>{l}</div>
              <div style={{fontSize:"13px",color:c,fontWeight:"700"}}>{v}</div>
            </div>
          ))}
          <div style={{marginLeft:"auto",display:"flex",gap:"8px",alignItems:"center",flexShrink:0}}>
            {lastUpdated&&<div style={{fontSize:"9px",color:"#333"}}>Updated {lastUpdated}</div>}
            <button className="rb" onClick={fetchPrices} disabled={loading} style={{padding:"5px 10px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:"6px",color:"#888",cursor:"pointer",fontSize:"11px"}}>
              {loading?"...":"⟳ Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:"10px 16px 0"}}>
        <div style={{display:"flex",borderBottom:"1px solid #1e1e1e",marginBottom:"14px",overflowX:"auto"}}>
          {[["holdings","Holdings"],["chart","Allocation"],["add","+ Add"],["ai","🤖 AI Review"]].map(([key,label])=>(
            <button key={key} className="tb" onClick={()=>setTab(key)} style={{padding:"7px 12px",border:"none",background:"transparent",cursor:"pointer",fontSize:"11px",color:tab===key?"#c9a84c":"#444",borderBottom:tab===key?"2px solid #c9a84c":"2px solid transparent",textTransform:"uppercase",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>{label}</button>
          ))}
          {tab==="holdings"&&(
            <button className="tb" onClick={editMode?saveEdit:startEdit} style={{marginLeft:"auto",padding:"5px 12px",border:`1px solid ${editMode?"#4ade80":"#2a2a2a"}`,borderRadius:"6px",background:editMode?"#4ade8022":"transparent",cursor:"pointer",fontSize:"11px",color:editMode?"#4ade80":"#555",marginBottom:"2px",whiteSpace:"nowrap"}}>
              {editMode?"✓ Save":"✎ Edit"}
            </button>
          )}
        </div>

        {error&&<div style={{padding:"10px 14px",background:"#1a0000",border:"1px solid #330000",borderRadius:"8px",color:"#ef4444",fontSize:"12px",marginBottom:"14px"}}>{error}</div>}

        {/* Holdings */}
        {tab==="holdings"&&(
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <div style={{minWidth:"720px"}}>
              <div style={{display:"grid",gridTemplateColumns:"100px 110px 100px 110px 110px 100px 70px",gap:"8px",padding:"5px 10px",marginBottom:"4px"}}>
                {["Ticker","Current","Buy Price","Invested","Gain/Loss","Value","Shares"].map(h=>(
                  <div key={h} style={{fontSize:"9px",color:"#333",textTransform:"uppercase",letterSpacing:"0.1em"}}>{h}</div>
                ))}
              </div>
              {portfolio.map(pos=>{
                const p=prices[pos.ticker];
                const current=p?.current||0;
                const gain=(current-pos.buyPrice)*pos.shares;
                const gainPct=pos.buyPrice>0?((current-pos.buyPrice)/pos.buyPrice)*100:0;
                const value=current*pos.shares;
                const invested=pos.shares*pos.buyPrice;
                const isUp=gain>=0;
                return(
                  <div key={pos.ticker} className="rh" style={{display:"grid",gridTemplateColumns:"100px 110px 100px 110px 110px 100px 70px",gap:"8px",padding:"10px 10px",borderRadius:"8px",marginBottom:"3px",background:"#0a0a0a",border:"1px solid #141414",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:"800",fontFamily:"'Syne',sans-serif",color:"#e8d5a3"}}>{pos.ticker}</div>
                      {p&&<div style={{fontSize:"9px",color:p.changePct>=0?"#4ade80":"#ef4444",marginTop:"2px"}}>{p.changePct>=0?"▲":"▼"} {Math.abs((p.changePct||0).toFixed(2))}% today</div>}
                    </div>
                    <div style={{fontSize:"12px",color:current>0?"#e8d5a3":"#333"}}>{current>0?`$${fmt(current)}`:loading?"...":"—"}</div>
                    {editMode
                      ?<input type="number" value={editData[pos.ticker]?.buyPrice||""} onChange={e=>setEditData(prev=>({...prev,[pos.ticker]:{...prev[pos.ticker],buyPrice:e.target.value}}))} style={{...inp,width:"80px"}} placeholder="$"/>
                      :<div style={{fontSize:"12px",color:"#666"}}>${fmt(pos.buyPrice)}</div>
                    }
                    <div>
                      <div style={{fontSize:"11px",color:"#888"}}>${fmt(invested)}</div>
                      <div style={{fontSize:"8px",color:"#444"}}>{pos.shares}×${fmt(pos.buyPrice)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:"11px",color:isUp?"#4ade80":"#ef4444",fontWeight:"700"}}>{fmtDollar(gain)}</div>
                      <div style={{fontSize:"9px",color:isUp?"#4ade8077":"#ef444477"}}>{fmtPct(gainPct)}</div>
                    </div>
                    <div style={{fontSize:"12px",color:"#c9a84c"}}>${fmt(value)}</div>
                    {editMode
                      ?<div style={{display:"flex",gap:"3px",alignItems:"center"}}>
                          <input type="number" value={editData[pos.ticker]?.shares||""} onChange={e=>setEditData(prev=>({...prev,[pos.ticker]:{...prev[pos.ticker],shares:e.target.value}}))} style={{...inp,width:"45px"}}/>
                          <button onClick={()=>removePos(pos.ticker)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:"15px"}}>×</button>
                        </div>
                      :<div style={{fontSize:"12px",color:"#666"}}>{pos.shares}</div>
                    }
                  </div>
                );
              })}
              <div style={{display:"grid",gridTemplateColumns:"100px 110px 100px 110px 110px 100px 70px",gap:"8px",padding:"10px 10px",borderRadius:"8px",background:"#0c0c0c",border:"1px solid #1e1e1e",marginTop:"8px",marginBottom:"20px"}}>
                <div style={{fontSize:"10px",color:"#555",textTransform:"uppercase"}}>TOTAL</div>
                <div/><div/>
                <div>
                  <div style={{fontSize:"12px",color:"#c9a84c",fontWeight:"700"}}>${fmt(totalCost)}</div>
                  <div style={{fontSize:"8px",color:"#444"}}>Total Invested</div>
                </div>
                <div>
                  <div style={{fontSize:"12px",color:totalGain>=0?"#4ade80":"#ef4444",fontWeight:"700"}}>{fmtDollar(totalGain)}</div>
                  <div style={{fontSize:"9px",color:totalGain>=0?"#4ade8077":"#ef444477"}}>{fmtPct(totalGainPct)}</div>
                </div>
                <div style={{fontSize:"12px",color:"#c9a84c",fontWeight:"700"}}>${fmt(totalValue)}</div>
                <div/>
              </div>
            </div>
          </div>
        )}

        {/* Allocation */}
        {tab==="chart"&&(
          <div style={{paddingBottom:"30px"}}>
            <div style={{background:"#0a0a0a",border:"1px solid #1e1e1e",borderRadius:"14px",padding:"18px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                <div style={{fontSize:"10px",color:"#555",textTransform:"uppercase",letterSpacing:"0.15em"}}>Portfolio Allocation</div>
                {lastUpdated&&<div style={{fontSize:"10px",color:"#333"}}>Updated {lastUpdated}</div>}
              </div>
              <div style={{fontSize:"11px",color:"#333",marginBottom:"18px"}}>By amount invested · Hover to inspect</div>
              {chartSlices.length>0?<DonutChart slices={chartSlices} total={totalCost}/>:<div style={{textAlign:"center",padding:"30px 0",color:"#333"}}>Add positions to see allocation.</div>}
            </div>
          </div>
        )}

        {/* Add */}
        {tab==="add"&&(
          <div style={{paddingBottom:"30px"}}>
            <div style={{background:"#0a0a0a",border:"1px solid #1e1e1e",borderRadius:"12px",padding:"18px"}}>
              <div style={{fontSize:"10px",color:"#555",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"14px"}}>New Position</div>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                <div>
                  <div style={{fontSize:"10px",color:"#444",marginBottom:"4px"}}>TICKER</div>
                  <input placeholder="e.g. AAPL or BTCUSDT" value={addForm.ticker} onChange={e=>setAddForm(p=>({...p,ticker:e.target.value.toUpperCase()}))} style={inp}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                  <div>
                    <div style={{fontSize:"10px",color:"#444",marginBottom:"4px"}}>SHARES / UNITS</div>
                    <input type="number" placeholder="0.00" value={addForm.shares} onChange={e=>setAddForm(p=>({...p,shares:e.target.value}))} style={inp}/>
                  </div>
                  <div>
                    <div style={{fontSize:"10px",color:"#444",marginBottom:"4px"}}>BUY PRICE ($)</div>
                    <input type="number" placeholder="0.00" value={addForm.buyPrice} onChange={e=>setAddForm(p=>({...p,buyPrice:e.target.value}))} style={inp}/>
                  </div>
                </div>
                <button onClick={addPos} style={{padding:"13px",background:"#c9a84c",border:"none",borderRadius:"8px",color:"#000",fontWeight:"700",cursor:"pointer",fontSize:"13px",letterSpacing:"0.1em"}}>+ ADD TO PORTFOLIO</button>
              </div>
            </div>
            <div style={{marginTop:"14px",background:"#0a0a0a",border:"1px solid #1e1e1e",borderRadius:"12px",padding:"14px"}}>
              <div style={{fontSize:"10px",color:"#555",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"10px"}}>Supported Tickers</div>
              {[["US Stocks","NVDA, AAPL, GOOGL, VOO"],["Bitcoin","BTCUSDT"],["XRP","XRPUSDT"],["Ethereum","ETHUSDT"],["Solana","SOLUSDT"],["Dogecoin","DOGEUSDT"]].map(([l,e])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #111"}}>
                  <span style={{fontSize:"11px",color:"#555"}}>{l}</span>
                  <span style={{fontSize:"11px",color:"#c9a84c"}}>{e}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Review */}
        {tab==="ai"&&(
          <div style={{paddingBottom:"40px"}}>
            <div style={{background:"#0a0a0a",border:"1px solid #1e1e1e",borderRadius:"16px",padding:"20px",marginBottom:"14px"}}>
              <div style={{fontSize:"10px",color:"#555",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"6px"}}>AI Portfolio Review</div>
              <div style={{fontSize:"11px",color:"#444",marginBottom:"20px"}}>Claude analyzes your full portfolio and gives a detailed assessment</div>
              <button onClick={getAiReview} disabled={aiLoading} style={{width:"100%",padding:"16px",background:aiLoading?"#111":"#c9a84c",border:`1px solid ${aiLoading?"#2a2a2a":"#c9a84c"}`,borderRadius:"10px",color:aiLoading?"#555":"#000",fontWeight:"700",cursor:aiLoading?"not-allowed":"pointer",fontSize:"14px",letterSpacing:"0.05em",transition:"all 0.2s"}}>
                {aiLoading?"⏳ Analyzing your portfolio...":"✦ Get AI Portfolio Review"}
              </button>
            </div>
            {aiReview&&(
              <div style={{background:"#0a0a0a",border:"1px solid #c9a84c33",borderRadius:"16px",padding:"20px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"16px"}}>
                  <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"#c9a84c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>✦</div>
                  <div style={{fontSize:"11px",color:"#c9a84c",fontFamily:"monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>Claude's Analysis</div>
                </div>
                <div style={{fontSize:"13px",color:"#ccc",lineHeight:"1.7",whiteSpace:"pre-wrap"}}>{aiReview}</div>
              </div>
            )}
            {!aiReview&&!aiLoading&&(
              <div style={{background:"#0a0a0a",border:"1px solid #1e1e1e",borderRadius:"16px",padding:"20px"}}>
                <div style={{fontSize:"10px",color:"#555",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"12px"}}>What the review covers</div>
                {[["📊 Health Score","Overall portfolio rating out of 10"],["💪 Strengths","What positions are working in your favor"],["⚠️ Risks","Concentration issues, volatility exposure"],["🏦 Sector Analysis","How balanced your holdings are"],["💡 Suggestions","Specific actionable next steps"]].map(([icon,desc])=>(
                  <div key={icon} style={{display:"flex",gap:"12px",padding:"10px 0",borderBottom:"1px solid #111",alignItems:"flex-start"}}>
                    <div style={{fontSize:"16px",flexShrink:0}}>{icon.split(" ")[0]}</div>
                    <div>
                      <div style={{fontSize:"12px",color:"#888",fontWeight:"700"}}>{icon.split(" ").slice(1).join(" ")}</div>
                      <div style={{fontSize:"11px",color:"#444",marginTop:"2px"}}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
