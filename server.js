const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');
const translate = require('google-translate-api-x');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch YouTube transcript
app.get('/api/transcript', async (req, res) => {
  const videoId = req.query.v;
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID (v) parameter is required' });
  }

  try {
    console.log(`Fetching transcript for video ID: ${videoId}`);
    
    // Attempt to fetch transcript
    // youtube-transcript automatically tries to find the best available transcript (English or auto-generated)
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ error: 'No subtitles found for this video. Make sure the video has English subtitles.' });
    }

    res.json({ success: true, transcript });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transcript. The video might not have captions enabled, or YouTube blocks automated access.',
      details: error.message 
    });
  }
});

// API endpoint to translate a word or phrase
app.get('/api/translate', async (req, res) => {
  const { text, to } = req.query;
  
  if (!text) {
    return res.status(400).json({ error: 'Text parameter is required' });
  }
  if (!to) {
    return res.status(400).json({ error: 'Target language (to) parameter is required' });
  }

  try {
    console.log(`Translating "${text}" to "${to}"`);
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

// Fallback to index.html for single page application behavior
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
