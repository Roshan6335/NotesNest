// Shared storage keys and helper methods for NoteNest pages.
const NOTE_KEYS = {
  session: 'notenestSession',
  darkMode: 'notenestDarkMode',
  pdfMapCache: 'notenestSciencePdfsCache'
};

const ADMIN_EMAIL = 'kumarsinghr27314@gmail.com';

// Public cloud JSON endpoint used as shared storage across devices.
// Anyone using this website reads/writes the same chapter notes.
const CLOUD_ENDPOINT = 'https://jsonblob.com/api/jsonBlob/019c582e-8052-7ada-a9f9-6066930c1013';

const SCIENCE_CHAPTERS = [
  'Matter in Our Surroundings',
  'Is Matter Around Us Pure',
  'Atoms and Molecules',
  'Structure of the Atom',
  'The Fundamental Unit of Life',
  'Tissues',
  'Motion',
  'Force and Laws of Motion',
  'Gravitation',
  'Work and Energy',
  'Sound',
  'Improvement in Food Resources'
];

function getSession() {
  return JSON.parse(sessionStorage.getItem(NOTE_KEYS.session) || 'null');
}

function setSession(data) {
  sessionStorage.setItem(NOTE_KEYS.session, JSON.stringify(data));
}

function clearSession() {
  sessionStorage.removeItem(NOTE_KEYS.session);
}

function applyTheme() {
  const enabled = localStorage.getItem(NOTE_KEYS.darkMode) === 'true';
  document.body.classList.toggle('dark', enabled);
}

function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  applyTheme();
  toggle.addEventListener('click', () => {
    const next = !(localStorage.getItem(NOTE_KEYS.darkMode) === 'true');
    localStorage.setItem(NOTE_KEYS.darkMode, String(next));
    applyTheme();
  });
}

function logout() {
  clearSession();
  window.location.href = 'index.html';
}

function getCachedMap() {
  return JSON.parse(localStorage.getItem(NOTE_KEYS.pdfMapCache) || '{}');
}

function setCachedMap(map) {
  localStorage.setItem(NOTE_KEYS.pdfMapCache, JSON.stringify(map));
}

function sanitizeMap(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const clean = {};
  SCIENCE_CHAPTERS.forEach((chapter) => {
    const data = raw[chapter];
    if (!data) return;
    if (typeof data.base64 !== 'string') return;
    clean[chapter] = {
      filename: data.filename || `${chapter}.pdf`,
      base64: data.base64,
      uploadedAt: data.uploadedAt || new Date().toISOString()
    };
  });
  return clean;
}

async function readCloudMap() {
  const response = await fetch(CLOUD_ENDPOINT, { method: 'GET', cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load cloud notes.');
  const data = await response.json();
  return sanitizeMap(data);
}

async function writeCloudMap(map) {
  const response = await fetch(CLOUD_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(map)
  });
  if (!response.ok) throw new Error('Could not save cloud notes.');
}

async function getPdfMap() {
  try {
    const cloudMap = await readCloudMap();
    setCachedMap(cloudMap);
    return cloudMap;
  } catch (error) {
    // Offline or cloud issue: fallback to last local cache.
    return getCachedMap();
  }
}

async function savePdf(chapter, data) {
  const latestMap = await getPdfMap();
  latestMap[chapter] = {
    filename: data.filename,
    base64: data.base64,
    uploadedAt: data.uploadedAt || new Date().toISOString()
  };

  try {
    await writeCloudMap(latestMap);
  } catch (error) {
    // Keep local copy if cloud sync fails.
  }
  setCachedMap(latestMap);
}

async function deletePdf(chapter) {
  const latestMap = await getPdfMap();
  delete latestMap[chapter];

  try {
    await writeCloudMap(latestMap);
  } catch (error) {
    // Keep local deletion if cloud sync fails.
  }
  setCachedMap(latestMap);
}
