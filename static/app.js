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

const UNKNOWN = "unidentified sighting";

function isUncertain(obs) {
  return !obs.confidence || obs.confidence < 0.5 || !obs.species || obs.species === UNKNOWN;
}

/* ------------------------------------------------------------------ health */

let modelReady = true;

async function loadHealth() {
  const el = $("status");
  const banner = $("ai-banner");
  try {
    const h = await api("/api/health");
    if (h.ollama && h.model_present) {
      modelReady = true;
      el.textContent = `${h.model} \u00b7 ${h.backend} \u00b7 offline`;
      el.className = "status ok";
      banner.hidden = true;
    } else if (h.ollama) {
      modelReady = false;
      el.textContent = `${h.model} \u00b7 not loaded`;
      el.className = "status bad";
      banner.innerHTML = `<strong>Local model not ready.</strong> Ollama is running but "${esc(h.model)}" is not pulled. ` +
        `Run <code>ollama pull ${esc(h.model)}</code> to turn on AI field notes. ` +
        `Your journal is still fully readable and searchable.`;
      banner.hidden = false;
    } else {
      modelReady = false;
      el.textContent = "ollama not running";
      el.className = "status bad";
      banner.innerHTML = `<strong>The local model is offline.</strong> Start Ollama to generate field notes. ` +
        `You can still browse and search everything already saved on disk.`;
      banner.hidden = false;
    }
  } catch (e) {
    modelReady = false;
    el.textContent = "backend offline";
    el.className = "status bad";
    banner.innerHTML = `<strong>Cannot reach the Bioledger backend.</strong> Is the server running?`;
    banner.hidden = false;
  }
}

/* --------------------------------------------------------------- specimen */

function specimenHTML(obs, opts) {
  opts = opts || {};
  const name = obs.common_name || obs.species || UNKNOWN;
  const sci = obs.common_name && obs.species && obs.common_name !== obs.species
    ? `<p class="specimen__sci">${esc(obs.species)}</p>` : "";

  const confidence = obs.confidence ? `${(obs.confidence * 100).toFixed(0)}%` : "\u2014";
  const source = opts.usedVision ? "photograph" : "field note";
  const facts = `
    <dl class="specimen__facts">
      <div><dt>Category</dt><dd>${esc(obs.category || "unclassified")}</dd></div>
      <div><dt>Confidence</dt><dd>${confidence}</dd></div>
      <div><dt>Locality</dt><dd>${esc(obs.place || "unrecorded")}</dd></div>
      <div><dt>Source</dt><dd>${source}</dd></div>
    </dl>`;

  const notice = opts.notice
    ? `<p class="notice">${esc(opts.notice)}</p>` : "";

  const uncertain = isUncertain(obs)
    ? `<p class="uncertain">The model was not confident about a species here, so this stays a plain description rather than a guess.</p>`
    : "";

  const media = opts.photoURL
    ? `<figure class="specimen__media">
         <img src="${opts.photoURL}" alt="Field photograph of ${esc(name)}" />
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

  const similar = (opts.similar && opts.similar.length)
    ? `<div class="specimen__similar">
         <span class="specimen__label">Similar past sightings</span>
         <ul>${opts.similar.map((s) => {
           const o = s.observation;
           return `<li>
             <span class="sci">${esc(o.common_name || o.species)}</span>
             <span class="score">${(s.score * 100).toFixed(0)}% match</span>
           </li>`;
         }).join("")}</ul>
       </div>`
    : "";

  return `
    <article class="specimen">
      <p class="specimen__no">Specimen record \u00b7 ${esc(prettyDate(obs.created_at))}</p>
      <h3 class="specimen__name" id="detail-title">${esc(name)}</h3>
      ${sci}
      ${notice}
      ${uncertain}
      ${facts}
      ${media}
      <div class="specimen__body">
        ${noteBlock}
        ${interpBlock}
      </div>
      ${season}
      ${tags}
      ${similar}
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
  btn.textContent = modelReady ? "Reading the field\u2026" : "Saving\u2026";
  const photoURL = photo ? URL.createObjectURL(photo) : null;
  try {
    const form = new FormData();
    form.append("text", text);
    form.append("place", $("place").value.trim());
    if (photo) form.append("photo", photo);
    const data = await api("/api/observe", { method: "POST", body: form });
    $("result").innerHTML = specimenHTML(data.observation, {
      similar: data.similar,
      usedVision: data.used_vision,
      notice: data.notice,
      photoURL,
    });
    if (!data.ai_processed) {
      loadHealth();
    }
    $("text").value = "";
    $("place").value = "";
    $("photo").value = "";
    $("photo-label").textContent = "Attach a photograph";
    clearPhotoPreview();
    $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
    await refreshLedger();
  } catch (e) {
    const box = $("result");
    if (photoURL) {
      // The note may still have been saved server-side; never imply it was lost.
      box.innerHTML = `<p class="notice">Something went wrong while submitting: ${esc(e.message)}. ` +
        `If this was a network drop, check the ledger below \u2014 your note may already be saved.</p>`;
    } else {
      box.innerHTML = `<p class="notice">Could not log that: ${esc(e.message)}</p>`;
    }
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

/* ----------------------------------------------------------------- ledger */

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

/* ---------------------------------------------------------------- archive */

const filterState = { q: "", category: "" };
let searchTimer = null;

function archiveRowHTML(o) {
  const name = o.common_name || o.species || UNKNOWN;
  return `<li class="entry" data-id="${o.id}" tabindex="0" role="button" aria-label="Open record for ${esc(name)}">
      <span class="date">${esc(prettyDate(o.created_at))}</span>
      <span class="name">${esc(name)}</span>
      <span class="cat">${esc(o.category || "")}</span>
      <span class="entry__chev" aria-hidden="true">&rsaquo;</span>
    </li>`;
}

function renderObservations(rows) {
  const filtering = !!(filterState.q || filterState.category);
  const list = $("observations");
  if (rows.length) {
    list.innerHTML = rows.map(archiveRowHTML).join("");
  } else if (filtering) {
    list.innerHTML = `<li class="empty">No sightings match that search. Try a different word or clear the filter.</li>`;
  } else {
    list.innerHTML = `<li class="empty">No sightings yet. Go outside and log one.</li>`;
  }
  const status = $("archive-status");
  if (filtering) {
    status.textContent = `${rows.length} ${rows.length === 1 ? "record" : "records"} shown` +
      (filterState.q ? ` for \u201c${filterState.q}\u201d` : "") +
      (filterState.category ? ` in ${filterState.category}` : "") + ".";
  } else {
    status.textContent = `${rows.length} ${rows.length === 1 ? "record" : "records"} in the ledger.`;
  }
}

function bindEntries() {
  $("observations").querySelectorAll(".entry").forEach((el) => {
    const id = el.getAttribute("data-id");
    el.addEventListener("click", () => openDetail(id));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(id);
      }
    });
  });
}

async function loadArchive() {
  const params = new URLSearchParams({ limit: "100" });
  if (filterState.q) params.set("q", filterState.q);
  if (filterState.category) params.set("category", filterState.category);
  const rows = await api(`/api/observations?${params.toString()}`);
  renderObservations(rows);
  bindEntries();
  return rows;
}

async function loadCategories() {
  const box = $("category-filters");
  let cats = [];
  try {
    const data = await api("/api/categories");
    cats = data.categories || [];
  } catch (e) {
    cats = [];
  }
  const total = cats.reduce((n, c) => n + c.count, 0);
  const allActive = filterState.category === "";
  const parts = [`<button class="filter-chip" data-cat="" aria-pressed="${allActive}">All<span class="n">${total}</span></button>`];
  cats.forEach((c) => {
    const active = filterState.category === c.category;
    parts.push(`<button class="filter-chip" data-cat="${esc(c.category)}" aria-pressed="${active}">${esc(c.category)}<span class="n">${c.count}</span></button>`);
  });
  box.innerHTML = parts.join("");
  box.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterState.category = btn.getAttribute("data-cat");
      loadArchive().then(loadCategories);
    });
  });
}

function onSearchInput(e) {
  filterState.q = e.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { loadArchive(); }, 220);
}

/* ----------------------------------------------------------------- detail */

let detailReturnFocus = null;

async function openDetail(id) {
  detailReturnFocus = document.activeElement;
  try {
    const obs = await api(`/api/observations/${id}`);
    $("detail-body").innerHTML =
      `<p class="detail-origin">Record #${esc(obs.id)} \u00b7 saved on disk</p>` +
      specimenHTML(obs, {});
    const overlay = $("detail");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    $("detail-close").focus();
  } catch (e) {
    $("result").innerHTML = `<p class="notice">Could not open that record: ${esc(e.message)}</p>`;
  }
}

function closeDetail() {
  const overlay = $("detail");
  overlay.hidden = true;
  document.body.style.overflow = "";
  if (detailReturnFocus && detailReturnFocus.focus) detailReturnFocus.focus();
}

/* ------------------------------------------------------------------ photo */

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

function showPhotoPreview(file, note) {
  clearPhotoPreview();
  if (!file) return;
  previewURL = URL.createObjectURL(file);
  const kb = (file.size / 1024).toFixed(0);
  const box = $("photo-preview");
  box.innerHTML = `
    <img src="${previewURL}" alt="Selected photograph preview" />
    <div class="photo-preview__bar">
      <span class="photo-preview__note">${esc(file.name)} \u00b7 ${kb} KB${note ? " \u00b7 " + esc(note) : ""}</span>
      <button type="button" class="photo-preview__remove" id="photo-remove">Remove photo</button>
    </div>`;
  box.hidden = false;
  $("photo-remove").addEventListener("click", () => {
    $("photo").value = "";
    $("photo-label").textContent = "Attach a photograph";
    clearPhotoPreview();
  });
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function onPhotoChange(e) {
  const file = e.target.files[0];
  if (!file) {
    $("photo-label").textContent = "Attach a photograph";
    clearPhotoPreview();
    return;
  }
  if (!file.type || !file.type.startsWith("image/")) {
    $("photo-label").textContent = "Attach a photograph";
    clearPhotoPreview();
    $("result").innerHTML = '<p class="notice">That file is not an image. Try a JPG, PNG, or WebP.</p>';
    e.target.value = "";
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    $("photo-label").textContent = "Attach a photograph";
    clearPhotoPreview();
    $("result").innerHTML = '<p class="notice">That photo is larger than 10 MB. Try a smaller one.</p>';
    e.target.value = "";
    return;
  }
  $("photo-label").textContent = file.name;
  showPhotoPreview(file, file.type.startsWith("image/") ? file.type.replace("image/", "").toUpperCase() : "");
}

/* ------------------------------------------------------------------ boot */

async function refreshLedger() {
  const [stats, timeline, season] = await Promise.all([
    api("/api/stats"),
    api("/api/timeline?days=30"),
    api("/api/season"),
  ]);
  renderStats(stats);
  renderTimeline(timeline.days);
  renderSeason(season.species);
  await loadArchive();
  await loadCategories();
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

$("observe-form").addEventListener("submit", submitObserve);
$("ask-form").addEventListener("submit", submitAsk);
$("seed-btn").addEventListener("click", seedDemo);
$("photo").addEventListener("change", onPhotoChange);
$("search-input").addEventListener("input", onSearchInput);
$("detail-close").addEventListener("click", closeDetail);
$("detail").addEventListener("click", (e) => {
  if (e.target === $("detail")) closeDetail();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("detail").hidden) closeDetail();
});

loadHealth();
refreshLedger().catch(() => {});
setInterval(loadHealth, 20000);
