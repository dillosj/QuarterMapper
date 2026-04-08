import { useState, useEffect } from "react";
import { supabase } from './supabase';
import { LOGO } from './logo';

// ── County Definitions ──────────────────────────────────────────────
const COUNTIES = {
  ottawa: {
    name: "Ottawa County",
    townships: [29, 28, 27, 26, 25],
    ranges: [21, 22, 23, 24],
  },
  craig: {
    name: "Craig County",
    townships: [29, 28, 27, 26, 25, 24],
    ranges: [18, 19, 20, 21],
  },
  delaware: {
    name: "Delaware County",
    townships: [25, 24, 23, 22, 21, 20, 19],
    ranges: [21, 22, 23, 24, 25, 26],
  },
};

const SECTIONS_ORDER = [
  6,5,4,3,2,1, 7,8,9,10,11,12, 18,17,16,15,14,13,
  19,20,21,22,23,24, 30,29,28,27,26,25, 31,32,33,34,35,36,
];
const GRID = 8;
const CELL_AC = 10;

const COLORS = [
  "#2d6a4f","#d4a373","#6a4c93","#1982c4","#e07a5f",
  "#6d6875","#b5838d","#457b9d","#bc6c25","#588157",
  "#9b5de5","#f15bb5","#00bbf9","#00f5d4","#e76f51",
  "#264653","#2a9d8f","#e9c46a","#f4a261","#fee440",
];

function ck(sec, r, c) { return `${sec}-${r}-${c}`; }
function pk(key) { const [s, r, c] = key.split("-").map(Number); return { sec: s, row: r, col: c }; }

// ── Legal Description Generator ─────────────────────────────────────
function cellQ(row, col) {
  return {
    quarter: (row < 4 ? "N" : "S") + (col < 4 ? "W" : "E"),
    sub: ((row % 4) < 2 ? "N" : "S") + ((col % 4) < 2 ? "W" : "E"),
    cell: (row % 2 === 0 ? "N" : "S") + (col % 2 === 0 ? "W" : "E"),
  };
}

function genLegal(cells, twp, rng, sec) {
  if (!cells || !cells.length) return "";
  const parsed = cells.map(c => { const { row, col } = pk(c); return { row, col, ...cellQ(row, col) }; });
  const n = parsed.length;
  const sfx = ` of Section ${sec}, T${twp}N, R${rng}E, Indian Meridian`;

  if (n === 64) return `All of Section ${sec}, T${twp}N, R${rng}E, Indian Meridian`;
  const rows = parsed.map(p => p.row), cols = parsed.map(p => p.col);
  if (n === 32) {
    if (rows.every(r => r < 4)) return `N/2${sfx}`;
    if (rows.every(r => r >= 4)) return `S/2${sfx}`;
    if (cols.every(c => c < 4)) return `W/2${sfx}`;
    if (cols.every(c => c >= 4)) return `E/2${sfx}`;
  }

  const byQ = {};
  parsed.forEach(p => {
    if (!byQ[p.quarter]) byQ[p.quarter] = {};
    if (!byQ[p.quarter][p.sub]) byQ[p.quarter][p.sub] = [];
    byQ[p.quarter][p.sub].push(p);
  });

  const halveDefs = [
    { name: "N/2", cells: ["NW","NE"] }, { name: "S/2", cells: ["SW","SE"] },
    { name: "W/2", cells: ["NW","SW"] }, { name: "E/2", cells: ["NE","SE"] },
  ];

  const parts = [];
  for (const [q, subs] of Object.entries(byQ)) {
    const all = Object.values(subs).flat();
    if (all.length === 16) { parts.push(`${q}/4`); continue; }
    if (all.length === 8) {
      const qr = all.map(p => p.row % 4), qc = all.map(p => p.col % 4);
      if (qr.every(r => r < 2)) { parts.push(`N/2 of ${q}/4`); continue; }
      if (qr.every(r => r >= 2)) { parts.push(`S/2 of ${q}/4`); continue; }
      if (qc.every(c => c < 2)) { parts.push(`W/2 of ${q}/4`); continue; }
      if (qc.every(c => c >= 2)) { parts.push(`E/2 of ${q}/4`); continue; }
    }

    for (const [sq, sqC] of Object.entries(subs)) {
      const sqSfx = `${sq}/4 of ${q}/4`;
      if (sqC.length === 4) { parts.push(sqSfx); continue; }

      const rem = new Set(sqC.map(c => c.cell));
      let found = true;
      while (found && rem.size >= 2) {
        found = false;
        for (const h of halveDefs) {
          if (h.cells.every(c => rem.has(c))) {
            parts.push(`${h.name} of ${sqSfx}`);
            h.cells.forEach(c => rem.delete(c));
            found = true; break;
          }
        }
      }
      for (const c of rem) parts.push(`${c}/4 of ${sqSfx}`);
    }
  }
  return parts.join("; ") + sfx;
}

// ── Storage (Supabase) ──────────────────────────────────────────────
async function loadFields(userId) {
  try {
    const { data, error } = await supabase.from('fields').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id, name: r.name, county: r.county, twp: r.twp, rng: r.rng, sec: r.sec,
      cells: r.cells, acres: r.acres, color: r.color, legalDescription: r.legal_description, created: r.created_at,
    }));
  } catch { return []; }
}
async function insertField(userId, f) {
  try {
    const { error } = await supabase.from('fields').insert({
      id: f.id, user_id: userId, name: f.name, county: f.county, twp: f.twp, rng: f.rng, sec: f.sec,
      cells: f.cells, acres: f.acres, color: f.color, legal_description: f.legalDescription,
    });
    if (error) throw error;
  } catch (e) { console.error('Insert failed:', e); }
}
async function deleteField(userId, id) {
  try {
    await supabase.from('fields').delete().eq('id', id).eq('user_id', userId);
  } catch (e) { console.error('Delete failed:', e); }
}
async function updateFieldName(userId, id, name) {
  try {
    await supabase.from('fields').update({ name }).eq('id', id).eq('user_id', userId);
  } catch (e) { console.error('Update failed:', e); }
}
async function deleteAllFields(userId) {
  try {
    await supabase.from('fields').delete().eq('user_id', userId);
  } catch (e) { console.error('Delete all failed:', e); }
}

// ── Reverse Parser: Legal Description → Cell Keys ───────────────────
function applySub(rows, cols, code) {
  const midR = rows[0] + (rows[rows.length - 1] - rows[0] + 1) / 2;
  const midC = cols[0] + (cols[cols.length - 1] - cols[0] + 1) / 2;
  const tR = rows.filter(r => r < midR), bR = rows.filter(r => r >= midR);
  const lC = cols.filter(c => c < midC), rC = cols.filter(c => c >= midC);
  switch (code) {
    case "NW": return [tR, lC]; case "NE": return [tR, rC];
    case "SW": return [bR, lC]; case "SE": return [bR, rC];
    case "N2": return [tR, cols]; case "S2": return [bR, cols];
    case "W2": return [rows, lC]; case "E2": return [rows, rC];
    default: return [rows, cols];
  }
}
function parseLegal(text) {
  const res = { twp: null, rng: null, sec: null, county: null, cells: [] };
  const sm = text.match(/(?:Section|Sec\.?)\s*(\d+)/i); if (sm) res.sec = parseInt(sm[1]);
  const tm = text.match(/T\.?\s*(\d+)\s*N/i); if (tm) res.twp = parseInt(tm[1]);
  const rm = text.match(/R\.?\s*(\d+)\s*E/i); if (rm) res.rng = parseInt(rm[1]);
  if (res.twp && res.rng) for (const [id, d] of Object.entries(COUNTIES)) if (d.townships.includes(res.twp) && d.ranges.includes(res.rng)) { res.county = id; break; }
  const dp = text.replace(/(?:of\s+)?Section.*$/i, "").replace(/,\s*$/, "").trim();
  const tracts = dp.split(/\s*[;&]\s*|\s+and\s+/i).filter(Boolean);
  for (const tract of tracts) {
    const tokens = []; const re = /\b(NE|NW|SE|SW|N|S|E|W)\s*[\/]?\s*(?:1\s*[\/]\s*)?(?:4|2)\b/gi; let m;
    while ((m = re.exec(tract)) !== null) { const u = m[0].toUpperCase().replace(/[^A-Z0-9]/g, ""); let c = null; if (/^(NE|NW|SE|SW)(14|4)?$/.test(u)) c = u.replace(/14|4/, ""); else if (/^(N|S|E|W)(12|2)$/.test(u)) c = u[0] + "2"; if (c) tokens.push(c); }
    if (!tokens.length && /\b(ALL|ENTIRE)\b/i.test(tract) && res.sec) { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) res.cells.push(ck(res.sec, r, c)); continue; }
    if (!tokens.length) continue;
    let rows = [0,1,2,3,4,5,6,7], cols = [0,1,2,3,4,5,6,7];
    for (const code of [...tokens].reverse()) [rows, cols] = applySub(rows, cols, code);
    if (res.sec) for (const r of rows) for (const c of cols) res.cells.push(ck(res.sec, r, c));
  }
  return res;
}

// ── Theme ───────────────────────────────────────────────────────────
const C = {
  bg: "#F8FAFC", srf: "#FFFFFF", alt: "#F1F5F9",
  bdr: "#E5E7EB", bdrL: "#D1D5DB",
  txt: "#111827", mut: "#6B7280", lt: "#9CA3AF",
  acc: "#2F7D32", accL: "#A5D6A7", accDk: "#25672A",
  dan: "#DC2626", danL: "#FEE2E2",
  sel: "#F59E0B", selL: "#FEF3C7",
  blue: "#1E3A8A", blueLt: "#93C5FD",
  brown: "#8B5E3C",
  boundary: "#374151", multi: "#34D399",
  success: "#16A34A", warn: "#F59E0B", info: "#2563EB",
};
const F = "'Inter','Segoe UI',system-ui,sans-serif";
const FD = "'Poppins','Inter',system-ui,sans-serif";

// ── App ─────────────────────────────────────────────────────────────
export default function FieldMapper({ session }) {
  const userId = session?.user?.id;
  const username = (session?.user?.email || '').replace('@quartermapper.app', '');
  const [view, setView] = useState("home"); // home | county | township | section
  const [county, setCounty] = useState(null);
  const [twp, setTwp] = useState(null);
  const [rng, setRng] = useState(null);
  const [sec, setSec] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [fname, setFname] = useState("");
  const [fields, setFields] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dMode, setDMode] = useState(null);
  const [search, setSearch] = useState("");
  const [searchErr, setSearchErr] = useState("");

  useEffect(() => { if (userId) loadFields(userId).then(f => { setFields(f); setLoaded(true); }); }, [userId]);
  useEffect(() => {
    const up = () => { setDragging(false); setDMode(null); };
    window.addEventListener("mouseup", up); window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mouseup", up); window.removeEventListener("touchend", up); };
  }, []);

  const pickCounty = (id) => { setCounty(id); setView("county"); };
  const openTwp = (t, r) => { setTwp(t); setRng(r); setView("township"); };
  const openSec = (s) => { setSec(s); setSel(new Set()); setFname(""); setView("section"); };
  const goBack = () => {
    if (view === "section") setView("township");
    else if (view === "township") setView("county");
    else if (view === "county") setView("home");
  };

  const mDown = (k) => {
    setDragging(true);
    const add = !sel.has(k); setDMode(add ? "a" : "r");
    setSel(p => { const n = new Set(p); add ? n.add(k) : n.delete(k); return n; });
  };
  const mEnter = (k) => {
    if (!dragging) return;
    setSel(p => { const n = new Set(p); dMode === "a" ? n.add(k) : n.delete(k); return n; });
  };

  const handleSearch = () => {
    if (!search.trim()) return; setSearchErr("");
    const r = parseLegal(search);
    if (!r.sec) { setSearchErr("No section number found."); return; }
    if (!r.twp || !r.rng) { setSearchErr("No township/range found (e.g. T26N, R22E)."); return; }
    if (!r.county) { setSearchErr("T" + r.twp + "N R" + r.rng + "E not in Ottawa, Craig, or Delaware."); return; }
    if (!r.cells.length) { setSearchErr("Could not parse quarter/half calls."); return; }
    setCounty(r.county); setTwp(r.twp); setRng(r.rng); setSec(r.sec); setSel(new Set(r.cells)); setFname(""); setView("section");
  };

  const saveField = async () => {
    if (!fname.trim() || sel.size === 0) return;
    const desc = genLegal(Array.from(sel), twp, rng, sec);
    const nf = {
      id: Date.now().toString(), name: fname.trim(), county, twp, rng, sec,
      cells: Array.from(sel), acres: sel.size * CELL_AC,
      color: COLORS[fields.length % COLORS.length],
      legalDescription: desc, created: new Date().toISOString(),
    };
    const u = [...fields, nf]; setFields(u); await insertField(userId, nf);
    setSel(new Set()); setFname("");
  };
  const delField = async (id) => { const u = fields.filter(f => f.id !== id); setFields(u); await deleteField(userId, id); };
  const renField = async (id, n) => { const u = fields.map(f => f.id === id ? { ...f, name: n } : f); setFields(u); await updateFieldName(userId, id, n); setEditing(null); };

  const cDef = county ? COUNTIES[county] : null;
  const secFields = fields.filter(f => f.county === county && f.twp === twp && f.rng === rng && f.sec === sec);
  const twpFields = fields.filter(f => f.county === county && f.twp === twp && f.rng === rng);
  const claimed = new Map();
  secFields.forEach(f => f.cells.forEach(c => claimed.set(c, f)));
  const legalDesc = sel.size > 0 ? genLegal(Array.from(sel), twp, rng, sec) : "";

  // Breadcrumb
  const crumbs = [];
  if (county) crumbs.push({ label: COUNTIES[county].name, view: "county", active: view !== "county" && view !== "home" });
  if (twp && view !== "home" && view !== "county") crumbs.push({ label: `T${twp}N R${rng}E`, view: "township", active: view === "section" });
  if (sec && view === "section") crumbs.push({ label: `Section ${sec}`, view: "section", active: false });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.txt, fontFamily: F, padding: 16, userSelect: "none" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet" />
      <style>{`.qm-cell:hover { outline: 2px solid ${C.acc}; outline-offset: -1px; z-index: 1; }`}</style>

      {/* Header */}
      <div style={{ maxWidth: 1000, margin: "0 auto 8px", display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
        <img src={LOGO} alt="QuarterMapper" style={{ height: 161 }} />
        {view !== "home" && <button onClick={goBack} style={{ background: C.srf, border: "1px solid " + C.bdr, borderRadius: 8, color: C.mut, fontFamily: F, fontSize: 12, padding: "6px 14px", cursor: "pointer", fontWeight: 500, marginTop: 4 }}>← Back</button>}
      </div>

      {/* User bar */}
      <div style={{ maxWidth: 1000, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
        <span style={{ fontSize: 12, color: C.mut }}>Signed in as <strong style={{ color: C.acc }}>{username}</strong></span>
        <button onClick={() => supabase.auth.signOut()}
          style={{ background: "none", border: "1px solid " + C.bdr, borderRadius: 6, color: C.mut, fontFamily: F, fontSize: 11, padding: "4px 12px", cursor: "pointer" }}>
          Sign Out
        </button>
      </div>

      {/* Breadcrumb */}
      <div style={{ maxWidth: 1000, margin: "0 auto 12px", fontSize: 12, color: C.lt, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {crumbs.map((cr, i) => (
          <span key={i}>
            {i > 0 && <span style={{ color: C.bdrL, margin: "0 2px" }}>›</span>}
            <span style={{ cursor: cr.active ? "pointer" : "default", color: cr.active ? C.acc : C.txt }}
              onClick={() => { if (cr.active) setView(cr.view); }}>{cr.label}</span>
          </span>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ maxWidth: 1000, margin: "0 auto 14px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setSearchErr(""); }}
            onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
            placeholder='Paste a legal description... e.g. N/2 of NW/4 of Section 12, T26N, R22E'
            style={{ flex: 1, background: C.srf, border: "1px solid " + C.bdr, borderRadius: 8, color: C.txt, fontFamily: F, fontSize: 13, padding: "10px 14px", outline: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }} />
          <button onClick={handleSearch} style={{ background: C.acc, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontFamily: F, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>Find on Map</button>
        </div>
        {searchErr && <div style={{ fontSize: 12, color: C.dan, marginTop: 6, fontWeight: 500 }}>{searchErr}</div>}
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* ── HOME: County Selector ────────────────────────────── */}
        {view === "home" && (
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontSize: 13, color: C.mut, marginBottom: 16 }}>Select a county to begin mapping fields.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {Object.entries(COUNTIES).map(([id, def]) => {
                const cf = fields.filter(f => f.county === id);
                const ac = cf.reduce((s, f) => s + f.acres, 0);
                return (
                  <div key={id} onClick={() => pickCounty(id)} style={{
                    background: cf.length > 0 ? C.accL : C.srf,
                    border: `1px solid ${cf.length > 0 ? C.acc + "44" : C.bdr}`,
                    borderRadius: 8, padding: "20px 18px", cursor: "pointer", transition: "all 0.15s",
                    borderLeft: `4px solid ${C.acc}`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = C.acc; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = cf.length > 0 ? C.acc + "44" : C.bdr; }}
                  >
                    <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, marginBottom: 4, color: C.blue }}>{def.name}</div>
                    <div style={{ fontSize: 11, color: C.mut }}>
                      T{def.townships[def.townships.length - 1]}N–T{def.townships[0]}N, R{def.ranges[0]}E–R{def.ranges[def.ranges.length - 1]}E
                    </div>
                    {cf.length > 0 && <div style={{ fontSize: 11, color: C.acc, marginTop: 8 }}>{cf.length} field{cf.length > 1 ? "s" : ""} · {ac} ac</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── COUNTY: Township Grid ────────────────────────────── */}
        {view === "county" && cDef && (
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cDef.ranges.length}, 1fr)`, gap: 8 }}>
              {cDef.townships.map(t =>
                cDef.ranges.map(r => {
                  const tf = fields.filter(f => f.county === county && f.twp === t && f.rng === r);
                  const ac = tf.reduce((s, f) => s + f.acres, 0);
                  return (
                    <div key={`${t}-${r}`} onClick={() => openTwp(t, r)} style={{
                      background: tf.length > 0 ? C.accL : C.alt,
                      border: `2px solid ${tf.length > 0 ? C.acc + "55" : C.bdr}`,
                      borderRadius: 8, padding: "16px 10px", textAlign: "center", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = C.acc; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = tf.length > 0 ? C.acc + "55" : C.bdr; }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>T{t}N R{r}E</div>
                      {tf.length > 0
                        ? <div style={{ fontSize: 11, color: C.acc, marginTop: 6, fontWeight: 600 }}>{tf.length} field{tf.length > 1 ? "s" : ""} · {ac}ac</div>
                        : <div style={{ fontSize: 11, color: C.mut, marginTop: 6 }}>No fields</div>
                      }
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── TOWNSHIP: 36 Sections ────────────────────────────── */}
        {view === "township" && (
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
              {SECTIONS_ORDER.map(s => {
                const sf = fields.filter(f => f.county === county && f.twp === twp && f.rng === rng && f.sec === s);
                const ac = sf.reduce((sum, f) => sum + f.acres, 0);
                return (
                  <div key={s} onClick={() => openSec(s)} style={{
                    background: sf.length > 0 ? C.accL : C.srf,
                    border: `1px solid ${sf.length > 0 ? C.acc + "44" : C.bdr}`,
                    borderRadius: 4, padding: "10px 4px", textAlign: "center", cursor: "pointer", minHeight: 54,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = C.acc; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = sf.length > 0 ? C.acc + "44" : C.bdr; }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s}</div>
                    {sf.length > 0 && <>
                      <div style={{ fontSize: 9, color: C.acc, marginTop: 2 }}>{ac}ac</div>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 3, flexWrap: "wrap" }}>
                        {sf.map(f => <div key={f.id} style={{ width: 8, height: 8, borderRadius: 2, background: f.color }} title={f.name} />)}
                      </div>
                    </>}
                  </div>
                );
              })}
            </div>
            {twpFields.length > 0 && (
              <div style={{ marginTop: 16, background: C.srf, border: `1px solid ${C.bdr}`, borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 10, color: C.brown, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8, fontWeight: 600 }}>Fields in T{twp}N R{rng}E</div>
                {twpFields.map(f => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: f.color, flexShrink: 0 }} />
                    <span>{f.name}</span>
                    <span style={{ color: C.mut, marginLeft: "auto" }}>Sec {f.sec} · {f.acres}ac</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION: 8x8 Grid ────────────────────────────────── */}
        {view === "section" && (
          <div style={{ flex: 1, minWidth: 300 }}>
            {legalDesc && (
              <div style={{ background: C.blueLt + "22", border: `1px solid ${C.blueLt}66`, borderRadius: 8, padding: "12px 16px", marginBottom: 14, maxWidth: 520 }}>
                <div style={{ fontSize: 10, color: C.blue, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6, fontWeight: 600 }}>Legal Description</div>
                <div style={{ fontSize: 12, color: C.txt, lineHeight: 1.5, wordBreak: "break-word" }}>{legalDesc}</div>
                <div style={{ fontSize: 11, color: C.mut, marginTop: 6 }}>{sel.size * CELL_AC} acres · {sel.size} blocks</div>
              </div>
            )}

            <div style={{ fontSize: 11, color: C.mut, marginBottom: 10 }}>Click or drag to select 10-acre blocks.</div>
            <div style={{ maxWidth: 520, textAlign: "center", fontSize: 9, color: C.lt, marginBottom: 2 }}>N</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, maxWidth: 540 }}>
              <span style={{ fontSize: 9, color: C.lt, width: 12, textAlign: "center" }}>W</span>
              <div style={{
                display: "grid", gridTemplateColumns: `repeat(${GRID}, 1fr)`, gap: 2,
                background: C.bdrL, border: `2px solid ${C.boundary}44`, borderRadius: 8, padding: 3, flex: 1, maxWidth: 520,
              }}>
                {Array.from({ length: GRID }).map((_, row) =>
                  Array.from({ length: GRID }).map((_, col) => {
                    const key = ck(sec, row, col);
                    const cl = claimed.get(key);
                    const isSel = sel.has(key);
                    const bg = cl ? cl.color + "30" : isSel ? C.acc + "20" : C.srf;
                    const bdr = isSel ? `2px solid ${C.acc}` : cl ? `1px solid ${cl.color}55` : `1px solid ${C.bdrL}`;
                    return (
                      <div key={key} className={!cl ? "qm-cell" : undefined}
                        onMouseDown={e => { e.preventDefault(); if (!cl) mDown(key); }}
                        onMouseEnter={() => { if (!cl) mEnter(key); }}
                        style={{
                          aspectRatio: "1", background: bg, border: bdr, borderRadius: 4,
                          cursor: cl ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 7, color: cl ? cl.color : isSel ? C.acc : C.bdrL, transition: "background 0.1s",
                        }}
                        title={cl ? `${cl.name} (${CELL_AC}ac)` : ""}
                      >
                        {cl ? cl.name.slice(0, 3) : isSel ? "●" : ""}
                      </div>
                    );
                  })
                )}
              </div>
              <span style={{ fontSize: 9, color: C.lt, width: 12, textAlign: "center" }}>E</span>
            </div>
            <div style={{ maxWidth: 520, textAlign: "center", fontSize: 9, color: C.lt, marginTop: 2, marginBottom: 4 }}>S</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 520, marginLeft: 16 }}>
              {["NW/4","NE/4","SW/4","SE/4"].map(q => <div key={q} style={{ textAlign: "center", fontSize: 9, color: C.lt, padding: "2px 0" }}>{q}</div>)}
            </div>

            {sel.size > 0 && (
              <div style={{ background: C.srf, border: `1px solid ${C.acc}33`, borderRadius: 6, padding: "12px 16px", maxWidth: 520, marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={fname} onChange={e => setFname(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveField(); }}
                    placeholder="Field name..." style={{ flex: 1, background: C.alt, border: `1px solid ${C.bdr}`, borderRadius: 4, color: C.txt, fontFamily: F, fontSize: 13, padding: "8px 12px", outline: "none" }} />
                  <button onClick={saveField} disabled={!fname.trim()} style={{
                    background: fname.trim() ? C.acc : C.bdr, color: "#fff", border: "none", borderRadius: 8,
                    padding: "8px 20px", fontFamily: F, fontSize: 13, fontWeight: 600, cursor: fname.trim() ? "pointer" : "default",
                  }}>Save</button>
                </div>
              </div>
            )}

            {secFields.length > 0 && (
              <div style={{ marginTop: 16, background: C.srf, border: `1px solid ${C.bdr}`, borderRadius: 6, padding: 12, maxWidth: 520 }}>
                <div style={{ fontSize: 10, color: C.brown, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8, fontWeight: 600 }}>Fields in Section {sec}</div>
                {secFields.map(f => (
                  <div key={f.id} style={{ marginBottom: 10, borderLeft: `3px solid ${f.color}`, paddingLeft: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      {editing === f.id ? (
                        <input autoFocus defaultValue={f.name} onBlur={e => renField(f.id, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") renField(f.id, e.target.value); if (e.key === "Escape") setEditing(null); }}
                          style={{ flex: 1, background: C.alt, border: `1px solid ${C.bdr}`, borderRadius: 3, color: C.txt, fontFamily: F, fontSize: 12, padding: "4px 8px", outline: "none" }} />
                      ) : (
                        <span style={{ fontWeight: 500, cursor: "pointer" }} onClick={() => setEditing(f.id)}>{f.name}</span>
                      )}
                      <span style={{ color: C.mut, marginLeft: "auto", whiteSpace: "nowrap" }}>{f.acres}ac</span>
                      <button onClick={() => delField(f.id)} style={{ background: "none", border: "none", color: C.dan, cursor: "pointer", fontSize: 14, padding: "0 4px", fontFamily: F }}>×</button>
                    </div>
                    {f.legalDescription && <div style={{ fontSize: 10, color: C.mut, marginTop: 4, lineHeight: 1.4 }}>{f.legalDescription}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <div style={{
          width: 270, flexShrink: 0, background: C.srf, border: `1px solid ${C.bdr}`, borderRadius: 10,
          padding: 14, maxHeight: "80vh", overflowY: "auto", position: "sticky", top: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}>
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `2px solid ${C.acc}22` }}>
            <div style={{ fontSize: 10, color: C.acc, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 10, fontWeight: 600 }}>Field Tracker</div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, background: C.acc + "12", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.acc, fontFamily: FD }}>{fields.length}</div>
                <div style={{ fontSize: 10, color: C.mut, fontWeight: 500 }}>Fields</div>
              </div>
              <div style={{ flex: 1, background: C.acc + "12", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.acc, fontFamily: FD }}>{fields.reduce((s, f) => s + f.acres, 0)}</div>
                <div style={{ fontSize: 10, color: C.mut, fontWeight: 500 }}>Acres</div>
              </div>
            </div>
          </div>
          {!loaded ? <div style={{ color: C.mut, fontSize: 12 }}>Loading...</div>
            : fields.length === 0 ? <div style={{ color: C.mut, fontSize: 12, lineHeight: 1.6 }}>No fields saved yet.</div>
            : <div>
              {fields.map(f => (
                <div key={f.id} onClick={() => { setCounty(f.county); setTwp(f.twp); setRng(f.rng); setSec(f.sec); setSel(new Set()); setFname(""); setView("section"); }}
                  style={{
                    marginBottom: 8, fontSize: 11, cursor: "pointer", padding: "8px 10px", borderRadius: 6,
                    borderLeft: `3px solid ${f.color}`,
                    background: (county === f.county && twp === f.twp && rng === f.rng && sec === f.sec && view === "section") ? C.alt : "transparent",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.alt; }}
                  onMouseLeave={e => { e.currentTarget.style.background = (county === f.county && twp === f.twp && rng === f.rng && sec === f.sec && view === "section") ? C.alt : "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button onClick={e => { e.stopPropagation(); delField(f.id); }} style={{ background: "none", border: "none", color: C.lt, cursor: "pointer", fontSize: 13, padding: "0 2px", fontFamily: F }}>×</button>
                  </div>
                  <div style={{ color: C.mut, fontSize: 10, marginTop: 2 }}>
                    {COUNTIES[f.county]?.name} · T{f.twp}N R{f.rng}E Sec {f.sec} · {f.acres}ac
                  </div>
                  {f.legalDescription && <div style={{ color: C.lt, fontSize: 9, marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.legalDescription}</div>}
                </div>
              ))}
            </div>
          }
          {fields.length > 0 && (
            <button onClick={async () => { if (confirm("Clear all saved fields?")) { setFields([]); await deleteAllFields(userId); } }}
              style={{ marginTop: 12, width: "100%", background: C.danL, border: `1px solid ${C.dan}33`, borderRadius: 8, color: C.dan, fontFamily: F, fontSize: 10, padding: "8px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>
              Reset All Fields
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
