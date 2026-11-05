/* ENTITY LAB — static Dead by Daylight intelligence PWA. No API keys. No fake AI. */
(function () {
  "use strict";
  const STORE_KEY = "entitylab_v1";
  const NAV = [
    { id: "dashboard", label: "Dashboard", ic: "◈" },
    { id: "killers", label: "Killer Intel", ic: "☠" },
    { id: "survivors", label: "Survivor Intel", ic: "◎" },
    { id: "perks", label: "Perk Database", ic: "✦" },
    { id: "addons", label: "Add-on Lab", ic: "⬢" },
    { id: "builds", label: "Build Laboratory", ic: "⚒" },
    { id: "maps", label: "Map Intelligence", ic: "▣" },
    { id: "matches", label: "Match Analyzer", ic: "📊" },
    { id: "meta", label: "Meta Research", ic: "📰" },
    { id: "sim", label: "Experimental Lab", ic: "⚗" },
    { id: "collection", label: "Koleksi Pribadi", ic: "☰" },
    { id: "ai", label: "AI Strategy Center", ic: "🧠" }
  ];
  let DB = null;
  const state = {
    route: "dashboard", q: "", filters: {}, selected: null, compare: [],
    build: { role: "killer", characterId: null, perks: [null,null,null,null], addons: [null,null], strategy: "", difficulty: "Intermediate" }
  };
  const store = {
    read() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { return {}; } },
    write(data) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {} },
    get(k, d) { const s = this.read(); return s[k] == null ? d : s[k]; },
    set(k, v) { const s = this.read(); s[k] = v; this.write(s); }
  };
  const el = {
    view: document.getElementById("view"),
    nav: document.getElementById("nav"),
    search: document.getElementById("globalSearch"),
    suggest: document.getElementById("searchSuggest"),
    sidebar: document.getElementById("sidebar"),
    backdrop: document.getElementById("backdrop"),
    dbMeta: document.getElementById("dbMeta")
  };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
  function initials(name) {
    return String(name || "?").replace(/^The\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
  }
  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
  }
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div"); t.id = "toast";
      t.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99;background:#1a1a22;border:1px solid rgba(196,30,42,.5);padding:10px 14px;border-radius:999px;font-size:13px";
      document.body.appendChild(t);
    }
    t.textContent = msg; t.hidden = false; clearTimeout(t._x);
    t._x = setTimeout(() => { t.hidden = true; }, 2200);
  }
  function matches() { return store.get("matches", []); }
  function builds() { return store.get("builds", []); }
  function bookmarks() { return store.get("bookmarks", []); }
  function notes() { return store.get("notes", []); }
  function experiments() { return store.get("experiments", []); }
  function activity() { return store.get("activity", []); }
  function pushActivity(item) {
    const a = activity(); a.unshift(Object.assign({ at: new Date().toISOString() }, item));
    store.set("activity", a.slice(0, 40));
  }
  function findKiller(id) { return DB.killers.find((k) => k.id === id || k.name === id); }
  function findPerk(name) { return DB.perks.find((p) => p.name === name); }
  function perksByRole(role) { return DB.perks.filter((p) => p.role === role); }
  function setRoute(id, selected) {
    state.route = id; state.selected = selected || null; state.filters = {};
    closeNav(); render(); el.view.focus();
    history.replaceState(null, "", "#" + id + (selected ? "/" + encodeURIComponent(String(selected)) : ""));
  }
  function openNav() { el.sidebar.classList.add("open"); el.backdrop.classList.add("open"); }
  function closeNav() { el.sidebar.classList.remove("open"); el.backdrop.classList.remove("open"); }

  function renderNav() {
    el.nav.innerHTML = NAV.map((n) =>
      `<button data-route="${n.id}" class="${state.route === n.id ? "on" : ""}"><span class="ic">${n.ic}</span>${esc(n.label)}</button>`
    ).join("");
    let tabs = document.querySelector(".tabs-mobile");
    if (!tabs) {
      tabs = document.createElement("nav"); tabs.className = "tabs-mobile";
      tabs.setAttribute("aria-label", "Menu cepat"); document.body.appendChild(tabs);
    }
    const mobileIds = ["dashboard","killers","perks","builds","matches","collection"];
    tabs.innerHTML = mobileIds.map((id) => {
      const n = NAV.find((x) => x.id === id);
      return `<button data-route="${id}" class="${state.route === id ? "on" : ""}">${n.ic}<br>${n.label.split(" ")[0]}</button>`;
    }).join("");
  }
  function bindGlobal() {
    document.getElementById("navToggle").onclick = () => el.sidebar.classList.contains("open") ? closeNav() : openNav();
    el.backdrop.onclick = closeNav;
    el.nav.addEventListener("click", (e) => { const b = e.target.closest("[data-route]"); if (b) setRoute(b.dataset.route); });
    document.body.addEventListener("click", (e) => { const b = e.target.closest(".tabs-mobile [data-route]"); if (b) setRoute(b.dataset.route); });
    el.search.addEventListener("input", () => { state.q = el.search.value.trim(); renderSuggest(); });
    el.search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const first = el.suggest.querySelector("button"); if (first) first.click(); }
      if (e.key === "Escape") el.suggest.hidden = true;
    });
    document.getElementById("btnExport").onclick = exportBackup;
    document.getElementById("importFile").onchange = importBackup;
  }
  function searchIndex() {
    const out = [];
    DB.killers.forEach((k) => out.push({ type:"Killer", label:k.name, sub:k.power||"", route:"killers", sel:k.name }));
    DB.survivors.forEach((s) => out.push({ type:"Survivor", label:s.name, sub:(s.uniquePerks||[]).join(", "), route:"survivors", sel:s.name }));
    DB.perks.forEach((p) => out.push({ type:"Perk", label:p.name, sub:p.role+(p.owner?" · "+p.owner:""), route:"perks", sel:p.name }));
    DB.addons.forEach((a) => out.push({ type:"Add-on", label:a.name, sub:a.killer||"", route:"addons", sel:a.name }));
    DB.maps.forEach((m) => out.push({ type:"Map", label:m.name, sub:m.realm||"", route:"maps", sel:m.name }));
    return out;
  }
  function renderSuggest() {
    const q = state.q.toLowerCase();
    if (!q) { el.suggest.hidden = true; el.suggest.innerHTML = ""; return; }
    const hits = searchIndex().filter((x) => (x.label+" "+x.sub+" "+x.type).toLowerCase().includes(q)).slice(0, 12);
    if (!hits.length) {
      el.suggest.hidden = false;
      el.suggest.innerHTML = `<div class="muted small" style="padding:12px">Tidak ada hasil untuk “${esc(state.q)}”.</div>`;
      return;
    }
    el.suggest.hidden = false;
    el.suggest.innerHTML = hits.map((h) =>
      `<button data-go-route="${h.route}" data-go-sel="${esc(h.sel)}"><span><b>${esc(h.label)}</b><br><span class="muted small">${esc(h.sub)}</span></span><span class="badge">${esc(h.type)}</span></button>`
    ).join("");
    el.suggest.querySelectorAll("button").forEach((b) => {
      b.onclick = () => { el.suggest.hidden = true; el.search.value = ""; state.q = ""; setRoute(b.dataset.goRoute, b.dataset.goSel); };
    });
  }
  function personalStats() {
    const ms = matches(); if (!ms.length) return null;
    const wins = ms.filter((m) => m.outcome === "win").length;
    const favKillers = {}, perkUse = {};
    ms.forEach((m) => {
      if (m.character) favKillers[m.character] = (favKillers[m.character] || 0) + 1;
      (m.perks || []).forEach((p) => { if (p) perkUse[p] = (perkUse[p] || 0) + 1; });
    });
    return {
      total: ms.length,
      killerN: ms.filter((m) => m.role === "killer").length,
      survivorN: ms.filter((m) => m.role === "survivor").length,
      winRate: Math.round((wins / ms.length) * 100),
      topK: Object.entries(favKillers).sort((a,b)=>b[1]-a[1]).slice(0,5),
      topP: Object.entries(perkUse).sort((a,b)=>b[1]-a[1]).slice(0,5)
    };
  }

  function listFilterBar(ph) {
    return `<div class="row" style="margin:10px 0 14px"><input type="search" id="localQ" placeholder="${esc(ph)}" style="flex:1;min-width:180px"></div>`;
  }
  function perkRow(p) {
    return `<button class="list-card" data-open-perk="${esc(p.name)}"><span class="avatar">✦</span><div><b>${esc(p.name)}</b> <span class="badge">${esc(p.role)}</span>
      <div class="muted small">${esc((p.description||"").slice(0,140))}</div>
      <div class="taglist" style="margin-top:4px">${(p.tags||[]).slice(0,5).map(t=>`<span class="badge">${esc(t)}</span>`).join("")}</div></div></button>`;
  }
  function viewDashboard() {
    const st = personalStats(); const act = activity(); const c = DB.meta.counts;
    return `<div class="stack">
      <section class="panel"><div class="spread"><div>
        <div class="badge red">ENTITY LAB ONLINE</div>
        <h1 style="margin-top:10px">${greeting()}, Operator.</h1>
        <p class="muted">Dead by Daylight Intelligence System — snapshot ${esc(DB.meta.asOf)} · patch ${esc(DB.meta.gameVersion)}</p>
      </div><button class="primary" data-route="ai">Buka AI Strategy Center</button></div></section>
      <section class="grid cols-4">${[["Killers",c.killers,"killers"],["Survivors",c.survivors,"survivors"],["Perks",c.perks,"perks"],["Maps",c.maps,"maps"]].map(([l,n,r])=>
        `<button class="stat" data-route="${r}"><div class="n">${n}</div><div class="l">${l}</div></button>`).join("")}</section>
      <section class="grid cols-2">
        <div class="panel"><h2>Akses cepat</h2><div class="grid cols-2" style="margin-top:10px">
          ${NAV.slice(1).map(n=>`<button class="list-card" data-route="${n.id}"><span class="avatar">${n.ic}</span><div><b>${esc(n.label)}</b><div class="muted small">Buka modul</div></div></button>`).join("")}
        </div></div>
        <div class="panel"><h2>Statistik pribadi</h2>
          ${st ? `<div class="grid cols-2" style="margin-top:10px">
            <div class="stat"><div class="n">${st.total}</div><div class="l">Match tercatat</div></div>
            <div class="stat"><div class="n">${st.winRate}%</div><div class="l">Win rate (data kamu)</div></div>
            <div class="stat"><div class="n">${st.killerN}</div><div class="l">Sebagai Killer</div></div>
            <div class="stat"><div class="n">${st.survivorN}</div><div class="l">Sebagai Survivor</div></div>
          </div>
          <div class="divider"></div>
          <div class="muted small">Killer favorit</div>
          <div class="taglist" style="margin-top:6px">${st.topK.map(([k,n])=>`<span class="badge red">${esc(k)} · ${n}</span>`).join("")||"—"}</div>
          <div class="muted small" style="margin-top:10px">Perk paling sering</div>
          <div class="taglist" style="margin-top:6px">${st.topP.map(([k,n])=>`<span class="badge">${esc(k)} · ${n}</span>`).join("")||"—"}</div>`
          : `<div class="empty" style="margin-top:12px">Belum ada match tersimpan.<br><button class="primary" style="margin-top:12px" data-route="matches">Catat match pertama</button></div>`}
        </div>
      </section>
      <section class="panel"><h2>Aktivitas terbaru</h2>
        ${act.length ? `<div class="stack" style="margin-top:10px">${act.slice(0,8).map(a=>`<div class="list-card" style="cursor:default"><div><b>${esc(a.title||a.type)}</b><div class="muted small">${esc(a.detail||"")} · ${esc((a.at||"").replace("T"," ").slice(0,16))}</div></div></div>`).join("")}</div>`
          : `<div class="empty" style="margin-top:10px">Belum ada aktivitas.</div>`}
      </section>
      <div class="notice">Angka personal hanya dari data di perangkat ini (localStorage). Tidak ada statistik palsu.</div>
    </div>`;
  }

  function viewKillers() {
    if (state.selected) {
      const k = DB.killers.find(x => x.name === state.selected || x.shortName === state.selected);
      if (!k) return `<div class="empty">Killer tidak ditemukan.</div>`;
      const ownPerks = DB.perks.filter(p => p.role === "killer" && p.ownerId === k.id);
      const ownAddons = DB.addons.filter(a => a.killerId === k.id);
      const realm = DB.realms.find(r => r.id === k.realmId);
      return `<button class="ghost" data-back="killers">← Semua Killer</button>
        <section class="panel" style="margin-top:10px">
          <div class="row"><div class="avatar" style="width:64px;height:64px;font-size:1.2rem">${esc(initials(k.name))}</div>
          <div><h1>${esc(k.name)}</h1><div class="muted">${k.realName ? esc(k.realName)+" · " : ""}${esc(k.origin||"")}</div>
          <div class="taglist" style="margin-top:8px">
            <span class="badge red">${esc(k.difficulty)}</span><span class="badge">${esc(k.height||"?")}</span>
            ${k.movementSpeedMs!=null?`<span class="badge mono">${k.movementSpeedMs} m/s (${k.movementSpeedPct}%)</span>`:`<span class="badge warn">Speed: n/a di Datatable</span>`}
            ${k.terrorRadiusM!=null?`<span class="badge mono">TR ${k.terrorRadiusM}m</span>`:""}
          </div></div></div>
          <div class="divider"></div>
          <div class="kv">
            <b>Power</b><span><b>${esc(k.power||"—")}</b>${k.specialAttack?` · Special Attack${k.specialAttackNote?" ("+esc(k.specialAttackNote)+")":""}`:""}</span>
            <b>Weapon</b><span>${esc(k.weapon||"—")}</span>
            <b>Realm</b><span>${esc(realm?realm.name:"—")}</span>
            <b>Sumber</b><span><a href="${esc(k.source)}" target="_blank" rel="noopener">wiki.gg</a> · ${esc(k.verificationStatus)} · ${esc(k.lastVerified)}</span>
          </div>
          <h3 style="margin-top:16px">Power (teks wiki, disederhanakan)</h3>
          <div class="pre">${esc(k.powerDescription||"Deskripsi belum tersedia.")}</div>
          <div class="notice" style="margin-top:10px">Teks power dari Module Descriptions — cek sumber untuk versi resmi penuh.</div>
        </section>
        <section class="grid cols-2" style="margin-top:12px">
          <div class="panel"><h2>Counterplay & kelemahan</h2>
            <div class="notice red" style="margin:8px 0">[GUIDANCE] = saran taktis, bukan fakta patch.</div>
            ${(k.counterplay||[]).map(x=>`<p class="small">${esc(x)}</p>`).join("")}
            <h3>Strengths</h3>${(k.strengths||[]).map(x=>`<p class="small">${esc(x)}</p>`).join("")}
            <h3>Weaknesses</h3>${(k.weaknesses||[]).map(x=>`<p class="small">${esc(x)}</p>`).join("")}
          </div>
          <div class="panel"><h2>Strategy tiers</h2>
            ${Object.entries(k.strategies||{}).map(([tier,text])=>`<div style="margin:10px 0"><span class="badge red">${esc(tier)}</span><p class="small" style="margin:6px 0 0">${esc(text)}</p></div>`).join("")}
          </div>
        </section>
        <section class="panel" style="margin-top:12px"><h2>Unique perks</h2>
          <div class="stack" style="margin-top:8px">${ownPerks.map(perkRow).join("")||"<div class='muted'>—</div>"}</div>
        </section>
        <section class="panel" style="margin-top:12px">
          <div class="spread"><h2>Add-ons (${ownAddons.length})</h2>
          <button class="ghost" data-route="addons" data-sel-killer="${k.id}">Buka Add-on Lab</button></div>
          <div class="stack" style="margin-top:8px">${ownAddons.slice(0,12).map(a=>`<div class="list-card" style="cursor:default"><div class="avatar">${esc((a.rarity||"?")[0])}</div>
            <div><b>${esc(a.name)}</b> <span class="badge">${esc(a.rarity)}</span>
            <div class="muted small">${esc((a.description||"").slice(0,160))}</div></div></div>`).join("")}
            ${ownAddons.length>12?`<div class="muted small">+${ownAddons.length-12} di Add-on Lab.</div>`:""}</div>
        </section>`;
    }
    const q = (state.filters.q||"").toLowerCase();
    const list = DB.killers.filter(k => !q || (k.name+" "+(k.power||"")+" "+(k.realName||"")).toLowerCase().includes(q));
    return `<div class="spread"><div><h1>Killer Intelligence</h1><p class="muted">${DB.killers.length} killer · stats wiki Datatable</p></div></div>
      ${listFilterBar("Filter nama / power…")}
      <div class="stack">${list.map(k=>`<button class="list-card" data-open-killer="${esc(k.name)}">
        <span class="avatar">${esc(initials(k.name))}</span>
        <div style="flex:1"><div class="spread"><b>${esc(k.name)}</b><span class="badge">${esc(k.difficulty)}</span></div>
        <div class="muted small">${esc(k.power||"—")} · ${k.movementSpeedMs!=null?k.movementSpeedMs+" m/s":"speed n/a"} · TR ${k.terrorRadiusM!=null?k.terrorRadiusM+"m":"n/a"}</div></div>
      </button>`).join("")}</div>`;
  }
  function viewSurvivors() {
    if (state.selected) {
      const s = DB.survivors.find(x => x.name === state.selected);
      if (!s) return `<div class="empty">Survivor tidak ditemukan.</div>`;
      const ups = (s.uniquePerks||[]).map(findPerk).filter(Boolean);
      return `<button class="ghost" data-back="survivors">← Semua Survivor</button>
        <section class="panel" style="margin-top:10px">
          <div class="row"><div class="avatar" style="width:64px;height:64px">${esc(initials(s.name))}</div>
          <div><h1>${esc(s.name)}</h1><div class="muted">${esc(s.role||"")} · ${esc(s.origin||"")}</div>
          <div class="taglist" style="margin-top:8px">${(s.archetypes||[]).map(a=>`<span class="badge red">${esc(a)}</span>`).join("")}</div></div></div>
          <p style="margin-top:12px">${esc(s.background)}</p>
          <div class="notice" style="margin-top:8px">Archetype dari tag unik perk (aturan lokal) — bukan klasifikasi resmi BHVR.</div>
          <div class="kv" style="margin-top:12px">
            <b>Solo queue</b><span>${esc(s.soloQueue)}</span>
            <b>Teamplay</b><span>${esc(s.teamplay)}</span>
            <b>Sumber</b><span><a href="${esc(s.source)}" target="_blank" rel="noopener">wiki.gg</a> · ${esc(s.lastVerified)}</span>
          </div>
        </section>
        <section class="panel" style="margin-top:12px"><h2>Unique perks</h2>
          <div class="stack" style="margin-top:8px">${ups.map(perkRow).join("")||"<div class='muted'>—</div>"}</div>
        </section>`;
    }
    const q = (state.filters.q||"").toLowerCase();
    const list = DB.survivors.filter(s => !q || (s.name+" "+(s.role||"")+" "+(s.uniquePerks||[]).join(" ")).toLowerCase().includes(q));
    return `<div><h1>Survivor Intelligence</h1><p class="muted">${DB.survivors.length} survivor</p></div>
      ${listFilterBar("Filter nama / role / perk…")}
      <div class="stack">${list.map(s=>`<button class="list-card" data-open-survivor="${esc(s.name)}">
        <span class="avatar">${esc(initials(s.name))}</span>
        <div><b>${esc(s.name)}</b><div class="muted small">${esc(s.role||"")} · ${(s.uniquePerks||[]).map(esc).join(" · ")}</div>
        <div class="taglist" style="margin-top:4px">${(s.archetypes||[]).map(a=>`<span class="badge">${esc(a)}</span>`).join("")}</div></div>
      </button>`).join("")}</div>`;
  }

  function viewCompareBox() {
    const items = state.compare.map(findPerk).filter(Boolean);
    return `<section class="panel" style="margin:12px 0"><div class="spread"><h2>Compare (${items.length}/4)</h2>
      <button class="ghost" data-clear-compare>Clear</button></div>
      <div class="compare-grid" style="margin-top:10px">${items.map(p=>`<div class="glass" style="padding:10px">
        <div class="spread"><b>${esc(p.name)}</b><button class="ghost" data-compare-toggle="${esc(p.name)}">×</button></div>
        <div class="badge">${esc(p.role)}</div>
        <div class="muted small" style="margin-top:8px">${esc((p.description||"").slice(0,220))}</div>
        <div class="taglist" style="margin-top:6px">${(p.tags||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join("")}</div>
      </div>`).join("")}</div>
      <div class="notice" style="margin-top:10px">Compare menampilkan teks wiki berdampingan — tanpa skor meta palsu.</div>
    </section>`;
  }
  function viewPerks() {
    if (state.selected) {
      const p = findPerk(state.selected);
      if (!p) return `<div class="empty">Perk tidak ditemukan.</div>`;
      const inCompare = state.compare.includes(p.name);
      return `<button class="ghost" data-back="perks">← Semua Perk</button>
        <section class="panel" style="margin-top:10px">
          <div class="spread"><div><h1>${esc(p.name)}</h1>
            <div class="muted">${esc(p.role)} ${p.owner?"· "+esc(p.owner):"· General / teachable"}</div></div>
            <div class="row"><button class="ghost" data-bookmark="perk:${esc(p.name)}">Bookmark</button>
            <button class="${inCompare?"primary":"ghost"}" data-compare-toggle="${esc(p.name)}">${inCompare?"Dalam compare":"Tambah compare"}</button></div>
          </div>
          <div class="taglist" style="margin:10px 0">${(p.tags||[]).map(t=>`<span class="badge red">${esc(t)}</span>`).join("")}
            ${p.values&&p.values.length?`<span class="badge mono">values ${esc(p.values.join("/"))}</span>`:""}
            ${p.patch?`<span class="badge">patch ${esc(p.patch)}</span>`:""}</div>
          <div class="pre">${esc(p.description||"Deskripsi tidak tersedia.")}</div>
          <p class="muted small" style="margin-top:8px">Sumber: <a href="${esc(p.source)}" target="_blank" rel="noopener">wiki</a> · ${esc(p.verificationStatus)} · ${esc(p.lastVerified)} · ${esc(p.gameVersion)}</p>
        </section>${state.compare.length?viewCompareBox():""}`;
    }
    const role = state.filters.role || "all";
    const tag = state.filters.tag || "";
    const q = (state.filters.q||"").toLowerCase();
    let list = DB.perks.slice();
    if (role !== "all") list = list.filter(p => p.role === role);
    if (tag) list = list.filter(p => (p.tags||[]).includes(tag));
    if (q) list = list.filter(p => (p.name+" "+(p.owner||"")+" "+(p.tags||[]).join(" ")).toLowerCase().includes(q));
    const allTags = Array.from(new Set(DB.perks.flatMap(p => p.tags||[]))).sort();
    return `<div class="spread"><div><h1>Perk Database</h1><p class="muted">${DB.perks.length} perk aktif</p></div>
      <button class="ghost" data-clear-compare ${state.compare.length?"":"hidden"}>Compare (${state.compare.length})</button></div>
      <div class="chips">${[["all","Semua"],["killer","Killer"],["survivor","Survivor"]].map(([v,l])=>
        `<button class="chip ${role===v?"on":""}" data-filter-role="${v}">${l}</button>`).join("")}</div>
      ${listFilterBar("Cari perk…")}
      <label class="field">Filter tag<select id="tagFilter"><option value="">Semua tag</option>
        ${allTags.map(t=>`<option value="${esc(t)}" ${tag===t?"selected":""}>${esc(t)}</option>`).join("")}</select></label>
      ${state.compare.length?viewCompareBox():""}
      <div class="stack" style="margin-top:12px">${list.slice(0,200).map(perkRow).join("")}
        ${list.length>200?`<div class="muted small">Menampilkan 200/${list.length}. Perhalus filter.</div>`:""}</div>`;
  }
  function suggestAddonCombos(a) {
    const tags = new Set(a.tags||[]); if (!tags.size) return [];
    return DB.addons.filter(x => x.killerId===a.killerId && x.name!==a.name)
      .map(p => ({p, shared:(p.tags||[]).filter(t=>tags.has(t))}))
      .filter(x => x.shared.length).sort((a,b)=>b.shared.length-a.shared.length).slice(0,4)
      .map(({p,shared}) => `Dengan ${p.name}: tag bersama [${shared.join(", ")}] — guidance mekanis, bukan jaminan.`);
  }
  function viewAddons() {
    const killerId = state.filters.killerId != null ? Number(state.filters.killerId) : (DB.killers[0] && DB.killers[0].id);
    const q = (state.filters.q||"").toLowerCase();
    const list = DB.addons.filter(a => a.killerId===killerId && (!q || a.name.toLowerCase().includes(q)));
    const k = findKiller(killerId);
    if (state.selected) {
      const a = DB.addons.find(x => x.name === state.selected);
      if (!a) return `<div class="empty">Add-on tidak ditemukan.</div>`;
      const syn = suggestAddonCombos(a);
      return `<button class="ghost" data-back="addons">← Add-on Lab</button>
        <section class="panel" style="margin-top:10px"><h1>${esc(a.name)}</h1>
          <div class="taglist"><span class="badge red">${esc(a.rarity)}</span><span class="badge">${esc(a.killer||"")}</span>
            ${(a.tags||[]).map(t=>`<span class="badge">${esc(t)}</span>`).join("")}</div>
          <div class="pre" style="margin-top:10px">${esc(a.description||"Efek teks tidak tersedia; buka sumber wiki.")}</div>
          <p class="muted small">Sumber: <a href="${esc(a.source)}" target="_blank" rel="noopener">wiki</a></p>
          <h3>Kombinasi (guidance)</h3><div class="notice red">Berdasarkan tag bersama saja.</div>
          ${syn.map(s=>`<p class="small">• ${esc(s)}</p>`).join("")||"<p class='muted small'>Tidak ada pasangan tag jelas.</p>"}
        </section>`;
    }
    return `<div><h1>Add-on Laboratory</h1><p class="muted">${DB.addons.length} killer add-on</p></div>
      <label class="field">Killer<select id="addonKiller">${DB.killers.map(kk=>`<option value="${kk.id}" ${kk.id===killerId?"selected":""}>${esc(kk.name)}</option>`).join("")}</select></label>
      ${listFilterBar("Filter add-on…")}
      <p class="muted small">${k?esc(k.name)+" · "+esc(k.power||""):""} · ${list.length} add-on</p>
      <div class="stack">${list.map(a=>`<button class="list-card" data-open-addon="${esc(a.name)}">
        <span class="avatar">${esc((a.rarity||"?")[0]||"?")}</span>
        <div><b>${esc(a.name)}</b> <span class="badge">${esc(a.rarity)}</span>
        <div class="muted small">${esc((a.description||a.tags.join(", ")||"").slice(0,140))}</div></div>
      </button>`).join("")}</div>`;
  }
  function analyzeBuild(role, charName, perkNames, addonNames, strategy) {
    const perks = perkNames.map(findPerk).filter(Boolean);
    const tags = {};
    perks.forEach(p => (p.tags||[]).forEach(t => { tags[t]=(tags[t]||0)+1; }));
    const synergy = [];
    Object.entries(tags).filter(([,n])=>n>=2).forEach(([t,n]) => synergy.push(`Tag “${t}” muncul di ${n} perk — overlap mekanis (bukan jaminan sinergi).`));
    const aura = perks.filter(p => (p.tags||[]).includes("Auras"));
    if (aura.length>=2) synergy.push(`Beberapa perk Aura (${aura.map(p=>p.name).join(", ")}): kuat info, rentan vs anti-info.`);
    const exh = perks.filter(p => (p.tags||[]).includes("Exhausted"));
    if (exh.length>=2) synergy.push(`Beberapa Exhaustion perk: biasanya tidak efisien ditumpuk.`);
    const strengths=[], weaknesses=[];
    if (tags.Generators || tags.Regression) strengths.push("Tekanan generator / regression terwakili.");
    if (tags.Haste) strengths.push("Mobilitas/haste tersedia.");
    if (!tags.Auras && role==="killer") weaknesses.push("Sedikit/zero info aura.");
    if (exh.length>=2) weaknesses.push("Overlap Exhaustion.");
    if (perks.length<4) weaknesses.push("Build belum 4 perk.");
    return {
      disclaimer: "Analisis rule-based dari tag & teks perk lokal. BUKAN output AI dan BUKAN jaminan win rate.",
      name: `${charName||role} · ${strategy||"Custom"}`,
      synergy: synergy.length?synergy:["Tidak ada overlap tag jelas — mungkin generalis."],
      strengths: strengths.length?strengths:["Tidak cukup sinyal tag untuk klaim kekuatan spesifik."],
      weaknesses: weaknesses.length?weaknesses:["Tidak ada kelemahan struktural jelas dari tag saja."],
      counterplay: role==="killer"
        ? ["Survivor: pecah hex early jika ada.","Jangan donasi resource saat power down.","Split gens vs info builds."]
        : ["Killer: tekan unhook & denial heal.","Hormati exhaustion windows.","Proxy cerdas vs unhook stacks."],
      alternatives: perks.slice(0,2).map(p => {
        const alt = DB.perks.filter(x => x.role===p.role && x.name!==p.name && (x.tags||[]).some(t=>(p.tags||[]).includes(t))).slice(0,2);
        return alt.length ? `Alternatif mirip ${p.name}: ${alt.map(a=>a.name).join(", ")}` : null;
      }).filter(Boolean)
    };
  }

  function viewBuilds() {
    const b = state.build;
    const chars = b.role === "killer" ? DB.killers : DB.survivors;
    const char = chars.find(c => c.id === b.characterId) || chars[0];
    if (char && b.characterId == null) b.characterId = char.id;
    const perkPool = perksByRole(b.role === "killer" ? "killer" : "survivor");
    const cats = DB.buildCategories[b.role] || [];
    const addons = b.role === "killer" ? DB.addons.filter(a => a.killerId === b.characterId) : [];
    const report = analyzeBuild(b.role, char && char.name, b.perks, b.addons, b.strategy);
    return `<div><h1>Build Laboratory</h1><p class="muted">Analisis berbasis aturan (tag perk) — bukan AI.</p></div>
      <div class="chips">
        <button class="chip ${b.role==="killer"?"on":""}" data-build-role="killer">Killer</button>
        <button class="chip ${b.role==="survivor"?"on":""}" data-build-role="survivor">Survivor</button>
      </div>
      <section class="panel">
        <div class="grid cols-2">
          <label class="field">Karakter<select id="buildChar">${chars.map(c=>`<option value="${c.id}" ${c.id===b.characterId?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
          <label class="field">Strategi / kategori<select id="buildStrat"><option value="">Custom</option>${cats.map(c=>`<option ${b.strategy===c?"selected":""}>${esc(c)}</option>`).join("")}</select></label>
          <label class="field">Difficulty intent<select id="buildDiff">${["Beginner","Intermediate","Advanced","Expert","Competitive"].map(d=>`<option ${b.difficulty===d?"selected":""}>${d}</option>`).join("")}</select></label>
        </div>
        <h3 style="margin-top:12px">4 Perks</h3>
        <div class="grid cols-2">${[0,1,2,3].map(i=>`<label class="field">Perk ${i+1}
          <select data-build-perk="${i}"><option value="">—</option>${perkPool.map(p=>`<option value="${esc(p.name)}" ${b.perks[i]===p.name?"selected":""}>${esc(p.name)}</option>`).join("")}</select>
        </label>`).join("")}</div>
        ${b.role==="killer"?`<h3 style="margin-top:12px">Add-ons</h3><div class="grid cols-2">${[0,1].map(i=>`<label class="field">Add-on ${i+1}
          <select data-build-addon="${i}"><option value="">—</option>${addons.map(a=>`<option value="${esc(a.name)}" ${b.addons[i]===a.name?"selected":""}>${esc(a.name)}</option>`).join("")}</select>
        </label>`).join("")}</div>`:""}
        <div class="row" style="margin-top:14px">
          <button class="primary" id="btnSaveBuild">Simpan build</button>
          <button class="ghost" id="btnCopyBuildPrompt">Salin prompt AI coach</button>
        </div>
      </section>
      <section class="panel" style="margin-top:12px">
        <h2>${esc(report.name)}</h2>
        <div class="notice red">${esc(report.disclaimer)}</div>
        <h3>Synergy</h3>${report.synergy.map(x=>`<p class="small">• ${esc(x)}</p>`).join("")}
        <h3>Strengths</h3>${report.strengths.map(x=>`<p class="small">• ${esc(x)}</p>`).join("")}
        <h3>Weaknesses</h3>${report.weaknesses.map(x=>`<p class="small">• ${esc(x)}</p>`).join("")}
        <h3>Counterplay</h3>${report.counterplay.map(x=>`<p class="small">• ${esc(x)}</p>`).join("")}
        <h3>Alternatives</h3>${report.alternatives.map(x=>`<p class="small">• ${esc(x)}</p>`).join("")||"<p class='muted small'>—</p>"}
      </section>`;
  }
  function viewMaps() {
    if (state.selected) {
      const m = DB.maps.find(x => x.name === state.selected);
      if (!m) return `<div class="empty">Map tidak ditemukan.</div>`;
      return `<button class="ghost" data-back="maps">← Semua Map</button>
        <section class="panel" style="margin-top:10px"><h1>${esc(m.name)}</h1>
          <div class="muted">${esc(m.realm||"")}${m.altName?" · alias "+esc(m.altName):""}</div>
          <div class="kv" style="margin-top:12px">
            <b>Tile size</b><span>${m.sizeTiles!=null?esc(m.sizeTiles)+" (wiki)":"tidak tercantum"}</span>
            <b>Release</b><span>${esc(m.release||"—")}</span>
            <b>Landmark</b><span>${esc(m.landmark||"—")}</span>
            <b>Sumber</b><span><a href="${esc(m.source)}" target="_blank" rel="noopener">wiki</a></span>
          </div>
          <div class="notice" style="margin-top:12px">${esc(m.notes)}</div>
          <h3 style="margin-top:12px">Guidance</h3>
          <p class="small">[GUIDANCE] Tekan generator yang membentuk 3-gen berbahaya; jangan overcommit di tile kuat tanpa info.</p>
          <p class="small">[GUIDANCE] Survivor: manfaatkan LOS putus di struktur utama; simpan pallet untuk Power windows.</p>
          <label class="field" style="margin-top:12px">Catatan strategimu
            <textarea id="mapNote">${esc((store.get("mapNotes",{})[m.name]||""))}</textarea></label>
          <button class="primary" id="saveMapNote" data-map="${esc(m.name)}">Simpan catatan</button>
        </section>`;
    }
    const q=(state.filters.q||"").toLowerCase(); const realmF=state.filters.realm||"";
    let list=DB.maps.slice();
    if (realmF) list=list.filter(m=>m.realm===realmF);
    if (q) list=list.filter(m=>(m.name+" "+(m.realm||"")).toLowerCase().includes(q));
    return `<div><h1>Map Intelligence</h1><p class="muted">${DB.maps.length} map · ${DB.realms.length} realm</p></div>
      <div class="chips"><button class="chip ${!realmF?"on":""}" data-realm="">Semua realm</button>
        ${DB.realms.map(r=>`<button class="chip ${realmF===r.name?"on":""}" data-realm="${esc(r.name)}">${esc(r.name)}</button>`).join("")}</div>
      ${listFilterBar("Cari map…")}
      <div class="stack">${list.map(m=>`<button class="list-card" data-open-map="${esc(m.name)}">
        <span class="avatar">▣</span><div><b>${esc(m.name)}</b>
        <div class="muted small">${esc(m.realm||"")}${m.sizeTiles!=null?" · size "+m.sizeTiles:""}</div></div>
      </button>`).join("")}</div>`;
  }
  function matchReport(m) {
    const lines=[];
    lines.push(`Laporan rule-based (bukan AI): ${m.role} sebagai ${m.character} di ${m.map||"map?"} → ${m.outcome}.`);
    if (m.duration) lines.push(`Durasi ~${m.duration} menit.`);
    if (m.gens!==""&&m.gens!=null) lines.push(`Generator metric: ${m.gens}.`);
    if (m.hooks!==""&&m.hooks!=null) lines.push(`Hook metric: ${m.hooks}.`);
    if (m.chase) lines.push(`Chase note: ${m.chase}.`);
    if (m.outcome==="loss") { lines.push("Improvement: tinjau chase panjang / 3-gen / unhook tidak aman."); lines.push("Next: 1 tujuan konkret untuk match berikutnya."); }
    else if (m.outcome==="win") lines.push("Pertahankan pola yang bekerja; catat map/build lawan jika ingat.");
    if ((m.perks||[]).filter(Boolean).length) lines.push("Build tags: "+analyzeBuild(m.role,m.character,m.perks,[],"").synergy[0]);
    if (m.notes) lines.push("Catatan: "+m.notes);
    return lines.join("\n");
  }
  function viewMatches() {
    const ms = matches();
    return `<div><h1>Match Analyzer</h1><p class="muted">Catat match nyata. Laporan rule-based dari inputmu.</p></div>
      <section class="panel">
        <div class="grid cols-2">
          <label class="field">Role<select id="mRole"><option value="killer">Killer</option><option value="survivor">Survivor</option></select></label>
          <label class="field">Karakter<select id="mChar"></select></label>
          <label class="field">Map<select id="mMap"><option value="">—</option>${DB.maps.map(m=>`<option>${esc(m.name)}</option>`).join("")}</select></label>
          <label class="field">Hasil<select id="mOut"><option value="win">Win</option><option value="loss">Loss</option><option value="draw">Lainnya</option></select></label>
          <label class="field">Generators (opsional)<input id="mGens" type="number" min="0" max="5"></label>
          <label class="field">Hooks (opsional)<input id="mHooks" type="number" min="0"></label>
          <label class="field">Durasi (menit)<input id="mDur" type="number" min="0"></label>
          <label class="field">Chase notes<input id="mChase" type="text"></label>
        </div>
        <div class="grid cols-2" style="margin-top:10px">${[0,1,2,3].map(i=>`<label class="field">Perk ${i+1}<select id="mPerk${i}"><option value="">—</option></select></label>`).join("")}</div>
        <label class="field" style="margin-top:10px">Catatan<textarea id="mNotes"></textarea></label>
        <button class="primary" style="margin-top:12px" id="saveMatch">Simpan & analisis</button>
      </section>
      <section class="panel" style="margin-top:12px"><h2>Riwayat (${ms.length})</h2>
        ${ms.length?`<div class="stack" style="margin-top:8px">${ms.map((m,idx)=>`<div class="list-card" style="cursor:default"><div style="flex:1">
          <div class="spread"><b>${esc(m.character)} · ${esc(m.role)}</b><span class="badge ${m.outcome==="win"?"ok":m.outcome==="loss"?"red":""}">${esc(m.outcome)}</span></div>
          <div class="muted small">${esc(m.map||"map?")} · ${(m.perks||[]).filter(Boolean).map(esc).join(", ")}</div>
          <div class="pre" style="margin-top:8px">${esc(m.report||"")}</div>
          <button class="ghost" data-del-match="${idx}">Hapus</button>
        </div></div>`).join("")}</div>`:`<div class="empty">Belum ada match.</div>`}
      </section>`;
  }

  function viewMeta() {
    const patches = DB.metaResearch.patches || [];
    return `<div><h1>Meta Research</h1><p class="muted">Data as of ${esc(DB.metaResearch.asOf)} · game ${esc(DB.metaResearch.gameVersion)}</p></div>
      <div class="notice">Jangan anggap info lama sebagai current. Setiap kartu punya tanggal & status verifikasi.</div>
      <div class="stack" style="margin-top:12px">${patches.map(p=>`<article class="panel">
        <div class="spread"><h2>${esc(p.version)} — ${esc(p.title)}</h2>
          <span class="badge ${p.verificationStatus==="verified"?"ok":"warn"}">${esc(p.verificationStatus)}</span></div>
        <div class="muted small">${p.date?esc(p.date):"tanggal tidak pasti"} · verified ${esc(p.lastVerified)}</div>
        <p>${esc(p.summary)}</p><a href="${esc(p.source)}" target="_blank" rel="noopener">Sumber</a>
      </article>`).join("")}</div>
      <section class="panel" style="margin-top:12px"><h2>Catatan dataset</h2>
        <ul>${(DB.meta.notes||[]).map(n=>`<li class="small">${esc(n)}</li>`).join("")}</ul>
        <p class="muted small">Sources: ${(DB.meta.sources||[]).map(s=>`<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a>`).join(" · ")}</p>
      </section>`;
  }
  function viewSim() {
    const ex = experiments();
    return `<div><h1>Experimental Build Simulator</h1></div>
      <div class="notice red">Lingkungan teoretis. Tidak mensimulasikan engine DBD. Pisahkan hipotesis dari hasil match nyata.</div>
      <section class="panel" style="margin-top:12px">
        <label class="field">Judul hipotesis<input id="exTitle"></label>
        <label class="field">Build / kombinasi<textarea id="exBuild"></textarea></label>
        <label class="field">Hipotesis<textarea id="exHyp"></textarea></label>
        <label class="field">Hasil match nyata<textarea id="exOut"></textarea></label>
        <button class="primary" style="margin-top:10px" id="saveEx">Simpan eksperimen</button>
      </section>
      <section class="panel" style="margin-top:12px"><h2>Log (${ex.length})</h2>
        <div class="stack">${ex.map((e,i)=>`<div class="list-card" style="cursor:default"><div>
          <b>${esc(e.title)}</b><div class="muted small">${esc(e.at||"")}</div>
          <div class="pre" style="margin-top:6px">Build: ${esc(e.build)}\nHipotesis: ${esc(e.hyp)}\nHasil: ${esc(e.out||"—")}</div>
          <button class="ghost" data-del-ex="${i}">Hapus</button></div></div>`).join("")||"<div class='empty'>Belum ada eksperimen.</div>"}</div>
      </section>`;
  }
  function viewCollection() {
    const b=builds(), bm=bookmarks(), nt=notes();
    return `<div class="spread"><div><h1>Koleksi Pribadi</h1><p class="muted">localStorage · export/import JSON</p></div>
      <div class="row"><button class="primary" id="btnExport2">Export backup</button>
      <button class="ghost" id="btnImport2">Import backup</button></div></div>
      <section class="panel" style="margin-top:12px"><h2>Build tersimpan (${b.length})</h2>
        <div class="stack">${b.map((x,i)=>`<div class="list-card" style="cursor:default"><div style="flex:1">
          <b>${esc(x.name||x.character)}</b> <span class="badge">${esc(x.role)}</span>
          <div class="muted small">${(x.perks||[]).map(esc).join(" · ")}</div>
          <button class="ghost" data-del-build="${i}">Hapus</button></div></div>`).join("")||"<div class='empty'>Belum ada build.</div>"}</div>
      </section>
      <section class="panel" style="margin-top:12px"><h2>Bookmark (${bm.length})</h2>
        <div class="taglist">${bm.map(x=>`<span class="badge red">${esc(x)}</span>`).join("")||"<span class='muted'>Kosong</span>"}</div>
      </section>
      <section class="panel" style="margin-top:12px"><h2>Catatan bebas</h2>
        <textarea id="freeNote"></textarea>
        <button class="primary" style="margin-top:8px" id="saveFreeNote">Tambah catatan</button>
        <div class="stack" style="margin-top:10px">${nt.map((n,i)=>`<div class="list-card" style="cursor:default"><div>${esc(n.text)}
          <div class="muted small">${esc(n.at||"")}</div><button class="ghost" data-del-note="${i}">Hapus</button></div></div>`).join("")}</div>
      </section>`;
  }
  function viewAI() {
    const b=state.build;
    const char=(b.role==="killer"?DB.killers:DB.survivors).find(c=>c.id===b.characterId);
    const perkLine=(b.perks||[]).filter(Boolean).join(", ")||"(belum dipilih di Build Lab)";
    const templates=[
      {title:"Build Analysis", body:`Analisis build Dead by Daylight ini secara mekanis (bukan popularitas buta).\nRole: ${b.role}\nKarakter: ${char?char.name:"?"}\nPerks: ${perkLine}\nAdd-ons: ${(b.addons||[]).filter(Boolean).join(", ")||"—"}\nStrategi: ${b.strategy||"custom"}\nBerikan: sinergi mekanis, kekuatan, kelemahan, counterplay, alternatif perk.`},
      {title:"Killer Analysis", body:`Jelaskan cara memaksimalkan power killer berikut.\nKiller: ${b.role==="killer"&&char?char.name:"(pilih di Build Lab)"}\nPower: ${char&&char.power?char.power:"?"}\nFokus: chase, pressure gens, hook pressure, endgame.`},
      {title:"Matchup Analysis", body:`Analisis matchup Killer vs Survivor.\nKiller: \nSurvivor comp / perks lawan: \nMap: \nApa win condition masing-masing?`},
      {title:"Counter Strategy", body:`Bagaimana counter playstyle berikut di DBD?\nPlaystyle lawan: \nRole saya: \nBerikan langkah konkret.`},
      {title:"Perk Synergy", body:`Identifikasi interaksi mekanis antar perk ini:\n${perkLine}\nPisahkan fakta efek vs spekulasi.`},
      {title:"Tactical Situation", body:`Situasi match:\nWaktu / gens tersisa: \nHooks: \nPosisi: \nPower status: \nBerikan BEST DECISION / WHY / RISK / ALTERNATIVE / NEXT MOVE.`},
      {title:"Coaching", body:`Saya baru selesai match. Ini catatan saya:\n(tempel ringkasan)\nTunjukkan kesalahan utama dan 3 drill latihan.`}
    ];
    return `<div><h1>AI Strategy Center</h1></div>
      <div class="notice red">Situs statis <b>tidak</b> menjalankan model AI dan tidak menyimpan API key. Analisis AI lewat Grok Bot / coach kamu. Template di bawah siap salin (terisi dari Build Lab).</div>
      <div class="stack" style="margin-top:12px">${templates.map((t,i)=>`<section class="panel">
        <div class="spread"><h2>${esc(t.title)}</h2><button class="primary" data-copy-prompt="${i}">Salin prompt</button></div>
        <div class="pre" id="prompt${i}">${esc(t.body)}</div></section>`).join("")}</div>`;
  }

  function render() {
    renderNav();
    el.dbMeta.innerHTML = `DB ${esc(DB.meta.gameVersion)}<br>as of ${esc(DB.meta.asOf)}`;
    const map = {dashboard:viewDashboard,killers:viewKillers,survivors:viewSurvivors,perks:viewPerks,addons:viewAddons,builds:viewBuilds,maps:viewMaps,matches:viewMatches,meta:viewMeta,sim:viewSim,collection:viewCollection,ai:viewAI};
    el.view.innerHTML = (map[state.route] || viewDashboard)();
    bindView();
  }
  function bindView() {
    el.view.querySelectorAll("[data-route]").forEach(b => b.onclick = () => setRoute(b.dataset.route));
    el.view.querySelectorAll("[data-back]").forEach(b => b.onclick = () => setRoute(b.dataset.back));
    el.view.querySelectorAll("[data-open-killer]").forEach(b => b.onclick = () => setRoute("killers", b.dataset.openKiller));
    el.view.querySelectorAll("[data-open-survivor]").forEach(b => b.onclick = () => setRoute("survivors", b.dataset.openSurvivor));
    el.view.querySelectorAll("[data-open-perk]").forEach(b => b.onclick = () => setRoute("perks", b.dataset.openPerk));
    el.view.querySelectorAll("[data-open-addon]").forEach(b => b.onclick = () => setRoute("addons", b.dataset.openAddon));
    el.view.querySelectorAll("[data-open-map]").forEach(b => b.onclick = () => setRoute("maps", b.dataset.openMap));
    const lq = document.getElementById("localQ");
    if (lq) { lq.value = state.filters.q || ""; lq.oninput = () => { state.filters.q = lq.value.trim(); render(); }; }
    el.view.querySelectorAll("[data-filter-role]").forEach(b => b.onclick = () => { state.filters.role = b.dataset.filterRole; render(); });
    const tagFilter = document.getElementById("tagFilter");
    if (tagFilter) tagFilter.onchange = () => { state.filters.tag = tagFilter.value; render(); };
    el.view.querySelectorAll("[data-compare-toggle]").forEach(b => b.onclick = () => {
      const name = b.dataset.compareToggle; const i = state.compare.indexOf(name);
      if (i >= 0) state.compare.splice(i, 1); else if (state.compare.length < 4) state.compare.push(name); else toast("Maksimal 4 perk");
      render();
    });
    el.view.querySelectorAll("[data-clear-compare]").forEach(b => b.onclick = () => { state.compare = []; render(); });
    el.view.querySelectorAll("[data-bookmark]").forEach(b => b.onclick = () => {
      const bm = bookmarks(); if (!bm.includes(b.dataset.bookmark)) { bm.push(b.dataset.bookmark); store.set("bookmarks", bm); toast("Ditandai"); }
    });
    const addonKiller = document.getElementById("addonKiller");
    if (addonKiller) addonKiller.onchange = () => { state.filters.killerId = Number(addonKiller.value); state.selected = null; render(); };
    el.view.querySelectorAll("[data-sel-killer]").forEach(b => b.onclick = () => { state.filters.killerId = Number(b.dataset.selKiller); setRoute("addons"); });
    el.view.querySelectorAll("[data-build-role]").forEach(b => b.onclick = () => {
      state.build.role = b.dataset.buildRole; state.build.characterId = null;
      state.build.perks = [null,null,null,null]; state.build.addons = [null,null]; render();
    });
    const buildChar = document.getElementById("buildChar");
    if (buildChar) buildChar.onchange = () => { state.build.characterId = Number(buildChar.value); state.build.addons = [null,null]; render(); };
    const buildStrat = document.getElementById("buildStrat");
    if (buildStrat) buildStrat.onchange = () => { state.build.strategy = buildStrat.value; render(); };
    const buildDiff = document.getElementById("buildDiff");
    if (buildDiff) buildDiff.onchange = () => { state.build.difficulty = buildDiff.value; };
    el.view.querySelectorAll("[data-build-perk]").forEach(s => s.onchange = () => { state.build.perks[Number(s.dataset.buildPerk)] = s.value || null; render(); });
    el.view.querySelectorAll("[data-build-addon]").forEach(s => s.onchange = () => { state.build.addons[Number(s.dataset.buildAddon)] = s.value || null; render(); });
    const btnSaveBuild = document.getElementById("btnSaveBuild");
    if (btnSaveBuild) btnSaveBuild.onclick = () => {
      const chars = state.build.role === "killer" ? DB.killers : DB.survivors;
      const char = chars.find(c => c.id === state.build.characterId);
      const list = builds();
      list.unshift({ name:(char&&char.name)+" build", role:state.build.role, character:char&&char.name, perks:state.build.perks.slice(), addons:state.build.addons.slice(), strategy:state.build.strategy, difficulty:state.build.difficulty, at:new Date().toISOString() });
      store.set("builds", list.slice(0,100)); pushActivity({type:"build", title:"Build disimpan", detail:char&&char.name}); toast("Build disimpan");
    };
    const btnCopyBuildPrompt = document.getElementById("btnCopyBuildPrompt");
    if (btnCopyBuildPrompt) btnCopyBuildPrompt.onclick = () => { setRoute("ai"); setTimeout(() => { const node=document.getElementById("prompt0"); if(node) navigator.clipboard.writeText(node.textContent).then(()=>toast("Prompt disalin")).catch(()=>toast("Salin manual")); }, 50); };
    el.view.querySelectorAll("[data-realm]").forEach(b => b.onclick = () => { state.filters.realm = b.dataset.realm; render(); });
    const saveMapNote = document.getElementById("saveMapNote");
    if (saveMapNote) saveMapNote.onclick = () => {
      const mapNotes = store.get("mapNotes", {}); mapNotes[saveMapNote.dataset.map] = document.getElementById("mapNote").value;
      store.set("mapNotes", mapNotes); toast("Catatan map disimpan");
    };
    const mRole = document.getElementById("mRole");
    if (mRole) {
      const fillChars = () => {
        const role = mRole.value;
        const chars = role === "killer" ? DB.killers : DB.survivors;
        document.getElementById("mChar").innerHTML = chars.map(c => `<option>${esc(c.name)}</option>`).join("");
        const pool = perksByRole(role === "killer" ? "killer" : "survivor");
        [0,1,2,3].forEach(i => { document.getElementById("mPerk"+i).innerHTML = `<option value="">—</option>` + pool.map(p => `<option>${esc(p.name)}</option>`).join(""); });
      };
      fillChars(); mRole.onchange = fillChars;
      document.getElementById("saveMatch").onclick = () => {
        const m = { role:mRole.value, character:document.getElementById("mChar").value, map:document.getElementById("mMap").value, outcome:document.getElementById("mOut").value, gens:document.getElementById("mGens").value, hooks:document.getElementById("mHooks").value, duration:document.getElementById("mDur").value, chase:document.getElementById("mChase").value, perks:[0,1,2,3].map(i=>document.getElementById("mPerk"+i).value||null), notes:document.getElementById("mNotes").value, at:new Date().toISOString() };
        m.report = matchReport(m);
        const list = matches(); list.unshift(m); store.set("matches", list.slice(0,200));
        pushActivity({type:"match", title:"Match dicatat", detail:m.character+" · "+m.outcome}); toast("Match disimpan"); render();
      };
    }
    el.view.querySelectorAll("[data-del-match]").forEach(b => b.onclick = () => { const list=matches(); list.splice(Number(b.dataset.delMatch),1); store.set("matches", list); render(); });
    const saveEx = document.getElementById("saveEx");
    if (saveEx) saveEx.onclick = () => {
      const list = experiments();
      list.unshift({ title:document.getElementById("exTitle").value||"Eksperimen", build:document.getElementById("exBuild").value, hyp:document.getElementById("exHyp").value, out:document.getElementById("exOut").value, at:new Date().toISOString() });
      store.set("experiments", list.slice(0,100)); toast("Eksperimen disimpan"); render();
    };
    el.view.querySelectorAll("[data-del-ex]").forEach(b => b.onclick = () => { const list=experiments(); list.splice(Number(b.dataset.delEx),1); store.set("experiments", list); render(); });
    const btnExport2 = document.getElementById("btnExport2"); if (btnExport2) btnExport2.onclick = exportBackup;
    const btnImport2 = document.getElementById("btnImport2"); if (btnImport2) btnImport2.onclick = () => document.getElementById("importFile").click();
    const saveFreeNote = document.getElementById("saveFreeNote");
    if (saveFreeNote) saveFreeNote.onclick = () => {
      const text = document.getElementById("freeNote").value.trim(); if (!text) return;
      const list = notes(); list.unshift({ text, at:new Date().toISOString() }); store.set("notes", list); toast("Catatan ditambah"); render();
    };
    el.view.querySelectorAll("[data-del-note]").forEach(b => b.onclick = () => { const list=notes(); list.splice(Number(b.dataset.delNote),1); store.set("notes", list); render(); });
    el.view.querySelectorAll("[data-del-build]").forEach(b => b.onclick = () => { const list=builds(); list.splice(Number(b.dataset.delBuild),1); store.set("builds", list); render(); });
    el.view.querySelectorAll("[data-copy-prompt]").forEach(b => b.onclick = () => {
      const node = document.getElementById("prompt"+b.dataset.copyPrompt); if (!node) return;
      navigator.clipboard.writeText(node.textContent).then(()=>toast("Prompt disalin")).catch(()=>{
        const r=document.createRange(); r.selectNodeContents(node); const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Blok dipilih — salin manual");
      });
    });
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(store.read(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "entity-lab-backup.json"; a.click(); toast("Backup diunduh");
  }
  function importBackup(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { try { store.write(JSON.parse(reader.result)); toast("Backup diimpor"); render(); } catch (err) { toast("File tidak valid"); } };
    reader.readAsText(f); e.target.value = "";
  }
  function parseHash() {
    const h = (location.hash || "#dashboard").slice(1);
    const [route, sel] = h.split("/");
    if (NAV.some(n => n.id === route)) { state.route = route; state.selected = sel ? decodeURIComponent(sel) : null; }
  }
  async function boot() {
    bindGlobal();
    try { const res = await fetch("data/db.json", { cache: "no-cache" }); DB = await res.json(); }
    catch (e) { el.view.innerHTML = `<div class="empty">Gagal memuat data/db.json</div>`; return; }
    parseHash(); render();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
  boot();
})();
