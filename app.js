// ── State ──
const BOOKS = [
  { id: 'genesis', label: 'Genesis', file: 'genesis.json' },
  { id: 'psalms', label: 'Psalms', file: 'psalms.json' },
  { id: 'matthew', label: 'Matthew', file: 'matthew.json' },
];

const state = {
  currentView: 'reader',
  reader: { bookIdx: 0, chapter: 0, data: null },
  stars: parseInt(localStorage.getItem('stars') || '0'),
  notes: JSON.parse(localStorage.getItem('notes') || '{}'),
  settings: JSON.parse(localStorage.getItem('settings') || '{"theme":"light","fontSize":18}'),
  noteEditing: null, // { key, verseNum, verseText }
};

// ── Persist ──
function save() {
  localStorage.setItem('stars', state.stars);
  localStorage.setItem('notes', JSON.stringify(state.notes));
  localStorage.setItem('settings', JSON.stringify(state.settings));
}

// ── Navigation ──
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

// ── READER ──
async function loadBook(idx) {
  state.reader.bookIdx = idx;
  state.reader.chapter = 0;
  const book = BOOKS[idx];
  document.getElementById('book-label').textContent = book.label;
  try {
    const res = await fetch(book.file);
    state.reader.data = await res.json();
  } catch (e) {
    document.getElementById('chapter-content').innerHTML = '<p style="padding:20px;color:var(--text-muted)">Could not load book.</p>';
    return;
  }
  renderChapter();
}

function renderChapter() {
  const data = state.reader.data;
  if (!data) return;
  const ch = data.chapters[state.reader.chapter];
  const bookLabel = BOOKS[state.reader.bookIdx].label;
  document.getElementById('chapter-label').textContent = `Chapter ${ch.chapter}`;

  // Prev/next buttons
  document.getElementById('prev-ch').disabled = state.reader.chapter === 0;
  document.getElementById('next-ch').disabled = state.reader.chapter === data.chapters.length - 1;

  const container = document.getElementById('chapter-content');
  container.innerHTML = '';

  const heading = document.createElement('p');
  heading.className = 'chapter-heading';
  heading.textContent = `${bookLabel} — Chapter ${ch.chapter}`;
  container.appendChild(heading);

  ch.verses.forEach(v => {
    const noteKey = `${bookLabel}:${ch.chapter}:${v.verse}`;
    const hasNote = !!state.notes[noteKey];

    const row = document.createElement('div');
    row.className = 'verse-row' + (hasNote ? ' has-note' : '');
    row.dataset.key = noteKey;
    row.dataset.verse = v.verse;
    row.dataset.text = v.text;

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

    // Long-press / hold to open note editor
    let holdTimer;
    row.addEventListener('pointerdown', () => {
      holdTimer = setTimeout(() => openNoteEditor(noteKey, v.verse, v.text, bookLabel, ch.chapter), 500);
    });
    row.addEventListener('pointerup', () => clearTimeout(holdTimer));
    row.addEventListener('pointercancel', () => clearTimeout(holdTimer));
    row.addEventListener('pointermove', () => clearTimeout(holdTimer));

    container.appendChild(row);
  });

  container.scrollTop = 0;
}

document.getElementById('prev-ch').addEventListener('click', () => {
  if (state.reader.chapter > 0) { state.reader.chapter--; renderChapter(); }
});
document.getElementById('next-ch').addEventListener('click', () => {
  const data = state.reader.data;
  if (data && state.reader.chapter < data.chapters.length - 1) { state.reader.chapter++; renderChapter(); }
});

// Book picker
const bookBtn = document.getElementById('book-btn');
const bookPicker = document.getElementById('book-picker');
const bookList = document.getElementById('book-list');

BOOKS.forEach((b, i) => {
  const btn = document.createElement('button');
  btn.textContent = b.label;
  btn.dataset.idx = i;
  if (i === 0) btn.classList.add('active-book');
  btn.addEventListener('click', () => {
    bookPicker.classList.add('hidden');
    bookList.querySelectorAll('button').forEach(b => b.classList.remove('active-book'));
    btn.classList.add('active-book');
    loadBook(i);
  });
  bookList.appendChild(btn);
});

bookBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  bookPicker.classList.toggle('hidden');
});
document.addEventListener('click', () => bookPicker.classList.add('hidden'));
bookPicker.addEventListener('click', e => e.stopPropagation());

// ── STARS ──
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

// ── NOTES ──
function noteRef(key) {
  const [book, ch, v] = key.split(':');
  return `${book} ${ch}:${v}`;
}

function openNoteEditor(key, verseNum, verseText, bookLabel, chNum) {
  state.noteEditing = { key, verseNum, verseText };
  document.getElementById('note-editor-ref').textContent = `${bookLabel} ${chNum}:${verseNum}`;
  document.getElementById('note-editor-verse').textContent = verseText;
  const existing = state.notes[key];
  document.getElementById('note-editor-input').value = existing ? existing.text : '';
  document.getElementById('note-editor').classList.remove('hidden');
  setTimeout(() => document.getElementById('note-editor-input').focus(), 100);
}

document.getElementById('note-save').addEventListener('click', () => {
  const { key, verseNum, verseText } = state.noteEditing;
  const text = document.getElementById('note-editor-input').value.trim();
  if (text) {
    state.notes[key] = { text, verseText };
  } else {
    delete state.notes[key];
  }
  save();
  document.getElementById('note-editor').classList.add('hidden');
  renderChapter(); // refresh note dots
  if (state.currentView === 'notes') renderNotes();
});

document.getElementById('note-cancel').addEventListener('click', () => {
  document.getElementById('note-editor').classList.add('hidden');
});

function renderNotes() {
  const list = document.getElementById('notes-list');
  const empty = document.getElementById('notes-empty');
  list.innerHTML = '';
  const keys = Object.keys(state.notes);
  if (keys.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  keys.forEach(key => {
    const note = state.notes[key];
    const card = document.createElement('div');
    card.className = 'note-card';

    const ref = document.createElement('div');
    ref.className = 'note-card-ref';
    ref.textContent = noteRef(key);

    const verse = document.createElement('div');
    verse.className = 'note-card-verse';
    verse.textContent = note.verseText;

    const text = document.createElement('div');
    text.className = 'note-card-text';
    text.textContent = note.text;

    const actions = document.createElement('div');
    actions.className = 'note-card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'note-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      const [book, ch, v] = key.split(':');
      openNoteEditor(key, v, note.verseText, book, ch);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'note-delete-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      delete state.notes[key];
      save();
      renderNotes();
      if (state.currentView === 'reader') renderChapter();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    card.appendChild(ref);
    card.appendChild(verse);
    card.appendChild(text);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

// ── SETTINGS ──
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

// ── Init ──
applySettings();
loadBook(0);
