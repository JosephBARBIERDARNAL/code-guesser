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
  const startButton = document.getElementById("start-button");
  const startScreen = document.getElementById("start-screen");
  const gameArea = document.getElementById("game-area");
  const snippetContainer = document.getElementById("snippet-container");

  const CLASSIC_MODE = "classic";
  const INFINITE_MODE = "infinite";
  const SNIPPETS_PER_GAME = 10;

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

  function startGame(mode) {
    gameMode = mode;
    currentSnippetIndex = 0;
    score = 0;
    totalAttempts = 0; // Reset attempts counter
    timeElapsed = 0;

    updateScoreDisplay();

    const shuffledAllSnippets = [...allSnippets];
    shuffleArray(shuffledAllSnippets);

    if (gameMode === CLASSIC_MODE) {
      currentGameSnippets = shuffledAllSnippets.slice(
        0,
        Math.min(SNIPPETS_PER_GAME, allSnippets.length)
      );
      totalSnippetsEl.textContent = currentGameSnippets.length;
      document.querySelector("#progress-container p").style.display = "block";
    } else {
      // Infinite mode - use all snippets in random order
      currentGameSnippets = shuffledAllSnippets;
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

    // For infinite mode, loop back to the beginning if we've gone through all snippets
    if (
      gameMode === INFINITE_MODE &&
      currentSnippetIndex >= currentGameSnippets.length
    ) {
      currentSnippetIndex = 0;
      shuffleArray(currentGameSnippets); // reshuffle for variety
    }

    feedbackText.textContent = "";
    feedbackText.className = "";
    snippetContainer.classList.add("loading");

    setTimeout(() => {
      const snippet = currentGameSnippets[currentSnippetIndex];

      // Clear previous highlighting by removing hljs classes and resetting content
      codeBlock.className = "hljs"; // Reset to base hljs class
      codeBlock.removeAttribute("data-highlighted"); // Remove highlight.js marker
      codeBlock.textContent = snippet.code;

      // Apply highlighting
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

    totalAttempts++; // Increment attempts for infinite mode
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

    // Update score display for infinite mode
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
      // For infinite mode, just show the score in the game area
      feedbackText.textContent = `Current score: ${score} (Time: ${timeElapsed.toFixed(
        1
      )}s)`;
      feedbackText.className = "score-display";

      // Reset for next question
      setTimeout(() => {
        currentSnippetIndex++;
        loadSnippet();
      }, 1000);
    }
  }

  classicModeButton.addEventListener("click", () => startGame(CLASSIC_MODE));
  infiniteModeButton.addEventListener("click", () => startGame(INFINITE_MODE));
  //startButton.addEventListener("click", startGame);
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

  loadSnippets();
});
