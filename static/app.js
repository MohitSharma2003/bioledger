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
  const tags = (obs.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("");
  const similarHtml = (similar && similar.length)
    ? `<div class="similar">Similar past sightings:<ul>${similar
        .map((s) => `<li>${esc(s.observation.species)} (${(s.score * 100).toFixed(0)}% match)</li>`)
        .join("")}</ul></div>`
    : "";
  const photoHtml = photoURL ? `<img class="obs-photo" src="${esc(photoURL)}" alt="The photo you logged" />` : "";
  $("result").innerHTML = `
    <div class="obs-card">
      <h3>${esc(obs.common_name || obs.species)}</h3>
      <div class="meta">${esc(obs.category)} \u00b7 confidence ${(obs.confidence * 100).toFixed(0)}%
        ${usedVision ? "\u00b7 read from your photo" : ""} ${obs.place ? "\u00b7 " + esc(obs.place) : ""}</div>
      ${photoHtml}
      <p>${esc(obs.note || obs.text)}</p>
      <div>${tags}</div>
      ${obs.season_note ? `<p class="meta">${esc(obs.season_note)}</p>` : ""}
      ${similarHtml}
    </div>`;
}

async function submitObserve(event) {
  event.preventDefault();
  const btn = $("observe-btn");
  const text = $("text").value.trim();
  const photo = $("photo").files[0];
  if (!text && !photo) {
    $("result").innerHTML = '<p class="meta">Add a description or a photo first.</p>';
    return;
  }
  btn.disabled = true;
  let lastText = btn.textContent;
  btn.textContent = photo ? "Reading your photo \u2026" : "Writing the field note \u2026";
  let photoURL = null;
  if (photo) {
    photoURL = URL.createObjectURL(photo);
  }
  $("result").innerHTML = '<p class="meta">Thinking locally with Ollama \u2026</p>';
  try {
    const form = new FormData();
    form.append("text", text);
    form.append("place", $("place").value.trim());
    if (photo) form.append("photo", photo);
    const data = await api("/api/observe", { method: "POST", body: form });
    renderObservationCard(data.observation, data.similar, data.used_vision, photoURL);
    $("text").value = "";
    $("photo").value = "";
    $("photo-label").textContent = "Attach a photo";
    await refreshLedger();
  } catch (e) {
    $("result").innerHTML = `<p class="meta">Could not log that: ${esc(e.message)}</p>`;
    if (photoURL) URL.revokeObjectURL(photoURL);
  } finally {
    btn.disabled = false;
    btn.textContent = lastText || "Log this sighting";
  }
}

async function submitAsk(event) {
  event.preventDefault();
  const question = $("question").value.trim();
  if (!question) return;
  $("answer").innerHTML = '<p class="meta">Thinking locally with Ollama \u2026</p>';
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
    <div class="stat"><div class="num">${s.total}</div><div class="lbl">sightings</div></div>
    <div class="stat"><div class="num">${s.species}</div><div class="lbl">species</div></div>
    <div class="stat"><div class="num">${s.this_week}</div><div class="lbl">this week</div></div>
    <div class="stat"><div class="num">${s.streak_days}</div><div class="lbl">day streak</div></div>`;
}

function renderTimeline(days) {
  const max = Math.max(1, ...days.map((d) => d.count));
  $("timeline").innerHTML = days
    .map((d) => `<div class="bar" title="${d.date}: ${d.count}" style="height:${(d.count / max) * 100}%"></div>`)
    .join("");
}

function renderSeason(rows) {
  $("season").innerHTML = rows.length
    ? rows.map((r) => `<li>${esc(r.species)} <span class="when">\u00d7${r.count}</span></li>`).join("")
    : '<li class="when">Nothing logged this month yet.</li>';
}

function renderObservations(rows) {
  $("observations").innerHTML = rows.length
    ? rows.map((o) => `<li>${esc(o.common_name || o.species)} <span class="when">${o.created_at.slice(0, 10)} \u00b7 ${esc(o.category)}</span></li>`).join("")
    : '<li class="when">No sightings yet. Go outside and log one.</li>';
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
  await api("/api/seed", { method: "POST" });
  await refreshLedger();
}

$("observe-form").addEventListener("submit", submitObserve);
$("ask-form").addEventListener("submit", submitAsk);
$("seed-btn").addEventListener("click", seedDemo);
$("photo").addEventListener("change", (e) => {
  const f = e.target.files[0];
  $("photo-label").textContent = f ? f.name : "Attach a photo";
});

loadHealth();
refreshLedger().catch(() => {});
