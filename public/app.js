// LingoTube Frontend JavaScript Logic (Version 1.0.5)

// Global State
let player = null;
let playerReady = false;
let transcriptData = [];
let activeSegmentIndex = -1;
let updateInterval = null;
let selectedWord = '';
let selectedWordTranslation = '';
let currentUser = JSON.parse(sessionStorage.getItem('lingotube_user')) || null;
let coursesCache = [];
let activeVideoType = 'free';
let authMode = 'login'; // 'login' or 'register'

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

  // Navigation Links
  const navHomeBtn = document.getElementById('nav-home-btn');
  const navVocabBtn = document.getElementById('nav-vocab-btn');
  const navAdminBtn = document.getElementById('nav-admin-btn');

  // Auth Modals & Forms
  const closeAuthModalBtn = document.getElementById('close-auth-modal-btn');
  const authForm = document.getElementById('auth-form');
  const authToggleLink = document.getElementById('auth-toggle-link');
  const googleAuthBtn = document.getElementById('google-auth-btn');

  // Paywall actions
  const paywallLoginBtn = document.getElementById('paywall-login-btn');
  const paywallRegisterBtn = document.getElementById('paywall-register-btn');
  const paywallGoogleBtn = document.getElementById('paywall-google-btn');
  const paywallPricingBtn = document.getElementById('paywall-pricing-btn');

  // Pricing & Checkout
  const closePricingModalBtn = document.getElementById('close-pricing-modal-btn');
  const checkoutPremiumBtn = document.getElementById('checkout-premium-btn');
  const closeCheckoutModalBtn = document.getElementById('close-checkout-modal-btn');
  const checkoutForm = document.getElementById('checkout-form');

  // AI Quiz Button
  const aiQuizBtn = document.getElementById('ai-quiz-btn');

  // Chat Support elements
  const chatWidgetBtn = document.getElementById('chat-widget-btn');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const sendChatBtn = document.getElementById('send-chat-btn');
  const chatInput = document.getElementById('chat-input');

  // Admin Course CRUD
  const adminAddCourseForm = document.getElementById('admin-add-course-form');

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

  // Navigation Links Click handlers
  if (navHomeBtn) {
    navHomeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      navHomeBtn.classList.add('active');
      document.getElementById('admin-panel-section').classList.add('hidden');
      document.getElementById('search-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  if (navVocabBtn) {
    navVocabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      navVocabBtn.classList.add('active');
      document.getElementById('admin-panel-section').classList.add('hidden');
      document.getElementById('vocab-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (navAdminBtn) {
    navAdminBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      navAdminBtn.classList.add('active');
      const adminSec = document.getElementById('admin-panel-section');
      adminSec.classList.remove('hidden');
      adminSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Auth Dialog Click handlers
  if (closeAuthModalBtn) {
    closeAuthModalBtn.addEventListener('click', closeAuthModal);
  }

  if (authForm) {
    authForm.addEventListener('submit', handleAuthSubmit);
  }

  if (authToggleLink) {
    authToggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      toggleAuthMode();
    });
  }

  if (googleAuthBtn) {
    googleAuthBtn.addEventListener('click', handleGoogleAuth);
  }

  // Paywall overlay action handlers
  if (paywallLoginBtn) {
    paywallLoginBtn.addEventListener('click', () => openAuthModal('login'));
  }

  if (paywallRegisterBtn) {
    paywallRegisterBtn.addEventListener('click', () => openAuthModal('register'));
  }

  if (paywallGoogleBtn) {
    paywallGoogleBtn.addEventListener('click', handleGoogleAuth);
  }

  if (paywallPricingBtn) {
    paywallPricingBtn.addEventListener('click', openPricingModal);
  }

  // Pricing and Checkout handlers
  if (closePricingModalBtn) {
    closePricingModalBtn.addEventListener('click', () => {
      document.getElementById('pricing-modal').classList.add('hidden');
    });
  }

  if (checkoutPremiumBtn) {
    checkoutPremiumBtn.addEventListener('click', openCheckoutModal);
  }

  if (closeCheckoutModalBtn) {
    closeCheckoutModalBtn.addEventListener('click', () => {
      document.getElementById('checkout-modal').classList.add('hidden');
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleCheckoutSubmit);
  }

  // AI Quiz Button Handler
  if (aiQuizBtn) {
    aiQuizBtn.addEventListener('click', handleAiQuizClick);
  }

  // Chat Trigger and Close Handlers
  if (chatWidgetBtn) {
    chatWidgetBtn.addEventListener('click', () => {
      const chatWin = document.getElementById('chat-window');
      chatWin.classList.toggle('hidden');
      
      // Hide alert dot when user opens chat
      const alertDot = chatWidgetBtn.querySelector('.chat-alert-dot');
      if (alertDot) alertDot.classList.add('hidden');
    });
  }

  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => {
      document.getElementById('chat-window').classList.add('hidden');
    });
  }

  if (sendChatBtn) {
    sendChatBtn.addEventListener('click', () => chatbotSend());
  }

  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        chatbotSend();
      }
    });
  }

  // Admin Course CRUD Form Submit
  if (adminAddCourseForm) {
    adminAddCourseForm.addEventListener('submit', handleAdminAddCourse);
  }

  // Fetch Recommended Videos from Backend and load gallery
  fetchAndRenderCourses();

  // Initialize FAQ accordions
  initFaqAccordions();

  // Load Gamification stats (Streak & Daily Challenge)
  initGamification();

  // Render initial vocabulary
  renderVocabulary();

  // Update Auth header
  updateAuthUI();
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

  // Lookup course type in cache
  const course = coursesCache.find(c => c.id === videoId);
  activeVideoType = course ? course.type : 'free';

  // Hide any active paywall overlays
  document.getElementById('login-paywall').classList.add('hidden');
  document.getElementById('premium-paywall').classList.add('hidden');

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
  // Paywall checks (30s preview limit)
  if (currentTime >= 30) {
    if (!currentUser) {
      // Guest: Pause video and show login paywall
      if (player && player.pauseVideo) {
        player.pauseVideo();
      }
      document.getElementById('login-paywall').classList.remove('hidden');
      return;
    } else if (currentUser.subscription !== 'premium' && activeVideoType === 'premium') {
      // Free Tier User watching Premium lesson: Pause and show premium paywall
      if (player && player.pauseVideo) {
        player.pauseVideo();
      }
      document.getElementById('premium-paywall').classList.remove('hidden');
      return;
    }
  }

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

// ==========================================================
// LMS Auth Controllers & UI Managers
// ==========================================================

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}-toast`;

  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') {
    icon = '<i class="fa-solid fa-circle-check"></i>';
  } else if (type === 'error') {
    icon = '<i class="fa-solid fa-circle-exclamation"></i>';
  } else if (type === 'gold') {
    icon = '<i class="fa-solid fa-crown text-gold"></i>';
  }

  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Automatically remove toast after 5s
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Update authentication state header and admin privileges
function updateAuthUI() {
  const authContainer = document.getElementById('auth-status-container');
  const navAdminBtn = document.getElementById('nav-admin-btn');
  const adminPanelSection = document.getElementById('admin-panel-section');

  if (!authContainer) return;

  if (currentUser) {
    // User is logged in
    const firstLetter = currentUser.email ? currentUser.email[0].toUpperCase() : 'U';
    const isPremium = currentUser.subscription === 'premium';
    const tierBadge = isPremium 
      ? '<span class="badge gold-badge" style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 20px; background: var(--gold-gradient); color: #05070f; box-shadow: 0 0 10px rgba(251, 191, 36, 0.4);"><i class="fa-solid fa-crown"></i> VIP</span>' 
      : '<span class="badge free-badge" style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-color); color: var(--text-secondary);">FREE</span>';

    authContainer.innerHTML = `
      <div class="user-profile-btn" id="header-profile-menu">
        <div class="user-avatar-circle">${firstLetter}</div>
        <span class="user-email-text" style="font-size: 13px; font-weight: 600; color: white;">${currentUser.email}</span>
        ${tierBadge}
        <button id="header-logout-btn" class="btn outline-btn mini-btn" style="padding: 6px 12px; font-size: 11px; margin-left: 10px;">
          <i class="fa-solid fa-right-from-bracket"></i> Chiqish
        </button>
      </div>
    `;

    // Hook logout action
    document.getElementById('header-logout-btn').addEventListener('click', handleLogout);

    // Enforce Admin Access
    if (currentUser.role === 'admin') {
      navAdminBtn.classList.remove('hidden');
    } else {
      navAdminBtn.classList.add('hidden');
      adminPanelSection.classList.add('hidden');
    }
  } else {
    // Guest User
    authContainer.innerHTML = `
      <button id="header-login-btn" class="btn outline-btn mini-btn"><i class="fa-solid fa-right-to-bracket"></i> Login</button>
      <button id="header-register-btn" class="btn primary-btn mini-btn"><i class="fa-solid fa-user-plus"></i> Register</button>
    `;

    // Hook login/register buttons
    document.getElementById('header-login-btn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('header-register-btn').addEventListener('click', () => openAuthModal('register'));

    navAdminBtn.classList.add('hidden');
    adminPanelSection.classList.add('hidden');
  }
}

// Open Auth dialog modal
function openAuthModal(mode) {
  authMode = mode;
  const modal = document.getElementById('auth-modal');
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const errorMsg = document.getElementById('auth-error-msg');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');

  errorMsg.classList.add('hidden');
  emailInput.value = '';
  passwordInput.value = '';
  modal.classList.remove('hidden');

  if (mode === 'login') {
    title.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Tizimga Kirish / Login';
    submitBtn.textContent = 'Kirish / Login';
    document.getElementById('auth-toggle-link').textContent = "Ro'yxatdan o'tish";
    document.querySelector('.auth-toggle-prompt').firstChild.textContent = "Akkauntingiz yo'qmi? ";
  } else {
    title.innerHTML = '<i class="fa-solid fa-user-plus"></i> Ro\'yxatdan O\'tish / Register';
    submitBtn.textContent = "Ro'yxatdan o'tish / Register";
    document.getElementById('auth-toggle-link').textContent = "Kirish";
    document.querySelector('.auth-toggle-prompt').firstChild.textContent = "Akkauntingiz bormi? ";
  }
}

// Close Auth dialog modal
function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

// Toggle Auth mode (login vs register)
function toggleAuthMode() {
  if (authMode === 'login') {
    openAuthModal('register');
  } else {
    openAuthModal('login');
  }
}

// Handle login/register submit form
async function handleAuthSubmit(e) {
  e.preventDefault();
  
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorMsg = document.getElementById('auth-error-msg');
  
  if (!email || !password) {
    errorMsg.textContent = "Iltimos barcha maydonlarni to'ldiring";
    errorMsg.classList.remove('hidden');
    return;
  }

  const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Server error occurred');
    }

    // Success login/register
    currentUser = data.user;
    sessionStorage.setItem('lingotube_user', JSON.stringify(currentUser));
    
    closeAuthModal();
    updateAuthUI();
    showToast(`${currentUser.email} muvaffaqiyatli kirdi! 🎉`, 'success');

    // Unlock achievements checking
    checkAchievements();

    // If video was blocked by paywall and user just authenticated, check if we can resume
    checkAndResumeVideo();

  } catch (err) {
    console.error("Auth error:", err);
    errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${err.message}`;
    errorMsg.classList.remove('hidden');
  }
}

// Mock Google OAuth Auth
async function handleGoogleAuth() {
  const randomId = Math.floor(Math.random() * 1000);
  const mockEmail = `google.student${randomId}@gmail.com`;
  const mockName = `Google Student ${randomId}`;

  try {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mockEmail, name: mockName })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Google auth simulation failed');
    }

    currentUser = data.user;
    sessionStorage.setItem('lingotube_user', JSON.stringify(currentUser));
    
    closeAuthModal();
    updateAuthUI();
    showToast(`Google orqali kirdingiz: ${currentUser.email} 🚀`, 'success');

    checkAchievements();
    checkAndResumeVideo();

  } catch (err) {
    console.error("Google Auth error:", err);
    showToast("Google orqali kirish simulyatsiyasi muvaffaqiyatsiz tugadi.", "error");
  }
}

// Handle Logout
function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem('lingotube_user');
  updateAuthUI();
  showToast("Akkauntdan chiqdingiz. Sayt mehmon rejimidan ishlaydi.", 'info');

  // Pause video if time is currently past 30s to re-trigger paywall
  if (player && player.getCurrentTime && player.getCurrentTime() >= 30) {
    player.pauseVideo();
    document.getElementById('login-paywall').classList.remove('hidden');
  }
}

// Check auth state to automatically resume playback
function checkAndResumeVideo() {
  if (player && player.getCurrentTime) {
    const time = player.getCurrentTime();
    if (time >= 30) {
      if (currentUser) {
        if (activeVideoType === 'premium' && currentUser.subscription !== 'premium') {
          // Keep paused and show premium paywall
          document.getElementById('login-paywall').classList.add('hidden');
          document.getElementById('premium-paywall').classList.remove('hidden');
        } else {
          // Logged in, and plan unlocks video
          document.getElementById('login-paywall').classList.add('hidden');
          document.getElementById('premium-paywall').classList.add('hidden');
          player.playVideo();
        }
      }
    }
  }
}

// ==========================================================
// Pricing and Payment Simulator (Stripe Gateway Mockup)
// ==========================================================

// Open Pricing Modal
function openPricingModal() {
  const modal = document.getElementById('pricing-modal');
  modal.classList.remove('hidden');

  // If user is premium, change plan card button labels
  const checkoutBtn = document.getElementById('checkout-premium-btn');
  if (currentUser && currentUser.subscription === 'premium') {
    checkoutBtn.textContent = 'Amaldagi VIP tarif';
    checkoutBtn.disabled = true;
  } else {
    checkoutBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> VIP Premium Obuna';
    checkoutBtn.disabled = false;
  }
}

// Open Checkout Simulator Modal
function openCheckoutModal() {
  if (!currentUser) {
    document.getElementById('pricing-modal').classList.add('hidden');
    openAuthModal('login');
    showToast("Premium sotib olish uchun iltimos tizimga kiring.", "info");
    return;
  }

  // Pre-fill fields for Stripe simulation
  document.getElementById('card-number').value = '4242 4242 4242 4242';
  document.getElementById('card-expiry').value = '12/29';
  document.getElementById('card-cvv').value = '242';
  document.getElementById('card-name').value = currentUser.email.split('@')[0].toUpperCase();

  document.getElementById('checkout-modal').classList.remove('hidden');
}

// Handle Stripe simulation submit
async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const cardNum = document.getElementById('card-number').value;
  const cardExpiry = document.getElementById('card-expiry').value;
  const cardCvv = document.getElementById('card-cvv').value;

  if (cardNum.length < 19 || cardExpiry.length < 5 || cardCvv.length < 3) {
    showToast("Iltimos karta ma'lumotlarini to'g'ri kiriting.", "error");
    return;
  }

  showToast("Stripe to'lov shlyuzi yuklanmoqda... 💳", 'info');

  try {
    const response = await fetch('/api/user/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, planType: 'premium' })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upgrade subscription failed');
    }

    // Success checkout
    currentUser = data.user;
    sessionStorage.setItem('lingotube_user', JSON.stringify(currentUser));

    // Close modals
    document.getElementById('checkout-modal').classList.add('hidden');
    document.getElementById('pricing-modal').classList.add('hidden');

    // Update Header
    updateAuthUI();

    showToast("To'lov muvaffaqiyatli yakunlandi! Siz endi VIP a'zosiz! 💎🏆", 'success');
    
    // Unlock loyalty achievement
    if (!unlockedAchievements.includes('quiz_champion')) {
      unlockedAchievements.push('quiz_champion');
      localStorage.setItem('lingotube_achievements', JSON.stringify(unlockedAchievements));
      checkAchievements();
    }

    // Unblock premium player paywall
    checkAndResumeVideo();

  } catch (err) {
    console.error("Payment error:", err);
    showToast(`To'lovda xatolik yuz berdi: ${err.message}`, 'error');
  }
}

// ==========================================================
// Advanced AI Quiz compiler (Connected to Backend NLP APIs)
// ==========================================================

async function handleAiQuizClick() {
  if (!currentUser) {
    openAuthModal('login');
    showToast("AI Test yaratish uchun iltimos tizimga kiring.", "info");
    return;
  }

  if (currentUser.subscription !== 'premium') {
    openPricingModal();
    showToast("AI Generator Testi faqatgina VIP Premium foydalanuvchilar uchundir! 💎", 'gold');
    return;
  }

  if (transcriptData.length === 0) {
    showToast("Viktorina yaratish uchun avval videoni yuklang.", "error");
    return;
  }

  showToast("Gemini NLP modeli orqali so'zlar tahlil qilinmoqda... 🪄🤖", "success");

  // Open Quiz Modal directly and show spinner skeleton inside
  const modal = document.getElementById('quiz-modal');
  const quizWord = document.getElementById('quiz-word');
  const optionsGrid = document.getElementById('quiz-options');
  const feedbackDiv = document.getElementById('quiz-feedback');
  
  document.getElementById('quiz-header-title').innerHTML = '<i class="fa-solid fa-wand-magic-sparkles text-gold"></i> AI Generator Quiz';
  document.getElementById('quiz-progress').style.width = '0%';
  quizWord.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-gold" style="font-size: 40px;"></i><p style="font-size: 14px; margin-top: 10px; font-weight: 500; color: var(--text-secondary);">Subtitrdan murakkab inglizcha terminlar o\'rganilmoqda va tarjima qilinmoqda...</p>';
  optionsGrid.innerHTML = '';
  feedbackDiv.classList.add('hidden');
  modal.classList.remove('hidden');

  try {
    const response = await fetch('/api/ai/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcriptData,
        to: document.getElementById('target-lang').value
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'AI quiz compilation failed');
    }

    quizQuestions = data.questions;
    currentQuizIndex = 0;
    quizScore = 0;

    // Load first question
    setTimeout(() => {
      loadQuizQuestion();
    }, 1500);

  } catch (error) {
    console.error("AI Quiz Generator error:", error);
    showToast("AI Test yaratishda xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.", "error");
    modal.classList.add('hidden');
  }
}

// ==========================================================
// Simulated Live Support Chatbot
// ==========================================================

function chatbotSend() {
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  
  if (!chatInput) return;

  const text = chatInput.value.trim();
  if (text === '') return;

  // Append user message
  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'msg user-msg';
  userMsgDiv.innerHTML = `
    <p>${escapeHtml(text)}</p>
    <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
  `;
  chatMessages.appendChild(userMsgDiv);
  chatInput.value = '';
  
  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Mock bot typing state after 400ms
  setTimeout(() => {
    // Generate intelligent reply
    let reply = "Savolingiz o'rganilmoqda. Tushunarsiz so'zlar bo'lsa dars davomida subtitrni bosing!";
    const norm = text.toLowerCase();
    
    if (norm.includes('salom') || norm.includes('hello')) {
      reply = "Salom! Men aqlli LingoBot ko'makchisiman. Sizga ingliz tili darslari yoki tarjima masalalarida qanday yordam bera olaman? 😊";
    } else if (norm.includes('parol') || norm.includes('admin') || norm.includes('akkaunt')) {
      reply = "Platformadagi test administrator kirish ma'lumotlari: email 'admin@lingotube.com', parol: 'admin123'. Ushbu ma'lumotlar bilan Admin panelni boshqarishingiz mumkin!";
    } else if (norm.includes('premium') || norm.includes('vip') || norm.includes('obuna') || norm.includes('pul')) {
      reply = "Premium VIP obuna orqali cheksiz AI darslari, Google translate orqali oqimli tarjimalar va barcha premium videolarni to'liq ko'rish imkoniyatiga ega bo'lasiz. Narxi oyiga $9.99! 💎";
    } else if (norm.includes('kim') || norm.includes('nima')) {
      reply = "Men LingoTube platformasining sun'iy intellektga asoslangan o'quv yordamchisiman.";
    } else if (norm.includes(' IELTS') || norm.includes('gramatika') || norm.includes('grammar')) {
      reply = "IELTS va grammatikani eng tez va oson o'rganish usuli - bu video darslarni muntazam tomosha qilishdir. Har kuni 3 tadan yangi so'zni lug'at daftarchangizga saqlang.";
    }

    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = 'msg bot-msg';
    botMsgDiv.innerHTML = `
      <p>${reply}</p>
      <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    chatMessages.appendChild(botMsgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Trigger alert dot if chat is closed
    const chatWin = document.getElementById('chat-window');
    if (chatWin.classList.contains('hidden')) {
      const alertDot = document.getElementById('chat-widget-btn').querySelector('.chat-alert-dot');
      if (alertDot) alertDot.classList.remove('hidden');
      showToast("LingoBot Assistantdan yangi xabar keldi 💬", "info");
    }

  }, 1000);
}

// Escape HTML safety helper
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ==========================================================
// Admin Panel Course CRUD Manager
// ==========================================================

async function handleAdminAddCourse(e) {
  e.preventDefault();

  const videoId = document.getElementById('admin-video-id').value.trim();
  const title = document.getElementById('admin-video-title').value.trim();
  const difficulty = document.getElementById('admin-video-difficulty').value;
  const type = document.getElementById('admin-video-type').value;
  const desc = document.getElementById('admin-video-desc').value.trim();

  if (!videoId || !title) {
    showToast("Iltimos, video ID va nomini kiriting.", "error");
    return;
  }

  try {
    const response = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: videoId,
        title: title,
        difficulty: difficulty,
        type: type,
        desc: desc,
        duration: '5:00' // Mock duration
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add lesson');
    }

    showToast("Dars muvaffaqiyatli ravishda bazaga qo'shildi! 🎬🚀", 'success');
    
    // Clear form inputs
    document.getElementById('admin-video-id').value = '';
    document.getElementById('admin-video-title').value = '';
    document.getElementById('admin-video-desc').value = '';

    // Reload courses list dynamically
    fetchAndRenderCourses();

  } catch (error) {
    console.error("Admin add course error:", error);
    showToast(`Xatolik: ${error.message}`, 'error');
  }
}

// Fetch Courses from REST Endpoint
async function fetchAndRenderCourses() {
  const gallery = document.querySelector('.videos-gallery');
  if (!gallery) return;

  try {
    const response = await fetch('/api/courses');
    const data = await response.json();

    if (response.ok && data.success) {
      coursesCache = data.courses;
      renderCoursesGallery(coursesCache);
    }
  } catch (error) {
    console.error("Error fetching courses:", error);
  }
}

// Render video card previews dynamically inside galleries
function renderCoursesGallery(courses) {
  const gallery = document.querySelector('.videos-gallery');
  if (!gallery) return;

  gallery.innerHTML = '';

  courses.forEach(course => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.videoId = course.id;

    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb';
    thumb.style.backgroundImage = `url('https://img.youtube.com/vi/${course.id}/mqdefault.jpg')`;

    const durationSpan = document.createElement('span');
    durationSpan.className = 'video-duration';
    durationSpan.textContent = course.duration || '5:00';
    thumb.appendChild(durationSpan);

    if (course.type === 'premium') {
      const ribbon = document.createElement('span');
      ribbon.className = 'premium-ribbon';
      ribbon.innerHTML = '<i class="fa-solid fa-crown"></i> Premium';
      thumb.appendChild(ribbon);
    }

    const playOverlay = document.createElement('div');
    playOverlay.className = 'play-overlay';
    playOverlay.innerHTML = '<i class="fa-solid fa-play"></i>';
    thumb.appendChild(playOverlay);

    const content = document.createElement('div');
    content.className = 'gallery-content';

    const diffBadge = document.createElement('span');
    const diffNames = { easy: "Boshlang'ich", medium: "O'rta", hard: "Qiyin" };
    const diffType = course.type === 'premium' ? 'Premium' : 'Free';
    diffBadge.className = `diff-badge ${course.difficulty}`;
    diffBadge.textContent = `${diffNames[course.difficulty] || course.difficulty} / ${diffType}`;
    content.appendChild(diffBadge);

    const titleH4 = document.createElement('h4');
    titleH4.textContent = course.title;
    content.appendChild(titleH4);

    const descP = document.createElement('p');
    descP.textContent = course.desc || '';
    content.appendChild(descP);

    card.appendChild(thumb);
    card.appendChild(content);

    // Card click handler loads video and scrolls to search section
    card.addEventListener('click', () => {
      const urlInput = document.getElementById('youtube-url');
      const url = `https://www.youtube.com/watch?v=${course.id}`;
      urlInput.value = url;

      document.getElementById('search-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
      loadVideo(url);
    });

    gallery.appendChild(card);
  });
}
