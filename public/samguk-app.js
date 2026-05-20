const samgukPeople = ["유비","조조","손권","원소","원술","동탁","유표","공손찬","여포","관우","장비","조운","마초","위연","마대","황충","강유","요화","제갈량","방통","서서","법정","마량","마속","간옹","장완","비의","순욱","순유","곽가","가후","정욱","사마의","진군","진궁","유엽","태사자","감녕","황개","정보","한당","주태","능통","서성","정봉","주유","노숙","여몽","육손","장소","장굉","제갈근","보즐","우번","하후돈","하우연","조인","조홍","장료","악진","우금","허저","장합","엄백호","공융","유요","유언","교모","공손연","한수","맹획","장각","화타","초선","대교","소교","장양","우길","좌자","사마휘","허소"];

const maxDraws = 20;
const storageKey = "samguk-drawn-indexes";
const previewImage = document.querySelector("#samgukPreviewImage");
const previewName = document.querySelector("#samgukPreviewName");
const drawButton = document.querySelector("#samgukDrawButton");
const resetButton = document.querySelector("#samgukResetButton");
const drawStatus = document.querySelector("#samgukDrawStatus");
const resultBox = document.querySelector("#samgukResult");
const cards = [...document.querySelectorAll(".samguk-card")];

let drawnIndexes = loadDrawnIndexes();
let previewTimer = 0;
let currentPreviewIndex = 0;

function imagePath(index) {
  return `./assets/samguk/p${String(index + 1).padStart(2, "0")}.svg`;
}

function loadDrawnIndexes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((index) => Number.isInteger(index)) : [];
  } catch (error) {
    return [];
  }
}

function saveDrawnIndexes() {
  localStorage.setItem(storageKey, JSON.stringify(drawnIndexes));
}

function remainingIndexes() {
  const drawn = new Set(drawnIndexes);
  return samgukPeople.map((_, index) => index).filter((index) => !drawn.has(index));
}

function setPreview(index) {
  currentPreviewIndex = index;
  previewImage.src = imagePath(index);
  previewImage.alt = `${samgukPeople[index]} 미리보기`;
  previewName.textContent = samgukPeople[index];
}

function updateCards() {
  const drawn = new Set(drawnIndexes);
  cards.forEach((card) => {
    const index = Number(card.dataset.index);
    card.classList.toggle("active", drawn.has(index));
  });
}

function formatCombo(count, label) {
  if (count <= 0) return "";
  if (label === "페어") {
    const pairNames = ["", "원페어", "2페어", "쓰리페어"];
    return pairNames[count] || `${count}페어`;
  }
  if (label === "트리플" && count === 1) return "원트리플";
  return `${count}${label}`;
}

function calculateCombos() {
  const drawn = new Set(drawnIndexes);
  const combos = { pair: 0, triple: 0, straight: 0, royal: 0 };

  for (let row = 0; row < 9; row += 1) {
    let streak = 0;
    for (let col = 0; col < 9; col += 1) {
      const index = row * 9 + col;
      if (drawn.has(index)) {
        streak += 1;
      }

      const isRowEnd = col === 8;
      const isStreakEnd = !drawn.has(index) || isRowEnd;
      if (!isStreakEnd) continue;

      const length = drawn.has(index) && isRowEnd ? streak : streak;
      if (length === 9) {
        combos.royal += 1;
      } else if (length >= 5) {
        combos.straight += 1;
      } else if (length >= 3) {
        combos.triple += 1;
      } else if (length >= 2) {
        combos.pair += 1;
      }
      streak = 0;
    }
  }

  return combos;
}

function updateResult() {
  if (!resultBox) return;
  if (drawnIndexes.length < maxDraws) {
    resultBox.textContent = "20번 뽑기를 마치면 결과가 표시됩니다.";
    resultBox.classList.remove("complete");
    return;
  }

  const combos = calculateCombos();
  const resultText = [
    formatCombo(combos.royal, "로얄스트리트"),
    formatCombo(combos.straight, "스트리트"),
    formatCombo(combos.triple, "트리플"),
    formatCombo(combos.pair, "페어")
  ].filter(Boolean).join(" · ");

  resultBox.textContent = resultText || "완성된 조합이 없습니다.";
  resultBox.classList.add("complete");
}

function updateStatus() {
  const left = Math.max(0, maxDraws - drawnIndexes.length);
  drawStatus.textContent = left > 0 ? `남은 뽑기 ${left}번` : "20번 뽑기가 끝났습니다.";
  drawButton.disabled = left <= 0 || remainingIndexes().length === 0;
  updateResult();
}

function tickPreview() {
  const remaining = remainingIndexes();
  if (!remaining.length || drawnIndexes.length >= maxDraws) return;
  const next = remaining[Math.floor(Math.random() * remaining.length)];
  setPreview(next);
}

function startPreview() {
  window.clearInterval(previewTimer);
  tickPreview();
  previewTimer = window.setInterval(tickPreview, 26);
}

function drawOne() {
  const remaining = remainingIndexes();
  if (!remaining.length || drawnIndexes.length >= maxDraws) {
    updateStatus();
    return;
  }
  const selected = remaining[Math.floor(Math.random() * remaining.length)];
  drawnIndexes.push(selected);
  saveDrawnIndexes();
  setPreview(selected);
  updateCards();
  updateStatus();
  previewName.textContent = `${samgukPeople[selected]} 선택`;
}

function resetDraw() {
  drawnIndexes = [];
  saveDrawnIndexes();
  updateCards();
  updateStatus();
  startPreview();
}

drawButton.addEventListener("click", drawOne);
resetButton.addEventListener("click", resetDraw);

updateCards();
updateStatus();
startPreview();
