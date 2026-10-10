const $ = (id) => document.getElementById(id);

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (e) {}
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  }[c]));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

async function loadHealth() {
  const el = $("status");
  try {
    const h = await api("/api/health");
    if (h.ollama && h.model_present) {
      el.textContent = `${h.model} \u00b7 ${h.backend} \u00b7 offline`;
      el.className = "status ok";
    } else {
      el.textContent = "model not ready \u2014 start Ollama";
      el.className = "status bad";
    }
  } catch (e) {
    el.textContent = "backend offline";
    el.className = "status bad";
  }
}

function renderObservationCard(obs, similar, usedVision, photoURL) {
  const name = obs.common_name || obs.species;
  const sci = obs.common_name && obs.species && obs.common_name !== obs.species
    ? `<p class="specimen__sci">${esc(obs.species)}</p>` : "";

  const confidence = obs.confidence ? `${(obs.confidence * 100).toFixed(0)}%` : "\u2014";
  const facts = `
    <dl class="specimen__facts">
      <div><dt>Category</dt><dd>${esc(obs.category || "unclassified")}</dd></div>
      <div><dt>Confidence</dt><dd>${confidence}</dd></div>
      <div><dt>Locality</dt><dd>${esc(obs.place || "unrecorded")}</dd></div>
      <div><dt>Source</dt><dd>${usedVision ? "photograph" : "field note"}</dd></div>
    </dl>`;

  const media = photoURL
    ? `<figure class="specimen__media">
         <img src="${photoURL}" alt="Field photograph of ${esc(name)}" />
         <figcaption>Plate \u2014 attached photograph</figcaption>
       </figure>`
    : "";

  const noteBlock = obs.text
    ? `<div class="specimen__block">
         <span class="specimen__label">Original note</span>
         <p class="specimen__text specimen__text--note">${esc(obs.text)}</p>
       </div>` : "";

  const interpBlock = obs.note
    ? `<div class="specimen__block">
         <span class="specimen__label">Interpretation</span>
         <p class="specimen__text">${esc(obs.note)}</p>
       </div>` : "";

  const tags = (obs.tags || []).length
    ? `<div class="specimen__tags">${obs.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>`
    : "";

  const season = obs.season_note
    ? `<p class="specimen__season">${esc(obs.season_note)}</p>` : "";

  const similarHtml = (similar && similar.length)
    ? `<div class="specimen__similar">
         <span class="specimen__label">Similar past sightings</span>
         <ul>${similar.map((s) => {
           const o = s.observation;
           return `<li>
             <span class="sci">${esc(o.common_name || o.species)}</span>
             <span class="score">${(s.score * 100).toFixed(0)}% match</span>
           </li>`;
         }).join("")}</ul>
       </div>`
    : "";

  $("result").innerHTML = `
    <article class="specimen">
      <p class="specimen__no">Specimen record \u00b7 ${esc(prettyDate(obs.created_at))}</p>
      <h3 class="specimen__name">${esc(name)}</h3>
      ${sci}
      ${facts}
      ${media}
      <div class="specimen__body">
        ${noteBlock}
        ${interpBlock}
      </div>
      ${season}
      ${tags}
      ${similarHtml}
    </article>`;
}

async function submitObserve(event) {
  event.preventDefault();
  const btn = $("observe-btn");
  const text = $("text").value.trim();
  const photo = $("photo").files[0];
  if (!text && !photo) {
    $("result").innerHTML = '<p class="composer__hint">Add a description or a photograph first.</p>';
    return;
  }
  btn.disabled = true;
  btn.textContent = "Reading the field\u2026";
  const photoURL = photo ? URL.createObjectURL(photo) : null;
  try {
    const form = new FormData();
    form.append("text", text);
    form.append("place", $("place").value.trim());
    if (photo) form.append("photo", photo);
    const data = await api("/api/observe", { method: "POST", body: form });
    renderObservationCard(data.observation, data.similar, data.used_vision, photoURL);
    $("text").value = "";
    $("place").value = "";
    $("photo").value = "";
    $("photo-label").textContent = "Attach a photograph";
    clearPhotoPreview();
    $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
    await refreshLedger();
  } catch (e) {
    $("result").innerHTML = `<p class="composer__hint">Could not log that: ${esc(e.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Log this sighting";
  }
}

async function submitAsk(event) {
  event.preventDefault();
  const question = $("question").value.trim();
  if (!question) return;
  $("answer").innerHTML = '<p class="meta">Thinking with the local model\u2026</p>';
  try {
    const data = await api("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    $("answer").innerHTML = `<p>${esc(data.answer)}</p>`;
    $("question").value = "";
  } catch (e) {
    $("answer").innerHTML = `<p class="meta">${esc(e.message)}</p>`;
  }
}

function renderStats(s) {
  $("stats").innerHTML = `
    <div class="stat"><div class="num">${s.total}</div><span class="lbl">sightings</span></div>
    <div class="stat"><div class="num">${s.species}</div><span class="lbl">species</span></div>
    <div class="stat"><div class="num">${s.this_week}</div><span class="lbl">this week</span></div>
    <div class="stat"><div class="num">${s.streak_days}</div><span class="lbl">day streak</span></div>`;
}

function renderTimeline(days) {
  const max = Math.max(1, ...days.map((d) => d.count));
  $("timeline").innerHTML = days
    .map((d) => {
      const height = d.count ? Math.max(6, (d.count / max) * 100) : 2;
      const cls = d.count ? "bar" : "bar is-empty";
      return `<div class="${cls}" title="${esc(d.date)}: ${d.count}" style="height:${height}%"></div>`;
    })
    .join("");
}

function renderSeason(rows) {
  $("season").innerHTML = rows.length
    ? rows.map((r) => `<li>
         <span class="sci">${esc(r.species)}</span>
         <span class="leader"></span>
         <span class="count">\u00d7${r.count}</span>
       </li>`).join("")
    : '<li class="empty">Nothing logged this month yet.</li>';
}

function renderObservations(rows) {
  $("observations").innerHTML = rows.length
    ? rows.map((o) => `<li>
         <span class="date">${esc(prettyDate(o.created_at))}</span>
         <span class="name">${esc(o.common_name || o.species)}</span>
         <span class="cat">${esc(o.category || "")}</span>
       </li>`).join("")
    : '<li class="empty">No sightings yet. Go outside and log one.</li>';
}

async function refreshLedger() {
  const [stats, timeline, season, obs] = await Promise.all([
    api("/api/stats"),
    api("/api/timeline?days=30"),
    api("/api/season"),
    api("/api/observations?limit=20"),
  ]);
  renderStats(stats);
  renderTimeline(timeline.days);
  renderSeason(season.species);
  renderObservations(obs);
}

async function seedDemo() {
  const btn = $("seed-btn");
  btn.disabled = true;
  btn.textContent = "Loading\u2026";
  try {
    await api("/api/seed", { method: "POST" });
    await refreshLedger();
  } finally {
    btn.disabled = false;
    btn.textContent = "Load demo sightings";
  }
}

let previewURL = null;

function clearPhotoPreview() {
  const box = $("photo-preview");
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
  box.innerHTML = "";
  box.hidden = true;
}

function showPhotoPreview(file) {
  clearPhotoPreview();
  if (!file) return;
  previewURL = URL.createObjectURL(file);
  const box = $("photo-preview");
  box.innerHTML = `<img src="${previewURL}" alt="Selected photograph preview" />`;
  box.hidden = false;
}

$("observe-form").addEventListener("submit", submitObserve);
$("ask-form").addEventListener("submit", submitAsk);
$("seed-btn").addEventListener("click", seedDemo);
$("photo").addEventListener("change", (e) => {
  const file = e.target.files[0];
  $("photo-label").textContent = file ? file.name : "Attach a photograph";
  showPhotoPreview(file);
});

loadHealth();
refreshLedger().catch(() => {});
