// ── Prevent double-tap zoom ──
let lastTap = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTap < 300) e.preventDefault();
  lastTap = now;
}, { passive: false });

// ── State ──
let BOOKS_INDEX = [];

const state = {
  currentView: 'reader',
  reader: { bookIdx: 0, chapter: 0, data: null, lang: 'en' },
  activTestament: 'OT',
  stars: parseInt(localStorage.getItem('stars') || '0'),
  notes: JSON.parse(localStorage.getItem('notes') || '{}'),
  settings: JSON.parse(localStorage.getItem('settings') || '{"theme":"dark","fontSize":18}'),
  noteEditing: null,
};

function save() {
  localStorage.setItem('stars', state.stars);
  localStorage.setItem('notes', JSON.stringify(state.notes));
  localStorage.setItem('settings', JSON.stringify(state.settings));
}

// ── Bottom nav ──
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.view;
    switchView(v);
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  });
});

function switchView(name) {
  state.currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'notes') renderNotes();
}

// ── Load books index ──
async function init() {
  applySettings();
  const res = await fetch('data/books.json');
  BOOKS_INDEX = await res.json();
  buildBookList();
  await loadBook(0);
}

// ── Book picker ──
const bookBtn = document.getElementById('book-btn');
const bookPicker = document.getElementById('book-picker');
const bookList = document.getElementById('book-list');

bookBtn.addEventListener('click', () => {
  closePickers();
  bookPicker.classList.toggle('hidden');
});
document.getElementById('book-close').addEventListener('click', () => bookPicker.classList.add('hidden'));

// Testament tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    state.activTestament = btn.dataset.testament;
    renderBookList();
  });
});

function buildBookList() {
  renderBookList();
}

function renderBookList() {
  bookList.innerHTML = '';
  const filtered = BOOKS_INDEX.filter(b => b.testament === state.activTestament);
  filtered.forEach((book, _) => {
    const idx = BOOKS_INDEX.indexOf(book);
    const item = document.createElement('button');
    item.className = 'book-item' + (idx === state.reader.bookIdx ? ' active-book' : '');
    item.innerHTML = `<span>${book.label}</span><span class="book-ch-count">${book.chapters} ch</span>`;
    item.addEventListener('click', () => {
      bookPicker.classList.add('hidden');
      loadBook(idx);
    });
    bookList.appendChild(item);
  });
}

// ── Chapter picker ──
const chapterBtn = document.getElementById('chapter-btn');
const chapterPicker = document.getElementById('chapter-picker');
const chapterGrid = document.getElementById('chapter-grid');

chapterBtn.addEventListener('click', () => {
  closePickers();
  buildChapterGrid();
  chapterPicker.classList.toggle('hidden');
});
document.getElementById('chapter-close').addEventListener('click', () => chapterPicker.classList.add('hidden'));

function buildChapterGrid() {
  const book = BOOKS_INDEX[state.reader.bookIdx];
  document.getElementById('chapter-picker-title').textContent = book.label;
  chapterGrid.innerHTML = '';
  for (let i = 0; i < book.chapters; i++) {
    const btn = document.createElement('button');
    btn.className = 'ch-btn' + (i === state.reader.chapter ? ' active-ch' : '');
    btn.textContent = i + 1;
    btn.addEventListener('click', () => {
      state.reader.chapter = i;
      chapterPicker.classList.add('hidden');
      renderChapter();
    });
    chapterGrid.appendChild(btn);
  }
}

function closePickers() {
  bookPicker.classList.add('hidden');
  chapterPicker.classList.add('hidden');
}

// Close pickers on content tap
document.getElementById('chapter-content').addEventListener('click', closePickers);

// ── Load book ──
async function loadBook(idx) {
  state.reader.bookIdx = idx;
  state.reader.chapter = 0;
  const book = BOOKS_INDEX[idx];
  document.getElementById('book-label').textContent = book.label;
  await loadChapterData();
  renderChapter();
  renderBookList(); // refresh active state
}

async function loadChapterData() {
  const book = BOOKS_INDEX[state.reader.bookIdx];
  const lang = state.reader.lang;
  try {
    const res = await fetch(`data/${lang}/${book.id}.json`);
    state.reader.data = await res.json();
  } catch (e) {
    state.reader.data = null;
  }
}

// ── Language switcher ──
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b === btn));
    state.reader.lang = btn.dataset.lang;
    await loadChapterData();
    renderChapter();
  });
});

// ── Render chapter ──
function renderChapter() {
  const data = state.reader.data;
  const book = BOOKS_INDEX[state.reader.bookIdx];
  document.getElementById('chapter-label').textContent = `Chapter ${state.reader.chapter + 1}`;

  const container = document.getElementById('chapter-content');
  container.innerHTML = '';

  if (!data) {
    container.innerHTML = '<p style="padding:20px;color:var(--text-muted)">Could not load.</p>';
    return;
  }

  const ch = data.chapters[state.reader.chapter];

  const heading = document.createElement('p');
  heading.className = 'chapter-heading';
  heading.textContent = `${book.label} — Chapter ${ch.chapter}`;
  container.appendChild(heading);

  ch.verses.forEach(v => {
    const noteKey = `${book.id}:${ch.chapter}:${v.verse}`;
    const hasNote = !!state.notes[noteKey];

    const row = document.createElement('div');
    row.className = 'verse-row' + (hasNote ? ' has-note' : '');

    const num = document.createElement('span');
    num.className = 'verse-num';
    num.textContent = v.verse;

    const text = document.createElement('span');
    text.className = 'verse-text';
    text.textContent = v.text;

    row.appendChild(num);
    row.appendChild(text);

    if (hasNote) {
      const dot = document.createElement('span');
      dot.className = 'verse-note-dot';
      row.appendChild(dot);
    }

    // Long-press to open note editor
    let holdTimer;
    row.addEventListener('pointerdown', () => {
      holdTimer = setTimeout(() => openNoteEditor(noteKey, v.verse, v.text, book.label, ch.chapter), 500);
    });
    ['pointerup','pointercancel','pointermove'].forEach(e => row.addEventListener(e, () => clearTimeout(holdTimer)));

    container.appendChild(row);
  });

  container.scrollTop = 0;
}

// ── Note editor ──
function openNoteEditor(key, verseNum, verseText, bookLabel, chNum) {
  state.noteEditing = { key, verseNum, verseText };
  document.getElementById('note-editor-ref').textContent = `${bookLabel} ${chNum}:${verseNum}`;
  document.getElementById('note-editor-verse').textContent = verseText;
  document.getElementById('note-editor-input').value = state.notes[key]?.text || '';
  document.getElementById('note-editor').classList.remove('hidden');
  setTimeout(() => document.getElementById('note-editor-input').focus(), 100);
}

document.getElementById('note-save').addEventListener('click', () => {
  const { key, verseText } = state.noteEditing;
  const text = document.getElementById('note-editor-input').value.trim();
  if (text) state.notes[key] = { text, verseText };
  else delete state.notes[key];
  save();
  document.getElementById('note-editor').classList.add('hidden');
  renderChapter();
  if (state.currentView === 'notes') renderNotes();
});

document.getElementById('note-cancel').addEventListener('click', () => {
  document.getElementById('note-editor').classList.add('hidden');
});

// ── Notes list ──
function renderNotes() {
  const list = document.getElementById('notes-list');
  const empty = document.getElementById('notes-empty');
  list.innerHTML = '';
  const keys = Object.keys(state.notes);
  if (!keys.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  keys.forEach(key => {
    const note = state.notes[key];
    const [bookId, ch, v] = key.split(':');
    const bookInfo = BOOKS_INDEX.find(b => b.id === bookId);
    const label = bookInfo ? bookInfo.label : bookId;

    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="note-card-ref">${label} ${ch}:${v}</div>
      <div class="note-card-verse">${note.verseText}</div>
      <div class="note-card-text">${note.text}</div>
      <div class="note-card-actions">
        <button class="note-edit-btn">Edit</button>
        <button class="note-delete-btn">Delete</button>
      </div>`;
    card.querySelector('.note-edit-btn').addEventListener('click', () => {
      openNoteEditor(key, v, note.verseText, label, ch);
      // switch to reader view so editor shows
      switchView('reader');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'reader'));
    });
    card.querySelector('.note-delete-btn').addEventListener('click', () => {
      delete state.notes[key]; save(); renderNotes();
      if (state.currentView === 'reader') renderChapter();
    });
    list.appendChild(card);
  });
}

// ── Stars ──
document.getElementById('star-count').textContent = state.stars;
document.getElementById('star-tap').addEventListener('click', () => {
  state.stars++;
  document.getElementById('star-count').textContent = state.stars;
  save();
});
document.getElementById('star-reset').addEventListener('click', () => {
  state.stars = 0;
  document.getElementById('star-count').textContent = 0;
  save();
});

// ── Settings ──
function applySettings() {
  document.body.className = `theme-${state.settings.theme}`;
  document.documentElement.style.setProperty('--font-size', state.settings.fontSize + 'px');
  document.getElementById('font-display').textContent = state.settings.fontSize + 'px';
  document.getElementById('theme-light').classList.toggle('active', state.settings.theme === 'light');
  document.getElementById('theme-dark').classList.toggle('active', state.settings.theme === 'dark');
}

document.getElementById('theme-light').addEventListener('click', () => {
  state.settings.theme = 'light'; applySettings(); save();
});
document.getElementById('theme-dark').addEventListener('click', () => {
  state.settings.theme = 'dark'; applySettings(); save();
});
document.getElementById('font-up').addEventListener('click', () => {
  if (state.settings.fontSize < 28) { state.settings.fontSize += 2; applySettings(); save(); }
});
document.getElementById('font-down').addEventListener('click', () => {
  if (state.settings.fontSize > 14) { state.settings.fontSize -= 2; applySettings(); save(); }
});

// ── Start ──
init();
