// Shared storage keys and helper methods for NoteNest pages.
const NOTE_KEYS = {
  session: 'notenestSession',
  darkMode: 'notenestDarkMode',
  pdfMapFallback: 'notenestSciencePdfsFallback'
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

/* ------------------------------
   IndexedDB storage for PDFs
   ------------------------------ */
const dbApi = {
  dbName: 'NoteNestDB',
  storeName: 'sciencePdfs',

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'chapter' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async readAll() {
    if (!window.indexedDB) {
      return JSON.parse(localStorage.getItem(NOTE_KEYS.pdfMapFallback) || '{}');
    }

    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const map = {};
        req.result.forEach((item) => {
          map[item.chapter] = {
            filename: item.filename,
            base64: item.base64,
            uploadedAt: item.uploadedAt
          };
        });
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async writeOne(chapter, data) {
    if (!window.indexedDB) {
      const map = JSON.parse(localStorage.getItem(NOTE_KEYS.pdfMapFallback) || '{}');
      map[chapter] = data;
      localStorage.setItem(NOTE_KEYS.pdfMapFallback, JSON.stringify(map));
      return;
    }

    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({ chapter, ...data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteOne(chapter) {
    if (!window.indexedDB) {
      const map = JSON.parse(localStorage.getItem(NOTE_KEYS.pdfMapFallback) || '{}');
      delete map[chapter];
      localStorage.setItem(NOTE_KEYS.pdfMapFallback, JSON.stringify(map));
      return;
    }

    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(chapter);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

async function getPdfMap() {
  return dbApi.readAll();
}

async function savePdf(chapter, data) {
  await dbApi.writeOne(chapter, data);
}

async function deletePdf(chapter) {
  await dbApi.deleteOne(chapter);
}

// Export/import so admin can move notes to another browser/device manually.
async function exportNotesData() {
  const map = await getPdfMap();
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'NoteNest',
    chapters: map
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'notenest-notes-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importNotesData(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !data.chapters || typeof data.chapters !== 'object') {
    throw new Error('Invalid backup file format.');
  }

  const chapters = data.chapters;
  for (const chapter of Object.keys(chapters)) {
    if (!SCIENCE_CHAPTERS.includes(chapter)) continue;
    await savePdf(chapter, chapters[chapter]);
  }
}
