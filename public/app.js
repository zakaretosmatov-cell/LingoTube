// LingoTube Frontend JavaScript Logic

// Global State
let player = null;
let playerReady = false;
let transcriptData = [];
let activeSegmentIndex = -1;
let updateInterval = null;
let selectedWord = '';
let selectedWordTranslation = '';
let vocabulary = JSON.parse(localStorage.getItem('lingotube_vocab')) || [];
let quizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;

// Initialize App directly when DOM is ready to prevent race conditions
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Initialize YouTube Player API (called by iframe_api script)
function onYouTubeIframeAPIReady() {
  console.log("YouTube Player API Ready");
  playerReady = true;
  
  // Auto-load default video as soon as API is ready
  const youtubeUrlInput = document.getElementById('youtube-url');
  if (youtubeUrlInput && youtubeUrlInput.value) {
    loadVideo(youtubeUrlInput.value);
  }
}

// Ensure the function is global so YouTube API can find it
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

// Initialize App
function initApp() {
  const loadBtn = document.getElementById('load-btn');
  const youtubeUrlInput = document.getElementById('youtube-url');
  const speakBtn = document.getElementById('speak-btn');
  const saveVocabBtn = document.getElementById('save-vocab-btn');
  const clearVocabBtn = document.getElementById('clear-vocab-btn');
  const quizBtn = document.getElementById('quiz-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const searchInput = document.getElementById('search-subtitles');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const targetLangSelect = document.getElementById('target-lang');
  const speedBtns = document.querySelectorAll('.speed-btn');

  // Load Video on Button Click
  loadBtn.addEventListener('click', () => {
    loadVideo(youtubeUrlInput.value);
  });

  // Load Video on Enter Key
  youtubeUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadVideo(youtubeUrlInput.value);
    }
  });

  // Text to Speech
  speakBtn.addEventListener('click', () => {
    if (selectedWord) {
      speakWord(selectedWord);
    }
  });

  // Save to Vocabulary
  saveVocabBtn.addEventListener('click', toggleSaveWord);

  // Clear Vocabulary
  clearVocabBtn.addEventListener('click', clearAllVocabulary);

  // Quiz Modal Actions
  quizBtn.addEventListener('click', startQuiz);
  closeModalBtn.addEventListener('click', closeQuizModal);

  // Subtitle Search
  searchInput.addEventListener('input', handleSubtitleSearch);
  clearSearchBtn.addEventListener('click', clearSubtitleSearch);

  // Language Change - if a word is already selected, re-translate it
  targetLangSelect.addEventListener('change', () => {
    if (selectedWord) {
      translateWord(selectedWord);
    }
  });

  // Playback Speed Controls
  speedBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseFloat(btn.dataset.speed);
      if (player && player.setPlaybackRate) {
        player.setPlaybackRate(speed);
      }
    });
  });

  // Render initial vocabulary
  renderVocabulary();
}

// Extract YouTube Video ID
function extractVideoId(url) {
  if (!url) return null;
  url = url.trim();
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Load Video and Subtitles
async function loadVideo(url) {
  if (typeof YT === 'undefined' || !YT.Player) {
    console.warn("YouTube API is not loaded yet. Retrying in 500ms...");
    setTimeout(() => loadVideo(url), 500);
    return;
  }

  const videoId = extractVideoId(url);
  const urlError = document.getElementById('url-error');
  
  if (!videoId) {
    urlError.classList.remove('hidden');
    return;
  }
  
  urlError.classList.add('hidden');
  document.getElementById('player-placeholder').classList.add('hidden');
  
  // Initialize or reload player
  if (player) {
    player.destroy();
    player = null;
  }
  
  // Clear any existing intervals
  clearInterval(updateInterval);
  activeSegmentIndex = -1;
  
  // Initialize YouTube Iframe Player
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: {
      'playsinline': 1,
      'rel': 0,
      'modestbranding': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });

  // Fetch Subtitles
  await fetchSubtitles(videoId);
}

function onPlayerReady(event) {
  // Reset speed to active selection
  const activeSpeedBtn = document.querySelector('.speed-btn.active');
  if (activeSpeedBtn && player.setPlaybackRate) {
    player.setPlaybackRate(parseFloat(activeSpeedBtn.dataset.speed));
  }
}

function onPlayerStateChange(event) {
  // Sync subtitles when playing
  if (event.data === YT.PlayerState.PLAYING) {
    startSubtitleSync();
  } else {
    clearInterval(updateInterval);
  }
}

// Start Subtitle Synchronization loop
function startSubtitleSync() {
  clearInterval(updateInterval);
  updateInterval = setInterval(() => {
    if (player && player.getCurrentTime) {
      syncSubtitles(player.getCurrentTime());
    }
  }, 200);
}

// Fetch Subtitles from backend
async function fetchSubtitles(videoId) {
  const container = document.getElementById('subtitles-container');
  const countBadge = document.getElementById('subtitle-count');
  
  container.innerHTML = `
    <div class="subtitles-placeholder">
      <i class="fa-solid fa-circle-notch fa-spin sub-placeholder-icon"></i>
      <p>Subtitrlar yuklanmoqda...</p>
    </div>
  `;
  countBadge.textContent = 'Yuklanmoqda...';

  try {
    const response = await fetch(`/api/transcript?v=${videoId}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch transcript');
    }

    transcriptData = data.transcript;
    countBadge.textContent = `${transcriptData.length} qator`;
    renderSubtitles(transcriptData);
  } catch (error) {
    console.warn('Backend transcript fetch failed, trying fallback public API...', error);
    try {
      const fallbackUrl = `https://youtube-transcript.ai/transcript/${videoId}.txt`;
      const response = await fetch(fallbackUrl);
      if (!response.ok) {
        throw new Error(`Fallback API returned status ${response.status}`);
      }
      const text = await response.text();
      const parsed = parseTextTranscript(text);
      
      if (parsed.length === 0) {
        throw new Error('Parsed transcript is empty');
      }
      
      transcriptData = parsed;
      countBadge.textContent = `${transcriptData.length} qator`;
      renderSubtitles(transcriptData);
    } catch (fallbackError) {
      console.error('Fallback transcript fetch also failed:', fallbackError);
      container.innerHTML = `
        <div class="subtitles-placeholder">
          <i class="fa-solid fa-triangle-exclamation sub-placeholder-icon" style="color: var(--danger-color)"></i>
          <p style="color: var(--danger-color)">Subtitrlarni yuklab bo'lmadi.</p>
          <p style="font-size: 12px; margin-top: 8px;">Ushbu videoda inglizcha subtitr mavjudligini tekshiring.</p>
        </div>
      `;
      countBadge.textContent = 'Xato';
      transcriptData = [];
    }
  }
}

// Parse plaintext Markdown transcript from fallback API
function parseTextTranscript(text) {
  const lines = text.split('\n');
  const segments = [];
  const timestampRegex = /^\[(\d+(?::\d+){1,2})\]\s*(.*)$/;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const match = line.match(timestampRegex);
    if (match) {
      const timeStr = match[1];
      const segmentText = match[2];
      
      const parts = timeStr.split(':').map(Number);
      let seconds = 0;
      if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      
      segments.push({
        start: seconds,
        duration: 4, // default, will be adjusted
        text: segmentText
      });
    }
  }
  
  // Adjust durations dynamically
  for (let i = 0; i < segments.length - 1; i++) {
    const diff = segments[i+1].start - segments[i].start;
    segments[i].duration = Math.max(1, Math.min(diff, 10)); // cap at 10s max duration
  }
  
  return segments;
}

// Render Subtitles in the container
function renderSubtitles(segments) {
  const container = document.getElementById('subtitles-container');
  container.innerHTML = '';

  if (segments.length === 0) {
    container.innerHTML = `
      <div class="subtitles-placeholder">
        <i class="fa-solid fa-file-audio sub-placeholder-icon"></i>
        <p>Subtitrlar mavjud emas</p>
      </div>
    `;
    return;
  }

  segments.forEach((segment, idx) => {
    const segmentDiv = document.createElement('div');
    segmentDiv.className = 'sub-segment';
    segmentDiv.dataset.index = idx;
    segmentDiv.dataset.start = segment.start;
    segmentDiv.dataset.duration = segment.duration;

    // Time stamp
    const timeSpan = document.createElement('span');
    timeSpan.className = 'sub-time';
    timeSpan.textContent = formatTime(segment.start);
    timeSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      seekToTime(segment.start);
    });

    // Subtitle text (interactive words)
    const textSpan = document.createElement('span');
    textSpan.className = 'sub-text';
    
    // Split text into words, keeping punctuation intact for rendering but cleaning for translate datasets
    const words = segment.text.split(/\s+/);
    words.forEach(word => {
      if (word.trim() === '') return;
      
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.textContent = word + ' ';
      
      // Clean word for translation
      const cleaned = cleanWord(word);
      wordSpan.dataset.cleanWord = cleaned;

      wordSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        handleWordClick(wordSpan, cleaned);
      });
      
      textSpan.appendChild(wordSpan);
    });

    // Line translation button
    const translateLineBtn = document.createElement('button');
    translateLineBtn.className = 'line-translate-btn tooltip';
    translateLineBtn.dataset.tooltip = "Qatorni tarjima qilish";
    translateLineBtn.innerHTML = '<i class="fa-solid fa-language"></i>';
    translateLineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      translateLine(segmentDiv, segment.text);
    });

    segmentDiv.appendChild(timeSpan);
    segmentDiv.appendChild(textSpan);
    segmentDiv.appendChild(translateLineBtn);
    
    // Seek video when clicking anywhere on segment
    segmentDiv.addEventListener('click', () => {
      seekToTime(segment.start);
    });

    container.appendChild(segmentDiv);
  });
}

// Clean word helper (removes leading/trailing punctuation)
function cleanWord(word) {
  // Remove non-alphanumeric characters from start and end, keep inner apostrophes/hyphens
  return word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
}

// Seek video to specific time
function seekToTime(seconds) {
  if (player && player.seekTo) {
    player.seekTo(seconds, true);
    player.playVideo();
  }
}

// Format time in seconds to MM:SS
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');
  
  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

// Sync subtitles scrolling and active states
function syncSubtitles(currentTime) {
  if (transcriptData.length === 0) return;

  // Find active segment
  let currentActiveIdx = -1;
  
  for (let i = 0; i < transcriptData.length; i++) {
    const seg = transcriptData[i];
    if (currentTime >= seg.start && currentTime <= (seg.start + seg.duration + 0.5)) {
      currentActiveIdx = i;
      break;
    }
  }

  // Fallback: if not directly in duration, find the closest segment that has already started
  if (currentActiveIdx === -1) {
    for (let i = 0; i < transcriptData.length; i++) {
      if (currentTime >= transcriptData[i].start) {
        currentActiveIdx = i;
      } else {
        break; // Segments are sorted
      }
    }
  }

  // If active segment changed, update classes and auto-scroll
  if (currentActiveIdx !== -1 && currentActiveIdx !== activeSegmentIndex) {
    activeSegmentIndex = currentActiveIdx;
    
    const segments = document.querySelectorAll('.sub-segment');
    segments.forEach(seg => seg.classList.remove('active'));
    
    const activeSegElement = document.querySelector(`.sub-segment[data-index="${activeSegmentIndex}"]`);
    if (activeSegElement) {
      activeSegElement.classList.add('active');
      
      const autoScrollToggle = document.getElementById('auto-scroll-toggle');
      if (autoScrollToggle.checked) {
        const container = document.getElementById('subtitles-container');
        // Scroll active element to middle of container
        const containerHeight = container.clientHeight;
        const elemTop = activeSegElement.offsetTop;
        const elemHeight = activeSegElement.clientHeight;
        
        container.scrollTop = elemTop - (containerHeight / 2) + (elemHeight / 2);
      }
    }
  }
}

// Handle Word Click
function handleWordClick(element, cleanedWord) {
  // Highlight clicked word
  document.querySelectorAll('.word').forEach(w => w.classList.remove('clicked-word'));
  element.classList.add('clicked-word');
  
  selectedWord = cleanedWord;
  
  // Automatically pause video for comfortable learning
  if (player && player.pauseVideo) {
    player.pauseVideo();
  }

  translateWord(cleanedWord);
}

// Fetch Word Translation
async function translateWord(word) {
  const dictWelcome = document.getElementById('dict-welcome');
  const dictLoading = document.getElementById('dict-loading');
  const dictError = document.getElementById('dict-error');
  const dictResult = document.getElementById('dict-result');
  const selectedWordSpan = document.getElementById('selected-word');
  const wordTranslationDiv = document.getElementById('word-translation');
  const detectedLangSpan = document.getElementById('detected-lang');
  const saveVocabBtn = document.getElementById('save-vocab-btn');
  const targetLang = document.getElementById('target-lang').value;

  dictWelcome.classList.add('hidden');
  dictError.classList.add('hidden');
  dictResult.classList.add('hidden');
  dictLoading.classList.remove('hidden');

  try {
    const response = await fetch(`/api/translate?text=${encodeURIComponent(word)}&to=${targetLang}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to translate');
    }

    selectedWordTranslation = data.translation;
    
    selectedWordSpan.textContent = word;
    wordTranslationDiv.textContent = data.translation;
    
    // Map language code to name
    const langNames = {
      'uz': "O'zbekcha",
      'ru': "Ruscha",
      'tr': "Turkcha",
      'es': "Ispancha",
      'de': "Nemischa",
      'fr': "Fransuzcha",
      'ar': "Arabcha"
    };
    detectedLangSpan.textContent = langNames[data.from] || data.from.toUpperCase();

    // Check if word is already in vocabulary
    const isSaved = vocabulary.some(item => item.word.toLowerCase() === word.toLowerCase());
    updateSaveButtonState(isSaved);

    dictLoading.classList.add('hidden');
    dictResult.classList.remove('hidden');
  } catch (error) {
    console.error('Translation error:', error);
    dictLoading.classList.add('hidden');
    dictError.classList.remove('hidden');
  }
}

// Translate full line (subtitle segment)
async function translateLine(segmentElement, text) {
  // Check if translation is already rendered
  let inlineTranslation = segmentElement.querySelector('.inline-translation');
  if (inlineTranslation) {
    inlineTranslation.remove();
    return;
  }

  // Create loading translation placeholder
  inlineTranslation = document.createElement('div');
  inlineTranslation.className = 'inline-translation';
  inlineTranslation.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tarjima qilinmoqda...';
  segmentElement.querySelector('.sub-text').appendChild(inlineTranslation);

  const targetLang = document.getElementById('target-lang').value;

  try {
    const response = await fetch(`/api/translate?text=${encodeURIComponent(text)}&to=${targetLang}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Translation failed');
    }

    inlineTranslation.innerHTML = `<strong>Tarjima:</strong> ${data.translation}`;
  } catch (error) {
    console.error('Line translation error:', error);
    inlineTranslation.innerHTML = `<span style="color: var(--danger-color)"><i class="fa-solid fa-triangle-exclamation"></i> Tarjima qilib bo'lmadi.</span>`;
  }
}

// Text-to-Speech (TTS)
function speakWord(word) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85; // slightly slower for clearer learning
    
    // Find a premium native voice if possible
    const voices = window.speechSynthesis.getVoices();
    const googleVoice = voices.find(voice => voice.name.includes('Google US English') || voice.name.includes('Natural'));
    if (googleVoice) {
      utterance.voice = googleVoice;
    }

    window.speechSynthesis.speak(utterance);
  } else {
    alert("Kechirasiz, brauzeringiz talaffuz xizmatini qo'llab-quvvatlamaydi.");
  }
}

// Toggle Save/Remove Word in Vocabulary List
function toggleSaveWord() {
  if (!selectedWord || !selectedWordTranslation) return;

  const wordIndex = vocabulary.findIndex(item => item.word.toLowerCase() === selectedWord.toLowerCase());
  
  if (wordIndex > -1) {
    // Remove if already exists
    vocabulary.splice(wordIndex, 1);
    updateSaveButtonState(false);
  } else {
    // Add new word
    const vocabItem = {
      word: selectedWord,
      translation: selectedWordTranslation,
      date: new Date().toLocaleDateString('uz-UZ')
    };
    vocabulary.unshift(vocabItem); // add to top
    updateSaveButtonState(true);
  }

  // Save to localStorage
  localStorage.setItem('lingotube_vocab', JSON.stringify(vocabulary));
  renderVocabulary();
}

function updateSaveButtonState(isSaved) {
  const saveBtn = document.getElementById('save-vocab-btn');
  if (isSaved) {
    saveBtn.className = 'btn save-btn saved';
    saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saqlandi';
  } else {
    saveBtn.className = 'btn outline-btn save-btn';
    saveBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i> Saqlash';
  }
}

// Render Vocabulary Notebook
function renderVocabulary() {
  const grid = document.getElementById('vocab-grid');
  const countBadge = document.getElementById('vocab-count');
  const quizBtn = document.getElementById('quiz-btn');
  const clearVocabBtn = document.getElementById('clear-vocab-btn');

  countBadge.textContent = vocabulary.length;
  grid.innerHTML = '';

  if (vocabulary.length === 0) {
    grid.innerHTML = `
      <div class="vocab-empty">
        <i class="fa-solid fa-bookmark empty-icon"></i>
        <p>Sizda hali saqlangan so'zlar yo'q. Subtitrdagi so'zlarni tanlab "Saqlash" tugmasini bosing.</p>
      </div>
    `;
    quizBtn.disabled = true;
    clearVocabBtn.disabled = true;
    return;
  }

  quizBtn.disabled = vocabulary.length < 4; // need at least 4 words for multiple-choice quiz
  if (vocabulary.length < 4) {
    quizBtn.setAttribute('data-tooltip', "O'yin uchun kamida 4 ta so'z saqlang");
    quizBtn.classList.add('tooltip');
  } else {
    quizBtn.removeAttribute('data-tooltip');
    quizBtn.classList.remove('tooltip');
  }
  
  clearVocabBtn.disabled = false;

  vocabulary.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'vocab-card';

    const info = document.createElement('div');
    info.className = 'vocab-word-info';

    const wordTitle = document.createElement('div');
    wordTitle.className = 'vocab-word-title';
    wordTitle.textContent = item.word;

    const wordTrans = document.createElement('div');
    wordTrans.className = 'vocab-word-translation';
    wordTrans.textContent = item.translation;

    const dateSpan = document.createElement('div');
    dateSpan.className = 'vocab-date';
    dateSpan.textContent = item.date;

    info.appendChild(wordTitle);
    info.appendChild(wordTrans);
    info.appendChild(dateSpan);

    const actions = document.createElement('div');
    actions.className = 'vocab-card-actions';

    // Speaker btn for TTS
    const speakBtn = document.createElement('button');
    speakBtn.className = 'icon-btn mini-btn tooltip';
    speakBtn.dataset.tooltip = "Talaffuz";
    speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord(item.word);
    });

    // Delete btn
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn mini-btn tooltip';
    deleteBtn.dataset.tooltip = "O'chirish";
    deleteBtn.style.color = 'var(--danger-color)';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteVocabularyItem(idx);
    });

    actions.appendChild(speakBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(info);
    card.appendChild(actions);
    
    // Clicking card triggers word lookup
    card.addEventListener('click', () => {
      selectedWord = item.word;
      translateWord(item.word);
    });

    grid.appendChild(card);
  });
}

// Delete individual item from vocabulary
function deleteVocabularyItem(index) {
  vocabulary.splice(index, 1);
  localStorage.setItem('lingotube_vocab', JSON.stringify(vocabulary));
  
  // If the currently viewed dictionary word is the one deleted, update the save button
  if (selectedWord) {
    const isStillSaved = vocabulary.some(item => item.word.toLowerCase() === selectedWord.toLowerCase());
    updateSaveButtonState(isStillSaved);
  }

  renderVocabulary();
}

// Clear all vocabulary
function clearAllVocabulary() {
  if (confirm("Haqiqatdan ham lug'at daftaringizdagi barcha so'zlarni o'chirmoqchimisiz?")) {
    vocabulary = [];
    localStorage.removeItem('lingotube_vocab');
    updateSaveButtonState(false);
    renderVocabulary();
  }
}

// Subtitle searching functionality
function handleSubtitleSearch() {
  const query = document.getElementById('search-subtitles').value.toLowerCase().trim();
  const clearBtn = document.getElementById('clear-search-btn');
  const segments = document.querySelectorAll('.sub-segment');

  if (query === '') {
    clearBtn.classList.add('hidden');
    segments.forEach(seg => {
      seg.style.display = 'flex';
      // Reset highlights
      seg.querySelectorAll('.word').forEach(w => w.style.color = '');
    });
    return;
  }

  clearBtn.classList.remove('hidden');

  segments.forEach(seg => {
    const textSpan = seg.querySelector('.sub-text');
    const textContent = textSpan.textContent.toLowerCase();
    
    if (textContent.includes(query)) {
      seg.style.display = 'flex';
      // Highlight matching words
      seg.querySelectorAll('.word').forEach(wordSpan => {
        const clean = wordSpan.dataset.cleanWord;
        if (clean && clean.includes(query)) {
          wordSpan.style.color = 'var(--secondary-color)';
        } else {
          wordSpan.style.color = '';
        }
      });
    } else {
      seg.style.display = 'none';
    }
  });
}

// Clear Subtitle Search
function clearSubtitleSearch() {
  const searchInput = document.getElementById('search-subtitles');
  searchInput.value = '';
  handleSubtitleSearch();
}

// Flashcard Quiz Game Logic
function startQuiz() {
  if (vocabulary.length < 4) return;

  const modal = document.getElementById('quiz-modal');
  modal.classList.remove('hidden');

  // Prepare 5 questions (or up to vocabulary length if less than 5)
  const numQuestions = Math.min(5, vocabulary.length);
  quizQuestions = [];
  
  // Shuffle copy of vocabulary
  const shuffledVocab = [...vocabulary].sort(() => 0.5 - Math.random());
  
  for (let i = 0; i < numQuestions; i++) {
    const correctItem = shuffledVocab[i];
    
    // Select 3 incorrect answers from remaining vocabulary
    const incorrectChoices = vocabulary
      .filter(item => item.word.toLowerCase() !== correctItem.word.toLowerCase())
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(item => item.translation);
      
    // Fallback if not enough saved words (unlikely because button disabled if < 4)
    while (incorrectChoices.length < 3) {
      incorrectChoices.push("Noto'g'ri variant");
    }

    const options = [correctItem.translation, ...incorrectChoices].sort(() => 0.5 - Math.random());

    quizQuestions.push({
      word: correctItem.word,
      correctTranslation: correctItem.translation,
      options: options
    });
  }

  currentQuizIndex = 0;
  quizScore = 0;
  loadQuizQuestion();
}

function loadQuizQuestion() {
  if (currentQuizIndex >= quizQuestions.length) {
    showQuizResults();
    return;
  }

  const question = quizQuestions[currentQuizIndex];
  
  // Progress Bar
  const progressPercent = (currentQuizIndex / quizQuestions.length) * 100;
  document.getElementById('quiz-progress').style.width = `${progressPercent}%`;

  // Display Word
  document.getElementById('quiz-word').textContent = question.word;
  
  // Render Options
  const optionsGrid = document.getElementById('quiz-options');
  optionsGrid.innerHTML = '';
  
  document.getElementById('quiz-feedback').classList.add('hidden');

  question.options.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'quiz-opt-btn';
    btn.textContent = option;
    
    btn.addEventListener('click', () => {
      handleQuizAnswer(btn, option, question.correctTranslation);
    });

    optionsGrid.appendChild(btn);
  });
}

function handleQuizAnswer(selectedBtn, chosenOption, correctOption) {
  const optionsGrid = document.getElementById('quiz-options');
  const buttons = optionsGrid.querySelectorAll('.quiz-opt-btn');
  
  // Disable all option buttons
  buttons.forEach(btn => btn.disabled = true);

  const feedbackDiv = document.getElementById('quiz-feedback');
  const feedbackText = document.getElementById('quiz-feedback-text');
  const nextBtn = document.getElementById('quiz-next-btn');

  // Trigger TTS so user hears word again
  speakWord(quizQuestions[currentQuizIndex].word);

  if (chosenOption === correctOption) {
    selectedBtn.classList.add('correct');
    feedbackText.textContent = "To'g'ri! Barakalla!";
    feedbackText.className = 'correct-text';
    quizScore++;
  } else {
    selectedBtn.classList.add('incorrect');
    // Highlight the correct answer in green
    buttons.forEach(btn => {
      if (btn.textContent === correctOption) {
        btn.classList.add('correct');
      }
    });
    feedbackText.textContent = `Noto'g'ri! To'g'ri javob: ${correctOption}`;
    feedbackText.className = 'incorrect-text';
  }

  nextBtn.onclick = () => {
    currentQuizIndex++;
    loadQuizQuestion();
  };

  feedbackDiv.classList.remove('hidden');
}

function showQuizResults() {
  document.getElementById('quiz-progress').style.width = '100%';
  
  const optionsGrid = document.getElementById('quiz-options');
  optionsGrid.innerHTML = '';

  const quizWord = document.getElementById('quiz-word');
  quizWord.textContent = `Natija: ${quizScore} / ${quizQuestions.length}`;

  const feedbackDiv = document.getElementById('quiz-feedback');
  const feedbackText = document.getElementById('quiz-feedback-text');
  const nextBtn = document.getElementById('quiz-next-btn');

  feedbackText.textContent = quizScore === quizQuestions.length ? "Ajoyib natija! 100%!" : "Yaxshi urinish! Yana takrorlab ko'ring.";
  feedbackText.className = 'correct-text';

  nextBtn.innerHTML = 'Tamomlash <i class="fa-solid fa-check"></i>';
  nextBtn.onclick = closeQuizModal;
  
  feedbackDiv.classList.remove('hidden');
}

function closeQuizModal() {
  document.getElementById('quiz-modal').classList.add('hidden');
}

// Load default voice list on load for TTS voices ready
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}
