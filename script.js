document.addEventListener("DOMContentLoaded", () => {
  const codeBlock = document.getElementById("code-block");
  const optionsContainer = document.getElementById("options-container");
  const feedbackText = document.getElementById("feedback-text");
  const currentSnippetEl = document.getElementById("current-snippet");
  const totalSnippetsEl = document.getElementById("total-snippets");
  const timerEl = document.getElementById("timer");
  const resultsScreen = document.getElementById("results-screen");
  const finalTimeEl = document.getElementById("final-time");
  const replayButton = document.getElementById("replay-button");
  const startScreen = document.getElementById("start-screen");
  const gameArea = document.getElementById("game-area");
  const snippetContainer = document.getElementById("snippet-container");
  const titleHeader = document.getElementById("title-header");

  const CLASSIC_MODE = "classic";
  const INFINITE_MODE = "infinite";
  const SNIPPETS_PER_GAME = 10;
  const API_BASE_URL = "https://code-guesser-production.up.railway.app/api";

  let totalAttempts = 0;
  let gameMode = CLASSIC_MODE;
  let classicModeButton;
  let infiniteModeButton;
  let allSnippets = [];
  let currentGameSnippets = [];
  let currentSnippetIndex = 0;
  let score = 0;
  let timerInterval;
  let startTime;
  let timeElapsed = 0;
  let languagesSet = new Set();
  let currentSessionId = null;
  let gameAnswers = [];
  let currentLeaderboardMode = 'classic';

  classicModeButton = document.getElementById("classic-mode-button");
  infiniteModeButton = document.getElementById("infinite-mode-button");

  async function loadSnippets() {
    try {
      const response = await fetch("snippets.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      allSnippets = await response.json();
      allSnippets.forEach((snippet) => languagesSet.add(snippet.language));
      if (allSnippets.length < SNIPPETS_PER_GAME) {
        console.warn(
          `Warning: Not enough snippets in JSON to play a full game of ${SNIPPETS_PER_GAME} snippets. Available: ${allSnippets.length}`
        );
      }
      if (allSnippets.length === 0) {
        codeBlock.textContent =
          "Error: No snippets loaded. Please check snippets.json.";
        optionsContainer.innerHTML = "<p>Cannot start game.</p>";
        return;
      }

      gameArea.classList.add("hidden");
      resultsScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
    } catch (error) {
      console.error("Could not load snippets:", error);
      codeBlock.textContent =
        "Error loading snippets. Please check console for details.";
      optionsContainer.innerHTML =
        "<p>Game cannot start. Ensure snippets.json is available and valid.</p>";
    }
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function updateScoreDisplay() {
    if (gameMode === INFINITE_MODE && totalAttempts > 0) {
      const percentage = Math.round((score / totalAttempts) * 100);
      document.getElementById(
        "current-score"
      ).textContent = `${percentage}% (${score}/${totalAttempts})`;
    } else {
      document.getElementById("current-score").textContent = "0% (0/0)";
    }
  }

  function getDistractors(correctLanguage, snippetDistractors) {
    const distractors = new Set(snippetDistractors || []);
    const allLangsArray = Array.from(languagesSet);
    while (distractors.size < 3) {
      const randomLang =
        allLangsArray[Math.floor(Math.random() * allLangsArray.length)];
      if (randomLang !== correctLanguage) {
        distractors.add(randomLang);
      }
    }
    return Array.from(distractors).slice(0, 3);
  }

  async function startGame(mode) {
    gameMode = mode;
    currentSnippetIndex = 0;
    score = 0;
    totalAttempts = 0;
    timeElapsed = 0;
    gameAnswers = [];

    try {
      // Start a new session with the backend
      console.log("Starting game session with backend:", API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/start-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameMode: mode,
          snippetsCount: SNIPPETS_PER_GAME,
        }),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error response:", errorText);
        throw new Error(`Failed to start game session: ${response.status} ${errorText}`);
      }

      const sessionData = await response.json();
      console.log("Session data received:", sessionData);
      currentSessionId = sessionData.sessionId;
      currentGameSnippets = sessionData.snippets;

      // Update languagesSet based on session snippets
      languagesSet.clear();
      currentGameSnippets.forEach((snippet) =>
        languagesSet.add(snippet.language)
      );
      
      console.log("Game session started successfully:", currentSessionId);
    } catch (error) {
      console.error("Error starting game session:", error);
      alert(`Backend connection failed: ${error.message}. Playing in offline mode.`);
      // Fallback to local mode if backend is unavailable
      currentSessionId = null;
      const shuffledAllSnippets = [...allSnippets];
      shuffleArray(shuffledAllSnippets);

      if (gameMode === CLASSIC_MODE) {
        currentGameSnippets = shuffledAllSnippets.slice(
          0,
          Math.min(SNIPPETS_PER_GAME, allSnippets.length)
        );
      } else {
        currentGameSnippets = shuffledAllSnippets;
      }
    }

    const optionalElements = document.querySelectorAll(".optional-infinite");
    optionalElements.forEach((el) => {
      el.style.display = gameMode === CLASSIC_MODE ? "none" : "";
    });

    updateScoreDisplay();

    if (gameMode === CLASSIC_MODE) {
      totalSnippetsEl.textContent = currentGameSnippets.length;
      document.querySelector("#progress-container p").style.display = "block";
    } else {
      totalSnippetsEl.textContent = "∞";
      document.querySelector("#progress-container p").style.display = "none";
    }

    startScreen.classList.add("hidden");
    resultsScreen.classList.add("hidden");
    gameArea.classList.remove("hidden");
    gameArea.style.opacity = "0";
    gameArea.style.transform = "scale(0.95)";

    requestAnimationFrame(() => {
      gameArea.style.opacity = "1";
      gameArea.style.transform = "scale(1)";
    });

    loadSnippet();
    startTimer();
  }

  function loadSnippet() {
    if (
      gameMode === CLASSIC_MODE &&
      currentSnippetIndex >= currentGameSnippets.length
    ) {
      endGame();
      return;
    }

    if (
      gameMode === INFINITE_MODE &&
      currentSnippetIndex >= currentGameSnippets.length
    ) {
      currentSnippetIndex = 0;
      shuffleArray(currentGameSnippets);
    }

    feedbackText.textContent = "";
    feedbackText.className = "";
    snippetContainer.classList.add("loading");

    setTimeout(() => {
      const snippet = currentGameSnippets[currentSnippetIndex];

      codeBlock.className = "hljs";
      codeBlock.removeAttribute("data-highlighted");
      codeBlock.textContent = snippet.code;

      hljs.highlightElement(codeBlock);

      currentSnippetEl.textContent = currentSnippetIndex + 1;

      const distractors = getDistractors(snippet.language, snippet.distractors);
      const options = [snippet.language, ...distractors];
      shuffleArray(options);

      optionsContainer.innerHTML = "";
      options.forEach((option) => {
        const button = document.createElement("button");
        button.classList.add("option-button");
        button.textContent = option;
        button.addEventListener("click", () =>
          handleOptionClick(option, snippet.language, button)
        );
        optionsContainer.appendChild(button);
      });
      snippetContainer.classList.remove("loading");
    }, 100);
  }

  function handleOptionClick(selectedOption, correctLanguage, button) {
    const buttons = optionsContainer.querySelectorAll(".option-button");
    buttons.forEach((btn) => btn.classList.add("disabled"));

    totalAttempts++;

    // Record the answer for backend validation
    gameAnswers.push({
      snippetIndex: currentSnippetIndex,
      selectedLanguage: selectedOption,
      correctLanguage: correctLanguage,
      isCorrect: selectedOption === correctLanguage,
    });

    if (selectedOption === correctLanguage) {
      score++;
      feedbackText.textContent = "Correct! 🎉";
      feedbackText.className = "correct";
      button.classList.add("correct");
    } else {
      feedbackText.textContent = `Oops! That was ${correctLanguage}.`;
      feedbackText.className = "incorrect";
      button.classList.add("incorrect");

      buttons.forEach((btn) => {
        if (btn.textContent === correctLanguage) {
          btn.classList.add("correct");
        }
      });
    }

    if (gameMode === INFINITE_MODE) {
      updateScoreDisplay();
    }

    setTimeout(() => {
      currentSnippetIndex++;
      loadSnippet();
    }, 500);
  }

  function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
      timeElapsed = (Date.now() - startTime) / 1000;
      timerEl.textContent = timeElapsed.toFixed(1) + "s";
    }, 100);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function endGame() {
    stopTimer();

    if (gameMode === CLASSIC_MODE) {
      gameArea.classList.add("hidden");
      resultsScreen.classList.remove("hidden");
      resultsScreen.style.opacity = "0";
      resultsScreen.style.transform = "scale(0.95)";

      requestAnimationFrame(() => {
        resultsScreen.style.opacity = "1";
        resultsScreen.style.transform = "scale(1)";
      });

      finalTimeEl.textContent = timeElapsed.toFixed(2);
      document.getElementById("final-score").textContent = score;
    } else {
      feedbackText.textContent = `Current score: ${score} (Time: ${timeElapsed.toFixed(
        1
      )}s)`;
      feedbackText.className = "score-display";

      setTimeout(() => {
        currentSnippetIndex++;
        loadSnippet();
      }, 1000);
    }
  }

  // Leaderboard functionality
  async function loadLeaderboard(mode = 'classic') {
    console.log('Loading leaderboard for mode:', mode);
    
    try {
      const url = `${API_BASE_URL}/leaderboard?mode=${mode}&limit=5`;
      console.log('Fetching leaderboard from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });
      
      console.log('Leaderboard response status:', response.status);
      console.log('Leaderboard response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Leaderboard error response:', errorText);
        throw new Error(`Failed to load leaderboard: ${response.status} - ${errorText}`);
      }
      
      const leaderboard = await response.json();
      console.log('Leaderboard data received:', leaderboard);
      displayLeaderboard(leaderboard);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      document.getElementById('leaderboard-list').innerHTML = 
        `<div class="leaderboard-error">Unable to load scores<br><small>${error.message}</small></div>`;
    }
  }

  function displayLeaderboard(scores) {
    const container = document.getElementById('leaderboard-list');
    
    if (scores.length === 0) {
      container.innerHTML = '<div class="no-scores">No scores yet!</div>';
      return;
    }
    
    const html = scores.map((score, index) => `
      <div class="leaderboard-entry">
        <div class="rank">${index + 1}</div>
        <div class="player-info">
          <div class="player-name">${escapeHtml(score.player_name)}</div>
          <div class="player-stats">
            <span class="score">${score.score}/${score.total_questions}</span>
            <span class="time">${score.time_taken}s</span>
          </div>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Save result functionality
  async function saveResult() {
    const playerName = document.getElementById("player-name").value.trim();
    const saveStatus = document.getElementById("save-status");
    const saveButton = document.getElementById("save-button");

    if (!playerName) {
      saveStatus.textContent = "Please enter your name";
      saveStatus.className = "error";
      return;
    }

    if (!currentSessionId) {
      saveStatus.textContent = "Cannot save result - no active session";
      saveStatus.className = "error";
      return;
    }

    saveButton.disabled = true;
    saveStatus.textContent = "Saving...";
    saveStatus.className = "saving";

    try {
      console.log("Saving result data:", {
        sessionId: currentSessionId,
        playerName: playerName,
        score: score,
        totalQuestions: totalAttempts,
        timeTaken: timeElapsed,
        gameMode: gameMode,
        answersCount: gameAnswers.length
      });

      const response = await fetch(`${API_BASE_URL}/validate-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          playerName: playerName,
          score: score,
          totalQuestions: totalAttempts,
          timeTaken: timeElapsed,
          gameMode: gameMode,
          answers: gameAnswers,
        }),
      });

      console.log("Save response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Save error response:", errorText);
        throw new Error(`Failed to save result: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("Save result:", result);
      saveStatus.textContent = `Result saved! Score: ${result.validatedScore}/${result.validatedTotal}`;
      saveStatus.className = "success";
      
      // Refresh leaderboard after saving
      setTimeout(() => loadLeaderboard(currentLeaderboardMode), 1000);
    } catch (error) {
      console.error("Error saving result:", error);
      saveStatus.textContent = `Failed to save result: ${error.message}`;
      saveStatus.className = "error";
      saveButton.disabled = false;
    }
  }

  classicModeButton.addEventListener("click", () => startGame(CLASSIC_MODE));
  infiniteModeButton.addEventListener("click", () => startGame(INFINITE_MODE));

  document.getElementById("save-button").addEventListener("click", saveResult);

  // Leaderboard mode toggle
  document.getElementById("lb-classic").addEventListener("click", () => {
    currentLeaderboardMode = 'classic';
    document.querySelectorAll('.lb-mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById("lb-classic").classList.add('active');
    loadLeaderboard('classic');
  });

  document.getElementById("lb-infinite").addEventListener("click", () => {
    currentLeaderboardMode = 'infinite';
    document.querySelectorAll('.lb-mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById("lb-infinite").classList.add('active');
    loadLeaderboard('infinite');
  });

  replayButton.addEventListener("click", () => {
    resultsScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    startScreen.style.opacity = "0";
    startScreen.style.transform = "scale(0.95)";

    requestAnimationFrame(() => {
      startScreen.style.opacity = "1";
      startScreen.style.transform = "scale(1)";
    });
  });

  titleHeader.addEventListener("click", () => {
    stopTimer();
    gameArea.classList.add("hidden");
    resultsScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    startScreen.style.opacity = "0";
    startScreen.style.transform = "scale(0.95)";

    requestAnimationFrame(() => {
      startScreen.style.opacity = "1";
      startScreen.style.transform = "scale(1)";
    });
  });

  loadSnippets();
  loadLeaderboard('classic'); // Load initial leaderboard
});
