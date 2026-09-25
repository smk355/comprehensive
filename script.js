const listEl = document.getElementById('questionList');
const topicFilterEl = document.getElementById('topicFilter');
const topicSelectEl = document.getElementById('topicSelect');
const searchBoxEl = document.getElementById('searchBox');
const statsEl = document.getElementById('stats');
const scrollTopEl = document.getElementById('scrollTop');

let ALL = typeof QUESTIONS_DATA !== 'undefined' ? QUESTIONS_DATA : [];
let activeTopic = 'All';
let searchTerm = '';

if (ALL.length) {
  buildTopicFilter();
  render();
} else {
  listEl.innerHTML = `<div class="empty-state">No question data found — data.js didn't load.</div>`;
}

function buildTopicFilter() {
  const counts = {};
  for (const q of ALL) counts[q.topic] = (counts[q.topic] || 0) + 1;
  const topics = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  const chips = [{ name: 'All', count: ALL.length }, ...topics.map(t => ({ name: t, count: counts[t] }))];
  topicFilterEl.innerHTML = '';
  for (const chip of chips) {
    const el = document.createElement('div');
    el.className = 'topic-chip' + (chip.name === activeTopic ? ' active' : '');
    el.innerHTML = `${chip.name} <span class="count">${chip.count}</span>`;
    el.addEventListener('click', () => {
      activeTopic = chip.name;
      buildTopicFilter();
      render();
    });
    topicFilterEl.appendChild(el);
  }

  topicSelectEl.innerHTML = '';
  for (const chip of chips) {
    const opt = document.createElement('option');
    opt.value = chip.name;
    opt.textContent = `${chip.name} (${chip.count})`;
    if (chip.name === activeTopic) opt.selected = true;
    topicSelectEl.appendChild(opt);
  }
}

topicSelectEl.addEventListener('change', () => {
  activeTopic = topicSelectEl.value;
  buildTopicFilter();
  render();
});

searchBoxEl.addEventListener('input', () => {
  searchTerm = searchBoxEl.value.trim().toLowerCase();
  render();
});

function filteredQuestions() {
  return ALL.filter(q => {
    if (activeTopic !== 'All' && q.topic !== activeTopic) return false;
    if (searchTerm && !q.question.toLowerCase().includes(searchTerm)) return false;
    return true;
  });
}

function render() {
  const qs = filteredQuestions();
  statsEl.textContent = `${qs.length} of ${ALL.length} questions`;

  if (qs.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No questions match.</div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  qs.forEach((q, idx) => frag.appendChild(buildCard(q, idx + 1)));
  listEl.innerHTML = '';
  listEl.appendChild(frag);
}

function buildCard(q, displayIndex, onAnswer) {
  const card = document.createElement('div');
  card.className = 'q-card';

  const head = document.createElement('div');
  head.className = 'q-head';
  if (q.diagram) {
    // the diagram screenshot already contains the question text, so just number it
    head.innerHTML = `<span class="q-num">Q${displayIndex})</span>`;
  } else {
    head.innerHTML = `<span class="q-num">Q${displayIndex})</span><span class="q-text"></span>`;
    head.querySelector('.q-text').textContent = q.question;
  }
  card.appendChild(head);

  const topic = document.createElement('div');
  topic.className = 'q-topic';
  topic.textContent = q.topic;
  card.appendChild(topic);

  if (q.diagram) {
    const img = document.createElement('img');
    img.className = 'q-diagram';
    img.src = 'images/' + q.diagram;
    img.alt = q.question;
    img.loading = 'lazy';
    card.appendChild(img);
  }

  const optsWrap = document.createElement('div');
  optsWrap.className = 'options';

  const answerBlock = document.createElement('div');
  answerBlock.className = 'answer-block';
  let answerHTML = `<b>Ans:</b> ${escapeHTML(q.reasoning)}`;
  if (!q.matches_original) {
    answerHTML += `<br><span class="flag-note">Re-checked — original PDF marked a different option</span>`;
  } else if (q.confidence === 'low') {
    answerHTML += `<br><span class="flag-note">Low confidence — question is ambiguous</span>`;
  }
  answerBlock.innerHTML = answerHTML;

  let answered = false;
  const letters = ['1', '2', '3', '4'];

  q.options.forEach((optText, i) => {
    const optNum = i + 1;
    const optImg = q.option_images && q.option_images[i];
    const opt = document.createElement('div');
    opt.className = 'option';
    if (optImg) {
      opt.innerHTML = `<span class="opt-letter">${letters[i]}.</span>`;
      const img = document.createElement('img');
      img.className = 'opt-image';
      img.src = 'images/' + optImg;
      img.alt = optText || `option ${letters[i]}`;
      opt.appendChild(img);
    } else {
      opt.innerHTML = `<span class="opt-letter">${letters[i]}.</span><span></span>`;
      opt.querySelector('span:last-child').textContent = optText;
    }

    opt.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const options = optsWrap.querySelectorAll('.option');
      options.forEach(o => o.classList.add('locked'));

      const isCorrect = optNum === q.correct;
      if (isCorrect) {
        opt.classList.add('correct');
      } else {
        opt.classList.add('wrong');
        options[q.correct - 1].classList.add('correct');
      }
      options.forEach(o => {
        if (!o.classList.contains('correct') && !o.classList.contains('wrong')) {
          o.classList.add('dim');
        }
      });

      answerBlock.classList.add('show');
      if (onAnswer) onAnswer(isCorrect);
    });

    optsWrap.appendChild(opt);
  });

  card.appendChild(optsWrap);
  card.appendChild(answerBlock);
  return card;
}

function escapeHTML(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

window.addEventListener('scroll', () => {
  scrollTopEl.classList.toggle('visible', window.scrollY > 400);
});
scrollTopEl.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ---------- Quiz mode ----------

const QUIZ_DISTRIBUTION = {
  'Management': 20,
  'TOC': 10,
  'CN': 10,
  'DSA': 8,
  'C/C++': 8,
  'Information Security': 8,
  'OS': 8,
  'DBMS': 8,
  'CAO': 4,
  'Software Engineering': 4,
  'OOPS': 4,
  'Business Ethics': 4,
  'Privacy & Compliance': 4,
};

const controlsEl = document.getElementById('controls');
const quizBtn = document.getElementById('quizBtn');
const quizModal = document.getElementById('quizModal');
const quizCancelBtn = document.getElementById('quizCancelBtn');
const quizBackBtn = document.getElementById('quizBackBtn');
const quizStepSection = document.getElementById('quizStepSection');
const quizStepCount = document.getElementById('quizStepCount');
const sectionOptionsEl = document.getElementById('sectionOptions');
const countOptionsEl = document.getElementById('countOptions');
const quizCountSubEl = document.getElementById('quizCountSub');
const quizBar = document.getElementById('quizBar');
const quizProgressEl = document.getElementById('quizProgress');
const quizExitBtn = document.getElementById('quizExitBtn');
const quizRetakeBtn = document.getElementById('quizRetakeBtn');

let quizActive = false;
let quizSize = 0;
let quizSection = 'All';
let quizQuestions = [];
let quizTotal = 0;
let quizAnswered = 0;
let quizScore = 0;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function topicCounts() {
  const counts = {};
  for (const q of ALL) counts[q.topic] = (counts[q.topic] || 0) + 1;
  return counts;
}

function buildQuiz(size) {
  const byTopic = {};
  for (const q of ALL) {
    (byTopic[q.topic] || (byTopic[q.topic] = [])).push(q);
  }
  let picked = [];
  for (const [topic, pct] of Object.entries(QUIZ_DISTRIBUTION)) {
    const n = Math.round((size * pct) / 100);
    const pool = shuffle((byTopic[topic] || []).slice());
    picked.push(...pool.slice(0, n));
  }
  return shuffle(picked);
}

function buildSectionQuiz(topic, size) {
  const pool = shuffle(ALL.filter(q => q.topic === topic).slice());
  return pool.slice(0, size);
}

function openQuizModal() {
  quizStepCount.classList.add('hidden');
  quizStepSection.classList.remove('hidden');
  const counts = topicCounts();
  const topics = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  sectionOptionsEl.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'quiz-size-btn';
  allBtn.textContent = `All topics (${ALL.length})`;
  allBtn.addEventListener('click', () => showCountStep('All'));
  sectionOptionsEl.appendChild(allBtn);
  for (const t of topics) {
    const btn = document.createElement('button');
    btn.className = 'quiz-size-btn';
    btn.textContent = `${t} (${counts[t]})`;
    btn.addEventListener('click', () => showCountStep(t));
    sectionOptionsEl.appendChild(btn);
  }
  quizModal.classList.remove('hidden');
}

function showCountStep(section) {
  quizSection = section;
  const available = section === 'All' ? ALL.length : (topicCounts()[section] || 0);
  quizCountSubEl.textContent = section === 'All'
    ? 'Pulled proportionally across all topics and shuffled.'
    : `Random questions from ${section} (${available} available), shuffled.`;

  countOptionsEl.innerHTML = '';
  [50, 100, 200].forEach(size => {
    const btn = document.createElement('button');
    btn.className = 'quiz-size-btn';
    const capped = section !== 'All' && size > available;
    btn.textContent = capped ? `${size} questions (only ${available} available)` : `${size} questions`;
    btn.addEventListener('click', () => {
      quizModal.classList.add('hidden');
      startQuiz(section, size);
    });
    countOptionsEl.appendChild(btn);
  });

  quizStepSection.classList.add('hidden');
  quizStepCount.classList.remove('hidden');
}

quizBtn.addEventListener('click', openQuizModal);
quizCancelBtn.addEventListener('click', () => quizModal.classList.add('hidden'));
quizBackBtn.addEventListener('click', openQuizModal);
quizModal.addEventListener('click', (e) => {
  if (e.target === quizModal) quizModal.classList.add('hidden');
});

function startQuiz(section, size) {
  quizSection = section;
  quizSize = size;
  quizQuestions = section === 'All' ? buildQuiz(size) : buildSectionQuiz(section, size);
  quizTotal = quizQuestions.length;
  quizAnswered = 0;
  quizScore = 0;
  quizActive = true;

  controlsEl.classList.add('hidden');
  quizBar.classList.remove('hidden');
  quizRetakeBtn.style.display = 'none';
  updateQuizProgress();
  renderQuiz();
  window.scrollTo({ top: 0 });
}

function updateQuizProgress() {
  if (quizAnswered < quizTotal) {
    quizProgressEl.innerHTML = `Quiz: <b>${quizAnswered}</b> of <b>${quizTotal}</b> answered &middot; Score so far: <b>${quizScore}</b>/${quizAnswered}`;
  } else {
    const pct = quizTotal ? Math.round((quizScore / quizTotal) * 100) : 0;
    quizProgressEl.innerHTML = `Quiz complete — <span class="quiz-score-final">Score: ${quizScore}/${quizTotal} (${pct}%)</span>`;
    quizRetakeBtn.style.display = 'inline-block';
  }
}

function renderQuiz() {
  statsEl.textContent = quizSection === 'All'
    ? `Quiz — ${quizTotal} questions`
    : `Quiz — ${quizSection} — ${quizTotal} questions`;
  const frag = document.createDocumentFragment();
  quizQuestions.forEach((q, idx) => {
    frag.appendChild(buildCard(q, idx + 1, (isCorrect) => {
      quizAnswered++;
      if (isCorrect) quizScore++;
      updateQuizProgress();
    }));
  });
  listEl.innerHTML = '';
  listEl.appendChild(frag);
}

function exitQuiz() {
  quizActive = false;
  controlsEl.classList.remove('hidden');
  quizBar.classList.add('hidden');
  render();
}

quizExitBtn.addEventListener('click', exitQuiz);
quizRetakeBtn.addEventListener('click', () => startQuiz(quizSection, quizSize));
