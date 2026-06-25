const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');
const translate = require('google-translate-api-x');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Setup (db.json as local JSON database)
const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDB(getDefaultDB());
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    console.error("Error reading database:", err);
    return getDefaultDB();
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

function getDefaultDB() {
  // Passwords hashed for security (password hash for "admin123", "teacher123", "student123")
  const adminHash = bcrypt.hashSync("admin123", 10);
  const teacherHash = bcrypt.hashSync("teacher123", 10);
  const studentHash = bcrypt.hashSync("student123", 10);

  return {
    users: [
      {
        id: "usr_1",
        email: "admin@lingotube.com",
        passwordHash: adminHash,
        role: "admin",
        subscription: "premium",
        streak: 5,
        achievements: ["first_word", "vocab_builder", "streak_3"]
      },
      {
        id: "usr_2",
        email: "teacher@lingotube.com",
        passwordHash: teacherHash,
        role: "teacher",
        subscription: "premium",
        streak: 3,
        achievements: ["first_word"]
      },
      {
        id: "usr_3",
        email: "student@lingotube.com",
        passwordHash: studentHash,
        role: "student",
        subscription: "free",
        streak: 1,
        achievements: []
      }
    ],
    courses: [
      {
        id: "dQw4w9WgXcQ",
        title: "Rick Astley - Never Gonna Give You Up",
        difficulty: "easy",
        type: "free",
        duration: "3:32",
        desc: "Qo'shiq matni orqali so'z boyligingizni oshiring."
      },
      {
        id: "iG9CE55wbtY",
        title: "Do schools kill creativity? - TED Talk",
        difficulty: "medium",
        type: "free",
        duration: "19:22",
        desc: "Sir Ken Robinsonning eng mashhur taqdimotini tinglang."
      },
      {
        id: "LEjhYFDg_gU",
        title: "Inside Out 2 - Official Teaser Trailer",
        difficulty: "hard",
        type: "premium",
        duration: "2:24",
        desc: "Multfilm treyleridan premium darajadagi kundalik iboralarni o'rganing."
      }
    ]
  };
}

// ---------------- USER AUTHENTICATION ENDPOINTS ----------------

// Register User
app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = readDB();
  const userExists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (userExists) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const newUser = {
    id: 'usr_' + Date.now(),
    email: email.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'student',
    subscription: 'free',
    streak: 1,
    achievements: []
  };

  db.users.push(newUser);
  writeDB(db);

  // Return user without password hash
  const { passwordHash, ...userResponse } = newUser;
  res.json({ success: true, user: userResponse });
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Muntazam parol yoki email xato' });
  }

  // Return user without password hash
  const { passwordHash, ...userResponse } = user;
  res.json({ success: true, user: userResponse });
});

// Google OAuth Simulation
app.post('/api/auth/google', (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const db = readDB();
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Register google user automatically
    user = {
      id: 'usr_' + Date.now(),
      email: email.toLowerCase(),
      name: name,
      passwordHash: '', // no local password
      role: 'student',
      subscription: 'free',
      streak: 1,
      achievements: []
    };
    db.users.push(user);
    writeDB(db);
  }

  const { passwordHash, ...userResponse } = user;
  res.json({ success: true, user: userResponse });
});

// Upgrade Subscription (Monetization Simulator)
app.post('/api/user/subscribe', (req, res) => {
  const { userId, planType } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const db = readDB();
  const userIdx = db.users.findIndex(u => u.id === userId);
  
  if (userIdx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.users[userIdx].subscription = 'premium';
  // Unlock Achievement "Quiz Champion" as badge of loyalty if premium
  if (!db.users[userIdx].achievements.includes('quiz_champion_unlocked')) {
    db.users[userIdx].achievements.push('quiz_champion_unlocked');
  }
  
  writeDB(db);

  const { passwordHash, ...userResponse } = db.users[userIdx];
  res.json({ success: true, user: userResponse });
});

// Save Streaks & Achievements progress
app.post('/api/user/progress', (req, res) => {
  const { userId, streak, achievements } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const db = readDB();
  const userIdx = db.users.findIndex(u => u.id === userId);
  
  if (userIdx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (streak !== undefined) db.users[userIdx].streak = streak;
  if (achievements !== undefined) db.users[userIdx].achievements = achievements;

  writeDB(db);
  res.json({ success: true });
});

// ---------------- COURSE CRUD ENDPOINTS (ADMIN-ONLY CONCEPT) ----------------

// Get Courses
app.get('/api/courses', (req, res) => {
  const db = readDB();
  res.json({ success: true, courses: db.courses });
});

// Create Course (Add YouTube Lesson)
app.post('/api/courses', (req, res) => {
  const { id, title, difficulty, type, duration, desc } = req.body;
  if (!id || !title) {
    return res.status(400).json({ error: 'Video ID and title are required' });
  }

  const db = readDB();
  const courseExists = db.courses.some(c => c.id === id);
  if (courseExists) {
    return res.status(400).json({ error: 'Lesson already exists' });
  }

  const newCourse = {
    id: id,
    title: title,
    difficulty: difficulty || 'easy',
    type: type || 'free',
    duration: duration || '0:00',
    desc: desc || ''
  };

  db.courses.push(newCourse);
  writeDB(db);

  res.json({ success: true, course: newCourse });
});

// Delete Course
app.delete('/api/courses/:id', (req, res) => {
  const courseId = req.params.id;
  const db = readDB();
  const courseIdx = db.courses.findIndex(c => c.id === courseId);
  
  if (courseIdx === -1) {
    return res.status(404).json({ error: 'Course not found' });
  }

  db.courses.splice(courseIdx, 1);
  writeDB(db);
  res.json({ success: true });
});

// ---------------- TRANSCRIPT & TRANSLATE API ----------------

// Fetch YouTube Transcript
app.get('/api/transcript', async (req, res) => {
  const videoId = req.query.v;
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID (v) parameter is required' });
  }

  try {
    console.log(`Fetching transcript for video ID: ${videoId}`);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ error: 'No subtitles found for this video.' });
    }

    res.json({ success: true, transcript });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transcript. YouTube blocks automated access on this server.',
      details: error.message 
    });
  }
});

// Translate word or sentence
app.get('/api/translate', async (req, res) => {
  const { text, to } = req.query;
  
  if (!text) {
    return res.status(400).json({ error: 'Text parameter is required' });
  }
  if (!to) {
    return res.status(400).json({ error: 'Target language (to) parameter is required' });
  }

  try {
    const translationResult = await translate(text, { to: to });
    res.json({
      success: true,
      original: text,
      translation: translationResult.text,
      from: translationResult.from.language.iso
    });
  } catch (error) {
    console.error('Error translating:', error);
    res.status(500).json({ 
      error: 'Translation failed', 
      details: error.message 
    });
  }
});

// ---------------- WOW PORTFOLIO AI ENDPOINT ----------------

// AI Quiz Generator (NLP compiler mimicking Gemini/AI APIs)
app.post('/api/ai/generate-quiz', async (req, res) => {
  const { transcript, to } = req.body;
  if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
    return res.status(400).json({ error: 'Transcript data array is required' });
  }
  const targetLang = to || 'uz';

  try {
    console.log(`AI Quiz Generator: Parsing words for translation to "${targetLang}"`);
    
    // 1. Gather all words from transcript lines
    const wordFrequency = {};
    transcript.forEach(seg => {
      const words = seg.text.split(/\s+/);
      words.forEach(w => {
        const cleaned = w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
        // Filters out stop words and short words
        if (cleaned.length > 5 && !['because', 'should', 'people', 'through', 'without', 'something', 'about', 'would'].includes(cleaned)) {
          wordFrequency[cleaned] = (wordFrequency[cleaned] || 0) + 1;
        }
      });
    });

    // 2. Select 4 most frequent words (or random unique words from the list)
    const uniqueWords = Object.keys(wordFrequency).sort(() => 0.5 - Math.random()).slice(0, 4);
    
    if (uniqueWords.length < 4) {
      // Fallback if not enough words
      uniqueWords.push(...['hello', 'world', 'language', 'teacher', 'student'].slice(0, 4 - uniqueWords.length));
    }

    // 3. Translate selected words using Google Translate API (acting as the AI NLP agent)
    const questions = [];
    const allTranslations = [];

    // First, fetch all translations
    for (const word of uniqueWords) {
      try {
        const transRes = await translate(word, { to: targetLang });
        allTranslations.push({ word, translation: transRes.text });
      } catch (e) {
        allTranslations.push({ word, translation: word === 'hello' ? 'salom' : word });
      }
    }

    // Generate multiple-choice quiz questions
    for (let i = 0; i < allTranslations.length; i++) {
      const correctItem = allTranslations[i];
      
      // Get 3 incorrect choices from other translations
      const incorrectChoices = allTranslations
        .filter((_, idx) => idx !== i)
        .map(item => item.translation);
      
      // Fallbacks if translations are identical
      while (incorrectChoices.length < 3) {
        incorrectChoices.push("Noto'g'ri variant " + incorrectChoices.length);
      }

      // Shuffle options
      const options = [correctItem.translation, ...incorrectChoices].sort(() => 0.5 - Math.random());

      questions.push({
        word: correctItem.word,
        correctTranslation: correctItem.translation,
        options: options
      });
    }

    res.json({ success: true, questions });
  } catch (error) {
    console.error("AI Quiz Generator error:", error);
    res.status(500).json({ error: "AI Quiz compilation failed", details: error.message });
  }
});

// Fallback to index.html for single page application routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
