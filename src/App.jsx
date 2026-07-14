import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase, supabaseConfigured } from "./lib/supabase.js";

/* ============================================================
   KOMPAS — comunidad para empezar a crear contenido
   Datos compartidos vía Supabase (tabla kv_store)
   Horario: America/Bogota
   ============================================================ */

// ---------- utilidades de fecha (Colombia) ----------
const TZ = "America/Bogota";
function bogotaToday() {
  // YYYY-MM-DD en horario Colombia
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return parts; // en-CA da YYYY-MM-DD
}
function dayIndexFrom(dateStr) {
  // índice estable de día desde una época fija, para rotar retos
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  return Math.floor(utc / 86400000);
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function prettyDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(dt);
}
function isoWeekKey(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = (dt.getUTCDay() + 6) % 7; // lunes=0
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10); // lunes de esa semana
}

// ---------- banco fijo de 30 retos ----------
const CHALLENGES = [
  ["Sube una historia de tu café o desayuno de hoy.", "No tiene que ser perfecto, solo real.", "☕"],
  ["Toma una foto de algo que te gustó en la calle y súbela.", "Entrena tu ojo, no tu edición.", "📸"],
  ["Cuenta en una story qué estás haciendo esta semana.", "La gente conecta con procesos, no con resultados.", "🗓️"],
  ["Muestra tu lugar de trabajo o entrenamiento.", "Mostrar tu contexto genera cercanía.", "🪴"],
  ["Escribe una mini reflexión de algo que te pasó hoy.", "Una idea honesta vale más que una frase bonita.", "✍️"],
  ["Presenta en una story de qué va a tratar tu cuenta.", "Si tú lo tienes claro, tu audiencia también.", "🎯"],
  ["Escribe o mejora tu bio de Instagram.", "Di qué haces y para quién en una línea.", "📝"],
  ["Comparte algo que aprendiste esta semana.", "Enseñar lo poco que sabes ya aporta a alguien.", "💡"],
  ["Haz una encuesta en stories sobre tu tema.", "Preguntar es la forma más fácil de romper el hielo.", "📊"],
  ["Publica tus 3 temas de los que vas a hablar.", "La constancia nace de tener sobre qué hablar.", "🧵"],
  ["Comenta genuinamente en 3 cuentas de tu nicho.", "Comunidad se construye comentando, no solo publicando.", "💬"],
  ["Sube una foto tuya haciendo lo que te gusta.", "Tú eres parte del contenido, no te escondas.", "🙂"],
  ["Comparte una opinión sobre algo de tu tema.", "Tener postura te hace memorable.", "🗣️"],
  ["Haz una caja de preguntas en stories.", "Deja que tu audiencia te diga qué quiere ver.", "❓"],
  ["Publica un carrusel simple de 3 tips.", "3 puntos claros valen más que 10 confusos.", "🎠"],
  ["Graba un video corto contando por qué empezaste.", "Tu historia es tu diferencial.", "🎬"],
  ["Responde una story de alguien de esta comunidad.", "Apoyarse entre creadores multiplica a todos.", "🤝"],
  ["Publica un 'un día en mi vida' corto.", "Lo cotidiano tuyo es interesante para otros.", "🌤️"],
  ["Usa tu voz en un video por primera vez.", "Tu voz genera más confianza que cualquier texto.", "🎙️"],
  ["Publica algo imperfecto a propósito.", "Lo hecho supera a lo perfecto que nunca sale.", "🌈"],
  ["Muestra un antes/después de algo tuyo.", "La transformación siempre engancha.", "🔄"],
  ["Graba tu primer reel aunque sea malo.", "El primero es para perder el miedo, no para viralizar.", "🎥"],
  ["Comparte un error que cometiste y qué aprendiste.", "La vulnerabilidad conecta más que el éxito.", "🪞"],
  ["Muestra tu cara hablando a cámara 15 segundos.", "La cámara asusta menos cada vez que la usas.", "😊"],
  ["Publica un tip específico de tu nicho en reel.", "Enseña una sola cosa bien.", "⭐"],
  ["Cuenta una meta que quieres lograr públicamente.", "Decirlo en voz alta te compromete.", "🎯"],
  ["Haz un reel respondiendo una pregunta frecuente.", "Responde lo que ya te preguntan.", "🔁"],
  ["Comparte tu proceso creando algo de principio a fin.", "El detrás de cámara vende más que el resultado.", "🎨"],
  ["Publica e interactúa con quien comente la primera hora.", "Responder rápido impulsa tu alcance.", "⚡"],
  ["Reflexiona sobre cómo te sentiste creando estos días.", "Cerrar un ciclo también es contenido.", "🌱"],
];
function challengeForDate(dateStr) {
  const idx = ((dayIndexFrom(dateStr) % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length;
  const [text, tip, icon] = CHALLENGES[idx];
  return { idx, text, tip, icon };
}

// ---------- niveles ----------
const TIERS = [
  { key: "semilla", name: "Semilla", emoji: "🌱", goal: "Cumplir el reto diario", dailyDays: 7, extra: 0 },
  { key: "brote", name: "Brote", emoji: "🌿", goal: "Reto diario + 3 posts o stories extra", dailyDays: 7, extra: 3 },
  { key: "crecimiento", name: "Creador en crecimiento", emoji: "🌳", goal: "Reto diario + 5 posts o stories extra", dailyDays: 7, extra: 5 },
  { key: "constante", name: "Creador constante", emoji: "⭐", goal: "Reto diario + 7 extra + interactuar con tu comunidad", dailyDays: 7, extra: 7 },
];

// ---------- storage helpers (Supabase: tabla kv_store(key text pk, value jsonb)) ----------
async function sget(key) {
  const { data, error } = await supabase.from("kv_store").select("value").eq("key", key).maybeSingle();
  if (error) { console.error("storage get", error); return null; }
  return data ? data.value : null;
}
async function sset(key, val) {
  const { error } = await supabase.from("kv_store").upsert({ key, value: val, updated_at: new Date().toISOString() });
  if (error) { console.error("storage set", error); return false; }
  return true;
}

// busca en qué comunidades ya es miembro esta persona (para dispositivos/navegadores
// nuevos que no tienen la sesión guardada localmente, y así no depender del código)
async function findMyCommunities(name) {
  const { data, error } = await supabase.from("kv_store").select("key,value").like("key", "comm:%:data");
  if (error) { console.error("find communities", error); return []; }
  return (data || [])
    .filter((row) => row.value?.members?.some((m) => m.name === name))
    .map((row) => ({ code: row.key.split(":")[1], name: row.value.name }));
}

// ---------- sesión persistida (recordar usuario y comunidad en este navegador) ----------
const SESSION_KEY = "kompas:session";
function saveSession(user, commCode) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user, commCode })); } catch {}
}
function loadSession() {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// ---------- hash de PIN (no guardamos el PIN en texto plano) ----------
async function hashPin(name, pin) {
  const enc = new TextEncoder();
  const data = enc.encode(`kompas:${name.trim().toLowerCase()}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- compresión de imagen ----------
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 800;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isValidUrl(str) {
  try {
    const u = new URL(str.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch { return false; }
}

// ---------- confeti ligero ----------
function burstConfetti() {
  const colors = ["#2f6690", "#6f9fc4", "#f2c14e", "#9fc1de", "#1f3c54"];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;z-index:9999;top:40%;left:50%;width:9px;height:9px;border-radius:2px;pointer-events:none;background:${colors[i % colors.length]};`;
    document.body.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 180;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 120;
    el.animate([
      { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.15,.7,.3,1)" });
    setTimeout(() => el.remove(), 1500);
  }
}

// ============================================================
//  ESTILOS (base clara salvia/marfil + acentos verde bosque)
// ============================================================
const C = {
  bg: "#eef3f8",
  card: "#ffffff",
  ink: "#1b2a3a",
  sub: "#57697d",
  line: "#dbe4ee",
  sage: "#6f9fc4",
  moss: "#2f6690",
  forest: "#152436",
  forest2: "#1f3c54",
  sun: "#f2c14e",
  clay: "#e07a5f",
  soft: "#e8f0f7",
};

const S = {
  page: { minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "'Inter',system-ui,sans-serif" },
  wrap: { maxWidth: 480, margin: "0 auto", paddingBottom: 90 },
  card: { background: C.card, borderRadius: 20, border: `1px solid ${C.line}`, padding: 18 },
  darkCard: { background: `linear-gradient(155deg,${C.forest},${C.forest2})`, color: "#eaf2fa", borderRadius: 24, padding: 22 },
  btn: { background: C.moss, color: "#fff", border: "none", borderRadius: 14, padding: "13px 18px", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%" },
  btnGhost: { background: C.soft, color: C.moss, border: "none", borderRadius: 14, padding: "12px 16px", fontWeight: 700, cursor: "pointer" },
  input: { width: "100%", padding: "13px 14px", borderRadius: 12, border: `1px solid ${C.line}`, fontSize: 15, background: "#fff", boxSizing: "border-box", color: C.ink },
  eyebrow: { fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: C.sage, fontWeight: 700 },
};

// ============================================================
//  COMPONENTE PRINCIPAL
// ============================================================
export default function Kompas() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);       // {name, pinHash}
  const [comm, setComm] = useState(null);        // código de comunidad
  const [state, setState] = useState(null);      // objeto comunidad completo
  const [tab, setTab] = useState("hoy");
  const [toast, setToast] = useState(null);
  const [welcome, setWelcome] = useState(false);
  const [myCommunities, setMyCommunities] = useState([]);
  const today = bogotaToday();

  // restaurar sesión guardada en este navegador (usuario + comunidad)
  useEffect(() => {
    const session = loadSession();
    if (session?.user) {
      setUser(session.user);
      if (session.commCode) setComm(session.commCode);
    }
    setLoading(false);
  }, []);

  // guardar sesión cada vez que cambie el usuario o la comunidad activa
  useEffect(() => {
    if (user) saveSession(user, comm);
  }, [user, comm]);

  function logout() {
    clearSession();
    setUser(null);
    setComm(null);
    setState(null);
    setTab("hoy");
  }

  // si no hay comunidad activa (p. ej. dispositivo/navegador nuevo sin sesión
  // guardada), busca en qué comunidades ya es miembro esta persona para no
  // depender de que recuerde el código de invitación
  useEffect(() => {
    if (!user || comm) { setMyCommunities([]); return; }
    (async () => setMyCommunities(await findMyCommunities(user.name)))();
  }, [user, comm]);

  // refrescar comunidad
  async function refresh(code = comm) {
    if (!code) return;
    const data = await sget(`comm:${code}:data`);
    if (!data) return;
    const changed = evaluateWeeks(data, today);
    if (changed) await sset(`comm:${code}:data`, data);
    setState(data);
  }
  useEffect(() => {
    if (!comm) return;
    refresh(comm);
    const iv = setInterval(() => refresh(comm), 8000);
    return () => clearInterval(iv);
  }, [comm]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // el nombre y la comunidad pueden no existir todavía (login/lobby aún no
  // completados); calculamos `me` de forma segura para poder llamar los
  // hooks de abajo siempre en el mismo orden, sin returns tempranos antes.
  const me = state?.members.find((m) => m.name === user?.name);

  // aviso de promoción de nivel
  useEffect(() => {
    if (!me?.justPromoted) return;
    flash(`🎉 ¡Subiste a nivel ${me.justPromoted}! Sigue así.`);
    (async () => {
      const fresh = await sget(`comm:${comm}:data`);
      if (fresh) {
        const m = fresh.members.find((x) => x.name === user.name);
        if (m) { delete m.justPromoted; await sset(`comm:${comm}:data`, fresh); }
      }
    })();
  }, [me?.justPromoted]);

  if (!supabaseConfigured) return <SupabaseSetupNeeded />;
  if (loading) return <div style={{ ...S.page, display: "grid", placeItems: "center" }}>Cargando…</div>;
  if (!user) return <Auth onDone={(u) => setUser(u)} flash={flash} toast={toast} />;
  if (!state) return (
    <Lobby
      user={user}
      myCommunities={myCommunities}
      onEnter={(code, data, showWelcome = true) => { setComm(code); setState(data); if (showWelcome) setWelcome(true); }}
      flash={flash}
      toast={toast}
    />
  );

  if (welcome && me) return <Welcome me={me} onClose={() => setWelcome(false)} />;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <Header state={state} me={me} />
        {tab === "hoy" && <TabHoy {...{ state, setState, user, comm, today, refresh, flash }} />}
        {tab === "feed" && <TabFeed {...{ state, setState, user, comm, refresh, flash }} />}
        {tab === "progreso" && <TabProgreso {...{ state, me, today }} />}
        {tab === "logros" && <TabLogros {...{ state, me }} />}
        {tab === "comunidad" && <TabComunidad {...{ state, comm, logout }} />}
      </div>
      <Nav tab={tab} setTab={setTab} />
      {toast && <Toast msg={toast} />}
    </div>
  );
}

function SupabaseSetupNeeded() {
  return (
    <div style={{ ...S.page, display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ maxWidth: 420, width: "100%", ...S.card, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🔌</div>
        <h2 style={{ fontSize: 22, margin: "8px 0 4px" }}>Falta conectar Supabase</h2>
        <p style={{ color: C.sub, lineHeight: 1.5 }}>
          Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en un archivo <code>.env</code> local,
          o en las variables de entorno del proyecto en Vercel, y vuelve a cargar.
        </p>
      </div>
    </div>
  );
}

// ============================================================
//  AUTH
// ============================================================
function Auth({ onDone, flash, toast }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState("in"); // in | up
  const [survey, setSurvey] = useState(false); // mostrar encuesta tras registro
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || pin.length !== 4) return flash("Escribe tu nombre y un PIN de 4 dígitos.");
    setBusy(true);
    const key = `user:${name.trim().toLowerCase()}`;
    const existing = await sget(key);
    if (mode === "up") {
      if (existing) { setBusy(false); return flash("Ese nombre ya existe. Inicia sesión."); }
      setSurvey(true); // no guardamos aún: falta la encuesta de nivel
      setBusy(false);
    } else {
      if (!existing) { setBusy(false); return flash("No encontramos ese nombre. Regístrate."); }
      const pinHash = await hashPin(name, pin);
      if (existing.pinHash !== pinHash) { setBusy(false); return flash("PIN incorrecto."); }
      onDone(existing);
    }
  }

  async function finishSurvey(tier) {
    const key = `user:${name.trim().toLowerCase()}`;
    const u = { name: name.trim(), pinHash: await hashPin(name, pin), startTier: tier };
    await sset(key, u);
    onDone(u);
  }

  if (survey) {
    return (
      <div style={{ ...S.page, display: "grid", placeItems: "center", padding: 20 }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ fontSize: 40 }}>🌱</div>
            <h2 style={{ fontSize: 26, margin: "8px 0 4px" }}>¿Dónde estás hoy?</h2>
            <p style={{ color: C.sub, margin: 0, lineHeight: 1.5 }}>
              Esto solo define tu punto de partida, para que compitas con gente en tu mismo momento. Nadie empieza "atrás".
            </p>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              [0, "🌱", "Estoy empezando", "Nunca he publicado o casi nunca. Quiero perder el miedo."],
              [1, "🌿", "Publico de vez en cuando", "He subido cosas, pero sin constancia."],
              [2, "🌳", "Publico seguido", "Ya tengo ritmo, quiero ser más constante y crecer."],
            ].map(([tier, emoji, title, desc]) => (
              <button key={tier} onClick={() => finishSurvey(tier)}
                style={{ ...S.card, textAlign: "left", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 30 }}>{emoji}</div>
                <div>
                  <div style={{ fontWeight: 800 }}>{title}</div>
                  <div style={{ fontSize: 13, color: C.sub }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  return (
    <div style={{ ...S.page, display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 46 }}>🧭</div>
          <h1 style={{ fontSize: 34, margin: "6px 0 4px", letterSpacing: -1 }}>Kompas</h1>
          <p style={{ color: C.sub, margin: 0, lineHeight: 1.5 }}>
            La comunidad para empezar a crear contenido.<br />Un reto pequeño cada día, y nadie lo hace solo.
          </p>
        </div>
        <div style={{ ...S.card, display: "grid", gap: 12 }}>
          <input style={S.input} placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={S.input} placeholder="PIN de 4 dígitos" inputMode="numeric" maxLength={4}
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          <button style={S.btn} disabled={busy} onClick={submit}>{busy ? "Un momento…" : mode === "up" ? "Crear mi cuenta" : "Entrar"}</button>
          <button style={{ ...S.btnGhost, width: "100%" }} onClick={() => setMode(mode === "up" ? "in" : "up")}>
            {mode === "up" ? "Ya tengo cuenta" : "Soy nuevo, crear cuenta"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.sub, textAlign: "center", marginTop: 14 }}>
          El PIN es solo para identificarte. No uses uno importante.
        </p>
      </div>
      {toast && <Toast msg={toast} />}
    </div>
  );
}

// ============================================================
//  LOBBY (crear/unirse a comunidad)
// ============================================================
function makeCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join("");
}
function Lobby({ user, myCommunities, onEnter, flash, toast }) {
  const [joinCode, setJoinCode] = useState("");
  const [commName, setCommName] = useState("");
  const [entering, setEntering] = useState(null);

  function newMember() {
    return { name: user.name, joined: bogotaToday(), tier: user.startTier ?? 0, weeksAtTier: 0, badges: [], extras: {}, lastWeekChecked: null };
  }

  async function enterExisting(code) {
    setEntering(code);
    const data = await sget(`comm:${code}:data`);
    setEntering(null);
    if (!data) return flash("Esa comunidad ya no existe.");
    onEnter(code, data, false);
  }

  async function create() {
    if (!commName.trim()) return flash("Ponle nombre a tu comunidad.");
    const code = makeCode();
    const data = {
      code, name: commName.trim(), admin: user.name,
      members: [newMember()], feed: [], entries: {}, // entries[date][name] = {done, link, img}
      created: bogotaToday(),
    };
    await sset(`comm:${code}:data`, data);
    onEnter(code, data);
  }

  async function join() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return flash("Escribe el código.");
    const data = await sget(`comm:${code}:data`);
    if (!data) return flash("No existe una comunidad con ese código.");
    if (!data.members.some((m) => m.name === user.name)) {
      data.members.push(newMember());
      await sset(`comm:${code}:data`, data);
    }
    onEnter(code, data);
  }

  return (
    <div style={{ ...S.page, padding: 20 }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <h2 style={{ fontSize: 26, marginBottom: 4 }}>Hola, {user.name} 👋</h2>
        <p style={{ color: C.sub, marginTop: 0 }}>Únete a una comunidad o crea la tuya.</p>

        {myCommunities.length > 0 && (
          <div style={{ ...S.card, display: "grid", gap: 10, marginBottom: 16 }}>
            <div style={S.eyebrow}>{myCommunities.length > 1 ? "Ya perteneces a estas comunidades" : "Ya perteneces a esta comunidad"}</div>
            {myCommunities.map((c) => (
              <button key={c.code} onClick={() => enterExisting(c.code)} disabled={entering === c.code}
                style={{ background: C.soft, border: "none", borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
                <span style={{ fontWeight: 700, color: C.ink }}>{c.name}</span>
                <span style={{ color: C.moss, fontSize: 13, fontWeight: 700 }}>{entering === c.code ? "Entrando…" : "Entrar →"}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ ...S.card, display: "grid", gap: 12, marginBottom: 16 }}>
          <div style={S.eyebrow}>Unirme a una comunidad</div>
          <input style={S.input} placeholder="Código (ej. AB4K9Z)" value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))} />
          <button style={S.btn} onClick={join}>Unirme</button>
        </div>

        <div style={{ ...S.card, display: "grid", gap: 12 }}>
          <div style={S.eyebrow}>Crear una comunidad</div>
          <input style={S.input} placeholder="Nombre de tu comunidad" value={commName}
            onChange={(e) => setCommName(e.target.value)} />
          <button style={{ ...S.btn, background: C.forest }} onClick={create}>Crear comunidad</button>
        </div>
      </div>
      {toast && <Toast msg={toast} />}
    </div>
  );
}

// evalúa semanas pasadas al iniciar una nueva; sube de nivel si cumplió meta, nunca baja
function evaluateWeeks(data, today) {
  const currentWk = isoWeekKey(today);
  let changed = false;
  const entries = data.entries || {};
  for (const mem of data.members) {
    // primera vez: marca la semana actual sin evaluar
    if (!mem.lastWeekChecked) { mem.lastWeekChecked = currentWk; changed = true; continue; }
    if (mem.lastWeekChecked === currentWk) continue;
    // evaluamos la semana que quedó cerrada (la de lastWeekChecked)
    const wk = mem.lastWeekChecked;
    const dailyDone = Object.keys(entries).filter((d) => isoWeekKey(d) === wk && entries[d]?.[mem.name]?.done).length;
    const extras = mem.extras?.[wk] || 0;
    const tier = TIERS[mem.tier];
    const met = dailyDone >= tier.dailyDays && extras >= tier.extra;
    if (met && mem.tier < TIERS.length - 1) {
      mem.tier += 1;
      mem.justPromoted = TIERS[mem.tier].name; // para avisar
      awardBadge(mem, "subir-nivel", "Subí de nivel", "⭐");
      const key = ["", "nivel-brote", "nivel-crecimiento", "nivel-constante"][mem.tier];
      if (key) awardBadge(mem, key, TIERS[mem.tier].name, TIERS[mem.tier].emoji);
    }
    // se queda en el mismo nivel si no cumplió (no baja). Semana nueva empieza limpia.
    mem.lastWeekChecked = currentWk;
    changed = true;
  }
  return changed;
}

// ============================================================
//  MÉTRICAS
// ============================================================
function useMemberStats(state, name, today) {
  return useMemo(() => {
    const entries = state.entries || {};
    // días cumplidos ordenados
    const doneDates = Object.keys(entries).filter((d) => entries[d]?.[name]?.done).sort();
    // racha actual (consecutiva hasta hoy o ayer)
    let streak = 0; let cursor = today;
    if (!entries[cursor]?.[name]?.done) cursor = addDays(today, -1);
    while (entries[cursor]?.[name]?.done) { streak++; cursor = addDays(cursor, -1); }
    // racha más larga
    let longest = 0, run = 0, prev = null;
    for (const d of doneDates) {
      if (prev && addDays(prev, 1) === d) run++; else run = 1;
      longest = Math.max(longest, run); prev = d;
    }
    // esta semana (retos diarios cumplidos esta semana)
    const wk = isoWeekKey(today);
    const weekDaily = doneDates.filter((d) => isoWeekKey(d) === wk).length;
    // extras registrados esta semana (posts/stories aparte del reto)
    const member = state.members.find((m) => m.name === name);
    const weekExtras = member?.extras?.[wk] || 0;
    // total y racha
    const total = doneDates.length;
    // ¿cumplió la meta de su nivel esta semana?
    const tier = TIERS[member?.tier ?? 0];
    const metGoal = weekDaily >= tier.dailyDays && weekExtras >= tier.extra;
    return { streak, longest, weekDaily, weekExtras, total, doneDates, wk, metGoal, tier };
  }, [state, name, today]);
}

// ============================================================
//  WELCOME (explica nivel actual y cómo subir)
// ============================================================
function Welcome({ me, onClose }) {
  const tier = TIERS[me.tier];
  const next = TIERS[me.tier + 1];
  return (
    <div style={{ ...S.page, display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ maxWidth: 420, width: "100%", display: "grid", gap: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>{tier.emoji}</div>
          <h2 style={{ fontSize: 26, margin: "8px 0 4px" }}>Estás en nivel {tier.name}</h2>
          <p style={{ color: C.sub, margin: 0 }}>Así funciona tu camino en Kompas.</p>
        </div>

        <div style={S.darkCard}>
          <div style={{ ...S.eyebrow, color: C.sage }}>Tu meta en este nivel</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>{tier.goal}</div>
          <div style={{ fontSize: 14, color: "#cfe0ee", marginTop: 10 }}>
            Cumple el reto del día para avanzar. Las stories e interacción las marcas tú y también suman.
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>¿Cómo subo de nivel?</div>
          {next ? (
            <p style={{ color: C.sub, margin: 0, lineHeight: 1.5, fontSize: 14.5 }}>
              Si cumples tu meta <b>en una semana</b> (de lunes a domingo), el lunes siguiente subes a {next.emoji} <b>{next.name}</b>, donde la meta será: {next.goal}. Si no la cumples, no bajas: sigues en tu nivel y la semana vuelve a empezar.
            </p>
          ) : (
            <p style={{ color: C.sub, margin: 0, lineHeight: 1.5, fontSize: 14.5 }}>
              Ya estás en el nivel más alto. Aquí la constancia es todo: eres ejemplo para quienes empiezan ⭐
            </p>
          )}
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Los 4 niveles</div>
          {TIERS.map((t, i) => (
            <div key={t.key} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < TIERS.length - 1 ? `1px solid ${C.line}` : "none", opacity: i === me.tier ? 1 : 0.7 }}>
              <div style={{ fontSize: 22 }}>{t.emoji}</div>
              <div>
                <div style={{ fontWeight: i === me.tier ? 800 : 600, fontSize: 14 }}>{t.name}{i === me.tier ? " · estás aquí" : ""}</div>
                <div style={{ fontSize: 12.5, color: C.sub }}>{t.goal}</div>
              </div>
            </div>
          ))}
        </div>

        <button style={S.btn} onClick={onClose}>Empezar 🚀</button>
      </div>
    </div>
  );
}

// ============================================================
//  HEADER
// ============================================================
function Header({ state, me }) {
  const tier = TIERS[me?.tier ?? 0];
  return (
    <div style={{ padding: "18px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>🧭 Kompas</div>
        <div style={{ fontSize: 13, color: C.sub }}>{state.name}</div>
      </div>
      <div style={{ background: C.forest, color: "#eaf2fa", padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700 }}>
        {tier.emoji} {tier.name}
      </div>
    </div>
  );
}

// ============================================================
//  TAB HOY
// ============================================================
function TabHoy({ state, setState, user, comm, today, refresh, flash }) {
  const ch = challengeForDate(today);
  const stats = useMemberStats(state, user.name, today);
  const myEntry = state.entries?.[today]?.[user.name];
  const [link, setLink] = useState("");
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  // quién falta hoy — pero SOLO en positivo
  const doneToday = state.members.filter((m) => state.entries?.[today]?.[m.name]?.done);
  const pct = state.members.length ? Math.round((doneToday.length / state.members.length) * 100) : 0;

  const tier = TIERS[state.members.find(m => m.name === user.name)?.tier ?? 0];

  async function pickImg(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { const c = await compressImage(f); setImg(c); } catch { flash("No se pudo procesar la imagen."); }
  }

  async function complete() {
    if (!link.trim() && !img) return flash("Pega el link o sube una captura de lo que publicaste.");
    if (link.trim() && !isValidUrl(link)) return flash("Ese link no parece válido. Debe empezar por http:// o https://");
    setBusy(true);
    const fresh = await sget(`comm:${comm}:data`) || state;
    fresh.entries = fresh.entries || {};
    fresh.entries[today] = fresh.entries[today] || {};
    const post = { done: true, link: link.trim() || null, img: img || null, ts: Date.now(), ch: ch.text, icon: ch.icon };
    fresh.entries[today][user.name] = post;
    // feed
    fresh.feed = fresh.feed || [];
    fresh.feed.unshift({ id: `${today}-${user.name}-${Date.now()}`, name: user.name, date: today, ...post, reactions: {}, comments: [] });
    fresh.feed = fresh.feed.slice(0, 200);
    // badges automáticos
    const mem = fresh.members.find((m) => m.name === user.name);
    const doneCount = Object.keys(fresh.entries).filter((d) => fresh.entries[d]?.[user.name]?.done).length;
    const newStreak = stats.streak + 1;
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date()));
    if (doneCount === 1) awardBadge(mem, "primer-post", "Primer post", "🌱");
    if (doneCount >= 7) awardBadge(mem, "primera-semana", "Primera semana", "📆");
    if (doneCount >= 10) awardBadge(mem, "retos-10", "Constante", "🎯");
    if (doneCount >= 25) awardBadge(mem, "retos-25", "Creador dedicado", "💪");
    if (doneCount >= 50) awardBadge(mem, "retos-50", "Máquina de contenido", "🚀");
    if (doneCount >= 100) awardBadge(mem, "retos-100", "Leyenda Kompas", "👑");
    if (newStreak >= 3) awardBadge(mem, "racha-3", "En marcha", "✨");
    if (newStreak >= 7) awardBadge(mem, "racha-7", "Una semana en racha", "🔥");
    if (newStreak >= 15) awardBadge(mem, "racha-15", "Racha de 15 días", "🔥");
    if (newStreak >= 30) awardBadge(mem, "racha-30", "Un mes imparable", "🏆");
    if (img) awardBadge(mem, "con-foto", "Muéstralo", "📸");
    if (hour < 9) awardBadge(mem, "madrugador", "Madrugador", "🌅");
    if (hour >= 21) awardBadge(mem, "nocturno", "Búho nocturno", "🦉");
    if (fresh.members.indexOf(mem) < 3) awardBadge(mem, "pionero", "Pionero", "🧭");
    await sset(`comm:${comm}:data`, fresh);
    setState({ ...fresh });
    setLink(""); setImg(null); setBusy(false);
    burstConfetti();
    const cheers = [
      "¡Lo lograste! Un día más construyendo el hábito 🌱",
      "¡Boom! Ya estás en el feed. Sigue así 🔥",
      "Publicaste hoy. Eso es más de lo que hace el 90% 💪",
      "¡Qué crack! Otro reto cumplido 🎉",
      `¡Vas ${stats.streak + 1} día${stats.streak + 1 > 1 ? "s" : ""} seguido${stats.streak + 1 > 1 ? "s" : ""}! 🔥`,
      "Pequeño paso hoy, gran creador mañana ✨",
      "¡Hecho! Tu constancia se nota 🌟",
    ];
    flash(cheers[Math.floor(Math.random() * cheers.length)]);
  }

  async function addExtra() {
    const fresh = await sget(`comm:${comm}:data`) || state;
    const mem = fresh.members.find((m) => m.name === user.name);
    const wk = isoWeekKey(today);
    mem.extras = mem.extras || {};
    mem.extras[wk] = (mem.extras[wk] || 0) + 1;
    await sset(`comm:${comm}:data`, fresh);
    setState({ ...fresh });
    flash("¡Sumado! Vas construyendo tu semana 💪");
  }

  return (
    <div style={{ padding: "8px 16px", display: "grid", gap: 16 }}>
      {/* mensaje motivador */}
      <MotivBanner stats={stats} myDone={!!myEntry?.done} pct={pct} tier={tier} />

      {/* reto del día */}
      <div style={S.darkCard}>
        <div style={{ ...S.eyebrow, color: C.sage }}>Reto de hoy · {prettyDate(today)}</div>
        <div style={{ fontSize: 40, margin: "10px 0 4px" }}>{ch.icon}</div>
        <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.25 }}>{ch.text}</div>
        <div style={{ marginTop: 12, background: "rgba(255,255,255,.09)", padding: "10px 12px", borderRadius: 12, fontSize: 14, color: "#cfe0ee" }}>
          💡 {ch.tip}
        </div>
      </div>

      {/* completar */}
      {myEntry?.done ? (
        <div style={{ ...S.card, textAlign: "center", border: `1.5px solid ${C.sage}` }}>
          <div style={{ fontSize: 30 }}>✅</div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>Cumpliste el reto de hoy</div>
          <div style={{ color: C.sub, fontSize: 14 }}>Racha actual: {stats.streak} 🔥</div>
        </div>
      ) : (
        <div style={{ ...S.card, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Muestra lo que publicaste</div>
          <input style={S.input} placeholder="Pega el link de tu publicación" value={link} onChange={(e) => setLink(e.target.value)} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button style={S.btnGhost} onClick={() => fileRef.current.click()}>📷 Subir captura</button>
            {img && <img src={img} alt="preview" style={{ height: 44, borderRadius: 8 }} />}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImg} />
          </div>
          <button style={S.btn} disabled={busy} onClick={complete}>{busy ? "Guardando…" : "Cumplí el reto"}</button>
        </div>
      )}

      {/* extras según nivel */}
      {tier.extra > 0 && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 800 }}>Posts o stories extra</span>
            <span style={{ color: C.sub, fontSize: 14 }}>{stats.weekExtras}/{tier.extra} esta semana</span>
          </div>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>
            Aparte del reto diario, tu nivel {tier.name} pide {tier.extra} publicaciones extra a la semana. Márcalas aquí.
          </div>
          <div style={{ height: 8, background: C.soft, borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: "100%", width: `${Math.min(100, (stats.weekExtras / tier.extra) * 100)}%`, background: C.sage }} />
          </div>
          <button style={{ ...S.btnGhost, width: "100%" }} onClick={addExtra}>+ Registré un post o story extra</button>
        </div>
      )}

      {/* progreso del grupo hoy */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontWeight: 800 }}>La comunidad hoy</span>
          <span style={{ color: C.sub, fontSize: 14 }}>{doneToday.length}/{state.members.length}</span>
        </div>
        <div style={{ height: 10, background: C.soft, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.moss, transition: "width .5s" }} />
        </div>
        {doneToday.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: C.sub }}>
            Ya publicaron: {doneToday.map((m) => m.name).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

function MotivBanner({ stats, myDone, pct, tier }) {
  let msg;
  if (myDone && stats.streak >= 3) msg = `🔥 ¡${stats.streak} días seguidos! Vas increíble.`;
  else if (myDone) msg = "🎉 Cumpliste el reto de hoy. Sigue así.";
  else if (stats.total === 0) msg = "🌱 Tu primer reto te espera. El primero es el más valiente.";
  else if (stats.streak > 0) msg = `💪 Llevas ${stats.streak} de racha, aún estás a tiempo hoy.`;
  else msg = "🌿 Retomar hoy te acerca de nuevo a tu meta. ¡Tú puedes!";
  return (
    <div style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 14px", fontWeight: 600, fontSize: 14.5 }}>
      {msg}
    </div>
  );
}

// ============================================================
//  TAB FEED
// ============================================================
const REACTS = ["❤️", "🎉", "👏"];
function TabFeed({ state, setState, user, comm, refresh, flash }) {
  const [text, setText] = useState({});

  async function react(id, emoji) {
    const fresh = await sget(`comm:${comm}:data`) || state;
    const item = fresh.feed.find((f) => f.id === id); if (!item) return;
    item.reactions = item.reactions || {};
    item.reactions[emoji] = item.reactions[emoji] || [];
    const i = item.reactions[emoji].indexOf(user.name);
    if (i >= 0) item.reactions[emoji].splice(i, 1); else item.reactions[emoji].push(user.name);
    // badge: autor con 10+ reacciones totales
    const author = fresh.members.find((m) => m.name === item.name);
    if (author) {
      const totalReacts = fresh.feed.filter((f) => f.name === item.name)
        .reduce((s, f) => s + Object.values(f.reactions || {}).reduce((a, arr) => a + arr.length, 0), 0);
      if (totalReacts >= 10) awardBadge(author, "querido", "Querido por todos", "❤️");
    }
    await sset(`comm:${comm}:data`, fresh); setState({ ...fresh });
  }
  async function comment(id) {
    const t = (text[id] || "").trim(); if (!t) return;
    const fresh = await sget(`comm:${comm}:data`) || state;
    const item = fresh.feed.find((f) => f.id === id); if (!item) return;
    item.comments = item.comments || [];
    item.comments.push({ name: user.name, text: t, ts: Date.now() });
    // badge: comentar a 5 publicaciones
    const myComments = fresh.feed.reduce((s, f) => s + (f.comments || []).filter((c) => c.name === user.name).length, 0);
    const me = fresh.members.find((m) => m.name === user.name);
    if (me && myComments >= 5) awardBadge(me, "social", "Alma social", "💬");
    await sset(`comm:${comm}:data`, fresh); setState({ ...fresh });
    setText({ ...text, [id]: "" });
  }

  const feed = state.feed || [];
  return (
    <div style={{ padding: "8px 16px", display: "grid", gap: 14 }}>
      <h2 style={{ margin: "4px 0", fontSize: 22 }}>Feed de la comunidad</h2>
      {feed.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", color: C.sub }}>
          Aún no hay publicaciones. Sé quien rompe el hielo con el reto de hoy 🌱
        </div>
      )}
      {feed.map((f) => (
        <div key={f.id} style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: C.sage, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>
              {f.name[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, lineHeight: 1 }}>{f.name}</div>
              <div style={{ fontSize: 12, color: C.sub }}>{f.icon} {f.ch}</div>
            </div>
          </div>
          {f.img && <img src={f.img} alt="post" style={{ width: "100%", borderRadius: 12, marginBottom: 8 }} />}
          {f.link && <a href={f.link} target="_blank" rel="noreferrer" style={{ color: C.moss, fontWeight: 700, wordBreak: "break-all", fontSize: 14 }}>{f.link}</a>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {REACTS.map((e) => {
              const arr = f.reactions?.[e] || [];
              const on = arr.includes(user.name);
              return (
                <button key={e} onClick={() => react(f.id, e)}
                  style={{ border: `1px solid ${on ? C.moss : C.line}`, background: on ? C.soft : "#fff", borderRadius: 999, padding: "5px 11px", cursor: "pointer", fontSize: 14 }}>
                  {e} {arr.length > 0 && arr.length}
                </button>
              );
            })}
          </div>
          {(f.comments || []).map((c, i) => (
            <div key={i} style={{ fontSize: 13, marginTop: 6 }}><b>{c.name}:</b> {c.text}</div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input style={{ ...S.input, padding: "9px 12px" }} placeholder="Deja un ánimo…" value={text[f.id] || ""}
              onChange={(e) => setText({ ...text, [f.id]: e.target.value })} />
            <button style={{ ...S.btnGhost, whiteSpace: "nowrap" }} onClick={() => comment(f.id)}>Enviar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  TAB PROGRESO (nivel, racha, ranking por tier)
// ============================================================
function TabProgreso({ state, me, today }) {
  const stats = useMemberStats(state, me.name, today);
  const tier = TIERS[me.tier];
  const nextTier = TIERS[me.tier + 1];
  const dailyProg = tier.dailyDays ? Math.min(1, stats.weekDaily / tier.dailyDays) : 1;
  const extraProg = tier.extra ? Math.min(1, stats.weekExtras / tier.extra) : 1;

  // ranking dentro del mismo tier por total de retos
  const sameTier = state.members
    .filter((m) => m.tier === me.tier)
    .map((m) => {
      const total = Object.keys(state.entries || {}).filter((d) => state.entries[d]?.[m.name]?.done).length;
      return { name: m.name, total };
    })
    .sort((a, b) => b.total - a.total);
  const myRank = sameTier.findIndex((m) => m.name === me.name) + 1;

  return (
    <div style={{ padding: "8px 16px", display: "grid", gap: 16 }}>
      <h2 style={{ margin: "4px 0", fontSize: 22 }}>Mi progreso</h2>

      <div style={S.darkCard}>
        <div style={{ ...S.eyebrow, color: C.sage }}>Tu nivel</div>
        <div style={{ fontSize: 30, marginTop: 6 }}>{tier.emoji} <b>{tier.name}</b></div>
        <div style={{ fontSize: 14, color: "#cfe0ee", marginTop: 4 }}>Meta de la semana: {tier.goal}</div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, color: "#cfe0ee" }}>
            <span>Reto diario</span><span>{stats.weekDaily}/{tier.dailyDays} días</span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,.15)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${dailyProg * 100}%`, background: C.sun }} />
          </div>
        </div>
        {tier.extra > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, color: "#cfe0ee" }}>
              <span>Posts/stories extra</span><span>{stats.weekExtras}/{tier.extra}</span>
            </div>
            <div style={{ height: 10, background: "rgba(255,255,255,.15)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${extraProg * 100}%`, background: C.sage }} />
            </div>
          </div>
        )}
        {nextTier
          ? <div style={{ fontSize: 13, color: "#cfe0ee", marginTop: 12 }}>
              {stats.metGoal
                ? `✅ ¡Meta cumplida! El lunes subes a ${nextTier.emoji} ${nextTier.name}.`
                : `Cumple la meta esta semana para subir a ${nextTier.emoji} ${nextTier.name}. Si no llegas, sigues en ${tier.name} sin bajar.`}
            </div>
          : <div style={{ fontSize: 13, color: "#cfe0ee", marginTop: 12 }}>Estás en el nivel más alto. ¡Eres ejemplo de constancia! ⭐</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Stat big={`${stats.streak} 🔥`} label="Racha actual" />
        <Stat big={stats.longest} label="Racha más larga" />
        <Stat big={stats.total} label="Retos cumplidos" />
        <Stat big={`#${myRank || "-"}`} label={`En tu nivel (${tier.name})`} />
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Ranking de {tier.emoji} {tier.name}</div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>Compites solo con personas de tu mismo nivel. Sin presión.</div>
        {sameTier.map((m, i) => (
          <div key={m.name} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < sameTier.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <span style={{ fontWeight: m.name === me.name ? 800 : 500 }}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {m.name}{m.name === me.name ? " (tú)" : ""}
            </span>
            <span style={{ color: C.sub }}>{m.total} retos</span>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>¿Cómo funcionan los niveles?</div>
        <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.5, marginTop: 0 }}>
          En Kompas creces por etapas, como una planta. Empiezas donde estás hoy y avanzas a tu ritmo. El ranking te compara solo con gente de tu mismo nivel, para que la comparación sea justa y motivadora, nunca aplastante.
        </p>
        {TIERS.map((t, i) => (
          <div key={t.key} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < TIERS.length - 1 ? `1px solid ${C.line}` : "none", opacity: i === me.tier ? 1 : 0.75 }}>
            <div style={{ fontSize: 22 }}>{t.emoji}</div>
            <div>
              <div style={{ fontWeight: i === me.tier ? 800 : 600, fontSize: 14 }}>
                {t.name}{i === me.tier ? " · estás aquí" : ""}
              </div>
              <div style={{ fontSize: 12.5, color: C.sub }}>Meta: {t.goal}</div>
              <div style={{ fontSize: 12.5, color: C.sub }}>
                {TIERS[i + 1]
                  ? "Cumple la meta en una semana para subir el lunes siguiente."
                  : "Nivel máximo. Aquí la constancia es la meta."}
              </div>
            </div>
          </div>
        ))}
        <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginBottom: 0 }}>
          Tu <b>racha</b> 🔥 son los días seguidos cumpliendo el reto. No da puntos, pero es tu mejor señal de constancia. Si se rompe, no pasa nada: retomar cuenta igual.
        </p>
      </div>
    </div>
  );
}
function Stat({ big, label }) {
  return (
    <div style={{ ...S.card, textAlign: "center", padding: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{big}</div>
      <div style={{ fontSize: 12, color: C.sub }}>{label}</div>
    </div>
  );
}

// ============================================================
//  TAB LOGROS
// ============================================================
const ALL_BADGES = [
  { id: "primer-post", name: "Primer post", emoji: "🌱", desc: "Publicaste tu primer reto" },
  { id: "primera-semana", name: "Primera semana", emoji: "📆", desc: "7 retos cumplidos" },
  { id: "racha-3", name: "En marcha", emoji: "✨", desc: "Racha de 3 días" },
  { id: "racha-7", name: "Una semana en racha", emoji: "🔥", desc: "7 días seguidos" },
  { id: "racha-15", name: "Racha de 15 días", emoji: "🔥", desc: "15 días seguidos" },
  { id: "racha-30", name: "Un mes imparable", emoji: "🏆", desc: "30 días seguidos" },
  { id: "retos-10", name: "Constante", emoji: "🎯", desc: "10 retos cumplidos" },
  { id: "retos-25", name: "Creador dedicado", emoji: "💪", desc: "25 retos cumplidos" },
  { id: "retos-50", name: "Máquina de contenido", emoji: "🚀", desc: "50 retos cumplidos" },
  { id: "retos-100", name: "Leyenda Kompas", emoji: "👑", desc: "100 retos cumplidos" },
  { id: "subir-nivel", name: "Subí de nivel", emoji: "⭐", desc: "Ascendiste de tier" },
  { id: "nivel-brote", name: "Brote", emoji: "🌿", desc: "Llegaste a nivel Brote" },
  { id: "nivel-crecimiento", name: "En crecimiento", emoji: "🌳", desc: "Llegaste a nivel Crecimiento" },
  { id: "nivel-constante", name: "Creador constante", emoji: "🌟", desc: "Alcanzaste el nivel máximo" },
  { id: "madrugador", name: "Madrugador", emoji: "🌅", desc: "Cumpliste antes de las 9am" },
  { id: "nocturno", name: "Búho nocturno", emoji: "🦉", desc: "Cumpliste después de las 9pm" },
  { id: "con-foto", name: "Muéstralo", emoji: "📸", desc: "Subiste una captura al feed" },
  { id: "social", name: "Alma social", emoji: "💬", desc: "Comentaste a 5 compañeros" },
  { id: "querido", name: "Querido por todos", emoji: "❤️", desc: "Recibiste 10 reacciones" },
  { id: "pionero", name: "Pionero", emoji: "🧭", desc: "Fuiste de los primeros de tu comunidad" },
];
function awardBadge(member, id, name, emoji) {
  member.badges = member.badges || [];
  if (!member.badges.some((b) => b.id === id)) {
    member.badges.push({ id, name, emoji, date: bogotaToday() });
    return true;
  }
  return false;
}
function TabLogros({ state, me }) {
  const mine = me.badges || [];
  function share(b) {
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 600;
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 600, 600);
    g.addColorStop(0, "#152436"); g.addColorStop(1, "#1f3c54");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 600, 600);
    ctx.fillStyle = "#f2c14e"; ctx.font = "bold 34px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("KOMPAS", 300, 90);
    ctx.font = "150px serif"; ctx.fillText(b.emoji, 300, 320);
    ctx.fillStyle = "#eaf2fa"; ctx.font = "bold 40px sans-serif"; ctx.fillText(b.name, 300, 420);
    ctx.fillStyle = "#9fc1de"; ctx.font = "22px sans-serif"; ctx.fillText(b.desc, 300, 470);
    ctx.fillText(b.date, 300, 520);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a"); a.href = url; a.download = `kompas-${b.id}.png`; a.click();
  }
  return (
    <div style={{ padding: "8px 16px" }}>
      <h2 style={{ margin: "4px 0 14px", fontSize: 22 }}>Mis logros</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {ALL_BADGES.map((b) => {
          const got = mine.find((x) => x.id === b.id);
          return (
            <div key={b.id} style={{ ...(got ? S.darkCard : S.card), padding: 16, textAlign: "center", opacity: got ? 1 : 0.55 }}>
              <div style={{ fontSize: 40, filter: got ? "none" : "grayscale(1)" }}>{b.emoji}</div>
              <div style={{ fontWeight: 800, marginTop: 4, color: got ? "#eaf2fa" : C.ink }}>{b.name}</div>
              <div style={{ fontSize: 12, color: got ? "#c3d8e8" : C.sub, margintop: 2 }}>{b.desc}</div>
              {got && <button style={{ ...S.btnGhost, marginTop: 10, width: "100%" }} onClick={() => share(b)}>Compartir 📤</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
//  TAB COMUNIDAD (miembros + código + tips)
// ============================================================
const TIPS = [
  "Empieza imperfecto. La primera versión siempre es la más difícil y la más valiente.",
  "Constancia > perfección. Es mejor publicar algo simple hoy que algo perfecto nunca.",
  "Tu nicho es el cruce entre lo que te gusta y lo que puedes sostener en el tiempo.",
  "Habla como le hablarías a un amigo, no como una marca.",
  "No creas contenido para todos. Habla con una persona específica.",
  "Reutiliza: un reel puede volverse story, carrusel y post.",
  "Las primeras publicaciones son práctica, no examen. Nadie te está juzgando tanto como crees.",
];
function TabComunidad({ state, comm, logout }) {
  const [tipIdx] = useState(() => dayIndexFrom(bogotaToday()) % TIPS.length);
  const wk = isoWeekKey(bogotaToday());
  const entries = state.entries || {};
  const memberScores = state.members.map((m) => {
    const daily = Object.keys(entries).filter((d) => isoWeekKey(d) === wk && entries[d]?.[m.name]?.done).length;
    const extras = m.extras?.[wk] || 0;
    return { name: m.name, tier: m.tier, score: daily + extras, daily, extras };
  });
  // separado por nivel: no tiene sentido comparar a alguien en Semilla contra alguien en Creador constante
  const boardByTier = TIERS
    .map((t, tierIdx) => ({
      tier: t,
      tierIdx,
      members: memberScores.filter((m) => m.tier === tierIdx).sort((a, b) => b.score - a.score),
    }))
    .filter((g) => g.members.length > 0);
  return (
    <div style={{ padding: "8px 16px", display: "grid", gap: 16 }}>
      <h2 style={{ margin: "4px 0", fontSize: 22 }}>{state.name}</h2>

      <div style={S.card}>
        <div style={S.eyebrow}>Código para invitar</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, marginTop: 6 }}>{comm}</div>
        <div style={{ fontSize: 13, color: C.sub }}>Compártelo para que otros se unan.</div>
      </div>

      <div style={S.darkCard}>
        <div style={{ ...S.eyebrow, color: C.sage }}>Tip del día</div>
        <div style={{ fontSize: 16, marginTop: 8, lineHeight: 1.4 }}>💡 {TIPS[tipIdx]}</div>
      </div>

      <div style={S.darkCard}>
        <div style={{ ...S.eyebrow, color: C.sage }}>Leaderboard de la semana</div>
        <div style={{ fontSize: 13, color: "#cfe0ee", marginTop: 6 }}>
          Quién cumple más esta semana (retos diarios + extras), por nivel. Se reinicia cada lunes.
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 18 }}>
          {boardByTier.map((g) => (
            <div key={g.tierIdx}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#cfe0ee", marginBottom: 6 }}>
                {g.tier.emoji} {g.tier.name}
              </div>
              {g.members.map((m, i) => (
                <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < g.members.length - 1 ? "1px solid rgba(255,255,255,.12)" : "none" }}>
                  <span style={{ fontSize: 17, width: 26 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                  <span style={{ flex: 1, fontWeight: i < 3 ? 800 : 500 }}>{m.name}{m.name === state.admin ? " 👑" : ""}</span>
                  <span style={{ fontWeight: 800, color: C.sun, minWidth: 34, textAlign: "right" }}>{m.score}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Miembros ({state.members.length})</div>
        {state.members.map((m) => (
          <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, background: C.sage, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>{m.name[0]?.toUpperCase()}</div>
            <span style={{ flex: 1 }}>{m.name}{m.name === state.admin ? " 👑" : ""}</span>
            <span style={{ fontSize: 13, color: C.sub }}>{TIERS[m.tier].emoji} {TIERS[m.tier].name}</span>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Tips para empezar</div>
        {TIPS.map((t, i) => (
          <div key={i} style={{ fontSize: 14, padding: "7px 0", borderBottom: i < TIPS.length - 1 ? `1px solid ${C.line}` : "none", color: C.sub }}>· {t}</div>
        ))}
      </div>

      <button style={{ ...S.btnGhost, width: "100%" }} onClick={logout}>Cerrar sesión</button>
    </div>
  );
}

// ============================================================
//  NAV + TOAST
// ============================================================
function Nav({ tab, setTab }) {
  const items = [
    ["hoy", "🎯", "Hoy"],
    ["feed", "🖼️", "Feed"],
    ["progreso", "📈", "Progreso"],
    ["logros", "🏅", "Logros"],
    ["comunidad", "👥", "Comunidad"],
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: `1px solid ${C.line}`, display: "flex", maxWidth: 480, margin: "0 auto" }}>
      {items.map(([k, ic, lb]) => (
        <button key={k} onClick={() => setTab(k)}
          style={{ flex: 1, border: "none", background: "none", padding: "10px 0 12px", cursor: "pointer", color: tab === k ? C.moss : C.sub }}>
          <div style={{ fontSize: 20 }}>{ic}</div>
          <div style={{ fontSize: 11, fontWeight: tab === k ? 800 : 500 }}>{lb}</div>
        </button>
      ))}
    </div>
  );
}
function Toast({ msg }) {
  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: C.forest, color: "#eaf2fa", padding: "12px 18px", borderRadius: 999, fontWeight: 600, fontSize: 14, zIndex: 9999, maxWidth: "90%", textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
      {msg}
    </div>
  );
}
