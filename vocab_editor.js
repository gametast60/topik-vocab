// ============================================================
// VOCABULARY STAGING EDITOR & EXPORTER
// ============================================================

let currentEditWordObj = null; // Store temp edit state { word, oldMeaning, levelId }
let exportedLevelIds    = [];  // Tracks which levels were exported for the confirm-clear step
let isExporting         = false;

// Canonical level order for consistent sorting
const LEVEL_ORDER = ["topik1", "topik2", "english_a1", "english_a2", "english_b1", "english_b2"];

// Human-readable labels for each level key
const LEVEL_LABELS = {
  topik1:     "TOPIK 1",
  topik2:     "TOPIK 2",
  english_a1: "EN A1",
  english_a2: "EN A2",
  english_b1: "EN B1",
  english_b2: "EN B2"
};

// ---- HELPERS ----

function normalizeWord(word) {
  return (word || "").trim().toLowerCase();
}

function mapLevelToId(level) {
  const mapping = {
    "TOPIK1":  "topik1",
    "TOPIK2":  "topik2",
    "EN A1":   "english_a1",
    "EN A2":   "english_a2",
    "EN B1":   "english_b1",
    "EN B2":   "english_b2"
  };
  return mapping[level] || String(level).toLowerCase().replace(/\s+/g, "_");
}

function getVocabEditsList(levelId) {
  try {
    const raw = localStorage.getItem(`${levelId}_vocab_edits`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveVocabEditsList(levelId, list) {
  localStorage.setItem(`${levelId}_vocab_edits`, JSON.stringify(list));
}

function getTodayStr() {
  return typeof todayStr === "function"
    ? todayStr()
    : new Date().toISOString().split("T")[0];
}

// ---- NOTIFICATION BADGE ----

function updateNotificationBadge() {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;
  const count = LEVEL_ORDER.filter(id => getVocabEditsList(id).length > 0).length;
  badge.textContent = count;
}

// Call on page startup
document.addEventListener("DOMContentLoaded", () => {
  updateNotificationBadge();
});

// ---- NOTIFICATION CENTER ----

function openNotifCenter() {
  const body = document.getElementById("notifCenterBody");
  const exportAllBtn = document.getElementById("notifExportAllBtn");
  if (!body) return;

  // Build fresh HTML every time (no DOM caching)
  const levels = LEVEL_ORDER.filter(id => getVocabEditsList(id).length > 0);

  if (levels.length === 0) {
    body.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:24px 0; font-size:15px;">ไม่มีแจ้งเตือน</div>`;
    if (exportAllBtn) exportAllBtn.style.display = "none";
  } else {
    body.innerHTML = levels.map(id => {
      const count = getVocabEditsList(id).length;
      const label = LEVEL_LABELS[id] || id;
      return `<div class="notif-level-row">
  <div class="notif-level-info">
    <span class="notif-level-name">${label}</span>
    <span class="notif-level-count">(${count})</span>
  </div>
  <div class="notif-level-actions">
    <button class="notif-detail-btn" onclick="openVocabDetails('${id}')">ดูรายละเอียด</button>
    <button class="notif-export-btn" onclick="exportLevelFromNotif('${id}')">📤 ส่งออก</button>
  </div>
</div>`;
    }).join("");
    if (exportAllBtn) exportAllBtn.style.display = "block";
  }

  const modal = document.getElementById("notifCenterModal");
  if (modal) modal.classList.remove("hidden");
}

function closeNotifCenter(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById("notifCenterModal");
  if (modal) modal.classList.add("hidden");
}

// ---- VOCAB DETAIL VIEW ----

function openVocabDetails(levelId) {
  const modal   = document.getElementById("vocabDetailsModal");
  const titleEl = document.getElementById("vocabDetailsTitle");
  const body    = document.getElementById("vocabDetailsBody");
  if (!modal || !body) return;

  const label = LEVEL_LABELS[levelId] || levelId;
  if (titleEl) titleEl.textContent = label;

  const edits     = getVocabEditsList(levelId);
  const editItems = edits.filter(i => i.type === "edit");
  const addItems  = edits.filter(i => i.type === "add");

  let html = "";

  if (editItems.length > 0) {
    html += `<div class="details-section-title">✏️ แก้ไขคำแปล</div>`;
    html += editItems.map(i => `<div class="details-item">
  <span class="details-word">${i.word}</span>
  <span class="details-arrow">${i.oldMeaning} → ${i.newMeaning}</span>
</div>`).join("");
  }

  if (addItems.length > 0) {
    if (html) html += `<hr class="details-divider">`;
    html += `<div class="details-section-title">➕ เพิ่มคำศัพท์</div>`;
    html += addItems.map(i => `<div class="details-item">
  <span class="details-word">${i.word}</span>
  <span class="details-meaning">${i.newMeaning}</span>
</div>`).join("");
  }

  body.innerHTML = html || `<div style="text-align:center; color:var(--text-muted); padding:24px 0;">ไม่มีรายการ</div>`;
  modal.classList.remove("hidden");
}

function closeVocabDetails(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById("vocabDetailsModal");
  if (modal) modal.classList.add("hidden");
}

// ---- SEARCH-ADD LEVEL SELECTOR ----

let pendingSearchWord = ""; // Holds trimmed word from search while user picks a level

function openSearchAddLevelSelectPopup(rawWord) {
  pendingSearchWord = (rawWord || "").trim();
  if (!pendingSearchWord) return;

  // Clear radio selection
  const radios = document.querySelectorAll('input[name="searchAddLevel"]');
  radios.forEach(r => { r.checked = false; });

  const modal = document.getElementById("searchAddLevelModal");
  if (modal) modal.classList.remove("hidden");
}

function closeSearchAddLevelModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById("searchAddLevelModal");
  if (modal) modal.classList.add("hidden");
}

function confirmSearchAddLevel() {
  const selected = document.querySelector('input[name="searchAddLevel"]:checked');
  if (!selected) {
    alert("กรุณาเลือกระดับคำศัพท์");
    return;
  }
  const levelId = selected.value;

  // Close level selector
  const levelModal = document.getElementById("searchAddLevelModal");
  if (levelModal) levelModal.classList.add("hidden");

  // Open add popup with prefilled word and target level
  openAddVocabPopup(pendingSearchWord, levelId);
}

// ---- POPUP OPENERS ----

function openEditPopup(word, oldMeaning, levelId) {
  speechSynthesis.cancel();

  const edits        = getVocabEditsList(levelId);
  const normalizedWord = normalizeWord(word);
  const existingEdit = edits.find(item => normalizeWord(item.word) === normalizedWord);

  currentEditWordObj = { word, oldMeaning, levelId };

  const wordInput    = document.getElementById("editVocabWord");
  const meaningInput = document.getElementById("editVocabMeaning");
  const modal        = document.getElementById("editVocabModal");

  if (wordInput && meaningInput && modal) {
    wordInput.value    = word;
    meaningInput.value = existingEdit ? existingEdit.newMeaning : oldMeaning;
    modal.classList.remove("hidden");
    meaningInput.focus();
  }
}

function openEditCurrentWordPopup() {
  const screenId = getCurrentScreenId();
  let wordObj = null;

  if (screenId === "flashcardGame") {
    if (typeof dueStage !== "undefined" && dueStage === 2) {
      if (typeof pendingList !== "undefined" && typeof fillIndex !== "undefined") {
        wordObj = pendingList[fillIndex];
      }
    } else {
      if (typeof shuffledVocabulary !== "undefined" && typeof fcIndex !== "undefined") {
        wordObj = shuffledVocabulary[fcIndex];
      }
    }
  } else if (screenId === "typingGame") {
    if (typeof shuffledVocabulary !== "undefined" && typeof currentIndex !== "undefined") {
      wordObj = shuffledVocabulary[currentIndex];
    }
  } else if (screenId === "quizGame") {
    if (typeof shuffledVocabulary !== "undefined" && typeof quizIndex !== "undefined") {
      wordObj = shuffledVocabulary[quizIndex];
    }
  }

  if (!wordObj) return;

  const levelId = typeof currentTopik !== "undefined" && currentTopik ? currentTopik : "topik1";
  openEditPopup(wordObj.word, wordObj.meaning, levelId);
}

function closeEditVocabModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById("editVocabModal");
  if (modal) modal.classList.add("hidden");
  restoreGameFocus();
}

function restoreGameFocus() {
  const screenId = getCurrentScreenId();
  if (screenId === "typingGame") {
    const input = document.getElementById("answerInput");
    if (input) input.focus();
  } else if (screenId === "flashcardGame" && typeof dueStage !== "undefined" && dueStage === 2) {
    const input = document.getElementById("fillInput");
    if (input) input.focus();
  }
}

// openAddVocabPopup: optionally prefill word and lock level
function openAddVocabPopup(prefillWord, targetLevelId) {
  const wordInput    = document.getElementById("addVocabWord");
  const meaningInput = document.getElementById("addVocabMeaning");
  const modal        = document.getElementById("addVocabModal");
  const levelHidden  = document.getElementById("addVocabLevelId");

  if (wordInput && meaningInput && modal) {
    wordInput.value    = prefillWord ? prefillWord.trim() : "";
    meaningInput.value = "";
    if (levelHidden) levelHidden.value = targetLevelId || "";
    modal.classList.remove("hidden");
    if (prefillWord && prefillWord.trim()) {
      meaningInput.focus();
    } else {
      wordInput.focus();
    }
  }
}

function closeAddVocabModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById("addVocabModal");
  if (modal) modal.classList.add("hidden");
}

// ---- ACTIONS ----

function saveVocabEdit() {
  if (!currentEditWordObj) return;

  const { word, oldMeaning, levelId } = currentEditWordObj;
  const meaningInput = document.getElementById("editVocabMeaning");
  if (!meaningInput) return;

  const newMeaning = meaningInput.value.trim();
  const cleanWord  = word.trim();

  if (!cleanWord || !newMeaning) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  if (oldMeaning.trim() === newMeaning) {
    alert("ไม่มีการเปลี่ยนแปลง");
    return;
  }

  const edits          = getVocabEditsList(levelId);
  const normalizedWord = normalizeWord(cleanWord);
  const existingIndex  = edits.findIndex(item => normalizeWord(item.word) === normalizedWord);

  if (existingIndex !== -1) {
    edits[existingIndex].newMeaning = newMeaning;
    edits[existingIndex].date       = getTodayStr();
    edits[existingIndex].type       = "edit";
    edits[existingIndex].level      = levelId;
  } else {
    edits.push({
      type:       "edit",
      level:      levelId,
      word:       cleanWord,
      oldMeaning: oldMeaning.trim(),
      newMeaning: newMeaning,
      date:       getTodayStr()
    });
  }

  saveVocabEditsList(levelId, edits);
  updateNotificationBadge();

  const modal = document.getElementById("editVocabModal");
  if (modal) modal.classList.add("hidden");
  restoreGameFocus();
}

function saveVocabAdd() {
  const wordInput    = document.getElementById("addVocabWord");
  const meaningInput = document.getElementById("addVocabMeaning");
  const levelHidden  = document.getElementById("addVocabLevelId");
  if (!wordInput || !meaningInput) return;

  const word    = wordInput.value.trim();
  const meaning = meaningInput.value.trim();

  // Determine target level: from hidden field (search-add flow) or currentTopik (settings flow)
  const levelId = (levelHidden && levelHidden.value)
    ? levelHidden.value
    : (typeof currentTopik !== "undefined" && currentTopik ? currentTopik : "topik1");

  if (!word || !meaning) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  const normalizedWord = normalizeWord(word);

  // 1. Check original database
  const vocabList    = typeof getTopikVocab === "function" ? getTopikVocab(levelId) : [];
  const existsInDb   = vocabList.some(item => item && normalizeWord(item.word) === normalizedWord);

  // 2. Check staged type:"add" only (ignore type:"edit")
  const edits          = getVocabEditsList(levelId);
  const existsInStaged = edits.some(item => item.type === "add" && normalizeWord(item.word) === normalizedWord);

  if (existsInDb || existsInStaged) {
    alert("คำนี้มีอยู่แล้ว");
    return;
  }

  edits.push({
    type:      "add",
    level:     levelId,
    word:      word,
    newMeaning: meaning,
    date:      getTodayStr()
  });

  saveVocabEditsList(levelId, edits);
  updateNotificationBadge();

  const modal = document.getElementById("addVocabModal");
  if (modal) modal.classList.add("hidden");
}

// ---- EXPORT HELPERS ----

function buildCleanEdits(edits) {
  return edits.map(item => {
    if (item.type === "edit") {
      return { type: "edit", level: item.level, word: item.word, oldMeaning: item.oldMeaning, newMeaning: item.newMeaning };
    } else {
      return { type: "add", level: item.level, word: item.word, newMeaning: item.newMeaning };
    }
  });
}

function downloadJs(levelId, cleanEdits) {
  const content = "const vocabEdits = " + JSON.stringify(cleanEdits, null, 2) + ";\n";
  const blob    = new Blob([content], { type: "application/javascript;charset=utf-8" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href        = url;
  a.download    = `${levelId}_vocab_edits_${getTodayStr()}.js`;
  a.click();
  URL.revokeObjectURL(url);
}

function showExportConfirmModal(message) {
  const textEl = document.getElementById("exportConfirmText");
  if (textEl) textEl.textContent = message;
  const modal = document.getElementById("exportConfirmModal");
  if (modal) modal.classList.remove("hidden");
}

// ---- SINGLE-LEVEL EXPORT (from notification center) ----

function exportLevelFromNotif(levelId) {
  const edits = getVocabEditsList(levelId);
  if (edits.length === 0) {
    alert("ไม่มีคำศัพท์ที่ต้องส่งออก");
    return;
  }

  exportedLevelIds = [levelId]; // Reset: only this level
  downloadJs(levelId, buildCleanEdits(edits));

  setTimeout(() => {
    showExportConfirmModal("ดาวน์โหลดไฟล์เรียบร้อยแล้วหรือไม่? หากเสร็จสิ้นแล้วระบบจะล้างรายการรอแก้ไขของระดับนี้");
  }, 500);
}

// Single-level export from settings panel (uses currentTopik)
function exportVocabEdits() {
  const levelId = typeof currentTopik !== "undefined" && currentTopik ? currentTopik : "topik1";
  const edits   = getVocabEditsList(levelId);

  if (edits.length === 0) {
    alert("ไม่มีคำศัพท์ที่ต้องส่งออก");
    return;
  }

  exportedLevelIds = [levelId]; // Reset
  downloadJs(levelId, buildCleanEdits(edits));

  setTimeout(() => {
    showExportConfirmModal("ดาวน์โหลดไฟล์เรียบร้อยแล้วหรือไม่? หากเสร็จสิ้นแล้วระบบจะล้างรายการรอแก้ไขของระดับนี้");
  }, 500);
}

// ---- EXPORT ALL ----

async function exportAllVocabEdits() {
  if (isExporting) return;

  const levelsWithData = LEVEL_ORDER.filter(id => getVocabEditsList(id).length > 0);
  if (levelsWithData.length === 0) {
    alert("ไม่มีคำศัพท์ที่ต้องส่งออก");
    return;
  }

  const btn = document.getElementById("notifExportAllBtn");
  const originalText = btn ? btn.textContent : "";

  isExporting = true;
  if (btn) { btn.disabled = true; btn.textContent = "⏳ กำลังส่งออก..."; }

  try {
    exportedLevelIds = [...levelsWithData]; // Reset to exactly this run's levels

    for (let i = 0; i < levelsWithData.length; i++) {
      const id    = levelsWithData[i];
      const edits = getVocabEditsList(id);
      downloadJs(id, buildCleanEdits(edits));
      if (i < levelsWithData.length - 1) {
        await new Promise(res => setTimeout(res, 300));
      }
    }

    setTimeout(() => {
      const count = levelsWithData.length;
      showExportConfirmModal(
        "ดาวน์โหลดไฟล์ทั้งหมด " + count + " ไฟล์เรียบร้อยแล้วหรือไม่? " +
        "หากเสร็จสิ้นแล้วระบบจะล้างรายการรอแก้ไขทั้งหมด\n\n" +
        "⚠️ หากไม่ได้รับไฟล์ครบ อาจเกิดจากเบราว์เซอร์บล็อกการดาวน์โหลดหลายไฟล์ กรุณาอนุญาตแล้วลองใหม่"
      );
    }, 500);

  } finally {
    isExporting = false;
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

// ---- CLOSE / CONFIRM EXPORT ----

function closeExportConfirmModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById("exportConfirmModal");
  if (modal) modal.classList.add("hidden");
}

function confirmClearEdits() {
  exportedLevelIds.forEach(id => {
    localStorage.removeItem(`${id}_vocab_edits`);
  });
  exportedLevelIds = [];

  const modal = document.getElementById("exportConfirmModal");
  if (modal) modal.classList.add("hidden");

  updateNotificationBadge();
  alert("ลบรายการรอแก้ไขเรียบร้อยแล้ว");
}
