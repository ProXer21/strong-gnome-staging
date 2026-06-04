'use strict';

// App-Version (bei jedem Release hochzählen — auch in index.html/sw.js Cache-Buster)
const APP_VERSION = 'v1.1.0';

// ─── Konstanten ─────────────────────────────────────────────────────────────

// Neutrale Fallback-Werte (nur falls ein Profil fehlt — normal setzt das Onboarding alles).
// Bewusst KEIN echter Name mehr, damit nie fremde Daten/Namen auftauchen.
const LEGACY = { name: 'Athlet:in', startDate: '2026-01-01', goalDate: '2026-12-31', startWeight: 80, goalWeight: 75 };

// aktueller eingeloggter Nutzer (Firebase-UID) — bestimmt den Speicher-Key
let currentUid = null;
function storageKey() { return currentUid ? 'fitnessData_' + currentUid : 'fitnessData'; }

// Standard-Plan für NEUE Nutzer: klassischer Push / Pull / Legs (3er-Split).
// Wird beim ersten Mal als bearbeitbare Vorlage angelegt — kann frei geändert werden.
const DEFAULT_ROUTINES = [
  { id: 'r_push', name: 'Push (Brust · Schultern · Trizeps)', emoji: '💪', exercises: [
    { name: 'Bankdrücken (Langhantel)',     tag: 'Brust',     sets: 4, repsMin: 8,  repsMax: 12 },
    { name: 'Schrägbankdrücken (Kurzhantel)',tag: 'obere Brust',sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Schulterdrücken (Kurzhantel)', tag: 'Schultern', sets: 3, repsMin: 8,  repsMax: 12 },
    { name: 'Seitheben',                    tag: 'Schultern', sets: 3, repsMin: 12, repsMax: 15 },
    { name: 'Trizeps Pushdown',             tag: 'Trizeps',   sets: 3, repsMin: 12, repsMax: 15 },
    { name: 'Trizeps Overhead Extension',   tag: 'Trizeps',   sets: 3, repsMin: 12, repsMax: 15 },
  ]},
  { id: 'r_pull', name: 'Pull (Rücken · Bizeps)', emoji: '🏋️', exercises: [
    { name: 'Klimmzüge (assistiert)',       tag: 'Rücken (breit)', sets: 4, repsMin: 6,  repsMax: 10 },
    { name: 'Langhantelrudern',             tag: 'Rücken (Mitte)', sets: 4, repsMin: 8,  repsMax: 12 },
    { name: 'Latzug',                       tag: 'Rücken (breit)', sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Face Pulls',                   tag: 'hintere Schulter',sets: 3, repsMin: 12, repsMax: 15 },
    { name: 'Bizeps Curls (Kurzhantel)',    tag: 'Bizeps',         sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Hammer Curls',                 tag: 'Bizeps',         sets: 3, repsMin: 10, repsMax: 12 },
  ]},
  { id: 'r_legs', name: 'Legs (Beine · Po)', emoji: '🦵', exercises: [
    { name: 'Kniebeugen (Langhantel)',      tag: 'Beine & Po',     sets: 4, repsMin: 8,  repsMax: 12 },
    { name: 'Rumänisches Kreuzheben (RDL)', tag: 'Po & Beinrückseite',sets: 4, repsMin: 8, repsMax: 12 },
    { name: 'Beinpresse',                   tag: 'Quads & Po',     sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Hip Thrust',                   tag: 'Po Hauptübung',  sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Beinbeuger-Maschine',          tag: 'Beinrückseite',  sets: 3, repsMin: 12, repsMax: 15 },
    { name: 'Wadenheben',                   tag: 'Waden',          sets: 4, repsMin: 12, repsMax: 20 },
  ]},
];

const ALTERNATIVES = {
  'Hip Thrust':                   ['Glute Bridge (Boden)', 'Beinpresse (Po-Fokus)'],
  'Rumänisches Kreuzheben (RDL)': ['Beinbeuger-Maschine', 'Good Mornings'],
  'Einbeinige Beinpresse':        ['Ausfallschritte', 'Bulgarian Split Squat'],
  'Abduktoren-Maschine':          ['Kabel-Abduktion', 'Band Abduktion (seitlich)'],
  'Hyperextension':               ['Glute Bridge', 'Romanian Deadlift (leicht)'],
  'Brustpresse':                  ['Bankdrücken (Kurzhantel)', 'Liegestütze'],
  'Butterfly':                    ['Kabel-Flys', 'Schrägbank-Flys'],
  'Schulterdrücken (Kurzhantel)': ['Schulterpresse (Maschine)', 'Arnold Press'],
  'Seitheben':                    ['Seitheben (Kabel)', 'Seitheben (Maschine)'],
  'Trizeps Kabelzug (einarmig)':  ['Overhead Extension', 'Trizeps Kickback'],
  'Trizeps Pushdown':             ['Dips (assistiert)', 'Overhead Extension'],
  'Around the World':             ['Frontheben', 'Seitheben (leicht)'],
  'Latzug':                       ['Klimmzüge (assistiert)', 'Kabelzug sitzend'],
  'Rudern':                       ['Kurzhantel-Rudern', 'T-Bar-Rudern'],
  'Face Pulls':                   ['Reverse Butterfly', 'Band Pull-Aparts'],
  'Lat Pulldown':                 ['Latzug (eng)', 'Klimmzüge (assistiert)'],
  'Reverse Butterfly':            ['Face Pulls', 'Reverse Flyes (Kurzhantel)'],
  'Bizeps Kabelzug':              ['Hammer Curls', 'Kurzhantel-Curls'],
  'Laufband (zügig gehen)':       ['Ellipsentrainer', 'Stepper'],
  'Fahrrad-Ergometer':            ['Rudermaschine', 'Crosstrainer'],
  'Plank':                        ['Knie-Plank', 'Unterarm-Plank'],
  'Dead Bug':                     ['Hollow Body Hold', 'Beinsenken (geführt)'],
  'Bird Dog':                     ['Quadruped Hip Extension', 'Superman'],
  // Push/Pull/Legs-Alternativen
  'Bankdrücken (Langhantel)':        ['Brustpresse (Maschine)', 'Bankdrücken (Kurzhantel)'],
  'Schrägbankdrücken (Kurzhantel)':  ['Schrägbank-Brustpresse', 'Schräg-Liegestütze'],
  'Trizeps Overhead Extension':      ['Trizeps Kabelzug (einarmig)', 'Dips (assistiert)'],
  'Klimmzüge (assistiert)':          ['Latzug', 'Kabelzug sitzend'],
  'Langhantelrudern':                ['Kurzhantel-Rudern', 'T-Bar-Rudern'],
  'Bizeps Curls (Kurzhantel)':       ['Bizeps Kabelzug', 'Langhantel-Curls'],
  'Hammer Curls':                    ['Bizeps Curls (Kurzhantel)', 'Seil-Hammer-Curls'],
  'Kniebeugen (Langhantel)':         ['Beinpresse', 'Goblet Squat'],
  'Beinpresse':                      ['Kniebeugen (Langhantel)', 'Hackenschmidt-Kniebeuge'],
  'Beinbeuger-Maschine':             ['Rumänisches Kreuzheben (RDL)', 'Nordic Curls'],
  'Wadenheben':                      ['Wadenheben sitzend', 'Wadenpresse (Beinpresse)'],
};

// Wählbare Mess-Frequenzen (informativ — bestimmt Beschriftung & Erinnerung)
const FREQ_LABELS = { daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich' };
const FREQ_HINT = {
  daily:   'jeden Morgen, nüchtern',
  weekly:  'einmal pro Woche, morgens nüchtern',
  monthly: 'einmal im Monat — immer an der gleichen Stelle',
};

// Alle möglichen Körpermaße (mehr Auswahl). key = Feld im Datensatz.
const MEASURE_FIELDS = [
  { key: 'hip',    emoji: '🍑', label: 'Hüfte / Po (breiteste Stelle)', lowerBetter: false },
  { key: 'waist',  emoji: '👖', label: 'Taille (schmalste Stelle)',     lowerBetter: true  },
  { key: 'belly',  emoji: '🤰', label: 'Bauch (Nabelhöhe)',             lowerBetter: true  },
  { key: 'chest',  emoji: '👚', label: 'Brust',                          lowerBetter: false },
  { key: 'arm',    emoji: '💪', label: 'Oberarm (Bizeps, angespannt)',   lowerBetter: false },
  { key: 'forearm',emoji: '🤜', label: 'Unterarm',                       lowerBetter: false },
  { key: 'thigh',  emoji: '🦵', label: 'Oberschenkel',                   lowerBetter: false },
  { key: 'calf',   emoji: '🦿', label: 'Wade',                           lowerBetter: false },
  { key: 'neck',   emoji: '🧣', label: 'Nacken / Hals',                  lowerBetter: true  },
];
const MEASURE_COLORS = ['#c42e86', '#7a1657', '#0f9d72', '#e08a00', '#3a7bd5', '#9b59b6', '#16a085', '#d35400', '#2c3e50'];

// ─── Daten-Layer ────────────────────────────────────────────────────────────

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function loadData() {
  let d;
  try { d = JSON.parse(localStorage.getItem(storageKey()) || 'null'); } catch { d = null; }
  if (!d) d = {};

  if (!Array.isArray(d.weightLog))    d.weightLog = [];
  if (!Array.isArray(d.measurements)) d.measurements = [];
  if (!Array.isArray(d.workouts))     d.workouts = [];
  if (!d.settings || typeof d.settings !== 'object') d.settings = {};
  if (!['dark', 'light', 'masc'].includes(d.settings.theme)) {
    d.settings.theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  if (d.settings.femMode !== 'dark' && d.settings.femMode !== 'light') {
    d.settings.femMode = d.settings.theme === 'masc' ? 'light' : d.settings.theme;
  }
  if (typeof d.settings.restDefault !== 'number') d.settings.restDefault = 90;
  if (!FREQ_LABELS[d.settings.weightFreq])  d.settings.weightFreq  = 'weekly';
  if (!FREQ_LABELS[d.settings.measureFreq]) d.settings.measureFreq = 'monthly';

  // ── Ernährung / Kalorientracker (v1.1) — defensiv defaulten (Abwärtskompatibilität) ──
  if (!d.nutrition || typeof d.nutrition !== 'object') d.nutrition = {};
  if (!Array.isArray(d.nutrition.log))   d.nutrition.log   = [];   // {id,date,meal,name,kcal,protein,carbs,fat}
  if (!Array.isArray(d.nutrition.foods)) d.nutrition.foods = [];   // gespeicherte „Meine Lebensmittel"
  if (!d.nutrition.goals || typeof d.nutrition.goals !== 'object') d.nutrition.goals = {};
  const ng = d.nutrition.goals;
  if (ng.mode !== 'auto' && ng.mode !== 'manual') ng.mode = 'auto';
  if (typeof ng.kcal    !== 'number') ng.kcal    = 2000;
  if (typeof ng.protein !== 'number') ng.protein = 110;
  if (typeof ng.carbs   !== 'number') ng.carbs   = 200;
  if (typeof ng.fat     !== 'number') ng.fat     = 65;
  if (ng.sex !== 'male' && ng.sex !== 'female') ng.sex = 'female';
  if (typeof ng.age      !== 'number') ng.age = 30;
  if (typeof ng.height   !== 'number') ng.height = 168;
  if (typeof ng.activity !== 'number') ng.activity = 1.375;
  if (typeof ng.breastfeeding !== 'boolean') ng.breastfeeding = false;

  // Routinen: aus Vorlage anlegen, falls noch keine vorhanden
  if (!Array.isArray(d.routines) || !d.routines.length) {
    d.routines = deepClone(DEFAULT_ROUTINES).map(r => ({
      ...r,
      exercises: r.exercises.map(e => ({ id: uid('e'), ...e })),
    }));
    // Alte „eigene Übungen" pro Tag (A/B/C/D) übernehmen
    const map = { A: 'r_po', B: 'r_brust', C: 'r_ruecken', D: 'r_cardio' };
    if (d.customExercises && typeof d.customExercises === 'object') {
      Object.keys(map).forEach(k => {
        const list = d.customExercises[k];
        const routine = d.routines.find(r => r.id === map[k]);
        if (Array.isArray(list) && routine) {
          list.forEach(ex => routine.exercises.push({
            id: uid('e'), name: ex.name, tag: ex.tag || 'Eigene Übung', sets: 3, repsMin: 10, repsMax: 12,
          }));
        }
      });
    }
  }
  // jede Routine/Übung absichern
  d.routines.forEach(r => {
    if (!r.id) r.id = uid('r');
    if (!Array.isArray(r.exercises)) r.exercises = [];
    r.exercises.forEach(e => {
      if (!e.id) e.id = uid('e');
      if (typeof e.sets !== 'number') e.sets = 3;
      if (typeof e.repsMin !== 'number') e.repsMin = 10;
      if (typeof e.repsMax !== 'number') e.repsMax = 12;
      if (typeof e.restSec !== 'number') e.restSec = d.settings.restDefault || 90;
    });
  });

  // Übungs-Bibliothek (für Autovervollständigung)
  const lib = new Set(Array.isArray(d.exerciseLibrary) ? d.exerciseLibrary : []);
  d.routines.forEach(r => r.exercises.forEach(e => lib.add(e.name)));
  d.workouts.forEach(w => (w.exercises || []).forEach(e => lib.add(e.name)));
  Object.keys(ALTERNATIVES).forEach(n => lib.add(n));
  d.exerciseLibrary = [...lib].sort((a, b) => a.localeCompare(b, 'de'));

  return d;
}

function saveData(data) {
  localStorage.setItem(storageKey(), JSON.stringify(data));
  if (window._fbRef) window._fbRef.set(data).catch(() => {});
}

// ─── Profil (pro Nutzer; ersetzt die früheren Konstanten) ───────────────────────

function profileOf(d) { return (d && d.profile) || (loadData().profile) || {}; }
function pStartWeight(d) { const p = profileOf(d); return typeof p.startWeight === 'number' ? p.startWeight : LEGACY.startWeight; }
function pGoalWeight(d)  { const p = profileOf(d); return typeof p.goalWeight  === 'number' ? p.goalWeight  : LEGACY.goalWeight; }
function pStartDate(d)   { const p = profileOf(d); return p.startDate || LEGACY.startDate; }
function pGoalDate(d)    { const p = profileOf(d); return p.goalDate  || LEGACY.goalDate; }
function pName(d)        { const p = profileOf(d); return p.name || LEGACY.name; }

// ─── Helfer ───────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

function formatRest(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function weeksRemaining() {
  return Math.max(0, Math.ceil((new Date(pGoalDate()) - new Date()) / 86400000 / 7));
}

function latestWeight(data) {
  if (!data.weightLog.length) return pStartWeight(data);
  return data.weightLog[data.weightLog.length - 1].weight;
}

function getRoutine(data, id) { return data.routines.find(r => r.id === id) || null; }

// Wann wurde eine Routine zuletzt trainiert?
function lastTrainedDate(data, routineId) {
  for (let i = data.workouts.length - 1; i >= 0; i--) {
    if (data.workouts[i].routineId === routineId) return data.workouts[i].date;
  }
  return null;
}

// Vorschlag: am längsten nicht trainierte Routine
function nextRoutine(data) {
  if (!data.routines.length) return null;
  let best = data.routines[0], bestDate = '9999';
  data.routines.forEach(r => {
    const d = lastTrainedDate(data, r.id) || '0000';
    if (d < bestDate) { bestDate = d; best = r; }
  });
  return best;
}

// Letzte tatsächlich geloggte Einheit einer Übung
function lastExercise(name, data) {
  for (let i = data.workouts.length - 1; i >= 0; i--) {
    const ex = (data.workouts[i].exercises || []).find(e => e.name === name && !e.skipped && e.sets && e.sets.length);
    if (ex) return ex;
  }
  return null;
}

// Wert eines bestimmten Satzes der letzten Einheit (für „Letztes Mal" pro Satz)
function previousSet(name, idx, data) {
  const ex = lastExercise(name, data);
  if (!ex || !ex.sets.length) return null;
  return ex.sets[Math.min(idx, ex.sets.length - 1)];
}

function lastSessionInfo(name, data) {
  const ex = lastExercise(name, data);
  if (!ex) return null;
  const s = ex.sets[ex.sets.length - 1];
  const avg = ex.sets.reduce((a, b) => a + (b.rpe || 7), 0) / ex.sets.length;
  return { weight: s.weight, reps: s.reps, rpe: Math.round(avg) };
}

// Gewichtsempfehlung: schwerster Satz letzte Einheit + Progression nach RPE
function calculateNextWeight(name, data) {
  const ex = lastExercise(name, data);
  if (!ex || !ex.sets.length) return null;
  const top = ex.sets.reduce((m, s) => (s.weight > m.weight ? s : m), ex.sets[0]);
  if (top.weight <= 0) return null;
  const avg = ex.sets.reduce((a, b) => a + (b.rpe || 7), 0) / ex.sets.length;
  if (avg <= 7) return +(top.weight + 2.5).toFixed(1);
  if (avg >= 9) return Math.max(0, +(top.weight - 2.5).toFixed(1));
  return top.weight;
}

function trafficLight(actual, target, lowerIsBetter = false) {
  if (actual === null || actual === undefined || target === null) return '';
  const diff = ((actual - target) / target) * 100;
  if (lowerIsBetter) { if (diff <= -1) return '🟢'; if (diff <= 2) return '🟡'; return '🔴'; }
  if (diff >= 1) return '🟢'; if (diff >= -2) return '🟡'; return '🔴';
}

function showToast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '';
  t.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(() => t.classList.remove('show'), 2500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ─── Theme (Hell / Dunkel) ────────────────────────────────────────────────────

const ICON_SUN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>';
// Skin-Umschalter: Blitz = „in den maskulinen Modus", Blüte/Funke = „zurück feminin"
const ICON_BOLT  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>';
const ICON_SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>';

function applyTheme(theme) {
  // nutzerunabhängig merken → beim Reload sofort korrektes Theme (kein Flackern,
  // auch bevor Firebase die uid-Daten geladen hat)
  try { localStorage.setItem('themePref', theme); } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'masc' ? '#07090d' : theme === 'dark' ? '#16121b' : '#fdf6fb');

  const masc = theme === 'masc';
  // Sonne/Mond: nur im femininen Modus sinnvoll (maskulin ist immer dunkel)
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.style.display = masc ? 'none' : '';
    btn.innerHTML = theme === 'dark' ? ICON_SUN : ICON_MOON;
  }
  // Stil-Umschalter feminin ↔ maskulin
  const skin = document.getElementById('skin-toggle');
  if (skin) {
    skin.innerHTML = masc ? ICON_SPARK : ICON_BOLT;
    skin.setAttribute('aria-label', masc ? 'Femininen Stil aktivieren' : 'Maskulinen Stil aktivieren');
  }
}

function toggleTheme() {
  const data = loadData();
  if (data.settings.theme === 'masc') return;           // im maskulinen Modus deaktiviert
  data.settings.theme = data.settings.theme === 'dark' ? 'light' : 'dark';
  data.settings.femMode = data.settings.theme;
  saveData(data);
  applyTheme(data.settings.theme);
}

// feminin ↔ maskulin umschalten (merkt sich den letzten femininen Modus)
function toggleSkin() {
  const data = loadData();
  if (data.settings.theme === 'masc') {
    data.settings.theme = data.settings.femMode || 'light';
  } else {
    data.settings.femMode = data.settings.theme;
    data.settings.theme = 'masc';
  }
  saveData(data);
  applyTheme(data.settings.theme);
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');   // Profil hat keinen Nav-Button
  window.scrollTo(0, 0);

  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'training')  renderTraining();
  if (pageId === 'history')   renderHistory();
  if (pageId === 'checkin')   renderCheckin();
  if (pageId === 'stats')     renderStats();
  if (pageId === 'nutrition') renderNutrition();
  if (pageId === 'profile')   renderProfile();
  if (pageId === 'friends')   renderFriends();
  if (pageId === 'workout-detail') renderWorkoutDetail();
}

// ─── Verlauf ──────────────────────────────────────────────────────────────────

function renderHistory() {
  const data = loadData();
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (!data.workouts.length) {
    list.innerHTML = '<div class="empty-state"><div class="es-icon">📅</div><p>Noch keine Workouts. Starte dein erstes Training!</p></div>';
    return;
  }
  // neueste zuerst
  data.workouts.map((w, i) => ({ w, i })).reverse().forEach(({ w, i }) => {
    const totalVol = (w.exercises || []).reduce((sum, ex) =>
      sum + (ex.sets || []).reduce((s2, st) => s2 + (st.weight || 0) * (st.reps || 0), 0), 0);
    const dur = w.durationSec ? `${Math.floor(w.durationSec / 60)} Min` : '—';

    const lines = (w.exercises || []).map(ex => {
      if (ex.skipped) return `<div class="hist-ex"><span>${escapeHtml(ex.name)}</span><span class="he-best">ausgelassen</span></div>`;
      const best = (ex.sets || []).reduce((m, s) => (s.weight > (m?.weight ?? -1) ? s : m), null);
      const bestTxt = best ? `${best.weight} kg × ${best.reps}` : '—';
      return `<div class="hist-ex"><span>${ex.sets.length}× ${escapeHtml(ex.name)}</span><span class="he-best">${bestTxt}</span></div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'card hist-card hist-clickable';
    card.setAttribute('role', 'button');
    card.onclick = () => openWorkoutDetail(i);
    card.innerHTML = `
      <div class="hist-head">
        <div>
          <h3>${escapeHtml(w.routineName || 'Training')}</h3>
          <p class="hist-date">${formatDateDE(w.date)}</p>
        </div>
        <button class="hist-del" onclick="event.stopPropagation(); deleteWorkout(${i})" aria-label="Workout löschen">✕</button>
      </div>
      <div class="hist-exs">${lines}</div>
      <div class="hist-foot">
        <span>⏱ ${dur}</span>
        <span>🏋️ ${Math.round(totalVol).toLocaleString('de-DE')} kg</span>
        <span>📋 ${(w.exercises || []).length} Übungen</span>
      </div>`;
    list.appendChild(card);
  });
}

function formatDateDE(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return iso; }
}

function deleteWorkout(index) {
  const data = loadData();
  if (index < 0 || index >= data.workouts.length) return;
  const w = data.workouts[index];
  if (!confirm(`Workout „${w.routineName || 'Training'}" vom ${formatDateDE(w.date)} löschen?`)) return;
  data.workouts.splice(index, 1);
  saveData(data);
  showToast('Workout gelöscht', '#6d5a67');
  renderHistory();
}

// ── Workout-Detailansicht (Karte antippen) ──
let detailWorkoutIndex = null;

function openWorkoutDetail(index) { detailWorkoutIndex = index; navigate('workout-detail'); }

// geschätztes 1RM (Epley-Formel)
function e1rm(weight, reps) {
  if (!weight || weight <= 0 || !reps) return null;
  return Math.round(weight * (1 + reps / 30));
}

// Wie viele Übungen sind in diesem Workout ein neuer Bestwert (Top-Gewicht > alle früheren)?
function countPRs(index, data) {
  const w = data.workouts[index];
  if (!w) return 0;
  let prs = 0;
  (w.exercises || []).forEach(ex => {
    if (ex.skipped || !ex.sets || !ex.sets.length) return;
    const topNow = Math.max(...ex.sets.map(s => s.weight || 0));
    if (topNow <= 0) return;
    let prevBest = 0;
    for (let j = 0; j < index; j++) {
      (data.workouts[j].exercises || []).forEach(pe => {
        if (pe.name === ex.name && !pe.skipped) (pe.sets || []).forEach(s => { if ((s.weight || 0) > prevBest) prevBest = s.weight || 0; });
      });
    }
    if (prevBest > 0 && topNow > prevBest) prs++;
  });
  return prs;
}

function renderWorkoutDetail() {
  const data = loadData();
  const w = data.workouts[detailWorkoutIndex];
  if (!w) { navigate('history'); return; }

  const totalVol = (w.exercises || []).reduce((sum, ex) =>
    sum + (ex.sets || []).reduce((s2, st) => s2 + (st.weight || 0) * (st.reps || 0), 0), 0);
  const durTxt = w.durationSec
    ? (w.durationSec >= 3600 ? `${Math.floor(w.durationSec / 3600)}h ${Math.round((w.durationSec % 3600) / 60)}m` : `${Math.round(w.durationSec / 60)} Min`)
    : '—';
  const prs = countPRs(detailWorkoutIndex, data);

  let html = `
    <div class="wd-head">
      <h1>${escapeHtml(w.routineName || 'Training')}</h1>
      <p class="wd-date">${formatDateDE(w.date)}</p>
      <div class="wd-stats">
        <div><span class="wd-st-ic">⏱</span> ${durTxt}</div>
        <div><span class="wd-st-ic">🏋️</span> ${Math.round(totalVol).toLocaleString('de-DE')} kg</div>
        <div><span class="wd-st-ic">🏆</span> ${prs} PRs</div>
      </div>
    </div>`;

  (w.exercises || []).forEach(ex => {
    html += `<div class="wd-ex">
      <div class="wd-ex-head"><h3>${escapeHtml(ex.name)}</h3>${(ex.sets && ex.sets.length) ? '<span class="wd-rm-label">1RM</span>' : ''}</div>`;
    if (ex.note) html += `<p class="wd-note">${escapeHtml(ex.note)}</p>`;
    if (ex.skipped || !ex.sets || !ex.sets.length) {
      html += `<p class="wd-skipped">ausgelassen</p>`;
    } else {
      ex.sets.forEach((s, i) => {
        const rm = e1rm(s.weight, s.reps);
        const wTxt = (s.weight > 0) ? `${s.weight} kg` : '+0 kg';
        html += `<div class="wd-set">
          <span class="wd-set-num">${i + 1}</span>
          <span class="wd-set-val">${wTxt} × ${s.reps}</span>
          <span class="wd-set-rm">${rm !== null ? rm : ''}</span>
        </div>`;
      });
    }
    html += `</div>`;
  });
  document.getElementById('wd-body').innerHTML = html;
}

function deleteWorkoutFromDetail() {
  const data = loadData();
  const w = data.workouts[detailWorkoutIndex];
  if (!w) { navigate('history'); return; }
  if (!confirm(`Workout „${w.routineName || 'Training'}" löschen?`)) return;
  data.workouts.splice(detailWorkoutIndex, 1);
  saveData(data);
  syncPublicProfile();
  showToast('Workout gelöscht', '#6d5a67');
  navigate('history');
}

// Workout erneut ausführen — neue Session mit denselben Übungen, Werte vorbefüllt
function repeatCurrentWorkout() {
  const data = loadData();
  const w = data.workouts[detailWorkoutIndex];
  if (!w) return;
  session = {
    routineId: w.routineId || null,
    routineName: w.routineName || 'Training',
    startTs: null,
    exercises: (w.exercises || []).filter(e => !e.skipped).map(ex => {
      const sets = (ex.sets || []).map(s => ({ weight: s.weight || '', reps: s.reps || 10, done: false }));
      if (!sets.length) sets.push({ weight: '', reps: 10, done: false });
      return { exId: null, name: ex.name, tag: ex.tag || '', repsMin: 8, repsMax: 12, restSec: data.settings.restDefault || 90, note: ex.note || '', rpe: 7, skipped: false, alternative: ex.alternative || null, sets };
    }),
  };
  if (!session.exercises.length) { showToast('Keine Übungen zum Wiederholen', '#c46a04'); return; }
  showWorkoutIntro({ emoji: '🔁', name: session.routineName, exercises: session.exercises });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function renderDashboard() {
  const data    = loadData();
  const sw = pStartWeight(data), gw = pGoalWeight(data);
  const current = latestWeight(data);
  const lost    = +(sw - current).toFixed(2);
  const total   = (sw - gw) || 1;
  const pct     = Math.min(100, Math.max(0, Math.round((lost / total) * 100)));
  const weeks   = weeksRemaining();

  const hi = document.querySelector('#page-dashboard h1');
  if (hi) hi.textContent = `Hallo, ${pName(data)}!`;

  document.getElementById('current-weight').textContent = current.toFixed(2);
  document.getElementById('weight-lost').textContent    = lost > 0 ? `-${lost.toFixed(2)} kg` : lost < 0 ? `+${Math.abs(lost).toFixed(2)} kg` : '±0';
  document.getElementById('weeks-left').textContent     = weeks;
  document.getElementById('progress-bar').style.width   = pct + '%';
  document.getElementById('progress-pct').textContent   = pct + '%';
  document.getElementById('progress-start').textContent = sw + ' kg';
  document.getElementById('progress-goal').textContent  = gw + ' kg';
  const weekly = weeks > 0 ? ((current - gw) / weeks) : (sw - gw);
  document.getElementById('weekly-target').textContent  = `${Math.max(0, weekly).toFixed(2)} kg/Woche bis Ziel`;
  const gws = document.getElementById('goal-weight-stat'); if (gws) gws.textContent = gw;
  const gms = document.getElementById('goal-month-stat');
  if (gms) { try { gms.textContent = new Date(pGoalDate(data)).toLocaleDateString('de-DE', { month: 'short' }); } catch (e) {} }

  // „Heute gegessen"-Karte
  const dashNut = document.getElementById('dash-nut');
  if (dashNut) {
    const goals = nutEffectiveGoals(data);
    const t = nutDayTotals(data, nutToday());
    const rem = goals.kcal - t.kcal;
    const pct = goals.kcal > 0 ? Math.min(100, Math.round((t.kcal / goals.kcal) * 100)) : 0;
    document.getElementById('dn-kcal').textContent = Math.round(t.kcal);
    document.getElementById('dn-goal').textContent = goals.kcal;
    document.getElementById('dn-rem').textContent  = rem >= 0 ? `${rem} kcal übrig` : `${Math.abs(rem)} kcal drüber`;
    document.getElementById('dn-rem').classList.toggle('over', rem < 0);
    document.getElementById('dn-bar').style.width = pct + '%';
    document.getElementById('dn-bar').style.background = rem < 0 ? 'var(--danger)' : 'var(--grad-primary)';
  }
}

// ─── Training: Ansichten ──────────────────────────────────────────────────────
// trainingView: 'list' | 'editor' | 'workout'

let trainingView = 'list';
let editorRoutineId = null;
let session = null;             // aktives Workout (im Speicher)
let currentExerciseForAlt = null;

function renderTraining() {
  if (session) trainingView = 'workout';
  document.getElementById('tv-list').style.display    = trainingView === 'list'    ? 'block' : 'none';
  document.getElementById('tv-editor').style.display  = trainingView === 'editor'  ? 'block' : 'none';
  document.getElementById('tv-workout').style.display = trainingView === 'workout' ? 'block' : 'none';
  if (trainingView === 'list')    renderRoutineList();
  if (trainingView === 'editor')  renderPlanEditor();
  if (trainingView === 'workout') renderActiveWorkout();
}

function showTrainingView(v) { trainingView = v; renderTraining(); }

// ── Routinen-Liste ──
function renderRoutineList() {
  const data = loadData();
  const list = document.getElementById('routine-list');
  list.innerHTML = '';
  if (!data.routines.length) {
    list.innerHTML = '<div class="empty-state"><div class="es-icon">📋</div><p>Noch kein Trainingsplan. Lege deinen ersten an!</p></div>';
  }
  data.routines.forEach(r => {
    const last = lastTrainedDate(data, r.id);
    const card = document.createElement('div');
    card.className = 'routine-card';
    card.innerHTML = `
      <div class="rc-main" onclick="startWorkout('${r.id}')">
        <div class="rc-emoji">${r.emoji || '🏋️'}</div>
        <div class="rc-info">
          <h3>${escapeHtml(r.name)}</h3>
          <p>${r.exercises.length} Übungen${last ? ' · zuletzt ' + last : ' · noch nie'}</p>
        </div>
      </div>
      <div class="rc-actions">
        <button class="rc-edit" onclick="openEditor('${r.id}')" aria-label="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="rc-start" onclick="startWorkout('${r.id}')">▶ Starten</button>
      </div>`;
    list.appendChild(card);
  });
}

function createRoutine() {
  const name = prompt('Name des neuen Trainingsplans (z. B. „Oberkörper"):');
  if (!name || !name.trim()) return;
  const data = loadData();
  const r = { id: uid('r'), name: name.trim(), emoji: '🏋️', exercises: [] };
  data.routines.push(r);
  saveData(data);
  openEditor(r.id);
}

// ── Routine-Editor ──
function openEditor(id) { editorRoutineId = id; showTrainingView('editor'); }

function renderPlanEditor() {
  const data = loadData();
  const r = getRoutine(data, editorRoutineId);
  if (!r) { showTrainingView('list'); return; }

  const title = document.getElementById('editor-title');
  title.textContent = `${r.emoji || '🏋️'} ${r.name}`;

  const body = document.getElementById('editor-body');
  body.innerHTML = '';

  r.exercises.forEach((ex, i) => {
    const row = document.createElement('div');
    row.className = 'editor-ex';
    row.innerHTML = `
      <div class="ee-reorder">
        <button onclick="moveExercise('${ex.id}',-1)" ${i === 0 ? 'disabled' : ''} aria-label="nach oben">▲</button>
        <button onclick="moveExercise('${ex.id}',1)" ${i === r.exercises.length - 1 ? 'disabled' : ''} aria-label="nach unten">▼</button>
      </div>
      <div class="ee-info">
        <h4>${escapeHtml(ex.name)}</h4>
        <div class="ee-fields">
          <label>Sätze<input type="number" min="1" max="10" value="${ex.sets}" onchange="updateExField('${ex.id}','sets',this.value)"></label>
          <label>Wdh<input type="number" min="1" max="50" value="${ex.repsMin}" onchange="updateExField('${ex.id}','repsMin',this.value)"></label>
          <span class="ee-dash">–</span>
          <label class="ee-nolabel"><input type="number" min="1" max="50" value="${ex.repsMax}" onchange="updateExField('${ex.id}','repsMax',this.value)"></label>
        </div>
      </div>
      <button class="ee-remove" onclick="removeExercise('${ex.id}')" aria-label="entfernen">✕</button>`;
    body.appendChild(row);
  });

  const add = document.createElement('button');
  add.className = 'btn-add-ex';
  add.textContent = '+ Übung hinzufügen';
  add.onclick = () => openExModal();
  body.appendChild(add);
}

function updateExField(exId, field, value) {
  const data = loadData();
  const r = getRoutine(data, editorRoutineId);
  const ex = r?.exercises.find(e => e.id === exId);
  if (!ex) return;
  ex[field] = Math.max(1, parseInt(value) || 1);
  if (ex.repsMax < ex.repsMin) ex.repsMax = ex.repsMin;
  saveData(data);
}

function moveExercise(exId, dir) {
  const data = loadData();
  const r = getRoutine(data, editorRoutineId);
  const i = r.exercises.findIndex(e => e.id === exId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= r.exercises.length) return;
  [r.exercises[i], r.exercises[j]] = [r.exercises[j], r.exercises[i]];
  saveData(data);
  renderPlanEditor();
}

function removeExercise(exId) {
  const data = loadData();
  const r = getRoutine(data, editorRoutineId);
  r.exercises = r.exercises.filter(e => e.id !== exId);
  saveData(data);
  renderPlanEditor();
}

function renameRoutine() {
  const data = loadData();
  const r = getRoutine(data, editorRoutineId);
  if (!r) return;
  const name = prompt('Trainingsplan umbenennen:', r.name);
  if (name && name.trim()) { r.name = name.trim(); saveData(data); renderPlanEditor(); }
}

function deleteRoutine() {
  const data = loadData();
  const r = getRoutine(data, editorRoutineId);
  if (!r) return;
  if (!confirm(`Trainingsplan „${r.name}" wirklich löschen?`)) return;
  data.routines = data.routines.filter(x => x.id !== editorRoutineId);
  saveData(data);
  showToast('Trainingsplan gelöscht', '#6d5a67');
  showTrainingView('list');
}

function duplicateRoutine() {
  const data = loadData();
  const r = getRoutine(data, editorRoutineId);
  if (!r) return;
  const copy = deepClone(r);
  copy.id = uid('r');
  copy.name = r.name + ' (Kopie)';
  copy.exercises.forEach(e => e.id = uid('e'));
  data.routines.push(copy);
  saveData(data);
  showToast('Trainingsplan dupliziert', '#c42e86');
  openEditor(copy.id);
}

// ── Übung-hinzufügen-Modal ──
// mode: 'routine' (Editor) | 'sessionAdd' (Workout) | 'sessionReplace' (Übung ersetzen)
let exModalMode = 'routine';
let exModalTarget = null;

function openExModal(mode, target) {
  exModalMode = mode || 'routine';
  exModalTarget = (target === undefined || target === null) ? null : target;
  const data = loadData();
  const dl = document.getElementById('ex-datalist');
  dl.innerHTML = data.exerciseLibrary.map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
  document.getElementById('ex-input').value = '';
  document.getElementById('ex-sets').value = 3;
  document.getElementById('ex-rmin').value = 10;
  document.getElementById('ex-rmax').value = 12;
  // Felder (Sätze/Wdh) nur bei Neu-Anlage zeigen, beim Ersetzen ausblenden
  const fields = document.querySelector('#ex-modal .modal-fields');
  if (fields) fields.style.display = exModalMode === 'sessionReplace' ? 'none' : 'flex';
  const h = document.querySelector('#ex-modal h3');
  if (h) h.textContent = exModalMode === 'sessionReplace' ? 'Übung ersetzen' : 'Übung hinzufügen';
  document.getElementById('ex-modal').classList.add('open');
  setTimeout(() => document.getElementById('ex-input').focus(), 100);
}
function closeExModal() { document.getElementById('ex-modal').classList.remove('open'); }

function confirmAddExercise() {
  const name = document.getElementById('ex-input').value.trim();
  if (!name) { showToast('Bitte einen Namen eingeben', '#c46a04'); return; }
  const sets    = Math.max(1, parseInt(document.getElementById('ex-sets').value) || 3);
  const repsMin = Math.max(1, parseInt(document.getElementById('ex-rmin').value) || 10);
  const repsMax = Math.max(repsMin, parseInt(document.getElementById('ex-rmax').value) || 12);

  if (exModalMode === 'sessionReplace' && session && exModalTarget !== null) {
    session.exercises[exModalTarget].name = name;
    session.exercises[exModalTarget].alternative = null;
    session.exercises[exModalTarget].skipped = false;
    closeExModal();
    renderActiveWorkout();
    showToast(`Übung ersetzt: ${name}`, '#c42e86');
    return;
  }

  if (exModalMode === 'sessionAdd' && session) {
    const data = loadData();
    const rec = calculateNextWeight(name, data);
    const arr = [];
    for (let i = 0; i < sets; i++) {
      const prev = previousSet(name, i, data);
      arr.push({ weight: rec !== null ? rec : (prev ? prev.weight : ''), reps: prev ? prev.reps : repsMin, done: false });
    }
    session.exercises.push({ exId: null, name, tag: ALTERNATIVES[name] ? '' : 'Eigene Übung', repsMin, repsMax, restSec: data.settings.restDefault || 90, note: '', rpe: 7, skipped: false, alternative: null, sets: arr });
    closeExModal();
    renderActiveWorkout();
    showToast(`✓ „${name}" hinzugefügt`, '#c42e86');
    return;
  }

  // mode 'routine'
  const data = loadData();
  const r = getRoutine(data, editorRoutineId);
  if (!r) return;
  r.exercises.push({ id: uid('e'), name, tag: ALTERNATIVES[name] ? '' : 'Eigene Übung', sets, repsMin, repsMax, restSec: data.settings.restDefault || 90 });
  saveData(data);
  closeExModal();
  renderPlanEditor();
  showToast(`✓ „${name}" hinzugefügt`, '#c42e86');
}

// ─── Aktives Workout (Satz-für-Satz) ───────────────────────────────────────────

function startWorkout(routineId) {
  const data = loadData();
  const r = getRoutine(data, routineId);
  if (!r) return;
  if (!r.exercises.length) { showToast('Dieser Trainingsplan hat noch keine Übungen', '#c46a04'); openEditor(routineId); return; }

  session = {
    routineId: r.id,
    routineName: r.name,
    startTs: null,                 // startet erst nach dem Countdown
    exercises: r.exercises.map(ex => {
      const rec = calculateNextWeight(ex.name, data);
      const sets = [];
      for (let i = 0; i < ex.sets; i++) {
        const prev = previousSet(ex.name, i, data);
        sets.push({
          weight: rec !== null ? rec : (prev ? prev.weight : ''),
          reps:   prev ? prev.reps : ex.repsMin,
          done:   false,
        });
      }
      return { exId: ex.id, name: ex.name, tag: ex.tag, repsMin: ex.repsMin, repsMax: ex.repsMax, restSec: ex.restSec || (data.settings.restDefault || 90), note: '', rpe: 7, skipped: false, alternative: null, sets };
    }),
  };
  showWorkoutIntro(r);
}

// ── Start-Bildschirm („Bereit?") — gibt dem Trainingsstart Gewicht ──
function showWorkoutIntro(r) {
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  document.getElementById('intro-emoji').textContent = r.emoji || '🏋️';
  document.getElementById('intro-name').textContent = r.name;
  document.getElementById('intro-meta').textContent =
    `${r.exercises.length} Übungen · ${totalSets} Sätze · ca. ${Math.max(15, Math.round(totalSets * 2.5))} Min`;
  document.getElementById('workout-intro').classList.add('show');
}

function cancelIntro() {
  document.getElementById('workout-intro').classList.remove('show');
  session = null;
}

function beginWorkout() {
  document.getElementById('workout-intro').classList.remove('show');
  if (!session) return;
  // Audio im User-Gesture entsperren (für die Countdown-Sounds)
  try { const c = audioCtx(); if (c && c.state === 'suspended') c.resume(); } catch (e) {}
  navigate('training');
  showTrainingView('workout');
  runCountdown(() => {
    session.startTs = Date.now();
    startSessionTimer();
  });
}

// 3 · 2 · 1 · LOS — cinematischer Countdown (antippen = überspringen)
function runCountdown(cb) {
  const el    = document.getElementById('countdown');
  const num   = document.getElementById('countdown-num');
  const ring  = el.querySelector('.cd-ring');
  const flash = el.querySelector('.cd-flash');
  let n = 3, done = false;

  const resetNum = () => num.classList.remove('slam', 'is-force', 'force-anim');

  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(window._cdT);
    el.onclick = null;
    el.classList.add('exit');         // Overlay zoomt weg
    revealWorkout();                  // Trainingsplan steigt gestaffelt ein
    cb();                             // Timer startet
    window._cdEnd = setTimeout(() => { el.classList.remove('show', 'shake', 'exit'); }, 640);
  };
  el.onclick = finish;
  el.classList.add('show');

  const tick = () => {
    if (done) return;

    if (n <= 0) {
      // Finale: fitness-Star-Wars-Spruch statt „LOS!"
      resetNum();
      num.textContent = 'MÖGE DIE KRAFT MIT DIR SEIN';
      ring.classList.remove('go'); el.classList.remove('shake');
      void num.offsetWidth;
      num.classList.add('is-force', 'force-anim');
      ring.classList.add('go'); el.classList.add('shake');
      flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
      playGo();
      try { if (navigator.vibrate) navigator.vibrate([0, 110, 60, 110, 60, 320]); } catch (e) {}
      window._cdT = setTimeout(finish, 1700);
      return;
    }

    // Countdown-Zahl
    resetNum();
    num.textContent = String(n);
    ring.classList.remove('go'); el.classList.remove('shake');
    void num.offsetWidth;
    num.classList.add('slam'); ring.classList.add('go'); el.classList.add('shake');
    playThud(140 + (3 - n) * 28);
    try { if (navigator.vibrate) navigator.vibrate(130 + (3 - n) * 45); } catch (e) {}
    n--;
    window._cdT = setTimeout(tick, 820);
  };
  tick();
}

// Trainingsplan gestaffelt einblenden (coole Transition nach dem Countdown)
function revealWorkout() {
  const w = document.getElementById('tv-workout');
  if (!w) return;
  w.classList.remove('reveal');
  void w.offsetWidth;
  w.classList.add('reveal');
  setTimeout(() => w.classList.remove('reveal'), 1400);
}

// ─── Sound-Effekte (Web Audio) ────────────────────────────────────────────────

function audioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  window._ac = window._ac || new AC();
  return window._ac;
}

// tiefer Impact-„Boom" pro Countdown-Zahl
function playThud(freq) {
  const c = audioCtx(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), t + 0.35);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.45);
}

// triumphaler Akkord beim „LOS!"
function playGo() {
  const c = audioCtx(); if (!c) return;
  const t = c.currentTime;
  [392, 523, 659, 784, 1047].forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const st = t + i * 0.025;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.3, st + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(c.destination);
    o.start(st); o.stop(t + 0.75);
  });
}

function startSessionTimer() {
  clearInterval(window._sessTimer);
  window._sessTimer = setInterval(() => {
    const el = document.getElementById('wb-timer');
    if (!el || !session) return;
    const s = Math.floor((Date.now() - session.startTs) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}

function renderActiveWorkout() {
  if (!session) { showTrainingView('list'); return; }
  const data = loadData();
  document.getElementById('wb-title').textContent = session.routineName;

  const body = document.getElementById('workout-body');
  body.innerHTML = '';

  session.exercises.forEach((ex, ei) => {
    const card = document.createElement('div');
    card.className = 'exercise-entry workout-ex' + (ex.skipped ? ' skipped' : '');

    const restLine = ex.restSec > 0
      ? `<div class="rest-line"><span>⏱ ${formatRest(ex.restSec)}</span></div>` : '';

    const rows = ex.sets.map((set, si) => {
      const prev = previousSet(ex.name, si, data);
      const prevTxt = prev ? `${prev.weight}kg × ${prev.reps}` : '—';
      return `
        <div class="set-wrap">
          <button class="set-delete" onclick="removeSet(${ei},${si})" aria-label="Satz löschen">Löschen</button>
          <div class="set-row${set.done ? ' done' : ''}" id="set-${ei}-${si}">
            <span class="sr-num">${si + 1}</span>
            <span class="sr-prev">${prevTxt}</span>
            <input class="sr-input" type="number" inputmode="decimal" step="0.5" min="0" value="${set.weight}"
              placeholder="kg" oninput="setVal(${ei},${si},'weight',this.value)" aria-label="Gewicht Satz ${si + 1}">
            <input class="sr-input" type="number" inputmode="numeric" min="0" value="${set.reps}"
              placeholder="Wdh" oninput="setVal(${ei},${si},'reps',this.value)" aria-label="Wiederholungen Satz ${si + 1}">
            <button class="sr-check" onclick="toggleSet(${ei},${si})" aria-label="Satz erledigt">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
          </div>
        </div>${restLine}`;
    }).join('');

    card.innerHTML = `
      <div class="ex-header">
        <div class="ex-info">
          <h3>${escapeHtml(ex.name)}${ex.alternative ? ' <span class="custom-tag">Alt</span>' : ''}</h3>
          <p>Ziel: ${ex.repsMin}–${ex.repsMax} Wdh.${ex.tag ? ' · ' + escapeHtml(ex.tag) : ''}</p>
        </div>
        <button class="ex-menu-btn" onclick="openExMenu(${ei})" aria-label="Übungs-Menü">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
        </button>
      </div>
      ${ex.note ? `<div class="ex-note">📝 ${escapeHtml(ex.note)}</div>` : ''}
      <div class="set-head"><span>Satz</span><span>Letztes&nbsp;Mal</span><span>kg</span><span>Wdh</span><span></span></div>
      <div class="set-rows">${rows}</div>
      <button class="btn-add-set" onclick="addSet(${ei})">+ Satz</button>
      <div class="rpe-row">
        <label>Anstrengung</label>
        <input type="range" min="1" max="10" value="${ex.rpe}" class="rpe-slider" id="wrpe-${ei}"
          oninput="session.exercises[${ei}].rpe=+this.value; document.getElementById('wrpev-${ei}').textContent=this.value">
        <span class="rpe-value" id="wrpev-${ei}">${ex.rpe}</span>
      </div>`;
    body.appendChild(card);
  });

  // "+ Übung hinzufügen" am Ende der Session
  const addEx = document.createElement('button');
  addEx.className = 'btn-add-ex';
  addEx.textContent = '+ Übung hinzufügen';
  addEx.onclick = () => openExModal('sessionAdd');
  body.appendChild(addEx);

  attachSetSwipe();
}

// ─── Übungs-Menü („…") im aktiven Workout ─────────────────────────────────────

let exMenuTarget = null;

function openExMenu(ei) {
  if (!session) return;
  exMenuTarget = ei;
  const ex = session.exercises[ei];
  document.getElementById('exmenu-title').textContent = ex.name;
  document.getElementById('exmenu-modal').classList.add('open');
}
function closeExMenu() { document.getElementById('exmenu-modal').classList.remove('open'); exMenuTarget = null; }

function menuReplace() {
  const ei = exMenuTarget; closeExMenu();
  openExModal('sessionReplace', ei);
}
function menuAlternative() {
  const ei = exMenuTarget; closeExMenu();
  openAltModal(ei, session.exercises[ei].name);
}
function menuNote() {
  const ei = exMenuTarget;
  const ex = session.exercises[ei];
  closeExMenu();
  const note = prompt('Notiz zur Übung:', ex.note || '');
  if (note === null) return;
  ex.note = note.trim();
  renderActiveWorkout();
}
function menuRemove() {
  const ei = exMenuTarget; closeExMenu();
  if (!confirm(`„${session.exercises[ei].name}" aus diesem Training entfernen?`)) return;
  session.exercises.splice(ei, 1);
  renderActiveWorkout();
}
function menuRest() {
  // wechselt zum Pausenzeit-Auswahl-Sheet
  document.getElementById('exmenu-modal').classList.remove('open');
  const ex = session.exercises[exMenuTarget];
  document.getElementById('rest-sheet-title').textContent = `Pause · ${ex.name}`;
  document.querySelectorAll('#rest-sheet .rest-opt').forEach(b =>
    b.classList.toggle('sel', parseInt(b.dataset.sec) === ex.restSec));
  document.getElementById('rest-sheet').classList.add('open');
}
function closeRestSheet() { document.getElementById('rest-sheet').classList.remove('open'); }

function setExerciseRest(sec) {
  if (exMenuTarget === null || !session) { closeRestSheet(); return; }
  const ex = session.exercises[exMenuTarget];
  ex.restSec = sec;
  // dauerhaft in der Routine merken (falls aus Routine gestartet)
  if (session.routineId && ex.exId) {
    const data = loadData();
    const r = getRoutine(data, session.routineId);
    const re = r?.exercises.find(e => e.id === ex.exId);
    if (re) { re.restSec = sec; saveData(data); }
  }
  closeRestSheet();
  exMenuTarget = null;
  renderActiveWorkout();
}

// Satz-Zeilen: nach links wischen → roter „Löschen"-Button
function closeAllSwipes(except) {
  document.querySelectorAll('.set-wrap.open').forEach(w => {
    if (w === except) return;
    w.classList.remove('open');
    const r = w.querySelector('.set-row');
    if (r) r.style.transform = '';
  });
}

function attachSetSwipe() {
  const OPEN = -88;
  document.querySelectorAll('.set-wrap').forEach(wrap => {
    const row = wrap.querySelector('.set-row');
    if (!row) return;
    let sx = 0, sy = 0, dx = 0, decided = false, horiz = false, active = false;

    row.addEventListener('touchstart', e => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; dx = 0;
      decided = false; horiz = false; active = true;
      row.style.transition = 'none';
      closeAllSwipes(wrap);
    }, { passive: true });

    row.addEventListener('touchmove', e => {
      if (!active) return;
      const t = e.touches[0];
      const mx = t.clientX - sx, my = t.clientY - sy;
      if (!decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
        decided = true; horiz = Math.abs(mx) > Math.abs(my);
      }
      if (horiz) {
        e.preventDefault();
        dx = Math.max(-110, Math.min(0, mx));
        row.style.transform = `translateX(${dx}px)`;
      }
    }, { passive: false });

    const end = () => {
      if (!active) return;
      active = false;
      row.style.transition = 'transform .2s ease';
      if (horiz && dx < OPEN / 2) {
        row.style.transform = `translateX(${OPEN}px)`;
        wrap.classList.add('open');
      } else {
        row.style.transform = '';
        wrap.classList.remove('open');
      }
    };
    row.addEventListener('touchend', end);
    row.addEventListener('touchcancel', end);
  });
}

function removeSet(ei, si) {
  if (!session) return;
  session.exercises[ei].sets.splice(si, 1);
  renderActiveWorkout();
}

function setVal(ei, si, field, value) {
  if (!session) return;
  session.exercises[ei].sets[si][field] = field === 'weight' ? (parseFloat(value) || 0) : (parseInt(value) || 0);
}

function toggleSet(ei, si) {
  if (!session) return;
  const ex = session.exercises[ei];
  const set = ex.sets[si];
  set.done = !set.done;
  const row = document.getElementById(`set-${ei}-${si}`);
  if (row) row.classList.toggle('done', set.done);
  if (set.done && ex.restSec > 0) startRest(ex.restSec);
}

function addSet(ei) {
  if (!session) return;
  const ex = session.exercises[ei];
  const last = ex.sets[ex.sets.length - 1];
  ex.sets.push({ weight: last ? last.weight : '', reps: last ? last.reps : ex.repsMin, done: false });
  renderActiveWorkout();
}

function finishWorkout() {
  if (!session) return;
  const data = loadData();
  const exercises = [];
  session.exercises.forEach(ex => {
    if (ex.skipped) { exercises.push({ name: ex.name, tag: ex.tag, skipped: true, alternative: ex.alternative, note: ex.note || '', sets: [] }); return; }
    const doneSets = ex.sets.filter(s => s.done).map(s => ({ weight: s.weight || 0, reps: s.reps || 0, rpe: ex.rpe }));
    if (doneSets.length) exercises.push({ name: ex.name, tag: ex.tag, skipped: false, alternative: ex.alternative, note: ex.note || '', sets: doneSets });
  });

  if (!exercises.some(e => !e.skipped && e.sets.length)) {
    if (!confirm('Du hast noch keinen Satz abgehakt. Training trotzdem beenden (wird nicht gespeichert)?')) return;
    session = null;
    clearInterval(window._sessTimer);
    showTrainingView('list');
    return;
  }

  data.workouts.push({
    date: today(),
    durationSec: Math.floor((Date.now() - session.startTs) / 1000),
    routineId: session.routineId,
    routineName: session.routineName,
    exercises,
  });
  saveData(data);
  session = null;
  clearInterval(window._sessTimer);
  stopRest(false);
  syncPublicProfile();   // letztes Training / Fortschritt für Freunde aktualisieren
  showToast('🎉 Training gespeichert!');
  setTimeout(() => navigate('dashboard'), 1200);
}

function cancelWorkout() {
  if (!session) { showTrainingView('list'); return; }
  if (!confirm('Training abbrechen? Eingaben gehen verloren.')) return;
  session = null;
  clearInterval(window._sessTimer);
  stopRest(false);
  showTrainingView('list');
}

// Leeres Workout ohne Plan starten — Übungen werden während des Trainings hinzugefügt
function startEmptyWorkout() {
  session = { routineId: null, routineName: 'Freies Training', startTs: Date.now(), exercises: [] };
  startSessionTimer();
  showTrainingView('workout');
  openExModal('sessionAdd');
}

// ── Alternativen-Modal ──
function openAltModal(ei, exerciseName) {
  currentExerciseForAlt = { ei, exerciseName };
  const alts = ALTERNATIVES[exerciseName] || [];
  document.getElementById('alt-ex-name').textContent = exerciseName;
  document.getElementById('alt-options').innerHTML = alts.length
    ? alts.map((a, i) => `<button class="alt-btn" onclick="chooseAlternative(${i})">${escapeHtml(a)}</button>`).join('')
    : '<p style="color:var(--text-muted);font-size:14px">Keine Alternative hinterlegt.</p>';
  document.getElementById('alt-modal').classList.add('open');
}
function chooseAlternative(altIdx) {
  if (!currentExerciseForAlt) return;
  const { ei, exerciseName } = currentExerciseForAlt;
  const alt = ALTERNATIVES[exerciseName]?.[altIdx];
  if (alt && session) {
    session.exercises[ei].alternative = exerciseName;
    session.exercises[ei].name = alt;
    session.exercises[ei].skipped = false;
  }
  closeAltModal();
  renderActiveWorkout();
  showToast(`Alternative: ${alt}`, '#c42e86');
}
function skipExercise() {
  if (!currentExerciseForAlt || !session) return;
  session.exercises[currentExerciseForAlt.ei].skipped = true;
  closeAltModal();
  renderActiveWorkout();
  showToast('Übung übersprungen', '#6d5a67');
}
function closeAltModal() { document.getElementById('alt-modal').classList.remove('open'); currentExerciseForAlt = null; }

// ─── Rest-Timer ─────────────────────────────────────────────────────────────

let rest = { id: null, remaining: 0 };

function startRest(sec) {
  rest.remaining = sec || loadData().settings.restDefault || 90;
  document.getElementById('rest-timer').classList.add('show');
  updateRestBar();
  clearInterval(rest.id);
  rest.id = setInterval(() => {
    rest.remaining--;
    updateRestBar();
    if (rest.remaining <= 0) stopRest(true);
  }, 1000);
}
function updateRestBar() {
  const m = Math.max(0, Math.floor(rest.remaining / 60));
  const s = Math.max(0, rest.remaining % 60);
  const el = document.getElementById('rest-time');
  if (el) el.textContent = `${m}:${String(s).padStart(2, '0')}`;
}
function adjustRest(delta) { rest.remaining = Math.max(5, rest.remaining + delta); updateRestBar(); }
function skipRest() { stopRest(false); }
function stopRest(finished) {
  clearInterval(rest.id); rest.id = null;
  const bar = document.getElementById('rest-timer');
  if (bar) bar.classList.remove('show');
  if (finished) {
    try { if (navigator.vibrate) navigator.vibrate(400); } catch (e) {}
    beep();
  }
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.42);
  } catch (e) {}
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

// Letzten gespeicherten Wert eines Mess-Felds finden (für „zuletzt"-Hinweis)
function lastMeasure(data, key) {
  for (let i = data.measurements.length - 1; i >= 0; i--) {
    const v = data.measurements[i][key];
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return null;
}

function renderCheckin() {
  const data = loadData();

  // Frequenz-Segmente (Gewicht + Maße)
  buildFreqSeg('freq-weight',  data.settings.weightFreq,  'weight');
  buildFreqSeg('freq-measure', data.settings.measureFreq, 'measure');

  const wh = document.getElementById('ci-weight-head');
  if (wh) wh.textContent = `⚖️ Gewicht (${FREQ_LABELS[data.settings.weightFreq]})`;
  const mh = document.getElementById('ci-measure-head');
  if (mh) mh.textContent = `📏 Körpermaße (${FREQ_LABELS[data.settings.measureFreq]})`;

  const ib = document.getElementById('checkin-hint');
  if (ib) ib.innerHTML =
    `📅 <strong>Gewicht:</strong> ${FREQ_HINT[data.settings.weightFreq]}.<br>` +
    `📏 <strong>Maße:</strong> ${FREQ_HINT[data.settings.measureFreq]}.`;

  // Mess-Felder dynamisch aufbauen
  const wrap = document.getElementById('measure-inputs');
  if (wrap) {
    wrap.innerHTML = MEASURE_FIELDS.map(f => {
      const last = lastMeasure(data, f.key);
      const hint = last !== null ? `zuletzt ${Number(last).toFixed(2)} cm` : '';
      return `<div class="input-field">
        <label>${escapeHtml(f.label)}${hint ? ` <span class="ci-last">${hint}</span>` : ''}</label>
        <input type="number" id="ci-${f.key}" inputmode="decimal" step="0.01" min="0" max="250" placeholder="—" />
        <span class="unit">cm</span>
      </div>`;
    }).join('');
  }

  // aktuelles Gewicht vorbelegen (Hinweis)
  const wIn = document.getElementById('ci-weight');
  if (wIn) wIn.placeholder = latestWeight(data).toFixed(2);
}

function buildFreqSeg(containerId, current, kind) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = ['daily', 'weekly', 'monthly'].map(f =>
    `<button type="button" class="freq-opt${f === current ? ' sel' : ''}" onclick="setFreq('${kind}','${f}')">${FREQ_LABELS[f]}</button>`
  ).join('');
}

function setFreq(kind, freq) {
  const data = loadData();
  if (kind === 'weight') data.settings.weightFreq = freq;
  else data.settings.measureFreq = freq;
  saveData(data);
  renderCheckin();
}

function saveCheckin() {
  const data = loadData();
  let saved = false;
  const weight = parseFloat(document.getElementById('ci-weight').value);
  if (weight) { data.weightLog.push({ date: today(), weight }); saved = true; }

  const entry = { date: today() };
  let hasMeasure = false;
  MEASURE_FIELDS.forEach(f => {
    const el = document.getElementById('ci-' + f.key);
    const v = el ? parseFloat(el.value) : NaN;
    if (!isNaN(v) && v > 0) { entry[f.key] = v; hasMeasure = true; }
  });
  if (hasMeasure) { data.measurements.push(entry); saved = true; }

  if (!saved) { showToast('Bitte mindestens einen Wert eingeben', '#c46a04'); return; }

  saveData(data);
  document.getElementById('ci-weight').value = '';
  MEASURE_FIELDS.forEach(f => { const el = document.getElementById('ci-' + f.key); if (el) el.value = ''; });
  showToast('✓ Werte gespeichert!');
  renderCheckin();
}

// ─── Profil & Einstellungen ─────────────────────────────────────────────────

const REST_OPTIONS = [30, 60, 90, 120, 150, 180];
const DESIGN_OPTIONS = [
  { theme: 'light', name: 'Rosé hell',   cls: 'dp-rose' },
  { theme: 'dark',  name: 'Rosé dunkel', cls: 'dp-rose-dark' },
  { theme: 'masc',  name: 'Maskulin',    cls: 'dp-masc' },
];

// stabilen Freundes-Code erzeugen (3 Buchstaben + 3 Ziffern), einmalig speichern
function ensureFriendCode(data) {
  if (data.profile && data.profile.friendCode) return data.profile.friendCode;
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) code += L[Math.floor(Math.random() * L.length)];
  code += '-';
  for (let i = 0; i < 3; i++) code += D[Math.floor(Math.random() * D.length)];
  if (!data.profile) data.profile = {};
  data.profile.friendCode = code;
  saveData(data);
  return code;
}

function renderProfile() {
  const data = loadData();
  const u = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;

  // Kopf
  document.getElementById('profile-name').textContent = pName(data);
  document.getElementById('profile-email').textContent = u ? u.email : 'lokaler Modus';
  const av = document.getElementById('profile-avatar');
  if (av) av.textContent = (pName(data).trim()[0] || '🙂').toUpperCase();

  // Felder
  document.getElementById('pf-name').value      = pName(data);
  document.getElementById('pf-start').value     = pStartWeight(data);
  document.getElementById('pf-goal').value       = pGoalWeight(data);
  document.getElementById('pf-startdate').value = pStartDate(data);
  document.getElementById('pf-goaldate').value  = pGoalDate(data);

  // Design-Auswahl
  const dp = document.getElementById('pf-design');
  if (dp) dp.innerHTML = DESIGN_OPTIONS.map(o =>
    `<button type="button" class="design-opt${data.settings.theme === o.theme ? ' sel' : ''}" onclick="setProfileTheme('${o.theme}')">
       <span class="dp-swatch ${o.cls}"></span><span class="dp-name">${o.name}</span>
     </button>`).join('');

  // Pausenzeit
  const rs = document.getElementById('pf-rest');
  if (rs) rs.innerHTML = REST_OPTIONS.map(s =>
    `<button type="button" class="freq-opt${data.settings.restDefault === s ? ' sel' : ''}" onclick="setProfileRest(${s})">${formatRest(s)}</button>`).join('');

  // Freundes-Code
  document.getElementById('pf-friendcode').textContent = ensureFriendCode(data);
}

function setProfileTheme(theme) {
  const data = loadData();
  data.settings.theme = theme;
  if (theme !== 'masc') data.settings.femMode = theme;
  saveData(data);
  applyTheme(theme);
  renderProfile();
}

function setProfileRest(sec) {
  const data = loadData();
  data.settings.restDefault = sec;
  saveData(data);
  renderProfile();
}

function saveProfile() {
  const data = loadData();
  const name = val('pf-name');
  const sw = parseFloat(val('pf-start'));
  const gw = parseFloat(val('pf-goal'));
  const sd = val('pf-startdate');
  const gd = val('pf-goaldate');
  if (!name) { showToast('Bitte einen Namen eingeben', '#c46a04'); return; }
  if (!sw || !gw) { showToast('Bitte Start- und Zielgewicht eingeben', '#c46a04'); return; }
  if (!data.profile) data.profile = {};
  data.profile.name = name;
  data.profile.startWeight = sw;
  data.profile.goalWeight = gw;
  if (sd) data.profile.startDate = sd;
  if (gd) data.profile.goalDate = gd;
  saveData(data);
  syncPublicProfile();
  renderProfile();
  showToast('✓ Profil gespeichert!');
}

// Konto-Daten zurücksetzen (z. B. um fälschlich übernommene Alt-Daten zu entfernen)
function resetAccountData() {
  if (!confirm('Alle Daten dieses Kontos löschen und neu einrichten?\n(Trainings, Gewicht, Maße, Pläne — Freunde bleiben erhalten.)')) return;
  const cur = loadData();
  const blank = {
    weightLog: [], measurements: [], workouts: [], routines: [],
    settings: { theme: cur.settings.theme, femMode: cur.settings.femMode, restDefault: 90, weightFreq: 'weekly', measureFreq: 'monthly' },
  };
  localStorage.setItem(storageKey(), JSON.stringify(blank));
  const data = loadData();   // sät Standard-Plan (PPL) neu, ohne Profil
  saveData(data);            // überschreibt auch das Cloud-Dokument
  syncPublicProfile();
  showToast('Konto zurückgesetzt — bitte neu einrichten');
  showOnboarding();
}

function copyFriendCode() {
  const code = document.getElementById('pf-friendcode').textContent;
  const done = () => showToast('✓ Code kopiert: ' + code, '#0f9d72');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(done).catch(() => done());
  } else { done(); }
}

// ─── Statistiken ──────────────────────────────────────────────────────────────

let activeChart = 'weight';
let chartInstance = null;

function renderStats() {
  document.querySelectorAll('.chart-btn').forEach(b => b.classList.toggle('active', b.dataset.chart === activeChart));
  document.querySelectorAll('.chart-view').forEach(v => v.style.display = v.id === 'chart-' + activeChart ? 'block' : 'none');
  const data = loadData();
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  if (activeChart === 'weight')   renderWeightChart(data);
  if (activeChart === 'measures') renderMeasureChart(data);
  if (activeChart === 'strength') renderStrengthChart(data);
  if (activeChart === 'heatmap')  renderHeatmap(data);
  if (activeChart === 'volume')   renderVolumeChart(data);
  if (activeChart === 'month')    renderMonthSummary(data);
}
function switchChart(name) { activeChart = name; renderStats(); }

function renderWeightChart(data) {
  const ctx = document.getElementById('canvas-weight')?.getContext('2d');
  if (!ctx) return;
  const sw = pStartWeight(data), gw = pGoalWeight(data);
  const startMs = new Date(pStartDate(data)).getTime(), goalMs = new Date(pGoalDate(data)).getTime();
  const daysTotal = Math.max(7, (goalMs - startMs) / 86400000);
  const goalLabels = [], goalData = [];
  for (let d = 0; d <= daysTotal; d += 7) {
    goalLabels.push(new Date(startMs + d * 86400000).toISOString().slice(0, 10));
    goalData.push(+(sw - (sw - gw) * (d / daysTotal)).toFixed(1));
  }
  const wl = data.weightLog.map(w => w.date), wv = data.weightLog.map(w => w.weight);
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: goalLabels, datasets: [
      { label: 'Ist-Gewicht', data: goalLabels.map(l => { const i = wl.indexOf(l); return i >= 0 ? wv[i] : null; }),
        borderColor: '#c42e86', backgroundColor: 'rgba(196,46,134,.12)', tension: .3, fill: false, pointRadius: 5, spanGaps: true },
      { label: 'Ziel-Kurve', data: goalData, borderColor: '#d8c7d2', borderDash: [6, 4], pointRadius: 0, fill: false },
    ]},
    options: chartOptions('Gewicht (kg)'),
  });
}
function renderMeasureChart(data) {
  const ctx = document.getElementById('canvas-measures')?.getContext('2d');
  if (!ctx || !data.measurements.length) return;
  const labels = data.measurements.map(m => m.date);
  // nur Felder mit mindestens einem Wert anzeigen
  const datasets = [];
  MEASURE_FIELDS.forEach((f, i) => {
    if (!data.measurements.some(m => m[f.key] !== null && m[f.key] !== undefined && m[f.key] !== '')) return;
    const col = MEASURE_COLORS[i % MEASURE_COLORS.length];
    datasets.push({
      label: f.label.split(' (')[0] + ' (cm)',
      data: data.measurements.map(m => (m[f.key] ?? null)),
      borderColor: col, backgroundColor: col, tension: .3, spanGaps: true,
    });
  });
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions('Umfang (cm)'),
  });
}
function renderStrengthChart(data) {
  const ctx = document.getElementById('canvas-strength')?.getContext('2d');
  const picker = document.getElementById('ex-picker');
  if (!ctx || !picker) return;
  const allEx = new Set();
  data.workouts.forEach(w => (w.exercises || []).forEach(e => { if (!e.skipped && e.sets?.length) allEx.add(e.name); }));
  const names = [...allEx];
  picker.innerHTML = names.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
  if (!names.length) { return; }
  const chosen = picker.value || names[0];
  const pts = data.workouts
    .filter(w => (w.exercises || []).some(e => e.name === chosen && !e.skipped && e.sets?.length))
    .map(w => { const ex = w.exercises.find(e => e.name === chosen); return { date: w.date, weight: Math.max(...ex.sets.map(s => s.weight)) }; });
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: pts.map(p => p.date), datasets: [{ label: chosen + ' (kg)', data: pts.map(p => p.weight), backgroundColor: '#c42e86', borderRadius: 6 }] },
    options: chartOptions('Maximalgewicht (kg)'),
  });
}
function renderHeatmap(data) {
  const hm = document.getElementById('heatmap-grid');
  if (!hm) return;
  hm.innerHTML = '';
  const trained = new Set(data.workouts.map(w => w.date));
  const todayStr = today(), start = new Date(pStartDate(data)), end = new Date();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    const div = document.createElement('div');
    div.className = 'hm-day' + (trained.has(ds) ? ' trained' : '') + (ds === todayStr ? ' today' : '');
    div.title = ds;
    hm.appendChild(div);
  }
}
function renderVolumeChart(data) {
  const ctx = document.getElementById('canvas-volume')?.getContext('2d');
  if (!ctx) return;
  const weekMap = {};
  data.workouts.forEach(w => {
    const week = 'W' + Math.ceil((new Date(w.date) - new Date(pStartDate(data))) / 86400000 / 7);
    const vol = (w.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + (set.weight || 0) * (set.reps || 0), 0), 0);
    weekMap[week] = (weekMap[week] || 0) + vol;
  });
  const labels = Object.keys(weekMap).sort();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Volumen (kg×Wdh.)', data: labels.map(l => weekMap[l]), backgroundColor: 'rgba(196,46,134,.55)', borderColor: '#c42e86', borderWidth: 2, borderRadius: 6 }] },
    options: chartOptions('Trainingsvolumen'),
  });
}
function renderMonthSummary(data) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthWorkouts = data.workouts.filter(w => w.date >= monthStart);
  const monthWeights  = data.weightLog.filter(w => w.date >= monthStart);
  const wLost = monthWeights.length >= 2 ? +(monthWeights[0].weight - monthWeights[monthWeights.length - 1].weight).toFixed(1) : null;
  const ms = data.measurements.filter(m => m.date >= monthStart);
  const firstM = ms[0], lastM = ms[ms.length - 1];
  const poDelta  = firstM && lastM && firstM !== lastM ? +(lastM.hip - firstM.hip).toFixed(1) : null;
  const armDelta = firstM && lastM && firstM !== lastM ? +(lastM.arm - firstM.arm).toFixed(1) : null;
  const el = document.getElementById('month-summary-grid');
  if (!el) return;
  el.innerHTML = `
    <div class="summary-item"><div class="s-icon">⚖️</div><div class="s-label">Gewicht verloren</div><div class="s-value">${wLost !== null ? wLost + ' kg' : '—'}</div><div class="s-traffic">${trafficLight(wLost, 3, false)}</div></div>
    <div class="summary-item"><div class="s-icon">💪</div><div class="s-label">Trainings absolviert</div><div class="s-value">${monthWorkouts.length}</div><div class="s-traffic">${trafficLight(monthWorkouts.length, 12, false)}</div></div>
    <div class="summary-item"><div class="s-icon">🍑</div><div class="s-label">Po-Maß Veränderung</div><div class="s-value">${poDelta !== null ? (poDelta > 0 ? '+' : '') + poDelta + ' cm' : '—'}</div><div class="s-traffic">${poDelta !== null ? (poDelta >= 0 ? '🟢' : '🔴') : ''}</div></div>
    <div class="summary-item"><div class="s-icon">💪</div><div class="s-label">Arm Veränderung</div><div class="s-value">${armDelta !== null ? (armDelta > 0 ? '+' : '') + armDelta + ' cm' : '—'}</div><div class="s-traffic">${armDelta !== null ? (armDelta <= 0 ? '🟢' : '🔴') : ''}</div></div>`;
}
function chartOptions(yLabel) {
  const grid = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#f0e8ee';
  const tick = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6d5a67';
  return {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { labels: { color: tick, font: { size: 12 }, boxWidth: 14 } } },
    scales: {
      y: { title: { display: true, text: yLabel, color: tick, font: { size: 11 } }, grid: { color: grid }, ticks: { color: tick } },
      x: { ticks: { maxTicksLimit: 6, color: tick, font: { size: 10 } }, grid: { display: false } },
    },
  };
}

// ─── Export / Import ────────────────────────────────────────────────────────

function exportData() {
  const blob = new Blob([JSON.stringify(loadData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `fitness_data_${today()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('✓ Daten exportiert!');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try { saveData(JSON.parse(e.target.result)); showToast('✓ Daten importiert!'); renderDashboard(); }
    catch { showToast('Fehler beim Importieren', '#c46a04'); }
  };
  reader.readAsText(file);
}

// ─── Firebase Sync ────────────────────────────────────────────────────────────

function setSyncStatus(status) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = { ok: '☁️', syncing: '🔄', offline: '📴', error: '⚠️' }[status] || '';
  el.title = { ok: 'Cloud-Sync aktiv', syncing: 'Synchronisiere…', offline: 'Offline — lokal gespeichert', error: 'Sync-Fehler' }[status] || '';
}
function cloudValid(c) { return c && (Array.isArray(c.weightLog) || c.profile || Array.isArray(c.routines)); }

function initFirebase() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || cfg.apiKey === 'HIER_EINFÜGEN' || typeof firebase === 'undefined' || !firebase.auth) {
    // Kein Firebase/Auth verfügbar → lokaler Einzelnutzer-Modus (Altverhalten)
    routeAfterAuth(null);
    return;
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    const auth = firebase.auth();
    try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
    auth.onAuthStateChanged(user => {
      if (window._fbUnsub) { try { window._fbUnsub(); } catch (e) {} window._fbUnsub = null; }
      window._fbRef = null;
      if (user) { currentUid = user.uid; attachUserDoc(user); }
      else { currentUid = null; setSyncStatus(''); showAuthScreen(); }
    });
  } catch (e) { routeAfterAuth(null); }
}

function attachUserDoc(user) {
  const db = firebase.firestore();
  window._fbRef = db.collection('fitness').doc(user.uid);
  setSyncStatus('syncing');
  window._fbRef.get().then(snap => {
    if (snap.exists && cloudValid(snap.data())) {
      localStorage.setItem(storageKey(), JSON.stringify(snap.data()));
    }
    // Kein Auto-Import von Alt-Daten mehr — neue Konten starten leer (→ Onboarding).
    // (Früher migrierte maybeMigrateLegacy() lokale Einzelnutzer-Daten ins erste Konto;
    //  das übernahm fälschlich Alt-Daten in JEDES neue Konto auf demselben Gerät.)
    setSyncStatus('ok');
    startUserListener();
    syncPublicProfile();        // öffentliches Profil aktuell halten
    startSocialListeners();     // Freundes-Anfragen/Posteingang live
    processFinishedGroupSessions(); // abgeschlossene Gruppentrainings übernehmen
    routeAfterAuth(user);
  }).catch(() => { setSyncStatus('offline'); routeAfterAuth(user); });
}

function startUserListener() {
  if (!window._fbRef) return;
  window._fbUnsub = window._fbRef.onSnapshot(snap => {
    if (!snap.exists || !cloudValid(snap.data())) { setSyncStatus('ok'); return; }
    localStorage.setItem(storageKey(), JSON.stringify(snap.data()));
    const active = document.querySelector('.page.active')?.id;
    try {
      if (active === 'page-dashboard') renderDashboard();
      if (active === 'page-stats') renderStats();
      if (active === 'page-history') renderHistory();
      if (active === 'page-training' && trainingView === 'list') renderRoutineList();
    } catch (e) {}
    setSyncStatus('ok');
  }, () => setSyncStatus('error'));
}

// ─── Social: Freunde & Plan-Teilen ───────────────────────────────────────────
// Benötigt eingeloggtes Cloud-Konto + die erweiterten Firestore-Regeln.

function fsdb() { return (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null; }
function socialAvailable() { return !!(fsdb() && currentUid); }

let friendsCache = [], incomingCache = [], planReqCache = [], inboxCache = [];

// Öffentliches Profil (Name, Code, letztes Training, Fortschritt, Plan-Namen) spiegeln.
// Bewusst OHNE Gewicht/Maße — die bleiben privat.
function syncPublicProfile() {
  if (!socialAvailable()) return;
  const data = loadData();
  const lastWorkout = data.workouts.length ? data.workouts[data.workouts.length - 1].date : null;
  const ms = new Date(); ms.setDate(1);
  const monthStart = ms.toISOString().slice(0, 10);
  const workoutsThisMonth = data.workouts.filter(w => w.date >= monthStart).length;
  const plans = (data.routines || []).map(r => ({ id: r.id, name: r.name, emoji: r.emoji || '🏋️', count: (r.exercises || []).length }));
  fsdb().collection('users').doc(currentUid).set({
    name: pName(data), friendCode: ensureFriendCode(data),
    lastWorkout, workoutsThisMonth, plans, updatedAt: Date.now(),
  }, { merge: true }).catch(() => {});
}

// Echtzeit-Listener für Anfragen / Posteingang → Badge + Live-Update der Seite
function startSocialListeners() {
  if (!socialAvailable()) return;
  if (window._socUnsub) { window._socUnsub.forEach(u => { try { u(); } catch (e) {} }); }
  const me = fsdb().collection('users').doc(currentUid);
  const subs = [];
  const onErr = () => {};
  const refresh = () => { updateSocialBadge(); if (document.getElementById('page-friends')?.classList.contains('active')) drawSocial(); };
  subs.push(me.collection('incoming').onSnapshot(s => { incomingCache = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); }, onErr));
  subs.push(me.collection('planRequests').onSnapshot(s => { planReqCache = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); }, onErr));
  subs.push(me.collection('inbox').onSnapshot(s => { inboxCache = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); }, onErr));
  subs.push(me.collection('friends').onSnapshot(async s => { await hydrateFriends(s.docs.map(d => ({ uid: d.id, ...d.data() }))); refresh(); }, onErr));
  window._socUnsub = subs;
}

async function hydrateFriends(basic) {
  const db = fsdb(); if (!db) { friendsCache = basic; return; }
  friendsCache = await Promise.all(basic.map(async f => {
    try { const p = await db.collection('users').doc(f.uid).get(); const d = p.exists ? p.data() : {}; return { uid: f.uid, name: d.name || f.name, lastWorkout: d.lastWorkout || null, workoutsThisMonth: d.workoutsThisMonth || 0, plans: d.plans || [] }; }
    catch (e) { return { uid: f.uid, name: f.name }; }
  }));
}

function updateSocialBadge() {
  const n = incomingCache.length + planReqCache.length + inboxCache.length;
  document.querySelectorAll('.social-badge').forEach(b => { b.textContent = n; b.style.display = n ? 'grid' : 'none'; });
}

function renderFriends() {
  const data = loadData();
  const mc = document.getElementById('fr-mycode'); if (mc) mc.textContent = ensureFriendCode(data);
  if (!socialAvailable()) {
    document.getElementById('friends-body').innerHTML =
      '<div class="empty-state"><div class="es-icon">☁️</div><p>Freunde funktionieren nur mit einem Cloud-Konto.<br>Bitte melde dich an.</p></div>';
    return;
  }
  document.getElementById('friends-body').innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>';
  loadSocial().then(drawSocial);
}

async function loadSocial() {
  if (!socialAvailable()) return;
  const me = fsdb().collection('users').doc(currentUid);
  try {
    const [inc, fr, pr, ib] = await Promise.all([
      me.collection('incoming').get(), me.collection('friends').get(),
      me.collection('planRequests').get(), me.collection('inbox').get(),
    ]);
    incomingCache = inc.docs.map(d => ({ id: d.id, ...d.data() }));
    planReqCache  = pr.docs.map(d => ({ id: d.id, ...d.data() }));
    inboxCache    = ib.docs.map(d => ({ id: d.id, ...d.data() }));
    await hydrateFriends(fr.docs.map(d => ({ uid: d.id, ...d.data() })));
    updateSocialBadge();
  } catch (e) {
    document.getElementById('friends-body').innerHTML =
      '<div class="empty-state"><div class="es-icon">⚠️</div><p>Konnte Freunde nicht laden.<br>Sind die Firebase-Regeln schon aktiv?</p></div>';
    throw e;
  }
}

function fmtLastWorkout(date) {
  if (!date) return 'noch kein Training';
  try {
    const days = Math.floor((new Date(today()) - new Date(date)) / 86400000);
    if (days <= 0) return 'heute trainiert';
    if (days === 1) return 'gestern trainiert';
    return `vor ${days} Tagen`;
  } catch (e) { return date; }
}

function drawSocial() {
  const body = document.getElementById('friends-body');
  if (!body) return;
  let html = '';

  // Eingehende Freundschaftsanfragen
  if (incomingCache.length) {
    html += '<div class="section-label">Freundschaftsanfragen</div>';
    incomingCache.forEach(r => {
      html += `<div class="social-card">
        <div class="sc-info"><h3>${escapeHtml(r.fromName || '?')}</h3><p>möchte sich verbinden</p></div>
        <div class="sc-actions">
          <button class="sc-accept" onclick="acceptFriend('${r.fromUid}','${escapeHtml(r.fromName || '')}')">Annehmen</button>
          <button class="sc-decline" onclick="declineFriend('${r.fromUid}')">✕</button>
        </div></div>`;
    });
  }

  // Eingehende Plan-Anfragen (jemand will MEINEN Plan)
  if (planReqCache.length) {
    html += '<div class="section-label">Plan-Anfragen</div>';
    planReqCache.forEach(r => {
      html += `<div class="social-card">
        <div class="sc-info"><h3>${escapeHtml(r.fromName || '?')}</h3><p>möchte „${escapeHtml(r.planName || 'Plan')}"</p></div>
        <div class="sc-actions">
          <button class="sc-accept" onclick='approvePlanRequest(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Senden</button>
          <button class="sc-decline" onclick="declinePlanRequest('${r.id}')">✕</button>
        </div></div>`;
    });
  }

  // Posteingang (Pläne + Gruppen-Einladungen)
  if (inboxCache.length) {
    html += '<div class="section-label">Posteingang</div>';
    inboxCache.forEach(it => {
      if (it.type === 'groupInvite') {
        html += `<div class="social-card">
          <div class="sc-info"><h3>🏋️ Gruppentraining</h3><p>${escapeHtml(it.fromName || '?')} · „${escapeHtml(it.routineName || 'Training')}"</p></div>
          <div class="sc-actions">
            <button class="sc-accept" onclick="acceptGroupInvite('${it.sessionId}','${it.id}')">Beitreten</button>
            <button class="sc-decline" onclick="dismissInbox('${it.id}')">✕</button>
          </div></div>`;
      } else {
        html += `<div class="social-card">
          <div class="sc-info"><h3>${escapeHtml(it.plan?.name || 'Plan')}</h3><p>von ${escapeHtml(it.fromName || '?')}</p></div>
          <div class="sc-actions">
            <button class="sc-accept" onclick='acceptInboxPlan(${JSON.stringify(it).replace(/'/g, "&#39;")})'>Übernehmen</button>
            <button class="sc-decline" onclick="dismissInbox('${it.id}')">✕</button>
          </div></div>`;
      }
    });
  }

  // Freundesliste
  html += '<div class="section-label">Meine Freunde</div>';
  if (!friendsCache.length) {
    html += '<div class="empty-state"><div class="es-icon">🤝</div><p>Noch keine Freunde. Verbinde dich über den Code oben!</p></div>';
  } else {
    friendsCache.forEach(f => {
      const plans = (f.plans || []).map(p =>
        `<div class="fp-row"><span>${escapeHtml(p.emoji || '🏋️')} ${escapeHtml(p.name)} <em>· ${p.count} Übungen</em></span>
          <button class="fp-req" onclick="requestPlan('${f.uid}','${p.id}','${escapeHtml(p.name)}')">Anfragen</button></div>`).join('')
        || '<p class="fp-empty">Keine Pläne geteilt.</p>';
      html += `<div class="friend-card">
        <div class="fc-head">
          <div class="fc-avatar">${escapeHtml((f.name || '?').trim()[0] || '?').toUpperCase()}</div>
          <div class="fc-info">
            <h3>${escapeHtml(f.name || 'Freund')}</h3>
            <p>${fmtLastWorkout(f.lastWorkout)} · ${f.workoutsThisMonth || 0} Trainings diesen Monat</p>
          </div>
        </div>
        <button class="fc-group-btn" onclick="startGroupTraining('${f.uid}','${escapeHtml(f.name || 'Freund')}')">🏋️ Gemeinsam trainieren</button>
        <div class="fc-plans"><div class="fp-title">Trainingspläne</div>${plans}</div>
      </div>`;
    });
  }

  body.innerHTML = html;
}

async function sendFriendByCode() {
  if (!socialAvailable()) { showToast('Bitte zuerst anmelden', '#c46a04'); return; }
  const code = (val('friend-code-input') || '').toUpperCase().trim();
  if (!code) { showToast('Bitte einen Code eingeben', '#c46a04'); return; }
  const data = loadData();
  if (code === ensureFriendCode(data)) { showToast('Das ist dein eigener Code 🙂', '#c46a04'); return; }
  try {
    const snap = await fsdb().collection('users').where('friendCode', '==', code).limit(1).get();
    if (snap.empty) { showToast('Kein Nutzer mit diesem Code', '#c0392b'); return; }
    const toUid = snap.docs[0].id;
    if (toUid === currentUid) { showToast('Das ist dein eigener Code 🙂', '#c46a04'); return; }
    await fsdb().collection('users').doc(toUid).collection('incoming').doc(currentUid).set({
      fromUid: currentUid, fromName: pName(data), fromCode: ensureFriendCode(data), ts: Date.now(),
    });
    document.getElementById('friend-code-input').value = '';
    showToast('✓ Anfrage gesendet!');
  } catch (e) { showToast('Fehler beim Senden', '#c0392b'); }
}

async function acceptFriend(fromUid, fromName) {
  if (!socialAvailable()) return;
  const myName = pName(loadData());
  try {
    await fsdb().collection('users').doc(currentUid).collection('friends').doc(fromUid).set({ uid: fromUid, name: fromName, ts: Date.now() });
    await fsdb().collection('users').doc(fromUid).collection('friends').doc(currentUid).set({ uid: currentUid, name: myName, ts: Date.now() });
    await fsdb().collection('users').doc(currentUid).collection('incoming').doc(fromUid).delete();
    showToast('✓ Freund hinzugefügt!');
    renderFriends();
  } catch (e) { showToast('Fehler', '#c0392b'); }
}

async function declineFriend(fromUid) {
  if (!socialAvailable()) return;
  try { await fsdb().collection('users').doc(currentUid).collection('incoming').doc(fromUid).delete(); renderFriends(); } catch (e) {}
}

// Plan beim Besitzer anfragen (Kopieren erst nach dessen Bestätigung)
async function requestPlan(ownerUid, planId, planName) {
  if (!socialAvailable()) return;
  const data = loadData();
  try {
    await fsdb().collection('users').doc(ownerUid).collection('planRequests').add({
      fromUid: currentUid, fromName: pName(data), planId, planName, ts: Date.now(),
    });
    showToast('✓ Anfrage gesendet — warte auf Bestätigung');
  } catch (e) { showToast('Fehler beim Anfragen', '#c0392b'); }
}

// Besitzer bestätigt → sendet den vollständigen Plan in den Posteingang des Anfragers
async function approvePlanRequest(req) {
  if (!socialAvailable()) return;
  const data = loadData();
  const r = (data.routines || []).find(x => x.id === req.planId);
  if (!r) { showToast('Plan nicht mehr vorhanden', '#c46a04'); declinePlanRequest(req.id); return; }
  const planCopy = { name: r.name, emoji: r.emoji || '🏋️', exercises: (r.exercises || []).map(e => ({ name: e.name, tag: e.tag || '', sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax, restSec: e.restSec || 90 })) };
  try {
    await fsdb().collection('users').doc(req.fromUid).collection('inbox').add({
      type: 'plan', fromUid: currentUid, fromName: pName(data), plan: planCopy, ts: Date.now(),
    });
    await fsdb().collection('users').doc(currentUid).collection('planRequests').doc(req.id).delete();
    showToast('✓ Plan gesendet!');
    renderFriends();
  } catch (e) { showToast('Fehler beim Senden', '#c0392b'); }
}

async function declinePlanRequest(id) {
  if (!socialAvailable()) return;
  try { await fsdb().collection('users').doc(currentUid).collection('planRequests').doc(id).delete(); renderFriends(); } catch (e) {}
}

// Gesendeten Plan in die eigenen Routinen übernehmen
function acceptInboxPlan(item) {
  const data = loadData();
  const p = item.plan || {};
  data.routines.push({
    id: uid('r'), name: (p.name || 'Plan') + ' (von ' + (item.fromName || 'Freund') + ')', emoji: p.emoji || '🏋️',
    exercises: (p.exercises || []).map(e => ({ id: uid('e'), name: e.name, tag: e.tag || '', sets: e.sets || 3, repsMin: e.repsMin || 10, repsMax: e.repsMax || 12, restSec: e.restSec || 90 })),
  });
  saveData(data);
  syncPublicProfile();
  if (socialAvailable()) fsdb().collection('users').doc(currentUid).collection('inbox').doc(item.id).delete().catch(() => {});
  showToast('✓ Plan übernommen!');
  renderFriends();
}

function dismissInbox(id) {
  if (!socialAvailable()) return;
  try { fsdb().collection('users').doc(currentUid).collection('inbox').doc(id).delete().then(renderFriends); } catch (e) {}
}

// ─── Gruppentraining (gemeinsame Live-Session) ────────────────────────────────

let groupSession = null, groupSessionId = null, _grpUnsub = null, _grpSaveT = null, _grpPickFriend = null;
const _finalizedGroupSessions = new Set();
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

// 1) Host wählt einen Plan
function startGroupTraining(friendUid, friendName) {
  if (!socialAvailable()) { showToast('Nur mit Cloud-Konto', '#c46a04'); return; }
  _grpPickFriend = { uid: friendUid, name: friendName };
  const data = loadData();
  document.getElementById('gpm-title').textContent = 'Mit ' + friendName + ' trainieren';
  const list = document.getElementById('gpm-plans');
  list.innerHTML = (data.routines || []).map(r =>
    `<button class="menu-item" onclick="createGroupSession('${r.id}')">${escapeHtml(r.emoji || '🏋️')} ${escapeHtml(r.name)}</button>`).join('')
    || '<p style="color:var(--text-muted)">Du hast noch keine Trainingspläne.</p>';
  document.getElementById('group-plan-modal').classList.add('open');
}
function closeGroupPlanModal() { document.getElementById('group-plan-modal').classList.remove('open'); }

// 2) Session anlegen + Einladung senden
async function createGroupSession(routineId) {
  closeGroupPlanModal();
  const data = loadData();
  const r = (data.routines || []).find(x => x.id === routineId);
  if (!r || !_grpPickFriend) return;
  const me = currentUid, friend = _grpPickFriend.uid;
  const mkSets = ex => { const a = []; for (let i = 0; i < (ex.sets || 3); i++) a.push({ weight: '', reps: ex.repsMin || 10, done: false }); return a; };
  const exercises = r.exercises.map(ex => ({
    name: ex.name, tag: ex.tag || '', repsMin: ex.repsMin || 10, repsMax: ex.repsMax || 12,
    sets: { [me]: mkSets(ex), [friend]: mkSets(ex) },
  }));
  const docData = {
    members: [me, friend],
    membersInfo: { [me]: { name: pName(data) }, [friend]: { name: _grpPickFriend.name } },
    host: me, routineName: r.name, status: 'active', startTs: Date.now(), exercises, saved: {}, createdAt: Date.now(),
  };
  try {
    const ref = await fsdb().collection('groupSessions').add(docData);
    await fsdb().collection('users').doc(friend).collection('inbox').add({
      type: 'groupInvite', sessionId: ref.id, fromUid: me, fromName: pName(data), routineName: r.name, ts: Date.now(),
    });
    openGroupSession(ref.id);
    showToast('Gruppentraining gestartet — Einladung gesendet 📨');
  } catch (e) { showToast('Fehler beim Start', '#c0392b'); }
}

// 3) Freund nimmt Einladung an
async function acceptGroupInvite(sessionId, inboxId) {
  try { await fsdb().collection('users').doc(currentUid).collection('inbox').doc(inboxId).delete(); } catch (e) {}
  openGroupSession(sessionId);
}

// 4) Live-Session öffnen (beide hören auf dasselbe Dokument)
function openGroupSession(sid) {
  groupSessionId = sid;
  if (_grpUnsub) { try { _grpUnsub(); } catch (e) {} }
  navigate('group');
  _grpUnsub = fsdb().collection('groupSessions').doc(sid).onSnapshot(snap => {
    if (!snap.exists) { showToast('Session wurde beendet'); _closeGroup(); return; }
    groupSession = snap.data();
    if (groupSession.status === 'done') finalizeGroupForMe();
    const ae = document.activeElement;
    const typing = ae && ae.closest && ae.closest('#group-body');   // beim Tippen nicht neu rendern
    if (!typing) renderGroupSession();
  }, () => showToast('Verbindungsfehler', '#c0392b'));
}

function renderGroupSession() {
  if (!groupSession) return;
  const me = currentUid;
  const names = groupSession.membersInfo || {};
  document.getElementById('grp-title').textContent = groupSession.routineName || 'Gruppentraining';
  document.getElementById('grp-sub').textContent = (groupSession.members || []).map(u => (names[u]?.name) || '?').join('  ·  ');
  const members = [me, ...(groupSession.members || []).filter(u => u !== me)];
  const body = document.getElementById('group-body');
  body.innerHTML = (groupSession.exercises || []).map((ex, ei) => {
    const cols = members.map(u => {
      const isMe = u === me;
      const sets = (ex.sets && ex.sets[u]) || [];
      const rows = sets.map((s, si) => `
        <div class="gset-row${s.done ? ' done' : ''}">
          <span class="gs-num">${si + 1}</span>
          <input class="sr-input" type="number" inputmode="decimal" step="0.5" min="0" value="${s.weight}" placeholder="kg"
            oninput="groupSetVal(${ei},'${u}',${si},'weight',this.value)" aria-label="Gewicht">
          <input class="sr-input" type="number" inputmode="numeric" min="0" value="${s.reps}" placeholder="Wdh"
            oninput="groupSetVal(${ei},'${u}',${si},'reps',this.value)" aria-label="Wiederholungen">
          <button class="sr-check" onclick="groupToggleSet(${ei},'${u}',${si})" aria-label="Satz erledigt">${CHECK_SVG}</button>
        </div>`).join('');
      return `<div class="gcol${isMe ? ' me' : ''}">
        <div class="gcol-name">${escapeHtml((names[u]?.name) || '?')}${isMe ? ' <span class="gcol-you">Du</span>' : ''}</div>
        ${rows}
        <button class="g-addset" onclick="groupAddSet(${ei},'${u}')">+ Satz</button>
      </div>`;
    }).join('');
    return `<div class="exercise-entry group-ex">
      <div class="ex-header"><div class="ex-info"><h3>${escapeHtml(ex.name)}</h3><p>Ziel: ${ex.repsMin}–${ex.repsMax} Wdh.</p></div></div>
      <div class="gcols">${cols}</div>
    </div>`;
  }).join('');
}

function groupSetVal(ei, u, si, field, value) {
  if (!groupSession) return;
  const s = groupSession.exercises[ei].sets[u][si];
  s[field] = field === 'weight' ? (parseFloat(value) || 0) : (parseInt(value) || 0);
  saveGroupSoon();
}
function groupToggleSet(ei, u, si) {
  if (!groupSession) return;
  const s = groupSession.exercises[ei].sets[u][si];
  s.done = !s.done;
  renderGroupSession(); saveGroupSoon();
}
function groupAddSet(ei, u) {
  if (!groupSession) return;
  const arr = groupSession.exercises[ei].sets[u];
  const last = arr[arr.length - 1];
  arr.push({ weight: last ? last.weight : '', reps: last ? last.reps : (groupSession.exercises[ei].repsMin || 10), done: false });
  renderGroupSession(); saveGroupSoon();
}
function saveGroupSoon() { clearTimeout(_grpSaveT); _grpSaveT = setTimeout(saveGroupNow, 700); }
function saveGroupNow() {
  if (!groupSession || !groupSessionId) return;
  fsdb().collection('groupSessions').doc(groupSessionId).set(groupSession).catch(() => {});
}

// Eigene Spalte in den EIGENEN Verlauf schreiben
function saveGroupColumnToHistory(session) {
  const data = loadData(), me = currentUid;
  const exercises = [];
  (session.exercises || []).forEach(ex => {
    const sets = ((ex.sets && ex.sets[me]) || []).filter(s => s.done).map(s => ({ weight: +s.weight || 0, reps: +s.reps || 0, rpe: 7 }));
    if (sets.length) exercises.push({ name: ex.name, tag: ex.tag || '', skipped: false, alternative: null, note: '', sets });
  });
  if (!exercises.length) return false;
  data.workouts.push({
    date: today(), durationSec: session.startTs ? Math.floor((Date.now() - session.startTs) / 1000) : 0,
    routineId: null, routineName: (session.routineName || 'Gruppentraining') + ' 👥', exercises,
  });
  saveData(data); syncPublicProfile();
  return true;
}

// Wird ausgelöst, wenn die Session auf "done" springt, während ich drin bin
function finalizeGroupForMe() {
  if (!groupSession || groupSession.status !== 'done' || _finalizedGroupSessions.has(groupSessionId)) return;
  _finalizedGroupSessions.add(groupSessionId);
  if (!(groupSession.saved && groupSession.saved[currentUid])) {
    saveGroupColumnToHistory(groupSession);
    fsdb().collection('groupSessions').doc(groupSessionId).set({ saved: { [currentUid]: true } }, { merge: true }).catch(() => {});
    showToast('Werte in deinen Verlauf übernommen ✓');
  }
}

function finishGroupSession() {
  if (!groupSession) { _closeGroup(); return; }
  if (!_finalizedGroupSessions.has(groupSessionId)) {
    saveGroupColumnToHistory(groupSession);
    _finalizedGroupSessions.add(groupSessionId);
  }
  groupSession.status = 'done';
  groupSession.saved = { ...(groupSession.saved || {}), [currentUid]: true };
  clearTimeout(_grpSaveT); saveGroupNow();
  showToast('🎉 Training gespeichert!');
  _closeGroup();
}

function leaveGroupSession() {
  if (groupSession && groupSession.status === 'active') {
    if (!confirm('Gruppentraining verlassen? Deine bisherigen Eingaben bleiben in der Session erhalten.')) return;
  }
  _closeGroup();
}
function _closeGroup() {
  if (_grpUnsub) { try { _grpUnsub(); } catch (e) {} _grpUnsub = null; }
  groupSession = null; groupSessionId = null;
  navigate('friends');
}

// Beim Login: abgeschlossene Gruppen-Sessions, die ich noch nicht gespeichert habe, übernehmen
async function processFinishedGroupSessions() {
  if (!socialAvailable()) return;
  try {
    const snap = await fsdb().collection('groupSessions').where('members', 'array-contains', currentUid).get();
    for (const d of snap.docs) {
      const s = d.data();
      if (s.status === 'done' && (!s.saved || !s.saved[currentUid]) && !_finalizedGroupSessions.has(d.id)) {
        if (saveGroupColumnToHistory(s)) showToast('Gruppentraining in deinen Verlauf übernommen ✓');
        _finalizedGroupSessions.add(d.id);
        try { await fsdb().collection('groupSessions').doc(d.id).set({ saved: { ...(s.saved || {}), [currentUid]: true } }, { merge: true }); } catch (e) {}
      }
    }
  } catch (e) {}
}

// ─── Auth-UI / Routing ──────────────────────────────────────────────────────

// Status-Bar-Farbe für die neutralen Vor-App-Screens (Login/Registrieren/Profil)
function setNeutralBar() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#f3f4f6');
}

function setAppState(s) { document.body.dataset.state = s; }
function showAuthScreen() { setAppState('auth'); authMode('login'); setNeutralBar(); }
function showOnboarding() {
  setAppState('onboarding');
  setNeutralBar();
  chosenDesign = 'light';
  refreshDesignPick();
  const d = document.getElementById('ob-date');
  if (d && !d.value) { const t = new Date(); t.setMonth(t.getMonth() + 3); d.value = t.toISOString().slice(0, 10); }
}

// ── Design-Auswahl beim Onboarding (Rosé vs. Maskulin) ──
let chosenDesign = 'light';
function pickDesign(theme) { chosenDesign = theme; refreshDesignPick(); }
function refreshDesignPick() {
  document.querySelectorAll('.design-opt').forEach(b =>
    b.classList.toggle('sel', b.dataset.design === chosenDesign));
}
function enterApp() {
  setAppState('app');
  // Theme des eingeloggten Nutzers anwenden (uid-Daten sind jetzt geladen)
  applyTheme(loadData().settings.theme);
  const u = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
  const ae = document.getElementById('account-email');
  if (ae) ae.textContent = u ? u.email : 'lokaler Modus';
  const acc = document.getElementById('account-section');
  if (acc) acc.style.display = u ? 'block' : 'none';
  navigate('dashboard');
}

function routeAfterAuth() {
  const data = loadData();
  const hasData = (data.weightLog && data.weightLog.length) || (data.workouts && data.workouts.length) || (data.measurements && data.measurements.length);
  // „Eingerichtet" = echtes Profil mit Name + Startgewicht (nicht nur ein friendCode-Objekt)
  const onboarded = !!(data.profile && data.profile.name && data.profile.startWeight);
  if (!onboarded && !hasData) { showOnboarding(); return; }
  enterApp();
}

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

const EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show ? EYE_OFF_SVG : EYE_SVG;
  btn.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
}

function authErr(e) {
  const m = {
    'auth/invalid-email': 'Ungültige E-Mail-Adresse',
    'auth/email-already-in-use': 'Diese E-Mail ist bereits registriert',
    'auth/weak-password': 'Passwort zu schwach (mind. 6 Zeichen)',
    'auth/wrong-password': 'Falsches Passwort',
    'auth/user-not-found': 'Kein Konto mit dieser E-Mail',
    'auth/invalid-credential': 'E-Mail oder Passwort falsch',
    'auth/missing-password': 'Bitte Passwort eingeben',
    'auth/too-many-requests': 'Zu viele Versuche — bitte später erneut',
    'auth/network-request-failed': 'Keine Verbindung',
    'auth/operation-not-allowed': 'Diese Login-Methode ist in Firebase noch nicht aktiviert',
    'auth/unauthorized-domain': 'Domain in Firebase nicht freigegeben (Authorized domains)',
    'auth/account-exists-with-different-credential': 'Konto existiert bereits mit anderer Methode',
    'auth/popup-closed-by-user': 'Anmeldung abgebrochen',
  };
  return m[e && e.code] || (e && e.message) || 'Fehler';
}

function authMode(m) {
  const reg = m === 'register';
  const l = document.getElementById('auth-login'), r = document.getElementById('auth-register');
  if (l) l.style.display = reg ? 'none' : 'block';
  if (r) r.style.display = reg ? 'block' : 'none';
}

function signIn() {
  const email = val('login-email'), pw = val('login-pw');
  if (!email || !pw) { showToast('E-Mail & Passwort eingeben', '#c46a04'); return; }
  firebase.auth().signInWithEmailAndPassword(email, pw).catch(e => showToast(authErr(e), '#c0392b'));
}
function signUp() {
  const email = val('reg-email'), pw = val('reg-pw'), pw2 = val('reg-pw2');
  if (!email || !pw) { showToast('E-Mail & Passwort eingeben', '#c46a04'); return; }
  if (pw.length < 6) { showToast('Passwort: mind. 6 Zeichen', '#c46a04'); return; }
  if (pw !== pw2) { showToast('Passwörter stimmen nicht überein', '#c46a04'); return; }
  firebase.auth().createUserWithEmailAndPassword(email, pw).catch(e => showToast(authErr(e), '#c0392b'));
}
function resetPassword() {
  const email = val('login-email');
  if (!email) { showToast('Erst deine E-Mail eingeben', '#c46a04'); return; }
  firebase.auth().sendPasswordResetEmail(email)
    .then(() => showToast('Passwort-Reset-Mail gesendet 📧', '#0f9d72'))
    .catch(e => showToast(authErr(e), '#c0392b'));
}
function signInWithGoogle() {
  if (typeof firebase === 'undefined' || !firebase.auth) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  firebase.auth().signInWithPopup(provider).catch(e => {
    const code = e && e.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return; // abgebrochen
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      firebase.auth().signInWithRedirect(provider).catch(er => showToast(authErr(er), '#c0392b'));
      return;
    }
    showToast(authErr(e), '#c0392b');
  });
}

function signOutUser() {
  if (!confirm('Wirklich abmelden?')) return;
  if (typeof firebase !== 'undefined' && firebase.auth) firebase.auth().signOut();
}

function saveOnboarding() {
  const name = val('ob-name');
  const sw = parseFloat(val('ob-start'));
  const gw = parseFloat(val('ob-goal'));
  const gd = val('ob-date');
  if (!name || !sw || !gw || !gd) { showToast('Bitte alles ausfüllen', '#c46a04'); return; }
  const data = loadData();
  data.profile = { name, startWeight: sw, goalWeight: gw, startDate: today(), goalDate: gd };
  // gewähltes Design speichern (Rosé = hell-feminin, Maskulin = düster)
  data.settings.theme = chosenDesign === 'masc' ? 'masc' : 'light';
  data.settings.femMode = chosenDesign === 'masc' ? 'light' : chosenDesign;
  if (!data.weightLog.length) data.weightLog.push({ date: today(), weight: sw });
  saveData(data);
  applyTheme(data.settings.theme);
  notifySignup(name);   // Entwickler per E-Mail über neue Registrierung informieren
  enterApp();
  showToast(`Willkommen, ${name}! 💪`);
}

// Schickt dem Entwickler eine E-Mail „Neue Registrierung" (EmailJS).
// Nur Name + Zeitpunkt — keine E-Mail-Adresse des Nutzers. Pro Konto nur einmal.
function notifySignup(name) {
  try {
    const key = 'signupNotified_' + (currentUid || 'local');
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    const c = window.EMAILJS_CONFIG;
    if (!c || !c.publicKey || /HIER_/.test(c.publicKey) || typeof emailjs === 'undefined') return;
    emailjs.send(c.serviceId, c.templateId, {
      name: name || 'Unbekannt',
      time: new Date().toLocaleString('de-DE'),
      app: 'Strong Gnome',
    }, { publicKey: c.publicKey }).catch(() => {});
  } catch (e) {}
}

// ─── Ernährung / Kalorientracker (v1.1) ────────────────────────────────────────

const MEALS = [
  { key: 'breakfast', label: 'Frühstück', emoji: '🌅' },
  { key: 'lunch',     label: 'Mittagessen', emoji: '🍽️' },
  { key: 'dinner',    label: 'Abendessen', emoji: '🌙' },
  { key: 'snack',     label: 'Snacks',    emoji: '🍎' },
];
const MACROS = [
  { key: 'protein', label: 'Eiweiß', short: 'E', color: 'var(--primary)' },
  { key: 'carbs',   label: 'Kohlenhydrate', short: 'KH', color: 'var(--amber)' },
  { key: 'fat',     label: 'Fett', short: 'F', color: 'var(--mint)' },
];

// Lokales Datum als YYYY-MM-DD (NICHT toISOString → das wäre UTC und nachts um den Vortag verschoben)
function nutISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function nutToday() { return nutISO(new Date()); }

let nutDate = nutToday();       // aktuell angezeigter Tag (YYYY-MM-DD, lokale Zeit)
let nutModalMeal = null;        // Mahlzeit, zu der gerade hinzugefügt wird

// Effektive Tagesziele: manuell ODER automatisch berechnet
function nutEffectiveGoals(data) {
  const g = data.nutrition.goals;
  if (g.mode === 'manual') return { kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat };
  return computeAutoGoals(data);
}

// Automatische Berechnung: Mifflin-St-Jeor → TDEE → Zielanpassung (+ Stillen-Bonus, Sicherheits-Floor)
function computeAutoGoals(data) {
  const g = data.nutrition.goals;
  const w  = latestWeight(data) || pStartWeight(data);
  const gw = pGoalWeight(data);
  const bmr  = 10 * w + 6.25 * (g.height || 168) - 5 * (g.age || 30) + (g.sex === 'male' ? 5 : -161);
  let tdee = bmr * (g.activity || 1.375);
  if (gw < w - 0.5)      tdee *= 0.82;   // Abnehmen: ~18 % Defizit
  else if (gw > w + 0.5) tdee *= 1.10;   // Aufbau: ~10 % Überschuss
  if (g.breastfeeding)   tdee += 330;    // Stillen: zusätzlicher Bedarf
  const floor = g.breastfeeding ? 1600 : 1300;   // verantwortungsvolle Untergrenze
  const kcal = Math.max(floor, Math.round(tdee / 10) * 10);
  const protein = Math.round(1.8 * gw);                       // 1,8 g/kg Zielgewicht
  const fat     = Math.round(0.9 * gw);                       // 0,9 g/kg Zielgewicht
  const carbs   = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

function nutDayEntries(data, date) { return data.nutrition.log.filter(e => e.date === date); }

function nutDayTotals(data, date) {
  return nutDayEntries(data, date).reduce((t, e) => ({
    kcal:    t.kcal    + (+e.kcal    || 0),
    protein: t.protein + (+e.protein || 0),
    carbs:   t.carbs   + (+e.carbs   || 0),
    fat:     t.fat     + (+e.fat     || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function nutShiftDay(delta) {
  const d = new Date(nutDate + 'T12:00:00');   // Mittag → DST-/Mitternachts-Sprünge vermeiden
  d.setDate(d.getDate() + delta);
  const iso = nutISO(d);
  if (iso > nutToday()) return;        // nicht in die Zukunft
  nutDate = iso;
  renderNutrition();
}

// Ring (SVG) für die Kalorien
function nutRing(consumed, goal) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const over = goal > 0 && consumed > goal;
  const dash = c * pct;
  const stroke = over ? 'var(--danger)' : 'var(--primary)';
  return `<svg viewBox="0 0 120 120" class="kcal-ring" aria-hidden="true">
    <circle cx="60" cy="60" r="${r}" class="kr-track"/>
    <circle cx="60" cy="60" r="${r}" class="kr-val" stroke="${stroke}"
      stroke-dasharray="${dash.toFixed(1)} ${(c - dash).toFixed(1)}" stroke-dashoffset="0"
      transform="rotate(-90 60 60)"/>
  </svg>`;
}

function renderNutrition() {
  const data = loadData();
  const goals = nutEffectiveGoals(data);
  const totals = nutDayTotals(data, nutDate);
  const isToday = nutDate === nutToday();
  const remaining = goals.kcal - totals.kcal;

  // Datumskopf
  const dLabel = isToday ? 'Heute'
    : (() => { const dt = new Date(nutDate + 'T00:00:00');
        return dt.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }); })();
  const head = document.getElementById('nut-date-label');
  if (head) head.textContent = dLabel;
  const fwd = document.getElementById('nut-fwd');
  if (fwd) fwd.disabled = isToday;

  // Kalorien-Ring + Zahlen
  const ringWrap = document.getElementById('nut-ring-wrap');
  if (ringWrap) {
    ringWrap.innerHTML = nutRing(totals.kcal, goals.kcal) +
      `<div class="kcal-center">
         <div class="kc-num">${Math.round(totals.kcal)}</div>
         <div class="kc-sub">von ${goals.kcal} kcal</div>
         <div class="kc-rem ${remaining < 0 ? 'over' : ''}">${remaining >= 0 ? remaining + ' übrig' : Math.abs(remaining) + ' drüber'}</div>
       </div>`;
  }

  // Makro-Balken
  const macroWrap = document.getElementById('nut-macros');
  if (macroWrap) {
    macroWrap.innerHTML = MACROS.map(m => {
      const have = Math.round(totals[m.key]), goal = goals[m.key] || 0;
      const pct = goal > 0 ? Math.min(100, Math.round((have / goal) * 100)) : 0;
      return `<div class="macro">
        <div class="macro-top"><span>${m.label}</span><span class="macro-val">${have} / ${goal} g</span></div>
        <div class="macro-track"><div class="macro-fill" style="width:${pct}%;background:${m.color}"></div></div>
      </div>`;
    }).join('');
  }

  // Mahlzeiten
  const mealsWrap = document.getElementById('nut-meals');
  if (mealsWrap) {
    mealsWrap.innerHTML = MEALS.map(meal => {
      const entries = nutDayEntries(data, nutDate).filter(e => e.meal === meal.key);
      const sub = entries.reduce((s, e) => s + (+e.kcal || 0), 0);
      const rows = entries.length ? entries.map(e => `
        <div class="nut-entry" onclick="openFoodModal('${meal.key}','${e.id}')" role="button">
          <div class="ne-info">
            <span class="ne-name">${escapeHtml(e.name || 'Eintrag')}</span>
            <span class="ne-macros">E ${Math.round(e.protein || 0)} · KH ${Math.round(e.carbs || 0)} · F ${Math.round(e.fat || 0)} g</span>
          </div>
          <span class="ne-kcal">${Math.round(e.kcal || 0)} kcal</span>
          <button class="ne-del" onclick="event.stopPropagation(); nutDeleteEntry('${e.id}')" aria-label="Eintrag löschen">✕</button>
        </div>`).join('')
        : '<div class="nut-empty">Noch nichts erfasst</div>';
      return `<div class="nut-meal">
        <div class="nm-head">
          <span class="nm-title">${meal.emoji} ${meal.label}</span>
          <span class="nm-sub">${Math.round(sub)} kcal</span>
        </div>
        ${rows}
        <button class="nm-add" onclick="openFoodModal('${meal.key}')">+ Hinzufügen</button>
      </div>`;
    }).join('');
  }

  // Ziel-Modus-Hinweis
  const gi = document.getElementById('nut-goal-info');
  if (gi) gi.textContent = data.nutrition.goals.mode === 'auto'
    ? `Automatisches Ziel: ${goals.kcal} kcal/Tag`
    : `Manuelles Ziel: ${goals.kcal} kcal/Tag`;
}

// ── Lebensmittel hinzufügen / bearbeiten (Modal) ──
function openFoodModal(meal, entryId) {
  nutModalMeal = meal;
  const data = loadData();
  const editing = entryId ? data.nutrition.log.find(e => e.id === entryId) : null;
  const root = document.getElementById('nut-modal-root');
  if (!root) return;
  document.body.classList.add('nut-modal-open');   // Hintergrund-Scroll sperren

  const savedFoods = data.nutrition.foods.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
  const savedHtml = savedFoods.length ? savedFoods.map(f => `
    <button type="button" class="saved-food" onclick="nutPickSaved('${f.id}')">
      <span class="sf-name">${escapeHtml(f.name)}</span>
      <span class="sf-kcal">${Math.round(f.kcal || 0)} kcal</span>
      <span class="sf-del" onclick="event.stopPropagation(); nutDeleteFood('${f.id}')" aria-label="Löschen">✕</span>
    </button>`).join('') : '<p class="nut-empty">Noch keine gespeicherten Lebensmittel.</p>';

  root.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeFoodModal()">
    <div class="modal-sheet" role="dialog" aria-label="Lebensmittel hinzufügen">
      <div class="modal-head">
        <h3>${editing ? 'Eintrag bearbeiten' : 'Hinzufügen'}</h3>
        <button class="modal-x" onclick="closeFoodModal()" aria-label="Schließen">✕</button>
      </div>
      ${editing ? '' : `
      <div class="saved-foods-block">
        <div class="sfb-label">Meine Lebensmittel</div>
        <div class="saved-foods">${savedHtml}</div>
      </div>
      <div class="modal-divider"><span>oder neu eingeben</span></div>`}
      <div class="modal-form">
        <label>Bezeichnung
          <input id="nf-name" class="input-field" type="text" placeholder="z. B. Haferflocken mit Milch" value="${editing ? escapeHtml(editing.name || '') : ''}">
        </label>
        <label>Kalorien (kcal)
          <input id="nf-kcal" class="input-field" type="number" inputmode="decimal" min="0" placeholder="0" value="${editing ? (editing.kcal ?? '') : ''}">
        </label>
        <div class="macro-inputs">
          <label>Eiweiß (g)<input id="nf-protein" class="input-field" type="number" inputmode="decimal" min="0" placeholder="0" value="${editing ? (editing.protein ?? '') : ''}"></label>
          <label>KH (g)<input id="nf-carbs" class="input-field" type="number" inputmode="decimal" min="0" placeholder="0" value="${editing ? (editing.carbs ?? '') : ''}"></label>
          <label>Fett (g)<input id="nf-fat" class="input-field" type="number" inputmode="decimal" min="0" placeholder="0" value="${editing ? (editing.fat ?? '') : ''}"></label>
        </div>
        ${editing ? '' : `<label class="chk"><input type="checkbox" id="nf-save"> In „Meine Lebensmittel" speichern</label>`}
      </div>
      <div class="modal-actions">
        ${editing ? `<button class="btn-ghost-danger" onclick="nutDeleteEntry('${editing.id}', true)">Löschen</button>` : ''}
        <button class="save-workout-btn" onclick="nutSaveEntry(${editing ? `'${editing.id}'` : 'null'})">${editing ? 'Speichern' : 'Hinzufügen'}</button>
      </div>
    </div>
  </div>`;
  setTimeout(() => { const n = document.getElementById('nf-name'); if (n && !editing) n.focus(); }, 50);
}

function closeFoodModal() {
  const root = document.getElementById('nut-modal-root');
  if (root) root.innerHTML = '';
  nutModalMeal = null;
  document.body.classList.remove('nut-modal-open');   // Hintergrund-Scroll wieder freigeben
}

function nutPickSaved(id) {
  const data = loadData();
  const f = data.nutrition.foods.find(x => x.id === id);
  if (!f) return;
  const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = (v ?? 0); };
  set('nf-name', f.name); set('nf-kcal', f.kcal); set('nf-protein', f.protein); set('nf-carbs', f.carbs); set('nf-fat', f.fat);
}

function nutNum(id) { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? 0 : Math.max(0, v); }

function nutSaveEntry(entryId) {
  const name = val('nf-name');
  const kcal = nutNum('nf-kcal');
  if (!name) { showToast('Bitte eine Bezeichnung eingeben', '#c46a04'); return; }
  if (!kcal) { showToast('Bitte Kalorien eingeben', '#c46a04'); return; }
  const data = loadData();
  const fields = { name, kcal, protein: nutNum('nf-protein'), carbs: nutNum('nf-carbs'), fat: nutNum('nf-fat') };

  if (entryId) {
    const e = data.nutrition.log.find(x => x.id === entryId);
    if (e) Object.assign(e, fields);
  } else {
    data.nutrition.log.push({ id: uid('n'), date: nutDate, meal: nutModalMeal || 'snack', ...fields });
    const save = document.getElementById('nf-save');
    if (save && save.checked && !data.nutrition.foods.some(f => (f.name || '').toLowerCase() === name.toLowerCase())) {
      data.nutrition.foods.push({ id: uid('f'), ...fields });
    }
  }
  saveData(data);
  closeFoodModal();
  renderNutrition();
  if (typeof renderDashboard === 'function' && document.getElementById('page-dashboard')?.classList.contains('active')) renderDashboard();
  showToast(entryId ? '✓ Gespeichert' : '✓ Hinzugefügt');
}

function nutDeleteEntry(id, fromModal) {
  const data = loadData();
  const i = data.nutrition.log.findIndex(e => e.id === id);
  if (i < 0) return;
  data.nutrition.log.splice(i, 1);
  saveData(data);
  if (fromModal) closeFoodModal();
  renderNutrition();
  showToast('Eintrag gelöscht', '#6d5a67');
}

function nutDeleteFood(id) {
  const data = loadData();
  const i = data.nutrition.foods.findIndex(f => f.id === id);
  if (i < 0) return;
  data.nutrition.foods.splice(i, 1);
  saveData(data);
  openFoodModal(nutModalMeal);   // Modal neu zeichnen
}

// ── Tagesziel einstellen (Modal: automatisch / manuell) ──
function openNutGoals() {
  const data = loadData();
  const g = data.nutrition.goals;
  const auto = computeAutoGoals(data);
  const root = document.getElementById('nut-modal-root');
  if (!root) return;
  document.body.classList.add('nut-modal-open');   // Hintergrund-Scroll sperren
  const actOpts = [
    { v: 1.2,   t: 'wenig (Bürojob)' },
    { v: 1.375, t: 'leicht aktiv (1–3×/Woche)' },
    { v: 1.55,  t: 'aktiv (3–5×/Woche)' },
    { v: 1.725, t: 'sehr aktiv (6–7×/Woche)' },
  ];
  root.innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeFoodModal()">
    <div class="modal-sheet" role="dialog" aria-label="Tagesziel">
      <div class="modal-head"><h3>Tagesziel</h3><button class="modal-x" onclick="closeFoodModal()" aria-label="Schließen">✕</button></div>
      <div class="mode-seg">
        <button class="ms-btn ${g.mode === 'auto' ? 'sel' : ''}" onclick="setNutMode('auto')">Automatisch</button>
        <button class="ms-btn ${g.mode === 'manual' ? 'sel' : ''}" onclick="setNutMode('manual')">Manuell</button>
      </div>

      <div id="nut-auto-block" style="${g.mode === 'auto' ? '' : 'display:none'}">
        <p class="nut-hint">Wir berechnen deinen Bedarf aus deinem Gewicht, Ziel & diesen Angaben.</p>
        <div class="macro-inputs">
          <label>Geschlecht
            <select id="ng-sex" class="input-field" onchange="nutGoalsLivePreview()">
              <option value="female" ${g.sex === 'female' ? 'selected' : ''}>weiblich</option>
              <option value="male" ${g.sex === 'male' ? 'selected' : ''}>männlich</option>
            </select>
          </label>
          <label>Alter<input id="ng-age" class="input-field" type="number" inputmode="numeric" value="${g.age}" oninput="nutGoalsLivePreview()"></label>
          <label>Größe (cm)<input id="ng-height" class="input-field" type="number" inputmode="numeric" value="${g.height}" oninput="nutGoalsLivePreview()"></label>
        </div>
        <label>Aktivität
          <select id="ng-activity" class="input-field" onchange="nutGoalsLivePreview()">
            ${actOpts.map(o => `<option value="${o.v}" ${Math.abs(g.activity - o.v) < 0.01 ? 'selected' : ''}>${o.t}</option>`).join('')}
          </select>
        </label>
        <label class="chk"><input type="checkbox" id="ng-bf" ${g.breastfeeding ? 'checked' : ''} onchange="nutGoalsLivePreview()"> Ich stille (+ Energiebedarf)</label>
        <div class="auto-preview" id="ng-preview">
          <strong id="ngp-kcal">${auto.kcal}</strong> kcal · E ${auto.protein} · KH ${auto.carbs} · F ${auto.fat} g
        </div>
      </div>

      <div id="nut-manual-block" style="${g.mode === 'manual' ? '' : 'display:none'}">
        <p class="nut-hint">Trage deine eigenen Tageswerte ein.</p>
        <label>Kalorien (kcal)<input id="ng-kcal" class="input-field" type="number" inputmode="numeric" value="${g.kcal}"></label>
        <div class="macro-inputs">
          <label>Eiweiß (g)<input id="ng-protein" class="input-field" type="number" value="${g.protein}"></label>
          <label>KH (g)<input id="ng-carbs" class="input-field" type="number" value="${g.carbs}"></label>
          <label>Fett (g)<input id="ng-fat" class="input-field" type="number" value="${g.fat}"></label>
        </div>
      </div>

      <div class="modal-actions"><button class="save-workout-btn" onclick="saveNutGoals()">Ziel speichern</button></div>
    </div>
  </div>`;
}

let _pendingNutMode = null;
function setNutMode(mode) {
  _pendingNutMode = mode;
  document.querySelectorAll('.ms-btn').forEach(b => b.classList.toggle('sel', b.textContent.toLowerCase().startsWith(mode === 'auto' ? 'auto' : 'man')));
  const a = document.getElementById('nut-auto-block'), m = document.getElementById('nut-manual-block');
  if (a) a.style.display = mode === 'auto' ? '' : 'none';
  if (m) m.style.display = mode === 'manual' ? '' : 'none';
}

function nutGoalsLivePreview() {
  const data = loadData();
  const g = { ...data.nutrition.goals,
    sex: document.getElementById('ng-sex')?.value || 'female',
    age: parseFloat(document.getElementById('ng-age')?.value) || 30,
    height: parseFloat(document.getElementById('ng-height')?.value) || 168,
    activity: parseFloat(document.getElementById('ng-activity')?.value) || 1.375,
    breastfeeding: !!document.getElementById('ng-bf')?.checked };
  const auto = computeAutoGoals({ ...data, nutrition: { ...data.nutrition, goals: g } });
  const el = document.getElementById('ng-preview');
  if (el) el.innerHTML = `<strong>${auto.kcal}</strong> kcal · E ${auto.protein} · KH ${auto.carbs} · F ${auto.fat} g`;
}

function saveNutGoals() {
  const data = loadData();
  const g = data.nutrition.goals;
  const mode = _pendingNutMode || g.mode;
  g.mode = mode;
  if (mode === 'auto') {
    g.sex = document.getElementById('ng-sex')?.value || 'female';
    g.age = parseFloat(document.getElementById('ng-age')?.value) || g.age;
    g.height = parseFloat(document.getElementById('ng-height')?.value) || g.height;
    g.activity = parseFloat(document.getElementById('ng-activity')?.value) || g.activity;
    g.breastfeeding = !!document.getElementById('ng-bf')?.checked;
  } else {
    g.kcal = parseFloat(document.getElementById('ng-kcal')?.value) || g.kcal;
    g.protein = parseFloat(document.getElementById('ng-protein')?.value) || g.protein;
    g.carbs = parseFloat(document.getElementById('ng-carbs')?.value) || g.carbs;
    g.fat = parseFloat(document.getElementById('ng-fat')?.value) || g.fat;
  }
  _pendingNutMode = null;
  saveData(data);
  closeFoodModal();
  renderNutrition();
  showToast('✓ Tagesziel gespeichert');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const pref = localStorage.getItem('themePref');
  applyTheme(['light', 'dark', 'masc'].includes(pref) ? pref : loadData().settings.theme);

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Nur bei einem echten Update neu laden (nicht bei der Erstinstallation)
      if (hadController && !reloading) { reloading = true; location.reload(); }
    });
    navigator.serviceWorker.register('./sw.js')
      .then(reg => { try { reg.update(); } catch (e) {} })
      .catch(() => {});
    // beim Zurückkehren in die App auf Updates prüfen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then(r => { if (r) try { r.update(); } catch (e) {} }).catch(() => {});
      }
    });
  }

  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.page)));

  document.querySelectorAll('.chart-btn').forEach(btn =>
    btn.addEventListener('click', () => switchChart(btn.dataset.chart)));

  document.getElementById('ex-picker')?.addEventListener('change', () => {
    if (chartInstance) chartInstance.destroy();
    renderStrengthChart(loadData());
  });

  const tt = document.getElementById('theme-toggle');
  if (tt) tt.addEventListener('click', toggleTheme);

  const st = document.getElementById('skin-toggle');
  if (st) st.addEventListener('click', toggleSkin);

  document.querySelectorAll('.app-version').forEach(el => { el.textContent = `Strong Gnome · ${APP_VERSION}`; });

  initFirebase();   // entscheidet: Login / Onboarding / App
});
