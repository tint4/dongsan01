const scoreLabels = "ABCDEFGHI".split("").flatMap((row) => {
  return Array.from({ length: 9 }, (_, index) => `${row}${index + 1}`);
});

const maxScoreDraws = 20;
const scoreStorageKey = "score-draw-state";
const scoreGrid = document.querySelector("#scoreGrid");
const previewCard = document.querySelector("#scorePreviewCard");
const previewValue = document.querySelector("#scorePreviewValue");
const drawButton = document.querySelector("#scoreDrawButton");
const resetButton = document.querySelector("#scoreResetButton");
const drawStatus = document.querySelector("#scoreDrawStatus");
const scoreTotal = document.querySelector("#scoreTotal");

let scoreState = loadScoreState();
let previewTimer = 0;

function createScores() {
  return scoreLabels.map(() => Math.floor(Math.random() * 30) - 9);
}

function loadScoreState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(scoreStorageKey) || "null");
    if (
      parsed &&
      Array.isArray(parsed.scores) &&
      parsed.scores.length === scoreLabels.length &&
      Array.isArray(parsed.drawn)
    ) {
      return parsed;
    }
  } catch (error) {
    // Start fresh when saved data is invalid.
  }
  return { scores: createScores(), drawn: [] };
}

function saveScoreState() {
  localStorage.setItem(scoreStorageKey, JSON.stringify(scoreState));
}

function remainingIndexes() {
  const drawn = new Set(scoreState.drawn);
  return scoreLabels.map((_, index) => index).filter((index) => !drawn.has(index));
}

function totalScore() {
  return scoreState.drawn.reduce((sum, index) => sum + Number(scoreState.scores[index] || 0), 0);
}

function renderGrid() {
  const drawn = new Set(scoreState.drawn);
  scoreGrid.innerHTML = scoreLabels.map((label, index) => {
    const isDrawn = drawn.has(index);
    const value = scoreState.scores[index];
    const valueText = value > 0 ? `+${value}` : String(value);
    return `
      <button class="score-card ${isDrawn ? "active" : ""}" type="button" disabled>
        <span class="score-card-front">${label}</span>
        <strong class="score-card-back">${isDrawn ? valueText : "?"}</strong>
      </button>
    `;
  }).join("");
}

function setPreview(index, reveal = false) {
  const value = scoreState.scores[index];
  previewCard.textContent = scoreLabels[index];
  previewValue.textContent = reveal ? (value > 0 ? `+${value}` : String(value)) : "?";
}

function updateStatus() {
  const left = Math.max(0, maxScoreDraws - scoreState.drawn.length);
  drawStatus.textContent = left > 0 ? `남은 뽑기 ${left}번` : "20번 뽑기가 끝났습니다.";
  scoreTotal.textContent = `합계 ${totalScore()}점`;
  drawButton.disabled = left <= 0 || remainingIndexes().length === 0;
}

function tickPreview() {
  const remaining = remainingIndexes();
  if (!remaining.length || scoreState.drawn.length >= maxScoreDraws) return;
  const next = remaining[Math.floor(Math.random() * remaining.length)];
  setPreview(next, false);
}

function startPreview() {
  window.clearInterval(previewTimer);
  tickPreview();
  previewTimer = window.setInterval(tickPreview, 26);
}

function drawScore() {
  const remaining = remainingIndexes();
  if (!remaining.length || scoreState.drawn.length >= maxScoreDraws) {
    updateStatus();
    return;
  }
  const selected = remaining[Math.floor(Math.random() * remaining.length)];
  scoreState.drawn.push(selected);
  saveScoreState();
  setPreview(selected, true);
  renderGrid();
  updateStatus();
}

function resetScoreDraw() {
  scoreState = { scores: createScores(), drawn: [] };
  saveScoreState();
  renderGrid();
  updateStatus();
  startPreview();
}

drawButton.addEventListener("click", drawScore);
resetButton.addEventListener("click", resetScoreDraw);

renderGrid();
updateStatus();
startPreview();
