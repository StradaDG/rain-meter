// Rain Meter · "cerebro" multi-fuente.
// Combina: 10 modelos meteorológicos (Open-Meteo), avisos oficiales del SMN (CAP),
// rayos observados por satélite (GOES-19 GLM) y el índice propio de granizo.
import fs from "node:fs";

export const MODELS = {
  best_match: "Best match", ecmwf_ifs025: "ECMWF", ecmwf_aifs025_single: "ECMWF IA",
  gfs_seamless: "GFS (EE.UU.)", icon_seamless: "ICON (Alemania)", gem_seamless: "GEM (Canadá)",
  ukmo_seamless: "UKMO (R. Unido)", meteofrance_seamless: "Météo-France", jma_seamless: "JMA (Japón)",
  cma_grapes_global: "CMA (China)"
};
const MVARS = "precipitation,precipitation_probability,weather_code,cape,lifted_index,convective_inhibition,freezing_level_height,temperature_500hPa,temperature_700hPa,temperature_850hPa,wind_speed_10m,wind_direction_10m,wind_speed_500hPa,wind_direction_500hPa,showers";

/* ---------- Modelos ---------- */
export async function fetchModels(PLACES) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${PLACES.map(p => p.lat)}&longitude=${PLACES.map(p => p.lon)}&hourly=${MVARS}&models=${Object.keys(MODELS)}&forecast_hours=30&timezone=GMT`;
  const r = await fetch(url); const j = await r.json();
  if (!r.ok || j.error) throw new Error("modelos: " + (j.reason || r.status));
  return Array.isArray(j) ? j : [j];
}
// Convierte la respuesta multi-modelo en {modelo: [hora...]} con t en ms UTC.
export function splitModels(raw) {
  const H = raw.hourly, out = {};
  const times = H.time.map(s => Date.parse(s + ":00Z"));
  for (const m of Object.keys(MODELS)) {
    const vars = MVARS.split(",");
    const rows = times.map((t, i) => {
      const o = { t };
      for (const v of vars) o[v] = H[`${v}_${m}`]?.[i] ?? null;
      if (o.precipitation_probability == null && o.precipitation != null)
        o.precipitation_probability = o.precipitation >= 1 ? 85 : o.precipitation >= .2 ? 70 : o.precipitation > 0 ? 50 : 10;
      return o;
    });
    if (rows.some(o => o.temperature_500hPa != null || o.precipitation != null)) out[m] = rows;
  }
  return out;
}

/* ---------- SMN: avisos oficiales (CAP, licencia CC BY 4.0) ---------- */
function inPoly(lat, lon, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const tag = (x, t) => (x.match(new RegExp(`<(?:cap:)?${t}>([\\s\\S]*?)</(?:cap:)?${t}>`, "i")) || [])[1]?.trim() ?? "";
const tags = (x, t) => [...x.matchAll(new RegExp(`<(?:cap:)?${t}>([\\s\\S]*?)</(?:cap:)?${t}>`, "gi"))].map(m => m[1].trim());
export async function fetchSMN(PLACES) {
  const rss = await (await fetch("https://ssl.smn.gob.ar/CAP/AR.php", { headers: { "User-Agent": "rain-meter" } })).text();
  const links = [...new Set([...rss.matchAll(/<item>[\s\S]*?<link>(.*?)<\/link>/g)].map(m => m[1].trim()))]
    .filter(l => !/viento|calor|frio|nieve|niebla|zonda|humo|polvo/i.test(l));
  const res = Object.fromEntries(PLACES.map(p => [p.id, []]));
  const now = Date.now();
  for (let i = 0; i < links.length; i += 12) {
    await Promise.all(links.slice(i, i + 12).map(async link => {
      try {
        const x = await (await fetch(link, { headers: { "User-Agent": "rain-meter" } })).text();
        for (const info of tags(x, "info")) {
          const ev = tag(info, "event"), head = tag(info, "headline"), desc = tag(info, "description");
          const txt = `${ev} ${head} ${desc}`;
          if (!/tormenta|lluvia|granizo|precipitaci/i.test(txt)) continue;
          const exp = Date.parse(tag(info, "expires")) || now + 3 * 36e5;
          const on = Date.parse(tag(info, "onset")) || Date.parse(tag(info, "effective")) || Date.parse(tag(x, "sent")) || now;
          if (exp < now) continue;
          const sev = tag(info, "severity");
          let lvl = /\bROJ/i.test(head) ? 3 : /NARANJ/i.test(head) ? 2 : /AMARILL/i.test(head) ? 1 : sev === "Extreme" ? 3 : sev === "Severe" ? 2 : 1;
          const polys = tags(info, "polygon").map(s => s.split(/\s+/).map(q => q.split(",").map(Number)));
          for (const p of PLACES) if (polys.some(pg => inPoly(p.lat, p.lon, pg)))
            res[p.id].push({ acp: /avisocortoplazo/.test(link), lvl, hail: /granizo/i.test(txt), rain: /lluvia|precipitaci/i.test(txt),
              head: (head || ev).replace(/\s+/g, " ").slice(0, 140), on, exp, link });
        }
      } catch (e) { }
    }));
  }
  for (const k in res) { // sin duplicados
    const seen = new Set(); res[k] = res[k].filter(a => { const key = a.head + a.on + a.exp; if (seen.has(key)) return false; seen.add(key); return true })
      .sort((a, b) => b.acp - a.acp || b.lvl - a.lvl);
  }
  return res;
}

/* ---------- Fusión ---------- */
// hailScore: el índice propio (el mismo de la página). alerts.mjs lo pasa como parámetro.
export function fuse({ PLACES, hailScore, models, smn, glm, now = Date.now() }) {
  const out = { updated: now, places: {} };
  PLACES.forEach((p, pi) => {
    const M = models?.[pi] || {}, A = smn?.[p.id] || [], G = glm?.places?.[p.id];
    const glmFresh = glm && now - glm.data_until < 25 * 60e3;
    const t0 = Math.floor(now / 36e5) * 36e5;
    const hours = [];
    for (let k = 0; k < 24; k++) {
      const t = t0 + k * 36e5, mod = {};
      for (const m in M) { const h = M[m].find(o => o.t === t); if (h) mod[m] = hailScore(h).s }
      const S = Object.values(mod).sort((a, b) => b - a);
      const mean = S.length ? S.reduce((a, b) => a + b, 0) / S.length : 0;
      const top = S.length ? S.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, S.length) : 0;
      const ens = Math.round(.5 * mean + .5 * top);
      const agree = S.filter(s => s >= 30).length;
      // SMN
      let smnF = 0, smnR = 0, smnTxt = "";
      for (const a of A) {
        if (!(a.on - 36e5 <= t + 36e5 && a.exp > t)) continue;
        let f = a.acp ? (a.hail ? 65 : 45) : a.lvl === 3 ? 75 : a.lvl === 2 ? (a.hail ? 55 : 40) : (a.hail ? 30 : 20);
        if (f > smnF) { smnF = f; smnTxt = (a.acp ? "Aviso SMN a corto plazo " : "Alerta SMN ") + ["", "amarilla", "naranja", "roja"][a.lvl] + (a.hail ? " con granizo" : "") }
        if (a.rain) smnR = Math.max(smnR, a.acp || a.lvl >= 2 ? 2 : 1);
      }
      // Rayos (sólo ahora y la hora siguiente)
      let rayF = 0, rayTxt = "";
      if (glmFresh && G && k <= 1) {
        const n = G.now, pr = G.prev;
        const approach = n.near != null && pr.near != null && n.near < pr.near - 4;
        const jump = n.r50 >= 20 && n.r50 >= 2 * Math.max(pr.r50, 1);
        if (k === 0) rayF = n.r20 >= 30 ? 60 : n.r20 >= 10 ? 45 : n.r20 >= 3 ? 35 : n.r50 >= 20 ? 30 : 0;
        else rayF = (approach || n.r20 > 0) && n.r50 >= 10 ? 40 : n.r50 >= 30 ? 30 : 0;
        if (jump && rayF) rayF += 10;
        if (n.r50 > 0) rayTxt = `${n.r50} rayos a <50 km` + (n.near != null ? ` (el más cerca a ${Math.round(n.near)} km${approach ? ", acercándose" : ""})` : "");
      }
      const signals = [ens >= 30, smnF >= 30, rayF >= 30].filter(Boolean).length;
      let pr = Math.max(ens, smnF, rayF) + (signals >= 2 ? 10 : 0) + (signals >= 3 ? 5 : 0);
      pr = Math.min(99, Math.round(pr));
      hours.push({ t, p: pr, ens, agree, n: S.length, mod, smn: smnF, smnR, smnTxt, ray: rayF, rayTxt });
    }
    out.places[p.id] = { hours, smn: A.map(({ link, ...a }) => a), glm: G || null, glmFresh: !!glmFresh, models: Object.keys(M).length };
  });
  return out;
}
export const loadJSON = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, "utf8")) } catch (e) { return d } };
