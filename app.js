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
  if (name === 'stars') {
    // Wait one frame so the view is visible and canvas has real dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => animateStars()));
  }
}

// ── Init ──
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

bookBtn.addEventListener('click', () => { closePickers(); bookPicker.classList.toggle('hidden'); });
document.getElementById('book-close').addEventListener('click', () => bookPicker.classList.add('hidden'));

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    state.activTestament = btn.dataset.testament;
    renderBookList();
  });
});

function buildBookList() { renderBookList(); }

function renderBookList() {
  bookList.innerHTML = '';
  BOOKS_INDEX.filter(b => b.testament === state.activTestament).forEach(book => {
    const idx = BOOKS_INDEX.indexOf(book);
    const item = document.createElement('button');
    item.className = 'book-item' + (idx === state.reader.bookIdx ? ' active-book' : '');
    item.innerHTML = `<span>${book.label}</span><span class="book-ch-count">${book.chapters}</span>`;
    item.addEventListener('click', () => { bookPicker.classList.add('hidden'); loadBook(idx); });
    bookList.appendChild(item);
  });
}

// ── Chapter picker ──
const chapterBtn = document.getElementById('chapter-btn');
const chapterPicker = document.getElementById('chapter-picker');
const chapterGrid = document.getElementById('chapter-grid');

chapterBtn.addEventListener('click', () => { closePickers(); buildChapterGrid(); chapterPicker.classList.toggle('hidden'); });
document.getElementById('chapter-close').addEventListener('click', () => chapterPicker.classList.add('hidden'));

function buildChapterGrid() {
  const book = BOOKS_INDEX[state.reader.bookIdx];
  document.getElementById('chapter-picker-title').textContent = book.label;
  chapterGrid.innerHTML = '';
  for (let i = 0; i < book.chapters; i++) {
    const btn = document.createElement('button');
    btn.className = 'ch-btn' + (i === state.reader.chapter ? ' active-ch' : '');
    btn.textContent = i + 1;
    btn.addEventListener('click', () => { state.reader.chapter = i; chapterPicker.classList.add('hidden'); renderChapter(); });
    chapterGrid.appendChild(btn);
  }
}

function closePickers() {
  bookPicker.classList.add('hidden');
  chapterPicker.classList.add('hidden');
}

document.getElementById('chapter-content').addEventListener('click', closePickers);

// ── Load book ──
async function loadBook(idx) {
  state.reader.bookIdx = idx;
  state.reader.chapter = 0;
  document.getElementById('book-label').textContent = BOOKS_INDEX[idx].label;
  await loadChapterData();
  renderChapter();
  renderBookList();
}

async function loadChapterData() {
  const book = BOOKS_INDEX[state.reader.bookIdx];
  try {
    const res = await fetch(`data/${state.reader.lang}/${book.id}.json`);
    state.reader.data = await res.json();
  } catch (e) { state.reader.data = null; }
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

// ── Verse action sheet ──
let actionSheetTarget = null;

function showVerseActions(key, verse, text, bookLabel, chNum) {
  actionSheetTarget = { key, verse, text, bookLabel, chNum };
  const sheet = document.getElementById('verse-action-sheet');
  const ref = document.getElementById('vas-ref');
  const preview = document.getElementById('vas-preview');
  ref.textContent = `${bookLabel} ${chNum}:${verse}`;
  preview.textContent = text.length > 100 ? text.slice(0, 100) + '…' : text;
  // Update note button label
  const hasNote = !!state.notes[key];
  document.getElementById('vas-note-btn').textContent = hasNote ? 'Edit note' : 'Add note';
  sheet.classList.remove('hidden');
}

document.getElementById('vas-close').addEventListener('click', () => {
  document.getElementById('verse-action-sheet').classList.add('hidden');
});
document.getElementById('vas-overlay').addEventListener('click', () => {
  document.getElementById('verse-action-sheet').classList.add('hidden');
});
document.getElementById('vas-note-btn').addEventListener('click', () => {
  document.getElementById('verse-action-sheet').classList.add('hidden');
  const { key, verse, text, bookLabel, chNum } = actionSheetTarget;
  openNoteEditor(key, verse, text, bookLabel, chNum);
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

    // Tap to open action sheet
    row.addEventListener('click', () => {
      showVerseActions(noteKey, v.verse, v.text, book.label, ch.chapter);
    });

    container.appendChild(row);
  });

  container.scrollTop = 0;
}

// ── Note editor ──
function openNoteEditor(key, verseNum, verseText, bookLabel, chNum) {
  state.noteEditing = { key, verseText };
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
        <button class="note-goto-btn">Go to verse</button>
        <button class="note-edit-btn">Edit</button>
        <button class="note-delete-btn">Delete</button>
      </div>`;

    card.querySelector('.note-goto-btn').addEventListener('click', () => {
      const bookIdx = BOOKS_INDEX.findIndex(b => b.id === bookId);
      if (bookIdx === -1) return;
      // Switch to reader
      switchView('reader');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'reader'));
      // Load book+chapter if needed, then scroll to verse
      const chIdx = parseInt(ch) - 1;
      if (bookIdx !== state.reader.bookIdx) {
        state.reader.bookIdx = bookIdx;
        state.reader.chapter = chIdx;
        document.getElementById('book-label').textContent = BOOKS_INDEX[bookIdx].label;
        loadChapterData().then(() => { renderChapter(); scrollToVerse(v); });
      } else if (chIdx !== state.reader.chapter) {
        state.reader.chapter = chIdx;
        renderChapter();
        scrollToVerse(v);
      } else {
        scrollToVerse(v);
      }
    });

    card.querySelector('.note-edit-btn').addEventListener('click', () => {
      openNoteEditor(key, v, note.verseText, label, ch);
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

function scrollToVerse(verseNum) {
  setTimeout(() => {
    const container = document.getElementById('chapter-content');
    const rows = container.querySelectorAll('.verse-row');
    // verse-row index = verseNum - 1 (accounting for heading)
    const target = Array.from(rows).find(r => {
      const num = r.querySelector('.verse-num');
      return num && num.textContent === String(verseNum);
    });
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('highlighted');
      setTimeout(() => target.classList.remove('highlighted'), 1800);
    }
  }, 80);
}

// ── Stars + Night sky ──
document.getElementById('star-count').textContent = state.stars;

document.getElementById('star-tap').addEventListener('click', () => {
  state.stars++;
  document.getElementById('star-count').textContent = state.stars;
  spawnStarBurst();
  save();
});

document.getElementById('star-reset').addEventListener('click', () => {
  state.stars = 0;
  document.getElementById('star-count').textContent = 0;
  save();
});

function animateStars() {
  const canvas = document.getElementById('night-sky');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.getBoundingClientRect().width || canvas.offsetWidth || 375;
  const H = canvas.getBoundingClientRect().height || canvas.offsetHeight || 220;
  canvas.width = W;
  canvas.height = H;

  // Generate fixed star positions
  const NUM_STARS = 80;
  const stars = Array.from({ length: NUM_STARS }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 0.7 + 0.2,
    baseAlpha: Math.random() * 0.3 + 0.65,
    speed: Math.random() * 0.003 + 0.001,
    phase: Math.random() * Math.PI * 2,
  }));

  let frame;
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      const twinkle = s.baseAlpha + Math.sin(t * s.speed * 60 + s.phase) * 0.25;
      const alpha = Math.max(0.1, Math.min(1, twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210,225,255,${alpha})`;
      ctx.fill();
    });
    frame = requestAnimationFrame(draw);
  }

  // Stop previous animation if any
  if (canvas._animFrame) cancelAnimationFrame(canvas._animFrame);
  frame = requestAnimationFrame(draw);
  canvas._animFrame = frame;
}

function spawnStarBurst() {
  const canvas = document.getElementById('night-sky');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const x = Math.random() * canvas.width;
  const y = Math.random() * canvas.height;
  let alpha = 1;
  function burst() {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,240,120,${alpha})`;
    ctx.fill();
    alpha -= 0.06;
    if (alpha > 0) requestAnimationFrame(burst);
  }
  burst();
}

// ── Settings ──
function applySettings() {
  document.body.className = `theme-${state.settings.theme}`;
  document.documentElement.style.setProperty('--font-size', state.settings.fontSize + 'px');
  document.getElementById('font-display').textContent = state.settings.fontSize + 'px';
  document.getElementById('theme-light').classList.toggle('active', state.settings.theme === 'light');
  document.getElementById('theme-dark').classList.toggle('active', state.settings.theme === 'dark');
}

document.getElementById('theme-light').addEventListener('click', () => { state.settings.theme = 'light'; applySettings(); save(); });
document.getElementById('theme-dark').addEventListener('click', () => { state.settings.theme = 'dark'; applySettings(); save(); });
document.getElementById('font-up').addEventListener('click', () => { if (state.settings.fontSize < 28) { state.settings.fontSize += 2; applySettings(); save(); } });
document.getElementById('font-down').addEventListener('click', () => { if (state.settings.fontSize > 14) { state.settings.fontSize -= 2; applySettings(); save(); } });

// ── Start ──
init();
