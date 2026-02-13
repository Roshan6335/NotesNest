// Shared storage keys and helper methods for NoteNest pages.
const NOTE_KEYS = {
  session: 'notenestSession',
  darkMode: 'notenestDarkMode',
  pdfMap: 'notenestSciencePdfs'
};

const ADMIN_EMAIL = 'kumarsinghr27314@gmail.com';

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

function getPdfMap() {
  return JSON.parse(localStorage.getItem(NOTE_KEYS.pdfMap) || '{}');
}

function setPdfMap(map) {
  localStorage.setItem(NOTE_KEYS.pdfMap, JSON.stringify(map));
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
