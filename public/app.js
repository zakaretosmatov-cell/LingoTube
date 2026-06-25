// LingoTube Frontend JavaScript Logic (Version 1.0.5)

// Global State
let player = null;
let playerReady = false;
let transcriptData = [];
let activeSegmentIndex = -1;
let updateInterval = null;
let selectedWord = '';
let selectedWordTranslation = '';

// LocalStorage State
let vocabulary = JSON.parse(localStorage.getItem('lingotube_vocab')) || [];
let unlockedAchievements = JSON.parse(localStorage.getItem('lingotube_achievements')) || [];
let streak = parseInt(localStorage.getItem('lingotube_streak')) || 0;
let lastActiveDate = localStorage.getItem('lingotube_last_active') || '';
let challengeDate = localStorage.getItem('lingotube_challenge_date') || '';
let challengeProgress = parseInt(localStorage.getItem('lingotube_challenge_progress')) || 0;

// Quiz State
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
  
  // Auto-load last watched video or default video as soon as API is ready
  const lastVideo = JSON.parse(localStorage.getItem('lingotube_last_video'));
  const youtubeUrlInput = document.getElementById('youtube-url');
  
  if (lastVideo && lastVideo.url) {
    youtubeUrlInput.value = lastVideo.url;
    loadVideo(lastVideo.url);
  } else if (youtubeUrlInput && youtubeUrlInput.value) {
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

  // Hero CTAs
  const heroStartBtn = document.getElementById('hero-start-btn');
  const heroDemoBtn = document.getElementById('hero-demo-btn');

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

  // Hero Section CTAs Click handlers
  if (heroStartBtn) {
    heroStartBtn.addEventListener('click', () => {
      document.getElementById('search-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
      youtubeUrlInput.focus();
    });
  }

  if (heroDemoBtn) {
    heroDemoBtn.addEventListener('click', () => {
      const demoUrl = "https://www.youtube.com/watch?v=iG9CE55wbtY"; // TED Talk default
      youtubeUrlInput.value = demoUrl;
      document.getElementById('search-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
      loadVideo(demoUrl);
    });
  }

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

  // Initialize Curated Video Preview Cards in gallery
  initVideoGallery();

  // Initialize FAQ accordions
  initFaqAccordions();

  // Load Gamification stats (Streak & Daily Challenge)
  initGamification();

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
  
  // Show Skeletons
  document.getElementById('player-skeleton').classList.remove('hidden');
  document.getElementById('subtitles-skeleton').classList.remove('hidden');
  document.getElementById('player-placeholder').classList.add('hidden');
  document.getElementById('subtitles-container').querySelectorAll('.sub-segment').forEach(s => s.classList.add('hidden'));

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
  // Hide Player Skeleton
  document.getElementById('player-skeleton').classList.add('hidden');

  // Reset speed to active selection
  const activeSpeedBtn = document.querySelector('.speed-btn.active');
  if (activeSpeedBtn && player.setPlaybackRate) {
    player.setPlaybackRate(parseFloat(activeSpeedBtn.dataset.speed));
  }

  // Save to "Continue Learning"
  const videoData = player.getVideoData();
  if (videoData) {
    const videoTitle = videoData.title;
    const videoUrl = player.getVideoUrl();
    const lastVideoInfo = { url: videoUrl, title: videoTitle };
    localStorage.setItem('lingotube_last_video', JSON.stringify(lastVideoInfo));
    updateContinueLearningWidget(lastVideoInfo);
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

// Fetch Subtitles from backend with client-side fallback scraper
async function fetchSubtitles(videoId) {
  const container = document.getElementById('subtitles-container');
  const countBadge = document.getElementById('subtitle-count');
  const subtitlesSkeleton = document.getElementById('subtitles-skeleton');
  
  countBadge.textContent = 'Yuklanmoqda...';

  try {
    const response = await fetch(`/api/transcript?v=${videoId}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch transcript');
    }

    transcriptData = data.transcript;
    countBadge.textContent = `${transcriptData.length} qator`;
    
    // Hide skeletons and render
    subtitlesSkeleton.classList.add('hidden');
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
      
      subtitlesSkeleton.classList.add('hidden');
      renderSubtitles(transcriptData);
    } catch (fallbackError) {
      console.error('Fallback transcript fetch also failed:', fallbackError);
      subtitlesSkeleton.classList.add('hidden');
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
  // Remove placeholders and load new segments
  container.querySelectorAll('.sub-segment').forEach(s => s.remove());
  const placeholder = container.querySelector('.subtitles-placeholder');
  if (placeholder) placeholder.remove();

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
    
    const words = segment.text.split(/\s+/);
    words.forEach(word => {
      if (word.trim() === '') return;
      
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.textContent = word + ' ';
      
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
    
    segmentDiv.addEventListener('click', () => {
      seekToTime(segment.start);
    });

    container.appendChild(segmentDiv);
  });
}

// Clean word helper (removes leading/trailing punctuation)
function cleanWord(word) {
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
        break;
      }
    }
  }

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
  document.querySelectorAll('.word').forEach(w => w.classList.remove('clicked-word'));
  element.classList.add('clicked-word');
  
  selectedWord = cleanedWord;
  
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
    
    const langNames = {
      'uz': "O'zbekcha", 'ru': "Ruscha", 'tr': "Turkcha",
      'es': "Ispancha", 'de': "Nemischa", 'fr': "Fransuzcha", 'ar': "Arabcha"
    };
    detectedLangSpan.textContent = langNames[data.from] || data.from.toUpperCase();

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
  let inlineTranslation = segmentElement.querySelector('.inline-translation');
  if (inlineTranslation) {
    inlineTranslation.remove();
    return;
  }

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
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    
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
    // Remove
    vocabulary.splice(wordIndex, 1);
    updateSaveButtonState(false);
  } else {
    // Add new word
    const vocabItem = {
      word: selectedWord,
      translation: selectedWordTranslation,
      date: new Date().toLocaleDateString('uz-UZ')
    };
    vocabulary.unshift(vocabItem);
    updateSaveButtonState(true);
    
    // Increment daily challenge progress
    incrementDailyChallenge();
  }

  // Save to localStorage
  localStorage.setItem('lingotube_vocab', JSON.stringify(vocabulary));
  
  // Render and update achievements
  renderVocabulary();
  checkAchievements();
}

function updateSaveButtonState(isSaved) {
  const saveBtn = document.getElementById('save-vocab-btn');
  if (isSaved) {
    saveBtn.className = 'btn save-btn saved';
    saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saqlandi';
  } else {
    saveBtn.className = 'btn save-btn';
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

  quizBtn.disabled = vocabulary.length < 4;
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

    const speakBtn = document.createElement('button');
    speakBtn.className = 'icon-btn mini-btn tooltip';
    speakBtn.dataset.tooltip = "Talaffuz";
    speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord(item.word);
    });

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
    
    card.addEventListener('click', () => {
      selectedWord = item.word;
      translateWord(item.word);
    });

    grid.appendChild(card);
  });
}

// Delete item
function deleteVocabularyItem(index) {
  vocabulary.splice(index, 1);
  localStorage.setItem('lingotube_vocab', JSON.stringify(vocabulary));
  
  if (selectedWord) {
    const isStillSaved = vocabulary.some(item => item.word.toLowerCase() === selectedWord.toLowerCase());
    updateSaveButtonState(isStillSaved);
  }

  renderVocabulary();
  checkAchievements();
}

// Clear all
function clearAllVocabulary() {
  if (confirm("Haqiqatdan ham lug'at daftaringizdagi barcha so'zlarni o'chirmoqchimisiz?")) {
    vocabulary = [];
    localStorage.removeItem('lingotube_vocab');
    updateSaveButtonState(false);
    renderVocabulary();
    checkAchievements();
  }
}

// Subtitle searching
function handleSubtitleSearch() {
  const query = document.getElementById('search-subtitles').value.toLowerCase().trim();
  const clearBtn = document.getElementById('clear-search-btn');
  const segments = document.querySelectorAll('.sub-segment');

  if (query === '') {
    clearBtn.classList.add('hidden');
    segments.forEach(seg => {
      seg.style.display = 'flex';
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

function clearSubtitleSearch() {
  const searchInput = document.getElementById('search-subtitles');
  searchInput.value = '';
  handleSubtitleSearch();
}

// FAQ Accordion logic
function initFaqAccordions() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(f => f.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

// Video Gallery Loader logic
function initVideoGallery() {
  const galleryCards = document.querySelectorAll('.gallery-card');
  const youtubeUrlInput = document.getElementById('youtube-url');
  
  galleryCards.forEach(card => {
    card.addEventListener('click', () => {
      const videoId = card.dataset.videoId;
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      youtubeUrlInput.value = url;
      
      document.getElementById('search-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
      loadVideo(url);
    });
  });
}

// Continue Learning Widget
function updateContinueLearningWidget(videoInfo) {
  const continueSection = document.getElementById('continue-learning-section');
  const continueTitle = document.getElementById('continue-video-title');
  const resumeBtn = document.getElementById('continue-resume-btn');
  
  if (videoInfo && videoInfo.url) {
    continueTitle.textContent = videoInfo.title;
    continueSection.classList.remove('hidden');
    
    // Clear and set listener
    const newResumeBtn = resumeBtn.cloneNode(true);
    resumeBtn.parentNode.replaceChild(newResumeBtn, resumeBtn);
    
    newResumeBtn.addEventListener('click', () => {
      const urlInput = document.getElementById('youtube-url');
      urlInput.value = videoInfo.url;
      loadVideo(videoInfo.url);
      document.getElementById('search-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  } else {
    continueSection.classList.add('hidden');
  }
}

// ==========================================================
// Gamification Engine (Streaks, Achievements, Challenges)
// ==========================================================
function initGamification() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  // 1. Streak Manager
  if (lastActiveDate === today) {
    // Already active today
  } else if (lastActiveDate === yesterday) {
    // Consecutive active day
    streak++;
    lastActiveDate = today;
  } else {
    // Break streak or first time
    streak = 1;
    lastActiveDate = today;
  }
  
  localStorage.setItem('lingotube_streak', streak);
  localStorage.setItem('lingotube_last_active', lastActiveDate);
  document.getElementById('streak-counter').textContent = `${streak} kun`;

  // 2. Daily Challenge Manager
  if (challengeDate !== today) {
    challengeDate = today;
    challengeProgress = 0;
    localStorage.setItem('lingotube_challenge_date', challengeDate);
    localStorage.setItem('lingotube_challenge_progress', challengeProgress);
  }
  
  updateChallengeUI();

  // 3. Load Achievements
  checkAchievements();
}

function incrementDailyChallenge() {
  const today = new Date().toISOString().split('T')[0];
  if (challengeProgress < 3) {
    challengeProgress++;
    localStorage.setItem('lingotube_challenge_progress', challengeProgress);
    updateChallengeUI();
  }
}

function updateChallengeUI() {
  const progressFill = document.getElementById('challenge-progress-fill');
  const statusSpan = document.getElementById('challenge-status');
  const descSpan = document.getElementById('challenge-desc');
  
  const widthPercent = Math.min((challengeProgress / 3) * 100, 100);
  progressFill.style.width = `${widthPercent}%`;
  statusSpan.textContent = `${challengeProgress} / 3`;
  
  if (challengeProgress >= 3) {
    descSpan.innerHTML = '<span style="text-decoration: line-through; opacity: 0.5">Lug\'atga 3 ta so\'z qo\'shing</span> <span style="color: var(--success-color)">Bajarildi! 🔥</span>';
  } else {
    descSpan.textContent = "Lug'atga 3 ta so'z qo'shing";
  }
}

// Achievement checking logic
function checkAchievements() {
  const badges = {
    'first_word': { condition: () => vocabulary.length >= 1, id: 'badge-first-word' },
    'vocab_builder': { condition: () => vocabulary.length >= 10, id: 'badge-vocab-builder' },
    'streak_3': { condition: () => streak >= 3, id: 'badge-streak-3' },
    'quiz_champion': { condition: () => unlockedAchievements.includes('quiz_champion_unlocked'), id: 'badge-quiz-champion' }
  };

  Object.entries(badges).forEach(([key, badge]) => {
    const element = document.getElementById(badge.id);
    if (!element) return;

    if (badge.condition() || unlockedAchievements.includes(key)) {
      element.classList.remove('locked');
      if (!unlockedAchievements.includes(key)) {
        unlockedAchievements.push(key);
      }
    } else {
      element.classList.add('locked');
    }
  });

  localStorage.setItem('lingotube_achievements', JSON.stringify(unlockedAchievements));
}

// Flashcard Quiz Game Logic
function startQuiz() {
  if (vocabulary.length < 4) return;

  const modal = document.getElementById('quiz-modal');
  modal.classList.remove('hidden');

  const numQuestions = Math.min(5, vocabulary.length);
  quizQuestions = [];
  
  const shuffledVocab = [...vocabulary].sort(() => 0.5 - Math.random());
  
  for (let i = 0; i < numQuestions; i++) {
    const correctItem = shuffledVocab[i];
    
    const incorrectChoices = vocabulary
      .filter(item => item.word.toLowerCase() !== correctItem.word.toLowerCase())
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(item => item.translation);
      
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
  const progressPercent = (currentQuizIndex / quizQuestions.length) * 100;
  document.getElementById('quiz-progress').style.width = `${progressPercent}%`;

  document.getElementById('quiz-word').textContent = question.word;
  
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
  
  buttons.forEach(btn => btn.disabled = true);

  const feedbackDiv = document.getElementById('quiz-feedback');
  const feedbackText = document.getElementById('quiz-feedback-text');
  const nextBtn = document.getElementById('quiz-next-btn');

  speakWord(quizQuestions[currentQuizIndex].word);

  if (chosenOption === correctOption) {
    selectedBtn.classList.add('correct');
    feedbackText.textContent = "To'g'ri! Barakalla!";
    feedbackText.className = 'correct-text';
    quizScore++;
  } else {
    selectedBtn.classList.add('incorrect');
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

  // If scored 100% in a quiz (at least 4 questions), unlock quiz champion achievement!
  if (quizScore === quizQuestions.length && quizQuestions.length >= 4) {
    feedbackText.textContent = "Daxshat natija! 100% javob berdiz! 🏆";
    feedbackText.className = 'correct-text';
    if (!unlockedAchievements.includes('quiz_champion')) {
      unlockedAchievements.push('quiz_champion_unlocked');
      unlockedAchievements.push('quiz_champion');
      localStorage.setItem('lingotube_achievements', JSON.stringify(unlockedAchievements));
      checkAchievements();
    }
  } else {
    feedbackText.textContent = quizScore === quizQuestions.length ? "Mukammal! 100%!" : "Yaxshi urinish! Yana takrorlab ko'ring.";
    feedbackText.className = 'correct-text';
  }

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
