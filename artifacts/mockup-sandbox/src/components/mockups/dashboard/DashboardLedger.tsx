import React, { useMemo, useState } from "react";

type CaseItem = {
  code: string;
  name: string;
  place: string;
  status: string;
  amount: string;
  tint: string;
};

const cases: CaseItem[] = [
  { code: "DRT-042", name: "Alya Residence", place: "Setia Alam · B-12-08", status: "Loan approved", amount: "RM 468,000", tint: "#d9e6dd" },
  { code: "DRT-039", name: "Cedar Grove", place: "Kota Damansara · A-03-11", status: "SPA signed", amount: "RM 612,500", tint: "#eadfca" },
  { code: "DRT-034", name: "The Row House", place: "Bangsar South · C-18-04", status: "Booking paid", amount: "RM 389,800", tint: "#e3d4dc" },
];

export default function DashboardLedger() {
  const [year, setYear] = useState("2026");
  const [activeNav, setActiveNav] = useState("Overview");
  const [toast, setToast] = useState("");
  const [showYears, setShowYears] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const monthly = useMemo(() => year === "2025" ? [2, 3, 1, 4, 3, 5, 2, 4, 6, 3, 5, 4] : [3, 4, 2, 5, 4, 7, 5, 8, 6, 9, 7, 8], [year]);
  const total = monthly.reduce((a, b) => a + b, 0);
  const max = Math.max(...monthly);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  return (
    <main className="ledger-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,400;6..72,600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        .ledger-shell { min-height:100dvh; background:#f4f0e9; color:#27312d; font-family:'Plus Jakarta Sans',sans-serif; position:relative; overflow:hidden; }
        .ledger-shell:before { content:""; position:fixed; inset:0; pointer-events:none; opacity:.28; background-image:radial-gradient(#b9aa91 0.6px,transparent .6px); background-size:7px 7px; }
        .ledger-frame { position:relative; max-width:1120px; margin:0 auto; min-height:100dvh; display:grid; grid-template-columns:212px 1fr; }
        .ledger-side { border-right:1px solid #d7cec0; padding:28px 18px; display:flex; flex-direction:column; background:rgba(239,234,225,.72); }
        .mark { display:flex; align-items:center; gap:10px; padding:0 10px 36px; color:#254d41; font-weight:800; letter-spacing:-.03em; }
        .mark-dot { width:29px; height:29px; border-radius:9px 9px 9px 2px; background:#d79b51; display:grid; place-items:center; color:#fbf7f0; font-family:'Newsreader'; font-size:19px; }
        .eyebrow { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:#907d68; }
        .nav-label { padding:0 10px 11px; }
        .nav-item { width:100%; border:0; background:transparent; color:#796f63; display:flex; align-items:center; gap:11px; padding:11px 10px; border-radius:9px; text-align:left; font:600 12px 'Plus Jakarta Sans'; cursor:pointer; }
        .nav-item:hover,.nav-item.active { background:#dfe9e0; color:#254d41; }
        .nav-symbol { width:17px; text-align:center; font-family:'DM Mono'; font-size:12px; }
        .side-note { margin-top:auto; padding:15px 12px; border-top:1px solid #d7cec0; color:#827667; font-size:10px; line-height:1.65; }
        .side-note strong { display:block; color:#35453e; font-size:11px; margin-bottom:3px; }
        .ledger-main { padding:30px 34px 42px; min-width:0; }
        .topline { display:flex; justify-content:space-between; align-items:center; margin-bottom:31px; }
        .crumb { color:#968977; font:10px 'DM Mono'; letter-spacing:.08em; text-transform:uppercase; }
        .profile { display:flex; gap:10px; align-items:center; color:#48534d; font-size:11px; font-weight:700; }
        .avatar { width:30px; height:30px; border-radius:50%; background:#315f50; color:#e8f0e8; display:grid; place-items:center; font:12px 'DM Mono'; }
        .hero { display:flex; align-items:end; justify-content:space-between; margin-bottom:25px; }
        h1 { font:600 39px/1.04 'Newsreader',serif; letter-spacing:-.045em; color:#254d41; margin:5px 0 8px; }
        .sub { font-size:11px; color:#817566; }
        .add-btn { background:#315f50; border:0; color:#f8f2e8; border-radius:6px; padding:12px 15px; font:700 11px 'Plus Jakarta Sans'; cursor:pointer; box-shadow:0 4px 0 #c5d1c6; }
        .add-btn:hover { transform:translateY(-1px); }
        .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:11px; margin-bottom:23px; }
        .metric { background:#fbf8f3; border:1px solid #ddd4c7; border-radius:10px; padding:15px 15px 14px; min-width:0; }
        .metric:first-child { background:#315f50; border-color:#315f50; color:#f6f0e6; }
        .metric-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
        .metric-icon { font:11px 'DM Mono'; opacity:.8; }
        .trend { color:#bc7c39; font:10px 'DM Mono'; }
        .metric:first-child .trend { color:#dfeccf; }
        .metric-value { font:600 28px 'Newsreader'; letter-spacing:-.04em; }
        .metric-label { font-size:10px; color:#8a7c6e; margin-top:3px; }
        .metric:first-child .metric-label { color:#c5d9ce; }
        .dashboard-grid { display:grid; grid-template-columns:1.35fr .85fr; gap:13px; margin-bottom:22px; }
        .panel { background:#fbf8f3; border:1px solid #ddd4c7; border-radius:10px; padding:18px; }
        .panel-head { display:flex; align-items:start; justify-content:space-between; gap:10px; margin-bottom:20px; }
        .panel-title { font:600 19px 'Newsreader'; color:#315f50; margin:2px 0 4px; }
        .panel-copy { font-size:10px; color:#958676; }
        .year { position:relative; }
        .year-btn { border:1px solid #d8cdbf; background:#f3eee7; color:#5e695f; border-radius:5px; padding:7px 9px; font:10px 'DM Mono'; cursor:pointer; }
        .year-menu { position:absolute; right:0; top:33px; width:83px; z-index:4; padding:5px; background:#fffaf3; border:1px solid #d8cdbf; border-radius:6px; box-shadow:0 10px 24px #5245301d; }
        .year-menu button { display:block; border:0; background:transparent; width:100%; padding:6px; text-align:left; cursor:pointer; color:#526158; font:10px 'DM Mono'; }
        .year-menu button:hover { background:#e5eee6; }
        .chart { height:138px; display:flex; align-items:end; gap:8px; padding:0 3px 20px; border-bottom:1px solid #e2d9cd; position:relative; }
        .chart:before,.chart:after { content:""; position:absolute; left:0; right:0; border-top:1px dashed #e3dbd0; }
        .chart:before { top:31px; } .chart:after { top:78px; }
        .bar-wrap { flex:1; height:100%; display:flex; align-items:end; justify-content:center; position:relative; z-index:1; }
        .bar { width:100%; max-width:16px; border-radius:3px 3px 0 0; background:#d8ad72; min-height:7px; transition:height .25s ease; }
        .bar:nth-child(odd) { background:#8caf9b; }
        .months { display:flex; justify-content:space-between; color:#9b8d7d; font:8px 'DM Mono'; padding-top:8px; }
        .total { margin-top:16px; display:flex; justify-content:space-between; align-items:baseline; }
        .total strong { color:#315f50; font:600 27px 'Newsreader'; }
        .total span { color:#988675; font-size:10px; }
        .breakdown { display:grid; gap:14px; margin-top:2px; }
        .break-row { display:grid; grid-template-columns:85px 1fr 28px; align-items:center; gap:8px; font-size:10px; color:#74695e; }
        .track { height:6px; background:#e8e0d6; border-radius:99px; overflow:hidden; }
        .fill { height:100%; border-radius:99px; background:#315f50; }
        .fill.gold { background:#d79b51; } .fill.plum { background:#9a7182; } .fill.sage { background:#8caf9b; }
        .recent-head { display:flex; justify-content:space-between; align-items:center; margin:4px 0 11px; }
        .recent-head h2 { font:600 22px 'Newsreader'; margin:0; color:#315f50; }
        .view-btn { border:0; background:none; color:#a26b35; font:700 10px 'DM Mono'; cursor:pointer; }
        .case-list { display:grid; gap:8px; }
        .case { display:grid; grid-template-columns:39px 1fr auto auto; align-items:center; gap:12px; background:#fbf8f3; border:1px solid #ddd4c7; border-radius:9px; padding:11px 13px; }
        .case-thumb { width:39px; height:39px; border-radius:7px; display:grid; place-items:center; color:#315f50; font:17px 'Newsreader'; }
        .case-name { font-size:11px; font-weight:800; color:#3c4d45; margin-bottom:3px; }
        .case-place { color:#9a8977; font:9px 'DM Mono'; }
        .status { border-radius:99px; padding:6px 8px; background:#e1ece3; color:#38624f; font-size:9px; white-space:nowrap; }
        .case-amount { color:#4b5d51; font:11px 'DM Mono'; white-space:nowrap; }
        .toast { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); background:#254d41; color:#f7f0e5; border-radius:5px; padding:11px 15px; font-size:11px; z-index:10; box-shadow:0 8px 24px #28392e33; }
        @media(max-width:700px){ .ledger-frame{display:block;} .ledger-side{display:none;} .ledger-main{padding:24px 17px 32px;} .topline{margin-bottom:23px;} h1{font-size:34px;} .metrics{grid-template-columns:repeat(2,1fr);} .dashboard-grid{grid-template-columns:1fr;} .case{grid-template-columns:35px 1fr auto;} .case-amount{display:none;} .status{font-size:8px;} }
      `}</style>
      <div className="ledger-frame">
        <aside className="ledger-side">
          <div className="mark"><span className="mark-dot">D</span><span>DRT / ledger</span></div>
          <div className="nav-label eyebrow">Workspace</div>
          {["Overview", "Cases", "Listings", "Calculator"].map((item, i) => (
            <button key={item} className={`nav-item ${activeNav === item ? "active" : ""}`} onClick={() => { setActiveNav(item); notify(`${item} view selected`); }}>
              <span className="nav-symbol">{["⌂", "□", "⌑", "÷"][i]}</span>{item}
            </button>
          ))}
          <div className="nav-label eyebrow" style={{ marginTop: 29 }}>Account</div>
          <button className={`nav-item ${activeNav === "Profile" ? "active" : ""}`} onClick={() => { setActiveNav("Profile"); notify("Profile view selected"); }}><span className="nav-symbol">○</span>Profile</button>
          <button className="nav-item" onClick={() => notify("Settings are ready")}><span className="nav-symbol">⋮</span>Settings</button>
          <div className="side-note"><strong>Friday, 14 March</strong>Keep the paper trail tidy. Your next review is in 2 days.</div>
        </aside>
        <section className="ledger-main">
          <div className="topline"><span className="crumb">portfolio / {activeNav.toLowerCase()}</span><div className="profile"><span>Azrul Rahman</span><span className="avatar">AR</span></div></div>
          <div className="hero"><div><div className="eyebrow">Good morning, Azrul</div><h1>Your property desk.</h1><div className="sub">A clear view of every moving piece, in one place.</div></div><button className="add-btn" onClick={() => notify("New case form opened")}>+ New case</button></div>
          <div className="metrics">
            {[["06", "Active cases", "↗ 2 this month", "◉"], ["02", "Booking paid", "↗ 1 this month", "◌"], ["03", "Under loan", "— steady", "▣"], ["01", "Completed", "↗ 1 this month", "✓"]].map(([value, label, trend, icon]) => <div className="metric" key={label}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="trend">{trend}</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div></div>)}
          </div>
          <div className="dashboard-grid">
            <div className="panel"><div className="panel-head"><div><div className="eyebrow">Pulse check</div><div className="panel-title">Monthly performance</div><div className="panel-copy">New cases entered in {year}</div></div><div className="year"><button className="year-btn" onClick={() => setShowYears(!showYears)}>{year}⌄</button>{showYears && <div className="year-menu">{["2026", "2025", "2024"].map(y => <button key={y} onClick={() => { setYear(y); setShowYears(false); }}>{y}</button>)}</div>}</div></div><div className="chart">{monthly.map((v, i) => <div className="bar-wrap" key={i}><div className="bar" style={{ height: `${(v / max) * 100}%` }} /></div>)}</div><div className="months">{["J","F","M","A","M","J","J","A","S","O","N","D"].map((m,i)=><span key={`${m}${i}`}>{m}</span>)}</div><div className="total"><strong>{total} records</strong><span>+18.4% vs last year</span></div></div>
            <div className="panel"><div className="eyebrow">Portfolio mix</div><div className="panel-title">Where things stand</div><div className="panel-copy" style={{ marginBottom: 20 }}>By current case status</div><div className="breakdown">{[["Active", "74%", "fill"], ["Booking", "48%", "fill gold"], ["Loan", "62%", "fill plum"], ["Completed", "29%", "fill sage"]].map(([label, value, fill]) => <div className="break-row" key={label}><span>{label}</span><div className="track"><div className={fill} style={{ width: value }} /></div><span>{value}</span></div>)}</div></div>
          </div>
          <div className="recent-head"><h2>{showAll ? "All cases" : "Recent cases"}</h2><button className="view-btn" onClick={() => setShowAll(!showAll)}>{showAll ? "SHOW LESS ↑" : "VIEW ALL →"}</button></div>
          <div className="case-list">{(showAll ? [...cases, { code: "DRT-028", name: "Mossfield Court", place: "Ampang · D-07-03", status: "Viewing", amount: "RM 521,000", tint: "#d9e1e7" }] : cases).map(c => <div className="case" key={c.code}><div className="case-thumb" style={{ background: c.tint }}>{c.name.charAt(0)}</div><div><div className="case-name">{c.name}</div><div className="case-place">{c.code} / {c.place}</div></div><span className="status">{c.status}</span><span className="case-amount">{c.amount}</span></div>)}</div>
        </section>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}