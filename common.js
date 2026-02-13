// Shared storage keys and helper methods for NoteNest pages.
const NOTE_KEYS = {
  session: 'notenestSession',
  darkMode: 'notenestDarkMode',
  notesCache: 'notenestScienceNotesCache',
  usersCache: 'notenestUsersCache'
};

const ADMIN_EMAIL = 'kumarsinghr27314@gmail.com';

// Shared cloud endpoints used for cross-device sync and backup.
const CLOUD_ENDPOINT = 'https://jsonblob.com/api/jsonBlob/019c582e-8052-7ada-a9f9-6066930c1013';
const CLOUD_BACKUP_ENDPOINT = 'https://jsonblob.com/api/jsonBlob/019c5837-80d0-7afc-bf70-613b0280d9c2';

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

function sanitizeNotesMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const clean = {};

  SCIENCE_CHAPTERS.forEach((chapter) => {
    const data = raw[chapter];
    if (!data || typeof data.base64 !== 'string') return;
    clean[chapter] = {
      filename: data.filename || `${chapter}.pdf`,
      base64: data.base64,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
      size: data.size || 0,
      source: data.source || 'cloud'
    };
  });

  return clean;
}

function sanitizeUsersList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && item.name)
    .map((item) => ({
      name: String(item.name),
      email: String(item.email || ''),
      ip: String(item.ip || 'Not available'),
      lastLoginAt: String(item.lastLoginAt || new Date().toISOString()),
      loginCount: Number(item.loginCount || 1)
    }));
}

function getCachedNotes() {
  return JSON.parse(localStorage.getItem(NOTE_KEYS.notesCache) || '{}');
}

function setCachedNotes(map) {
  localStorage.setItem(NOTE_KEYS.notesCache, JSON.stringify(map));
}

function getCachedUsers() {
  return JSON.parse(localStorage.getItem(NOTE_KEYS.usersCache) || '[]');
}

function setCachedUsers(users) {
  localStorage.setItem(NOTE_KEYS.usersCache, JSON.stringify(users));
}

/* ------------------------------
   IndexedDB for larger PDFs
   ------------------------------ */
const localDb = {
  dbName: 'NoteNestLocalDB',
  storeName: 'scienceNotes',

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

  async getAll() {
    if (!window.indexedDB) return getCachedNotes();
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).getAll();
      req.onsuccess = () => {
        const map = {};
        req.result.forEach((item) => {
          map[item.chapter] = {
            filename: item.filename,
            base64: item.base64,
            uploadedAt: item.uploadedAt,
            size: item.size || 0,
            source: item.source || 'local'
          };
        });
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async put(chapter, data) {
    if (!window.indexedDB) {
      const map = getCachedNotes();
      map[chapter] = data;
      setCachedNotes(map);
      return;
    }

    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put({ chapter, ...data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(chapter) {
    if (!window.indexedDB) {
      const map = getCachedNotes();
      delete map[chapter];
      setCachedNotes(map);
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

function normalizeCloudState(data) {
  // Backward compatibility: old schema had notes directly at root.
  const looksLikeOldSchema = data && typeof data === 'object' && !data.notes;
  if (looksLikeOldSchema) {
    return {
      notes: sanitizeNotesMap(data),
      users: [],
      updatedAt: new Date().toISOString()
    };
  }

  return {
    notes: sanitizeNotesMap(data?.notes),
    users: sanitizeUsersList(data?.users),
    updatedAt: String(data?.updatedAt || new Date().toISOString())
  };
}

async function readCloudState() {
  const response = await fetch(CLOUD_ENDPOINT, { method: 'GET', cache: 'no-store' });
  if (!response.ok) throw new Error('Cloud load failed.');
  const raw = await response.json();
  return normalizeCloudState(raw);
}

async function writeCloudState(state) {
  const response = await fetch(CLOUD_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notes: state.notes || {},
      users: state.users || [],
      updatedAt: new Date().toISOString()
    })
  });

  if (!response.ok) throw new Error('Cloud save failed.');
}

async function getPdfMap() {
  const localNotes = sanitizeNotesMap(await localDb.getAll());

  try {
    const cloudState = await readCloudState();
    const merged = { ...cloudState.notes, ...localNotes };
    setCachedNotes(merged);
    setCachedUsers(cloudState.users);
    return merged;
  } catch (error) {
    return { ...getCachedNotes(), ...localNotes };
  }
}

async function savePdf(chapter, data) {
  const note = {
    filename: data.filename,
    base64: data.base64,
    uploadedAt: data.uploadedAt || new Date().toISOString(),
    size: data.size || 0,
    source: 'local'
  };

  await localDb.put(chapter, note);

  const merged = await getPdfMap();
  merged[chapter] = { ...note, source: 'cloud' };

  let cloudSynced = false;
  try {
    const state = await readCloudState();
    state.notes[chapter] = merged[chapter];
    await writeCloudState(state);
    cloudSynced = true;
  } catch (error) {
    cloudSynced = false;
  }

  setCachedNotes(merged);
  return { cloudSynced };
}

async function deletePdf(chapter) {
  await localDb.delete(chapter);

  const merged = await getPdfMap();
  delete merged[chapter];

  let cloudSynced = false;
  try {
    const state = await readCloudState();
    delete state.notes[chapter];
    await writeCloudState(state);
    cloudSynced = true;
  } catch (error) {
    cloudSynced = false;
  }

  setCachedNotes(merged);
  return { cloudSynced };
}

async function exportBackupFile() {
  const notes = await getPdfMap();
  const users = getCachedUsers();
  const payload = {
    app: 'NoteNest',
    exportedAt: new Date().toISOString(),
    notes,
    users
  };

  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'notenest-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importBackupFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const notes = sanitizeNotesMap(parsed?.notes);
  const users = sanitizeUsersList(parsed?.users || []);

  for (const chapter of Object.keys(notes)) {
    await localDb.put(chapter, notes[chapter]);
  }

  setCachedNotes(notes);
  setCachedUsers(users);

  try {
    const cloudState = await readCloudState();
    cloudState.notes = { ...cloudState.notes, ...notes };
    cloudState.users = users.length ? users : cloudState.users;
    await writeCloudState(cloudState);
  } catch (error) {
    // Ignore: local import still succeeds.
  }
}

async function createCloudBackup() {
  const notes = await getPdfMap();
  const users = getCachedUsers();
  const response = await fetch(CLOUD_BACKUP_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: 'NoteNest', backupAt: new Date().toISOString(), notes, users })
  });
  if (!response.ok) throw new Error('Backup sync failed.');
}

async function restoreCloudBackup() {
  const response = await fetch(CLOUD_BACKUP_ENDPOINT, { method: 'GET', cache: 'no-store' });
  if (!response.ok) throw new Error('Backup fetch failed.');

  const parsed = await response.json();
  const notes = sanitizeNotesMap(parsed?.notes);
  const users = sanitizeUsersList(parsed?.users || []);

  for (const chapter of Object.keys(notes)) {
    await localDb.put(chapter, notes[chapter]);
  }

  setCachedNotes(notes);
  setCachedUsers(users);

  try {
    const cloudState = await readCloudState();
    cloudState.notes = { ...cloudState.notes, ...notes };
    if (users.length) cloudState.users = users;
    await writeCloudState(cloudState);
  } catch (error) {
    // Local restore already completed.
  }
}

async function getPublicIp() {
  try {
    const response = await fetch('https://api64.ipify.org?format=json');
    if (!response.ok) return 'Not available';
    const data = await response.json();
    return data.ip || 'Not available';
  } catch (error) {
    return 'Not available';
  }
}

async function registerUserLogin(user) {
  const loginUser = {
    name: String(user?.name || 'Unknown'),
    email: String(user?.email || ''),
    ip: await getPublicIp(),
    lastLoginAt: new Date().toISOString(),
    loginCount: 1
  };

  const cachedUsers = sanitizeUsersList(getCachedUsers());
  const cacheIdx = cachedUsers.findIndex((item) => item.name === loginUser.name && item.email === loginUser.email);
  if (cacheIdx >= 0) {
    cachedUsers[cacheIdx].lastLoginAt = loginUser.lastLoginAt;
    cachedUsers[cacheIdx].ip = loginUser.ip;
    cachedUsers[cacheIdx].loginCount = Number(cachedUsers[cacheIdx].loginCount || 1) + 1;
  } else {
    cachedUsers.push(loginUser);
  }
  setCachedUsers(cachedUsers);

  try {
    const state = await readCloudState();
    const users = sanitizeUsersList(state.users);
    const idx = users.findIndex((item) => item.name === loginUser.name && item.email === loginUser.email);

    if (idx >= 0) {
      users[idx].lastLoginAt = loginUser.lastLoginAt;
      users[idx].ip = loginUser.ip;
      users[idx].loginCount = Number(users[idx].loginCount || 1) + 1;
    } else {
      users.push(loginUser);
    }

    state.users = users;
    await writeCloudState(state);
    setCachedUsers(users);
  } catch (error) {
    // Keep local user log if cloud is unavailable.
  }
}

async function getUserList() {
  try {
    const state = await readCloudState();
    setCachedUsers(state.users);
    return state.users;
  } catch (error) {
    return sanitizeUsersList(getCachedUsers());
  }
}
