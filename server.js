const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:8080',
      'https://josephbarbier.github.io',
      // Add variations for GitHub Pages
      'https://josephbarbier.github.io/guess-the-code',
      'https://JosephBARBIERDARNAL.github.io',
      'https://JosephBARBIERDARNAL.github.io/guess-the-code'
    ].filter(Boolean);
    
    console.log('CORS check - Origin:', origin);
    console.log('CORS check - Allowed origins:', allowedOrigins);
    
    // If FRONTEND_URL is not set, allow GitHub Pages domains for development
    if (!process.env.FRONTEND_URL && origin && origin.includes('github.io')) {
      console.log('FRONTEND_URL not set, allowing GitHub Pages origin:', origin);
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));

// Database setup
const db = new sqlite3.Database('./game_results.db');

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    snippets TEXT,
    game_mode TEXT,
    is_completed BOOLEAN DEFAULT FALSE
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    player_name TEXT,
    score INTEGER,
    total_questions INTEGER,
    time_taken REAL,
    game_mode TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions (id)
  )`);
});

// Load snippets for validation
let snippetsData = [];
try {
  const snippetsPath = path.join(__dirname, 'snippets.json');
  console.log('Looking for snippets at:', snippetsPath);
  console.log('File exists:', fs.existsSync(snippetsPath));
  
  if (fs.existsSync(snippetsPath)) {
    const fileContent = fs.readFileSync(snippetsPath, 'utf8');
    snippetsData = JSON.parse(fileContent);
    console.log('Loaded snippets:', snippetsData.length);
  } else {
    console.warn('snippets.json not found at:', snippetsPath);
    // Create a fallback snippet for testing
    snippetsData = [{
      "language": "JavaScript",
      "code": "console.log('Hello, World!');",
      "distractors": ["Python", "Java", "C++"]
    }];
  }
} catch (error) {
  console.error('Error loading snippets:', error);
}

// Helper function to generate session ID
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to shuffle array (same as frontend)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Start game session endpoint
app.post('/api/start-session', [
  body('gameMode').isIn(['classic', 'infinite']),
  body('snippetsCount').optional().isInt({ min: 1, max: 50 })
], (req, res) => {
  console.log('Start session request received:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  if (!snippetsData || snippetsData.length === 0) {
    console.error('No snippets data available');
    return res.status(500).json({ error: 'No snippets data available' });
  }

  const { gameMode, snippetsCount = 10 } = req.body;
  const sessionId = generateSessionId();
  
  console.log('Creating session:', sessionId, 'for mode:', gameMode);
  
  // Select and shuffle snippets
  const shuffledSnippets = shuffleArray(snippetsData);
  const sessionSnippets = gameMode === 'classic' 
    ? shuffledSnippets.slice(0, Math.min(snippetsCount, shuffledSnippets.length))
    : shuffledSnippets;
  
  console.log('Session snippets count:', sessionSnippets.length);
  
  // Store session in database
  db.run(
    'INSERT INTO game_sessions (id, snippets, game_mode) VALUES (?, ?, ?)',
    [sessionId, JSON.stringify(sessionSnippets), gameMode],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to create session' });
      }
      
      console.log('Session created successfully:', sessionId);
      res.json({
        sessionId,
        snippets: sessionSnippets,
        gameMode
      });
    }
  );
});

// Validate game result endpoint
app.post('/api/validate-result', [
  body('sessionId').isLength({ min: 64, max: 64 }),
  body('playerName').isLength({ min: 1, max: 50 }).escape(),
  body('score').isInt({ min: 0 }),
  body('totalQuestions').isInt({ min: 0 }), // Allow 0 for infinite mode
  body('timeTaken').isFloat({ min: 0 }),
  body('gameMode').isIn(['classic', 'infinite']),
  body('answers').isArray()
], (req, res) => {
  console.log('Validate result request:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { sessionId, playerName, score, totalQuestions, timeTaken, gameMode, answers } = req.body;
  
  console.log('Validating result for session:', sessionId);
  
  // Verify session exists
  db.get(
    'SELECT * FROM game_sessions WHERE id = ? AND is_completed = FALSE',
    [sessionId],
    (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!session) {
        console.log('Session not found or already completed:', sessionId);
        return res.status(400).json({ error: 'Invalid or expired session' });
      }
      
      console.log('Session found:', session.game_mode);
      const sessionSnippets = JSON.parse(session.snippets);
      console.log('Session snippets count:', sessionSnippets.length);
      console.log('Answers received:', answers.length);
      
      // Validate answers against session snippets
      let validatedScore = 0;
      let validatedTotal = 0;
      
      for (let i = 0; i < Math.min(answers.length, sessionSnippets.length); i++) {
        const answer = answers[i];
        const snippet = sessionSnippets[i];
        
        console.log(`Validating answer ${i}:`, answer);
        
        if (snippet && answer.snippetIndex === i) {
          validatedTotal++;
          if (answer.selectedLanguage === snippet.language) {
            validatedScore++;
          }
        }
      }
      
      console.log('Validation results:', { validatedScore, validatedTotal });
      
      // Additional validation checks
      if (gameMode === 'classic' && validatedTotal > sessionSnippets.length) {
        console.log('Invalid answer count for classic mode');
        return res.status(400).json({ error: 'Invalid answer count' });
      }
      
      if (validatedScore > validatedTotal) {
        console.log('Invalid score - score higher than total');
        return res.status(400).json({ error: 'Invalid score' });
      }
      
      // Basic time validation (not too fast) - only for classic mode or if we have answers
      if (validatedTotal > 0) {
        const minExpectedTime = validatedTotal * 1; // At least 1 second per question
        if (timeTaken < minExpectedTime) {
          console.log('Suspicious completion time:', timeTaken, 'min expected:', minExpectedTime);
          return res.status(400).json({ error: 'Suspicious completion time' });
        }
      }
      
      // Save result
      console.log('Saving result to database...');
      db.run(
        'INSERT INTO game_results (session_id, player_name, score, total_questions, time_taken, game_mode) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, playerName, validatedScore, validatedTotal, timeTaken, gameMode],
        function(err) {
          if (err) {
            console.error('Database error saving result:', err);
            return res.status(500).json({ error: 'Failed to save result' });
          }
          
          console.log('Result saved with ID:', this.lastID);
          
          // Mark session as completed
          db.run('UPDATE game_sessions SET is_completed = TRUE WHERE id = ?', [sessionId]);
          
          res.json({
            success: true,
            resultId: this.lastID,
            validatedScore,
            validatedTotal
          });
        }
      );
    }
  );
});

// Get leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  const gameMode = req.query.mode || 'classic';
  const limit = parseInt(req.query.limit) || 5;
  
  db.all(
    `SELECT player_name, score, total_questions, time_taken, created_at,
            ROUND((CAST(score AS FLOAT) / total_questions) * 100, 1) as percentage
     FROM game_results 
     WHERE game_mode = ? AND total_questions > 0
     ORDER BY score DESC, time_taken ASC, created_at ASC
     LIMIT ?`,
    [gameMode, limit],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(rows);
    }
  );
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    snippetsLoaded: snippetsData.length,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Debug endpoint to check snippets
app.get('/api/debug', (req, res) => {
  res.json({
    snippetsCount: snippetsData.length,
    sampleSnippet: snippetsData[0] || null,
    environment: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'not set'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});