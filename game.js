(() => {
  // ---------- rules (match the spreadsheet) ----------
  const BASE = 200, SENS = 30, COST = 1, START = 100, GOAL = 1000;
  const P_MIN = 0.5, P_MAX = 6.5, C_MAX = 400;

  const WX = {
    mild:     {name:"Mild autumn day", mult:1.0, blurb:"Classic Melbourne. Not too hot, not too cold.", tip:"A normal day. Around 110 people want coffee at $3."},
    cold:     {name:"Cold snap, 9°",  mult:1.4, blurb:"Southerly's in. Everyone wants something warm.", tip:"Cold days bring 40% more customers. Make more cups!"},
    rainy:    {name:"Drizzle",         mult:1.2, blurb:"Umbrellas up, flat white in hand.", tip:"Rain pushes people into the laneway. A bit busier than usual."},
    hot:      {name:"Heatwave, 38°",   mult:0.6, blurb:"Too hot for hot coffee. The laneway is quiet.", tip:"Heatwave! Only about 60% of the usual crowd. Don't over-make."},
    festival: {name:"Night market",    mult:1.8, blurb:"Food stalls and huge crowds all evening.", tip:"Biggest day of the week. Nearly double the crowd. Go big."}
  };
  const CLASSIC = ["mild","cold","rainy","hot","festival"];
  const DAYNAMES = ["Mon","Tue","Wed","Thu","Fri"];

  const fmt$ = n => (n<0?"−":"") + "$" + Math.abs(n).toLocaleString("en-AU",{minimumFractionDigits:n%1?2:0, maximumFractionDigits:2});
  const fmtP = n => "$" + n.toFixed(2);
  const demandOf = (price, mult) => Math.floor(Math.max(0, (BASE - SENS*price) * mult));
  const clamp = (v,a,b) => Math.min(b, Math.max(a, v));

  // best possible week (ignoring cash limits) for the end-of-game comparison
  function bestDay(mult){
    let best = {profit:-1e9};
    for (let p = P_MIN; p <= P_MAX + 1e-9; p += 0.25){
      const d = demandOf(p, mult); const pr = d*p - d*COST;
      if (pr > best.profit) best = {price:p, cups:d, profit:pr};
    }
    return best;
  }

  // ---------- state ----------
  let S;
  function fresh(week){
    return {week: week || CLASSIC.slice(), day:0, cash:START, price:3.0, cups:100, phase:"plan", log:[], last:null, hint:false};
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const panel = $("panel");

  function wxIcon(key, size=28){
    const s = size;
    const icons = {
      mild: `<svg viewBox="0 0 40 40"><circle cx="16" cy="16" r="7" fill="#e7b77a"/><path d="M12 30 h18 a6 6 0 0 0 0 -12 a8 8 0 0 0 -15 2 a5 5 0 0 0 -3 10z" fill="#f1ece1"/></svg>`,
      cold: `<svg viewBox="0 0 40 40"><g stroke="#8fb6d4" stroke-width="2.4" stroke-linecap="round"><path d="M20 6 v28 M8 13 l24 14 M8 27 l24 -14"/><path d="M16 8 l4 3 4 -3 M16 32 l4 -3 4 3"/></g></svg>`,
      rainy: `<svg viewBox="0 0 40 40"><path d="M10 22 h20 a6 6 0 0 0 0 -12 a8 8 0 0 0 -15 2 a5 5 0 0 0 -5 10z" fill="#b9b3a7"/><g stroke="#8fb6d4" stroke-width="2.2" stroke-linecap="round"><path d="M13 27 l-2 6 M20 27 l-2 6 M27 27 l-2 6"/></g></svg>`,
      hot: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="8" fill="#e8913c"/><g stroke="#e8913c" stroke-width="2.4" stroke-linecap="round"><path d="M20 4 v5 M20 31 v5 M4 20 h5 M31 20 h5 M8.7 8.7 l3.5 3.5 M27.8 27.8 l3.5 3.5 M8.7 31.3 l3.5 -3.5 M27.8 12.2 l3.5 -3.5"/></g></svg>`,
      festival: `<svg viewBox="0 0 40 40"><path d="M3 10 Q20 22 37 10" fill="none" stroke="#b9b3a7" stroke-width="1.4"/><circle cx="8" cy="14" r="3.2" fill="#e7b77a"/><circle cx="16" cy="17" r="3.2" fill="#a5452f"/><circle cx="24" cy="17" r="3.2" fill="#4f8a64"/><circle cx="32" cy="14" r="3.2" fill="#8fb6d4"/><path d="M10 34 l4 -10 h12 l4 10z" fill="#a5452f"/><path d="M12 24 h16" stroke="#f1ece1" stroke-width="2"/></svg>`
    };
    return icons[key].replace("<svg", `<svg width="${s}" height="${s}" aria-hidden="true"`);
  }

  // ---------- Joann ----------
  const MOODS = {
    happy:   {mouth:"M288 170 Q300 186 312 170 Q300 176 288 170 Z", bl:"M281 139 Q287 134 293 138", br:"M307 138 Q313 134 319 139", eye:4},
    neutral: {mouth:"M290 173 Q300 178 310 173", bl:"M281 140 Q287 137 293 140", br:"M307 140 Q313 137 319 140", eye:4},
    worried: {mouth:"M290 177 Q300 170 310 177", bl:"M281 141 Q287 135 293 137", br:"M307 137 Q313 135 319 141", eye:4.4},
    wow:     {mouth:"M296 174 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0", bl:"M281 136 Q287 131 293 135", br:"M307 135 Q313 131 319 136", eye:4.8},
    focus:   {mouth:"M292 174 L308 174", bl:"M281 141 Q287 139 293 140", br:"M307 140 Q313 139 319 141", eye:3}
  };
  function mood(m){
    const d = MOODS[m] || MOODS.neutral;
    const mo = $("mouth"); mo.setAttribute("d", d.mouth);
    mo.setAttribute("fill", (m==="happy"||m==="wow") ? "#5a2a1c" : "none");
    $("browL").setAttribute("d", d.bl); $("browR").setAttribute("d", d.br);
    $("eyeL").setAttribute("ry", d.eye); $("eyeR").setAttribute("ry", d.eye);
  }
  function say(html, m){
    $("say").innerHTML = html;
    if (m) mood(m);
    const b = $("bubble"); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
    setTimeout(()=>b.classList.remove("pop"), 260);
  }

  // ---------- scene drawing ----------
  function drawCups(n){
    const g = $("cupStack");
    const icons = Math.ceil(n/10);
    let out = "";
    for (let i=0;i<icons;i++){
      const col = i % 10, row = Math.floor(i/10);
      const x = 18 + col*18, y = 228 - row*20;
      const partial = (i === icons-1 && n % 10) ? .55 : 1;
      out += `<g transform="translate(${x},${y})" opacity="${partial}"><path d="M0 2 h13 l-2 16 h-9 z" fill="#f1ece1"/><rect x="-1" y="0" width="15" height="4" rx="1.5" fill="#2a2a2a"/><rect x="1.5" y="8" width="10" height="4" fill="#a5452f"/></g>`;
    }
    if (n === 0) out = `<text x="20" y="240" font-family="Caveat, cursive" font-size="18" fill="#e7b77a">no cups made…</text>`;
    g.innerHTML = out;
  }
  function drawWeather(key){
    const layer = $("wxLayer"), sky = $("sky"), fest = $("festoon");
    let html = "";
    fest.style.display = "none";
    if (key === "mild") { sky.setAttribute("fill","url(#dusk)"); html = `<circle cx="340" cy="46" r="10" fill="#e7b77a" opacity=".85"/>`; }
    if (key === "cold") { sky.setAttribute("fill","#5d7488"); html = `<g fill="#f1ece1" opacity=".8">${[...Array(14)].map((_,i)=>`<circle cx="${310+((i*37)%142)}" cy="${30+((i*23)%96)}" r="1.6"/>`).join("")}</g>`; }
    if (key === "rainy") { sky.setAttribute("fill","#4a5866"); html = `<g class="raindrops" stroke="#8fb6d4" stroke-width="1.3" opacity=".8">${[...Array(22)].map((_,i)=>`<line x1="${308+((i*29)%146)}" y1="${(i*17)%110 - 20}" x2="${304+((i*29)%146)}" y2="${(i*17)%110 - 10}"/>`).join("")}</g>`; }
    if (key === "hot") { sky.setAttribute("fill","#d9a35e"); html = `<circle cx="420" cy="48" r="16" fill="#f6d27a"/><circle cx="420" cy="48" r="24" fill="#f6d27a" opacity=".25"/>`; }
    if (key === "festival") {
      sky.setAttribute("fill","#1d2433"); fest.style.display = "";
      html = `<g fill="#f1ece1" opacity=".7"><circle cx="330" cy="40" r="1"/><circle cx="410" cy="34" r="1.2"/><circle cx="440" cy="60" r="1"/></g>`;
      const cols = ["#e7b77a","#a5452f","#4f8a64","#8fb6d4","#f1ece1"];
      let b = "";
      for (let i=0;i<20;i++){ const x = 12 + i*24; const t = x/480; const y = 8 + Math.sin(t*Math.PI*2)*-12 + 14; b += `<circle class="fl" style="animation-delay:${(i%5)*.3}s" cx="${x}" cy="${y.toFixed(1)}" r="4" fill="${cols[i%5]}"/>`; }
      $("bulbs").innerHTML = b;
    }
    layer.innerHTML = html;
  }
  function updateScene(){
    $("menuPrice").textContent = fmtP(S.price);
    $("menuCups").textContent = S.cups;
    drawCups(S.cups);
  }

  // ---------- header ----------
  function updateHeader(){
    $("cashTxt").textContent = fmt$(S.cash);
    const pct = clamp(S.cash/GOAL, 0, 1)*100;
    $("goalBar").querySelector("i").style.width = pct + "%";
    $("goalBar").classList.toggle("won", S.cash >= GOAL);
    $("dayTxt").textContent = S.phase === "end" ? "Week complete" : `Day ${S.day+1} of 5 · ${DAYNAMES[S.day]}`;
    $("goalTxt").textContent = S.cash >= GOAL ? "Goal reached!" : `Goal: $1,000 · need ${fmt$(Math.max(0,GOAL - S.cash))} more`;
  }

  function daysStrip(){
    return `<div class="days">${S.week.map((k,i)=>{
      const done = S.log[i];
      const cls = i===S.day && S.phase!=="end" ? "now" : done ? "done" : "";
      const sub = done ? `<span class="p ${done.profit>=0?"pos":"neg"}">${fmt$(done.profit)}</span>` : `<span>${WX[k].mult.toFixed(1)}×</span>`;
      return `<div class="day ${cls}"><b>${DAYNAMES[i]}</b>${wxIcon(k)}${sub}</div>`;
    }).join("")}</div>`;
  }

  // ---------- PLAN view ----------
  function renderPlan(){
    const k = S.week[S.day], w = WX[k];
    const cost = S.cups*COST, afford = cost <= S.cash;
    const maxAfford = Math.min(C_MAX, Math.floor(S.cash/COST));
    panel.innerHTML = `
      ${daysStrip()}
      <div class="forecast">${wxIcon(k,44)}<div><h2>${DAYNAMES[S.day]}: ${w.name}</h2><p>${w.blurb}</p></div><span class="mult">demand ×${w.mult.toFixed(1)}</span></div>

      <div class="ctrl">
        <div class="top"><label for="price">Price per cup</label><span class="val" id="priceVal">${fmtP(S.price)}</span></div>
        <div class="stepper">
          <button class="sbtn big" data-p="-1">−$1</button>
          <button class="sbtn" data-p="-0.25" aria-label="Lower price by 25 cents">−25¢</button>
          <input type="range" id="price" min="${P_MIN}" max="${P_MAX}" step="0.25" value="${S.price}" aria-label="Price per cup">
          <button class="sbtn" data-p="0.25" aria-label="Raise price by 25 cents">+25¢</button>
          <button class="sbtn big" data-p="1">+$1</button>
        </div>
      </div>

      <div class="ctrl">
        <div class="top"><label for="cups">Cups to make</label><span class="val" id="cupsVal">${S.cups}</span></div>
        <div class="stepper">
          <button class="sbtn big" data-c="-50">−50</button>
          <button class="sbtn" data-c="-10" aria-label="Make 10 fewer cups">−10</button>
          <input type="range" id="cups" min="0" max="${C_MAX}" step="5" value="${S.cups}" aria-label="Cups to make">
          <button class="sbtn" data-c="10" aria-label="Make 10 more cups">+10</button>
          <button class="sbtn big" data-c="50">+50</button>
        </div>
        <div class="presets">
          <button class="chip" data-set="60">60 cups</button>
          <button class="chip" data-set="120">120 cups</button>
          <button class="chip" data-set="200">200 cups</button>
          <button class="chip" data-set="${maxAfford}">All I can afford (${maxAfford})</button>
        </div>
      </div>

      <div class="ledger">
        <span>Cost to make (${S.cups} × ${fmtP(COST)})</span><span class="${afford?"":"warn"}">${fmt$(cost)}</span>
        <span>Cash available</span><span>${fmt$(S.cash)}</span>
        <span>If you sell every cup</span><span>${fmt$(S.cups*S.price)}</span>
      </div>

      <div class="actions">
        <button class="go" id="open" ${afford?"":"disabled"}>${afford ? `Open the café · ${DAYNAMES[S.day]}` : "Not enough cash for that many cups"}</button>
        <button class="ghost" id="hint">Ask Joann</button>
      </div>`;
    wirePlan();
    updateScene(); updateHeader(); drawWeather(k);
  }

  function liveUpdate(){
    $("priceVal").textContent = fmtP(S.price);
    $("cupsVal").textContent = S.cups;
    $("price").value = S.price; $("cups").value = S.cups;
    const cost = S.cups*COST, afford = cost <= S.cash;
    const led = panel.querySelector(".ledger");
    led.innerHTML = `<span>Cost to make (${S.cups} × ${fmtP(COST)})</span><span class="${afford?"":"warn"}">${fmt$(cost)}</span>
      <span>Cash available</span><span>${fmt$(S.cash)}</span>
      <span>If you sell every cup</span><span>${fmt$(S.cups*S.price)}</span>`;
    const go = $("open"); go.disabled = !afford;
    go.textContent = afford ? `Open the café · ${DAYNAMES[S.day]}` : "Not enough cash for that many cups";
    updateScene();
    // Joann reacts while you plan
    if (!afford) say(`We've only got <b>${fmt$(S.cash)}</b> in the till. That's ${Math.floor(S.cash/COST)} cups max.`, "worried");
    else if (S.price >= 5.5) say(`<b>${fmtP(S.price)}</b> for a flat white? Even Collins Street would flinch!`, "wow");
    else if (S.price <= 1.25) say(`At <b>${fmtP(S.price)}</b> we're basically giving it away. Our cups cost $1 each!`, "worried");
    else if (S.cups === 0) say(`No cups means no sales. Make at least a few!`, "worried");
    else say(`${fmtP(S.price)} a cup, ${S.cups} cups ready. Looks good to me.`, "focus");
    persist();
  }

  function wirePlan(){
    $("price").addEventListener("input", e => { S.price = +e.target.value; liveUpdate(); });
    $("cups").addEventListener("input", e => { S.cups = +e.target.value; liveUpdate(); });
    panel.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { S.price = clamp(Math.round((S.price + +b.dataset.p)*4)/4, P_MIN, P_MAX); liveUpdate(); }));
    panel.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { S.cups = clamp(S.cups + +b.dataset.c, 0, C_MAX); liveUpdate(); }));
    panel.querySelectorAll("[data-set]").forEach(b => b.addEventListener("click", () => { S.cups = clamp(+b.dataset.set, 0, C_MAX); liveUpdate(); }));
    $("hint").addEventListener("click", () => {
      const w = WX[S.week[S.day]], d = demandOf(S.price, w.mult);
      const lo = Math.max(0, Math.round(d*0.9/5)*5), hi = Math.round(d*1.1/5)*5;
      say(`${w.tip} At <b>${fmtP(S.price)}</b> I reckon <b>${lo}–${hi}</b> people will buy.`, "happy");
    });
    $("open").addEventListener("click", openShop);
  }

  // ---------- SERVE ----------
  const SKINS = ["#f1c9a5","#c68863","#8a5a3b","#5b3a29","#e0ac7e","#3f2a1f"];
  const SHIRTS = ["#a5452f","#4f8a64","#8fb6d4","#e7b77a","#6d5a8a","#b9b3a7","#d0705a"];

  function openShop(){
    const k = S.week[S.day], w = WX[k];
    const demand = demandOf(S.price, w.mult);
    const sold = Math.min(demand, S.cups);
    const r = {
      day:S.day, wx:k, price:S.price, made:S.cups, demand, sold,
      unsold:S.cups - sold, missed:Math.max(0, demand - S.cups),
      revenue:sold*S.price, cost:S.cups*COST, cashStart:S.cash
    };
    r.profit = r.revenue - r.cost; r.cashEnd = S.cash + r.profit;
    S.phase = "serving"; S.last = r;
    say(`Doors open! Let's see who turns up…`, "happy");
    panel.querySelectorAll("button,input").forEach(el => el.disabled = true);

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return finishDay();
    const q = $("queue"); q.querySelectorAll(".cust").forEach(c=>c.remove());
    const walkers = Math.min(28, Math.max(3, Math.round(demand/8)));
    const total = 3000;
    $("queueLbl").textContent = `${demand} customers today`;
    for (let i=0;i<walkers;i++){
      setTimeout(() => {
        const c = document.createElement("div");
        const served = i < Math.round(walkers * (sold/Math.max(1,demand)));
        c.className = "cust walk";
        c.style.setProperty("--dur", (1.4 + Math.random()*0.6) + "s");
        c.innerHTML = `<span class="h" style="background:${SKINS[i%SKINS.length]}"></span><span class="b" style="background:${SHIRTS[(i*3)%SHIRTS.length]}"></span>${served?'<span class="cup"></span>':''}`;
        q.appendChild(c);
        setTimeout(()=>c.remove(), 2200);
      }, i * (total/walkers));
    }
    // count cups down on the counter
    const t0 = performance.now();
    (function tick(now){
      const p = Math.min(1, (now - t0)/total);
      const left = Math.round(r.made - r.sold*p);
      drawCups(left); $("menuCups").textContent = left;
      if (p < 1) requestAnimationFrame(tick); else setTimeout(finishDay, 500);
    })(t0);
  }

  function finishDay(){
    const r = S.last;
    S.log[S.day] = r;
    S.cash = r.cashEnd;
    S.phase = "result";
    $("queueLbl").textContent = "Laneway";
    persist(); renderResult(); renderLog(); renderMaths(r);
  }

  function reaction(r){
    if (r.profit < 0) return [`Ouch. We lost <b>${fmt$(-r.profit)}</b> today. ${r.unsold>0?`${r.unsold} cups went in the bin.`:"Our price was too low to cover costs."}`, "worried"];
    if (r.missed > 25) return [`Sold out! <b>${r.missed}</b> people left without coffee. We could've made more, or charged a bit more.`, "wow"];
    if (r.unsold > 25) return [`We made <b>${r.unsold}</b> cups too many. That's ${fmt$(r.unsold*COST)} down the sink.`, "worried"];
    if (r.missed === 0 && r.unsold <= 5) return [`Spot on! Hardly any waste and nobody missed out. Profit: <b>${fmt$(r.profit)}</b>. Too easy!`, "happy"];
    return [`Not bad! <b>${fmt$(r.profit)}</b> profit today.`, "happy"];
  }

  function renderResult(){
    const r = S.last;
    const [line, m] = reaction(r);
    say(line, m);
    const last = S.day === 4;
    panel.innerHTML = `
      ${daysStrip()}
      <div class="result">
        <h2>${DAYNAMES[r.day]} wrap-up</h2>
        <div class="stats">
          <div class="stat"><small>Customers</small><b>${r.demand}</b></div>
          <div class="stat"><small>Cups sold</small><b>${r.sold}</b></div>
          <div class="stat ${r.unsold>0?"bad":""}"><small>Wasted</small><b>${r.unsold}</b></div>
          <div class="stat ${r.missed>0?"bad":""}"><small>Missed</small><b>${r.missed}</b></div>
          <div class="stat"><small>Revenue</small><b>${fmt$(r.revenue)}</b></div>
          <div class="stat ${r.profit>=0?"good":"bad"}"><small>Profit</small><b>${fmt$(r.profit)}</b></div>
        </div>
        <div class="ledger">
          <span>Cash this morning</span><span>${fmt$(r.cashStart)}</span>
          <span>Today's profit</span><span>${fmt$(r.profit)}</span>
          <span>Cash tonight</span><span>${fmt$(r.cashEnd)}</span>
        </div>
        <button class="go" id="next">${last ? "See how the week went" : `Plan ${DAYNAMES[r.day+1]}: ${WX[S.week[r.day+1]].name}`}</button>
      </div>`;
    updateHeader();
    $("next").addEventListener("click", () => {
      if (last){ S.phase = "end"; persist(); renderEnd(); return; }
      S.day++; S.phase = "plan"; persist(); renderPlan();
      const w = WX[S.week[S.day]];
      say(`${DAYNAMES[S.day]}'s forecast: <b>${w.name}</b>. ${w.blurb}`, "neutral");
    });
    $("next").focus({preventScroll:true});
  }

  // ---------- END ----------
  function renderEnd(){
    const final = S.cash;
    const best = S.week.reduce((a,k)=>a+bestDay(WX[k].mult).profit, START);
    const stars = final >= 1200 ? 3 : final >= GOAL ? 2 : final >= 700 ? 1 : 0;
    const won = final >= GOAL;
    say(won ? `We did it! <b>${fmt$(final)}</b> in the till. Drinks are on me (well, coffee is).`
            : `We finished on <b>${fmt$(final)}</b>. So close! Want to have another crack?`, won ? "happy" : "neutral");
    const waste = S.log.reduce((a,r)=>a+r.unsold,0), missed = S.log.reduce((a,r)=>a+r.missed,0);
    panel.innerHTML = `
      ${daysStrip()}
      <div class="result">
        <h2>${won ? "Goal smashed!" : "Week over"}</h2>
        <div class="stars" aria-label="${stars} of 3 stars">${"★".repeat(stars)}<span class="off">${"★".repeat(3-stars)}</span></div>
        <div class="stats">
          <div class="stat ${won?"good":""}"><small>Final cash</small><b>${fmt$(final)}</b></div>
          <div class="stat ${waste?"bad":""}"><small>Cups wasted</small><b>${waste}</b></div>
          <div class="stat ${missed?"bad":""}"><small>Customers missed</small><b>${missed}</b></div>
        </div>
        <div class="ledger">
          <span>Perfect week (best price, exact cups)</span><span>${fmt$(best)}</span>
          <span>Your score</span><span>${Math.round(Math.max(0,final-START)/(best-START)*100)}% of perfect</span>
        </div>
        <p class="note" style="margin:0">★ $700 · ★★ $1,000 goal · ★★★ $1,200. The best price is close to $3.75 every day; the real skill is matching cups to each day's crowd.</p>
        <div class="actions">
          <button class="go" id="again">Play the same week again</button>
          <button class="ghost" id="shuffle">Random week</button>
        </div>
      </div>`;
    updateHeader();
    $("again").addEventListener("click", () => restart(S.week.slice()));
    $("shuffle").addEventListener("click", () => {
      const keys = Object.keys(WX); const wk = [];
      for (let i=0;i<5;i++) wk.push(keys[Math.floor(Math.random()*keys.length)]);
      restart(wk);
    });
  }

  function restart(week){
    S = fresh(week); persist(); renderLog(); renderMaths(null); renderPlan();
    say(`New week, fresh beans! First up: <b>${WX[S.week[0]].name}</b>. Set a price and how many cups to make.`, "happy");
  }

  // ---------- log + maths ----------
  function renderLog(){
    const rows = S.log.filter(Boolean);
    if (!rows.length){ $("logWrap").innerHTML = `<p class="empty">Each day you trade adds a row here, just like the spreadsheet.</p>`; return; }
    const tot = k => rows.reduce((a,r)=>a+r[k],0);
    $("logWrap").innerHTML = `<table><thead><tr><th>Day</th><th>Weather</th><th>Price</th><th>Made</th><th>Sold</th><th>Wasted</th><th>Missed</th><th>Profit</th><th>Cash</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${DAYNAMES[r.day]}</td><td>${WX[r.wx].name}</td><td>${fmtP(r.price)}</td><td>${r.made}</td><td>${r.sold}</td><td>${r.unsold}</td><td>${r.missed}</td><td class="${r.profit>=0?"pos":"neg"}">${fmt$(r.profit)}</td><td>${fmt$(r.cashEnd)}</td></tr>`).join("")}
      </tbody><tfoot><tr><td>Total</td><td></td><td></td><td>${tot("made")}</td><td>${tot("sold")}</td><td>${tot("unsold")}</td><td>${tot("missed")}</td><td class="${tot("profit")>=0?"pos":"neg"}">${fmt$(tot("profit"))}</td><td>${fmt$(S.cash)}</td></tr></tfoot></table>`;
  }

  function renderMaths(r){
    const el = $("maths");
    if (!r){
      el.innerHTML = `<span class="c">Open the café and the formulas fill in here.</span>

<span class="k">Demand</span> = ROUNDDOWN(MAX(0, (200 − 30 × Price) × Weather), 0)
<span class="k">Sold</span>   = MIN(Demand, Cups made)
<span class="k">Wasted</span> = Cups made − Sold
<span class="k">Missed</span> = MAX(0, Demand − Cups made)
<span class="k">Profit</span> = Sold × Price − Cups made × $1`;
      return;
    }
    const w = WX[r.wx];
    el.innerHTML = `<span class="c">${DAYNAMES[r.day]} · ${w.name}</span>

<span class="k">Demand</span>  = ROUNDDOWN(MAX(0, (200 − 30 × ${r.price.toFixed(2)}) × ${w.mult.toFixed(1)}), 0) = ${r.demand}
<span class="k">Sold</span>    = MIN(${r.demand}, ${r.made}) = ${r.sold}
<span class="k">Wasted</span>  = ${r.made} − ${r.sold} = ${r.unsold}
<span class="k">Missed</span>  = MAX(0, ${r.demand} − ${r.made}) = ${r.missed}
<span class="k">Revenue</span> = ${r.sold} × ${r.price.toFixed(2)} = ${r.revenue.toFixed(2)}
<span class="k">Cost</span>    = ${r.made} × 1.00 = ${r.cost.toFixed(2)}
<span class="k">Profit</span>  = ${r.revenue.toFixed(2)} − ${r.cost.toFixed(2)} = ${r.profit.toFixed(2)}
<span class="k">Cash</span>    = ${r.cashStart.toFixed(2)} + ${r.profit.toFixed(2)} = ${r.cashEnd.toFixed(2)}`;
  }

  // ---------- persistence (per viewer, optional) ----------
  function persist(){ try { localStorage.setItem("chai-crema-v1", JSON.stringify(S)); } catch(e){} }
  function load(){ try { const s = JSON.parse(localStorage.getItem("chai-crema-v1")); if (s && s.week && s.week.length===5) return s; } catch(e){} return null; }

  function start(data){
    S = (data && data.week) ? data : (load() || fresh());
    if (S.phase === "serving") S.phase = "plan";
    renderLog();
    renderMaths(S.log.filter(Boolean).slice(-1)[0] || null);
    if (S.phase === "end") { drawWeather(S.week[4]); updateScene(); renderEnd(); }
    else if (S.phase === "result" && S.last) { drawWeather(S.last.wx); drawCups(S.last.unsold); renderResult(); }
    else {
      renderPlan();
      if (S.day === 0 && !S.log.length) say(`Hi! I'm <b>Joann</b>, and this is my little laneway café. Help me hit <b>$1,000</b> by Friday. Pick a price and how many cups to make.`, "happy");
      else say(`Welcome back! It's ${DAYNAMES[S.day]}: <b>${WX[S.week[S.day]].name}</b>.`, "happy");
    }
  }

  start(null);
})();
