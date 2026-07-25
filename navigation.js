// ============================================================
// VARIABLES
// ============================================================
let screenHistory  = [];
let currentTopik   = "";   // "topik1" | "topik2"
let currentVocabulary = [];

let srsSessionWords = [];
let srsSessionMode  = "";
let srsSessionType  = "";   // "due" | "practice" | "wrongbox"
let lastRenderedDate = todayStr();

const backButton = document.getElementById("backButton");
const homeButton = document.getElementById("homeButton");
const trackNavButton = document.getElementById("trackNavButton");

function getCurrentScreenId(){
  return document.querySelector(".screen:not(.hidden)")?.id || "mainMenu";
}

function getTrackMenuScreenId(){
  if(currentTopik && currentTopik.startsWith("english_")) return "englishMenu";
  if(currentTopik && currentTopik.startsWith("topik")) return "koreanMenu";
  const cur = getCurrentScreenId();
  if(cur === "englishMenu") return "englishMenu";
  return "koreanMenu";
}

function updateTrackNavButton(forceHidden = false){
  if(!trackNavButton) return;

  const currentScreen = getCurrentScreenId();
  const hideGlobalSettings = currentScreen === "globalSettingsPanel";
  const targetScreen = getTrackMenuScreenId();

  const shouldHide =
    forceHidden ||
    currentScreen === "mainMenu" ||
    currentScreen === "globalSettingsPanel" ||
    currentScreen === targetScreen;

  trackNavButton.classList.toggle("hidden", shouldHide);

  trackNavButton.textContent =
    targetScreen === "englishMenu"
      ? "หน้า Level"
      : "หน้า TOPIK";
}

function openTrackMenu(){

  const target = getTrackMenuScreenId();

  if(target === "koreanMenu"){
    document.getElementById("appTitle").textContent = "KR ภาษาเกาหลี";
  }else{
    document.getElementById("appTitle").textContent = "EN ภาษาอังกฤษ";
  }

  goTo(target);
}

// ============================================================
// SCREEN NAVIGATION
// ============================================================
function showScreen(screenId){
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  const t = document.getElementById(screenId);
  if(t) t.classList.remove("hidden");
  // Reset scroll ทุกครั้งที่เปลี่ยนหน้า
  // ป้องกัน #app.scrollTop ค้างจาก scroll chaining ของ homeDueHub
  // ซึ่งทำให้ตำแหน่ง click target ไม่ตรงกับตำแหน่งที่ตาเห็น
  const app = document.getElementById("app");
  if(app) app.scrollTop = 0;
}


function goTo(screenId){
  const cur = document.querySelector(".screen:not(.hidden)");
  if(cur) screenHistory.push(cur.id);
  showScreen(screenId);
  ["flashcardProgress","progress","quizProgress"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
  updateTitleVisibility();
  updateNavButtons();
}

function goBack(){
  if(screenHistory.length === 0) return;
  const prevScreen = screenHistory.pop();
  showScreen(prevScreen);
  ["flashcardProgress","progress","quizProgress"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
  if(prevScreen === "mainMenu"){
    document.getElementById("appTitle").textContent = "Vocab by 톤님";
    renderHomeDueHub();
  } else if(prevScreen === "koreanMenu"){
    document.getElementById("appTitle").textContent = "KR ภาษาเกาหลี";
  } else if(prevScreen === "englishMenu"){
    document.getElementById("appTitle").textContent = "EN ภาษาอังกฤษ";
  } else if(prevScreen === "srsDashboard"){
    const TITLES = {
      topik1:"TOPIK 1", topik2:"TOPIK 2",
      english_a1:"English A1", english_a2:"English A2",
      english_b1:"English B1", english_b2:"English B2",
    };
    document.getElementById("appTitle").textContent = TITLES[currentTopik] || currentTopik;
    renderSRSHome();
  }
  updateTitleVisibility();
  updateNavButtons();
}

function updateNavButtons(){

  const currentScreen = getCurrentScreenId();
  const hideGlobalSettings = currentScreen === "globalSettingsPanel";

  const hideBack = [
  "mainMenu",
  "koreanMenu",
  "englishMenu",
  "srsDashboard"
].includes(currentScreen);

  const inFlashcard =
       !document.getElementById("flashcardGame").classList.contains("hidden");

  const inTyping =
       !document.getElementById("typingGame").classList.contains("hidden");

  const inQuiz =
       !document.getElementById("quizGame").classList.contains("hidden");

  const hideAllNav = inFlashcard || inTyping || inQuiz;

  backButton.classList.toggle("hidden", hideBack || hideAllNav || hideGlobalSettings);
  homeButton.classList.toggle("hidden", currentScreen === "mainMenu" || hideAllNav || hideGlobalSettings);

  updateTrackNavButton(hideAllNav);
}

///==========================================
/// ตรวจสอบวันที่อัตโนมัติ
///==========================================
function autoRefreshHomeDueIfNeeded() {

  const currentDate = todayStr();

  if (currentDate !== lastRenderedDate) {

    lastRenderedDate = currentDate;

    // รีเซ็ตข้อมูล SRS ประจำวัน
    checkDailyReset();

    // อัปเดตข้อมูลหน้า Home
    renderHomeDueHub();

    // ถ้าอยู่หน้า Dashboard อยู่ให้รีเฟรชด้วย
    if (getCurrentScreenId() === "srsDashboard") {
      renderSRSHome();
    }

    console.log("Auto refresh daily data");

    const currentScreen = getCurrentScreenId();

    const inGame = [
      "flashcardGame",
      "typingGame",
      "quizGame"
    ].includes(currentScreen);

    // ไม่แสดง Popup ถ้ากำลังเล่นเกมอยู่
    if (!inGame) {
      showNewDayPopup();
    }
  }
}


// ============================================================
// MAIN MENU
// ============================================================
function showMainMenu(){
  practicePool = [];
  practiceSourceWords = [];
  wrongboxPool = [];
  wrongboxSourceWords = [];
  srsSessionWords = [];
  srsSessionMode = "";
  srsSessionType = "";

  screenHistory = [];
  currentTopik  = "";
  document.getElementById("appTitle").textContent = "Vocab by 톤님";
  ["flashcardProgress","progress","quizProgress"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
  showScreen("mainMenu");
  updateTitleVisibility();
  updateNavButtons();
  lastRenderedDate = todayStr();
  renderHomeDueHub();
}

function getHomeDueCount(topikId) {
  const origTopik = currentTopik;
  currentTopik = topikId;
  try {
    checkDailyReset();
    initAllVocab();
    return getSRSStats().dueToday;
  } catch (e) {
    console.error("Error getting due count for " + topikId, e);
    return 0;
  } finally {
    currentTopik = origTopik;
  }
}

function renderHomeDueHub() {
  const container = document.getElementById("homeDueHub");
  if (!container) return;

  const HOME_DUE_TOPIKS = [
    { id: "topik1", label: "TOPIK1" },
    { id: "topik2", label: "TOPIK2" },
    { id: "english_a1", label: "English A1" },
    { id: "english_a2", label: "English A2" },
    { id: "english_b1", label: "English B1" },
    { id: "english_b2", label: "English B2" }
  ];

  let html = "";
  let totalDueCount = 0;
  let cardsHtml = "";

  HOME_DUE_TOPIKS.forEach(item => {
    const dueCount = getHomeDueCount(item.id);
    if (dueCount > 0) {
      totalDueCount += dueCount;
      cardsHtml += `
        <div class="home-due-card">
          <div class="home-due-info">
            <span class="home-due-label">${item.label}</span>
            <span class="home-due-count">${dueCount} คำ</span>
          </div>
          <button class="home-due-action-btn" onclick="startHomeDue('${item.id}')">Go!</button>
        </div>
      `;
    }
  });

  const headerHtml = `
    <div class="home-due-header">
      <div class="home-due-header-left">
       📅 ทวนวันนี้ <span class="home-due-date">${todayStr()}</span>
      </div>
      <div class="home-due-header-right">
        <span class="home-due-divider">|</span>
        <button class="home-due-refresh-btn" onclick="triggerRefreshWithLoading()">🔄รีเฟรช</button>
      </div>
    </div>
  `;

  if (totalDueCount === 0) {
    html = `
      ${headerHtml}
      <div class="home-due-empty">
        <div class="home-empty-emoji">🎉</div>
        <div class="home-empty-text">คุณเคลียร์คำที่ต้องทวนหมดแล้ว</div>
      </div>
    `;
  } else {
    html = `
      ${headerHtml}
      ${cardsHtml}
    `;
  }

  container.innerHTML = html;
}

function triggerRefreshWithLoading() {
  const popup = document.getElementById("refreshLoadingPopup");
  const bar = document.getElementById("refLoadBar");
  const btn = document.getElementById("refLoadConfirmBtn");
  const title = popup ? popup.querySelector(".ref-load-title") : null;

  if (!popup || !bar || !btn || !title) return;

  // 1. Reset state
  bar.style.transition = "none";
  bar.style.width = "0%";
  title.innerHTML = "Loading....";
  btn.classList.add("ref-load-btn-hidden");
  btn.classList.remove("ref-load-btn-visible");

  // 2. Open popup
  popup.classList.add("ref-load-show");

  // 3. Trigger transition for the loading bar
  // Force a reflow to reset width
  void bar.offsetWidth;

  // Set transition and width (2 seconds)
  bar.style.transition = "width 2s linear";
  bar.style.width = "100%";

  // 4. Wait 2 seconds (2000ms) for the bar to be full, then change title and fade-in the confirm button
  setTimeout(() => {
    title.innerHTML = 'เสร็จสิ้น<br><span class="ref-load-subtitle">ปัดแอพทิ้งแล้วเข้าใหม่</span>';
    btn.classList.remove("ref-load-btn-hidden");
    btn.classList.add("ref-load-btn-visible");
  }, 2000);
}

function confirmRefreshPopup() {
  const popup = document.getElementById("refreshLoadingPopup");
  if (!popup) return;

  // Delay for a short duration (e.g. 300ms) before closing and refreshing
  setTimeout(() => {
    popup.classList.remove("ref-load-show");
    location.reload();
  }, 300);
}

function startHomeDue(topikId) {
  practicePool = [];
  practiceSourceWords = [];
  wrongboxPool = [];
  wrongboxSourceWords = [];
  
  currentTopik = topikId;
  
  const TITLES = {
    topik1:     "TOPIK 1",
    topik2:     "TOPIK 2",
    english_a1: "English A1",
    english_a2: "English A2",
    english_b1: "English B1",
    english_b2: "English B2",
  };
  document.getElementById("appTitle").textContent = TITLES[topikId] || topikId;

  openSRSDue();
}

function openLanguage(lang){
  if(lang === "korean"){
    document.getElementById("appTitle").textContent = "KR ภาษาเกาหลี";
    goTo("koreanMenu");
  } else {
    document.getElementById("appTitle").textContent = "EN ภาษาอังกฤษ";
    goTo("englishMenu");
  }
}

function openTopik(topik){
  practicePool = [];
  practiceSourceWords = [];
  wrongboxPool = [];
  wrongboxSourceWords = [];
  srsSessionWords = [];
  srsSessionMode = "";
  srsSessionType = "";

  currentTopik = topik;
  const TITLES = {
    topik1:     "TOPIK 1",
    topik2:     "TOPIK 2",
    english_a1: "English A1",
    english_a2: "English A2",
    english_b1: "English B1",
    english_b2: "English B2",
  };
  document.getElementById("appTitle").textContent = TITLES[topik] || topik;
  goTo("srsDashboard");
  renderSRSHome();
}

function goToSRSDashboard(){
  practicePool = [];
  practiceSourceWords = [];
  wrongboxPool = [];
  wrongboxSourceWords = [];

  screenHistory = screenHistory.filter(id => id !== "srsDashboard");
  goTo("srsDashboard");
  renderSRSHome();
}

function backToDashboard(){
  goToSRSDashboard();
}

function getTopikVocab(topik){
  if(topik === "topik1")     return window.flashVocabData1      || [];
  if(topik === "topik2")     return window.flashVocabData2      || [];
  if(topik === "english_a1") return window.flashVocabDataEnA1   || [];
  if(topik === "english_a2") return window.flashVocabDataEnA2   || [];
  if(topik === "english_b1") return window.flashVocabDataEnB1   || [];
  if(topik === "english_b2") return window.flashVocabDataEnB2   || [];
  return [];
}

// ============================================================
// SRS DASHBOARD
// ============================================================
function renderSRSHome(){
  checkDailyReset();
  initAllVocab();

  const counts   = getBoxCounts();
  const due      = getDueWords();
  const wrongBox = getWrongBoxWords();

  const BOX_LABELS = ["ใหม่","1วัน","3วัน","7วัน","14วัน","จำได้✅"];
  const BOX_COLORS = ["#6b7280","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#16a34a"];

  const boxRow = document.getElementById("srsBoxRow");
  if(!boxRow) return;

  let boxHtml = "";
  for(let i = 0; i <= 5; i++){
    boxHtml += `
      <div class="srs-box srs-box-clickable" style="--box-color:${BOX_COLORS[i]}" onclick="openBoxInspector(${i})">
        <div class="srs-box-count">${counts[i]}</div>
        <div class="srs-box-label">${BOX_LABELS[i]}</div>
      </div>`;
  }
  const wbFull = wrongBox.length >= WRONG_BOX_MAX;
  boxHtml += `
    <div class="srs-box srs-box-wrongbox srs-box-clickable" style="--box-color:#db2777" onclick="openWrongBoxInspector()">
      <div class="srs-box-count">${wrongBox.length}</div>
      <div class="srs-box-label">❌คำผิด</div>
      ${wbFull ? '<div class="srs-box-full">เต็ม</div>' : ''}
    </div>`;
  boxRow.innerHTML = boxHtml;

  const actions = document.getElementById("srsActions");
  actions.innerHTML = `
    <div class="srs-action-row">
      <button class="srs-action-btn srs-due-btn" onclick="openSRSDue()">
        📅 ทวนวันนี้
      </button>
      <button class="srs-action-btn srs-wrongbox-btn" onclick="${wrongBox.length === 0 ? 'alertNoWrongWords()' : 'openWrongBox()'}">
        ❌ ทวนคำผิด <span class="srs-badge">${wrongBox.length}/${WRONG_BOX_MAX}</span>
      </button>
    </div>
    <div class="srs-action-row single">
      <button class="srs-action-btn srs-new-btn" onclick="openPractice()">
        🎮 ฝึกหัด
      </button>
    </div>
    <div class="srs-action-row">
      <button class="srs-action-btn srs-stat-btn" onclick="openSRSStats()">📊 สถิติ</button>
      <button class="srs-action-btn srs-settings-btn" onclick="openSettings()">⚙️ ตั้งค่า</button>
    </div>`;
}

// ============================================================
// ทวนวันนี้ (SRS Flashcard)
// ============================================================
function openSRSDue(){
  checkDailyReset();
  initAllVocab();
  if(isWrongBoxFull()){
    alert("🛑 วันนี้พอแล้ว!\n\nกล่องคำผิดเต็ม (30 คำ) แล้วครับ\nเมื่อวันใหม่เริ่ม กล่องคำผิดจะรีเซ็ตเป็น 0\nแล้วค่อยกลับมาทวนใหม่ได้นะครับ 😊");
    return;
  }
  const chunk = getDueChunk();
  if(chunk.length === 0){
    alert(getDueWords().length === 0
      ? "✅ ไม่มีคำให้ทวนวันนี้แล้ว!"
      : "✅ ทวนครบทุกคำแล้ว! กล่องคำผิดยังไม่เต็ม\nลองทวนคำผิดดูได้ครับ");
    return;
  }
  srsSessionWords   = chunk.map(i => ({ word: i.word, meaning: i.meaning }));
  srsSessionType    = "due";
  currentVocabulary = [...srsSessionWords];
  // ตรวจภาระพรุ่งนี้ก่อนเริ่ม — แสดง Popup ถ้าเกิน TOMORROW_WARNING_THRESHOLD
  const tomorrowDue = getTomorrowDueCount();
  if(tomorrowDue >= TOMORROW_WARNING_THRESHOLD){
    showTomorrowWarningPopup(startDueFlashcard, tomorrowDue);
  } else {
    startDueFlashcard();
  }
}

function startDueFlashcard(){
  shuffledVocabulary = [...currentVocabulary];
  fcIndex       = 0;
  fcForgotten   = [];
  pendingList   = [];
  fillWrongList = [];
  fillIndex     = 0;
  dueStage      = 1;
  isDueMode     = true;
  // ซ่อน fillCardUI เผื่อค้างจากรอบก่อน
  const fillUI = document.getElementById("fillCardUI");
  if(fillUI) fillUI.classList.add("hidden");
  goTo("flashcardGame");
  showFlashcard();
}

// ============================================================
// ทวนคำผิด (Wrong Box)
// ============================================================
function alertNoWrongWords(){
  alert("📭 วันนี้ยังไม่มีคำผิดเลยครับ\n\nกรุณาเล่นโหมด ทวนวันนี้ ก่อน\nแล้วคำที่ตอบผิดจะมาเก็บไว้ที่นี่ 😊");
}

function openWrongBox(){
  // รีเซ็ต Queue ทุกครั้งที่เข้าเมนูทวนคำผิด
  // เพื่อให้เห็นคำผิดล่าสุดเสมอ และเริ่ม FIFO ใหม่จากต้น
  wrongboxPool = [];
  wrongboxSourceWords = [];

  const chunk = getNextWrongboxSet();

  if(chunk.length === 0){ alert("ยังไม่มีคำผิดวันนี้"); return; }

  const wChunk = getWrongChunkSize();

  srsSessionWords   = chunk;
  srsSessionType    = "wrongbox";
  currentVocabulary = srsSessionWords.map(i => ({ word: i.word, meaning: i.meaning }));
  document.getElementById("wrongBoxGameInfo").innerHTML = `
    <div class="srs-session-label">❌ ทวนคำผิด</div>
    <div class="srs-session-note">${wChunk} คำ — เลือกรูปแบบการเล่น</div>`;
  goTo("wrongBoxGameMenu");
}

function startWrongBoxGame(mode, isStage2 = false){
  srsSessionMode    = mode;
  currentVocabulary = srsSessionWords.map(i => ({ word: i.word, meaning: i.meaning }));
  if(mode === "quiz"){
    shuffledVocabulary = shuffleArray([...currentVocabulary]);
    quizIndex = 0;
    if(!isStage2) wrongAnswers = [];
    goTo("quizGame"); showQuiz();
  } else {
    shuffledVocabulary = shuffleArray([...currentVocabulary]);
    currentIndex = 0;
    if(!isStage2) wrongAnswers = [];
    goTo("typingGame"); showWord();
  }
}

// ============================================================
// ฝึกหัด (Practice)
// ============================================================
function openPractice(){
  srsSessionWords = [];
  srsSessionType  = "";
  renderPracticeBoxFilterLabel();
  document.getElementById("practiceGameInfo").innerHTML = `
    <div class="srs-session-label">🎮 ฝึกหัด</div>
    <div class="srs-session-note">1. เลือกกล่องคำที่เล่น &nbsp;2. เลือกโหมดเกม</div>`;
  goTo("practiceGameMenu");
}

function startPracticeGame(mode, isStage2 = false){

  // สร้างชุดคำใหม่เฉพาะตอนเริ่มฝึกหัดครั้งแรก (ใช้ FIFO Queue)
  if(srsSessionType !== "practice" || srsSessionWords.length === 0){

    const words = getNextPracticeChunk();

    if(words.length === 0){
      srsSessionWords = [];
      currentVocabulary = [];
      shuffledVocabulary = [];

      alert("ไม่พบคำศัพท์ในกล่องที่เลือก\nกรุณากด 📦 เลือกกล่องเล่น ก่อนนะครับ");
      return;
    }

    srsSessionWords = words;
    srsSessionType = "practice";
  }

  // ใช้ชุดเดิมเสมอเมื่อสลับโหมด
  srsSessionMode = mode;

  currentVocabulary = srsSessionWords.map(i => ({
    word: i.word,
    meaning: i.meaning
  }));

  // สับลำดับใหม่ทุกครั้ง
  shuffledVocabulary = shuffleArray([...currentVocabulary]);

  if(mode === "quiz"){

    quizIndex = 0;
    if(!isStage2) wrongAnswers = [];

    goTo("quizGame");
    showQuiz();

  } else {

    currentIndex = 0;
    if(!isStage2) wrongAnswers = [];

    goTo("typingGame");
    showWord();
  }
}

// ============================================================
// PRACTICE BOX SELECTOR
// ============================================================

// key แยกตาม topik
function practiceBoxesKey(){
  return `topik_practice_boxes_${currentTopik || "topik1"}`;
}

// โหลดค่าที่บันทึกไว้ — default = เลือกทุกกล่อง [0,1,2,3,4,5,6]
function getPracticeSelectedBoxes(){
  try {
    const raw = localStorage.getItem(practiceBoxesKey());
    if(raw) return JSON.parse(raw);
  } catch(e) {}
  return [0,1,2,3,4,5];
}

function savePracticeSelectedBoxes(arr){
  localStorage.setItem(practiceBoxesKey(), JSON.stringify(arr));
}

// ดึงคำจากกล่องที่เลือก (ไม่กระทบ SRS)
function getPracticeWordsByBoxes(selectedBoxes, limit){
  if(!selectedBoxes || selectedBoxes.length === 0) return [];
  const data = loadSRS();
  let pool = [];
  Object.values(data).forEach(item => {
    if(selectedBoxes.includes(item.box) && item.word && item.meaning){ // ← เพิ่ม check
      pool.push({ word: item.word, meaning: item.meaning });
    }
  });
  pool = shuffleArray(pool);
  return pool.slice(0, Math.min(limit, pool.length));
}

// นับจำนวนคำในแต่ละกล่อง (สำหรับแสดงใน popup)
function getPracticeBoxCounts(){
  return getBoxCounts(); // [0,1,2,3,4,5] จาก srs.js
}

// เปิด popup
function openPracticeBoxModal(){
  const counts   = getPracticeBoxCounts();
  const selected = getPracticeSelectedBoxes();

  const BOX_LABELS = [
    "กล่อง 0 — คำใหม่",
    "กล่อง 1 — 1 วัน",
    "กล่อง 2 — 3 วัน",
    "กล่อง 3 — 7 วัน",
    "กล่อง 4 — 14 วัน",
    "กล่อง 5 — จำได้ ✅"
  ];
  const BOX_COLORS = ["#6b7280","#3b82f6","#8b5cf6","#d97706","#ef4444","#16a34a","#db2777"];

  let html = "";
  for(let i = 0; i <= 5; i++){
    const checked = selected.includes(i) ? "checked" : "";
    html += `
      <label style="display:flex;align-items:center;gap:10px;font-size:15px;padding:9px 0;border-bottom:1px solid #f3f4f6;cursor:pointer;">
        <input type="checkbox" class="practice-box-cb practice-checkbox" value="${i}" ${checked}
          style="accent-color:${BOX_COLORS[i]};"
          onchange="updatePracticeBoxSummary()">
        <span style="color:${BOX_COLORS[i]};font-weight:700;">${BOX_LABELS[i]}</span>
        <span style="margin-left:auto;background:${BOX_COLORS[i]};color:white;font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;">${counts[i]}</span>
      </label>`;
  }

  document.getElementById("practiceBoxChecklist").innerHTML = html;
  updatePracticeBoxSummary();

  // อัปเดต "เลือกทั้งหมด"
  document.getElementById("practiceSelectAll").checked = selected.filter(b => b <= 5).length === 6;

  document.getElementById("practiceBoxModal").classList.remove("hidden");
}

function closePracticeBoxModal(e){
  if(e && e.target !== document.getElementById("practiceBoxModal")) return;
  document.getElementById("practiceBoxModal").classList.add("hidden");
}

// อัปเดต summary "เลือก X กล่อง รวม Y คำ"
function updatePracticeBoxSummary(){
  const cbs = [...document.querySelectorAll(".practice-box-cb")];
  const counts = getPracticeBoxCounts();

  const checkedBoxes = cbs.filter(cb => cb.checked).map(cb => parseInt(cb.value));
  const totalWords = checkedBoxes.reduce((sum, b) => sum + (counts[b] || 0), 0);

  document.getElementById("practiceBoxSummary").textContent =
    checkedBoxes.length === 0
      ? "ยังไม่ได้เลือกกล่อง"
      : `เลือก ${checkedBoxes.length} กล่อง — รวม ${totalWords} คำ`;

  // sync "เลือกทั้งหมด"
  document.getElementById("practiceSelectAll").checked = checkedBoxes.length === 6;
}

function togglePracticeSelectAll(checked){
  document.querySelectorAll(".practice-box-cb").forEach(cb => cb.checked = checked);
  updatePracticeBoxSummary();
}

function clearPracticeBoxSelection(){
  document.querySelectorAll(".practice-box-cb").forEach(cb => cb.checked = false);
  document.getElementById("practiceSelectAll").checked = false;
  updatePracticeBoxSummary();
}

function confirmPracticeBoxSelection(){
  const selected = [...document.querySelectorAll(".practice-box-cb:checked")].map(cb => parseInt(cb.value));
  if(selected.length === 0){
    alert("กรุณาเลือกอย่างน้อย 1 กล่อง");
    return;
  }
  savePracticeSelectedBoxes(selected);
  document.getElementById("practiceBoxModal").classList.add("hidden");
  renderPracticeBoxFilterLabel();
  alert(`✅ บันทึกแล้ว! เลือก ${selected.length} กล่อง`);
}

// แสดง label กล่องที่เลือกใต้ปุ่มเกม
function renderPracticeBoxFilterLabel(){
  const el = document.getElementById("practiceBoxFilterLabel");
  if(!el) return;
  const selected = getPracticeSelectedBoxes();
  const counts   = getPracticeBoxCounts();
  const total = selected.reduce((s, b) => s + (counts[b] || 0), 0);

  if(total === 0){
    el.textContent = "⚠️ กล่องที่เลือกไม่มีคำศัพท์";
  } else {
    el.textContent = selected.filter(b => b <= 5).length === 6
      ? `📦 ทุกกล่อง — ${total} คำ`
      : `📦 กล่อง ${selected.join(", ")} — ${total} คำ`;
  }
  el.style.display = "block";

  document.querySelectorAll("#practiceGameMenu .menu-btn").forEach(btn => {
  if(btn.id === "practiceBoxSelectBtn") return;
  btn.disabled = total === 0;
 });
}

// ============================================================
// SRS FINISH SCREEN (ทวนวันนี้)
// ============================================================
function showSRSFinish(wrongList){
  // wrongList = fcForgotten ซึ่งรวมคำผิดทั้ง 2 ด่านไว้แล้ว
  // (ด่าน 1: จำไม่ได้ / ด่าน 2: เติมผิด — ทั้งคู่ push เข้า fcForgotten)

  goTo("srsFinishScreen");

  const container = document.getElementById("srsWrongAnswers");
  const wb        = getWrongBoxWords();
  const wbFull    = isWrongBoxFull();

  let statusHtml = "";
  if(srsSessionType === "due"){
    // แสดงสรุปสถิติ
    const totalPlayed    = shuffledVocabulary.length;
    const stage1Wrong    = fcForgotten.filter(w => !fillWrongList.some(f => f.word === w.word)).length;
    // คำผิดด่าน 1 = fcForgotten ที่ไม่ได้ไปถึงด่าน 2
    // คำผิดด่าน 2 = fillWrongList
    const stage1WrongCount = fcForgotten.length - fillWrongList.length;
    const stage2WrongCount = fillWrongList.length;
    const promotedCount    = fillCorrectCount;

    statusHtml = `
      <div class="wb-status" style="margin-top: 10px;">
        กล่องคำผิด: <b>${wb.length} / ${WRONG_BOX_MAX}</b>
        ${wbFull ? '<span class="wb-full-tag">เต็ม!</span>' : ''}
      </div>`;
  }

  if(wrongList.length === 0){
    container.innerHTML = `<div class="wrong-list"><h3>🎉 ยอดเยี่ยม! ผ่านทั้ง 2 ด่าน</h3>${statusHtml}</div>`;
  } else {
    let html = `<div class="wrong-list"><h3>❌ คำที่ยังจำไม่ได้ (${wrongList.length} คำ)</h3>${statusHtml}`;
    wrongList.forEach((item, i) => {
      // ระบุว่าผิดจากด่านไหน
      const isStage2Wrong = fillWrongList.some(f => f.word === item.word);
      const tag = isStage2Wrong
        ? `<span class="wrong-stage-tag stage2">ด่าน 2</span>`
        : `<span class="wrong-stage-tag stage1">ด่าน 1</span>`;
      html += `<div class="wrong-item">${i+1}. <b>${item.word}</b> = ${item.meaning} ${tag}</div>`;
    });
    container.innerHTML = html + `</div>`;
  }

  const nextBtn      = document.getElementById("srsNextChunkBtn");
  const stillHaveDue = getDueChunk().length > 0;
  if(srsSessionType === "due" && !wbFull && stillHaveDue){
    nextBtn.style.display = "";
    nextBtn.textContent = `▶ ทวนชุดถัดไป`;
  } else {
    nextBtn.style.display = "none";
  }
}

function continueNextChunk(){
  if(isWrongBoxFull()){ goToSRSDashboard(); return; }
  const chunk = getDueChunk();
  if(chunk.length === 0){ goToSRSDashboard(); return; }
  srsSessionWords   = chunk.map(i => ({ word: i.word, meaning: i.meaning }));
  currentVocabulary = [...srsSessionWords];
  // ตรวจภาระพรุ่งนี้ก่อนเริ่ม — แสดง Popup ถ้าเกิน TOMORROW_WARNING_THRESHOLD
  const tomorrowDue = getTomorrowDueCount();
  if(tomorrowDue >= TOMORROW_WARNING_THRESHOLD){
    showTomorrowWarningPopup(startDueFlashcard, tomorrowDue);
  } else {
    startDueFlashcard();
  }
}

// ============================================================
// TOMORROW WARNING POPUP
// ============================================================
let _tomorrowWarningCallback = null;

/**
 * เปิด Popup แจ้งเตือนภาระพรุ่งนี้
 * @param {Function} onContinue - callback ที่จะเรียกเมื่อผู้ใช้กด "เล่นต่อ"
 * @param {number}   count      - จำนวนคำทวนพรุ่งนี้จาก getTomorrowDueCount()
 */
function showTomorrowWarningPopup(onContinue, count){
  _tomorrowWarningCallback = null;  // clear ก่อนเสมอ (Defensive)
  document.getElementById("tomorrowWarningCount").textContent = count;
  _tomorrowWarningCallback = onContinue;
  document.getElementById("tomorrowWarningPopup").classList.remove("hidden");
}

/** ผู้ใช้กด "เล่นต่อ" → ปิด Popup แล้วเริ่มเกม */
function confirmTomorrowWarning(){
  document.getElementById("tomorrowWarningPopup").classList.add("hidden");
  const cb = _tomorrowWarningCallback;
  _tomorrowWarningCallback = null;
  if(cb) cb();
}

/** ผู้ใช้กด "พักก่อน" → ปิด Popup แล้วกลับ Dashboard */
function cancelTomorrowWarning(){
  document.getElementById("tomorrowWarningPopup").classList.add("hidden");
  _tomorrowWarningCallback = null;
  goToSRSDashboard();
}

// ============================================================
// STATS
// ============================================================
function openSRSStats(){
  const stats  = getSRSStats();
  const counts = getBoxCounts();
  const BOX_LABELS = ["กล่อง 0 (ใหม่)","กล่อง 1 (1วัน)","กล่อง 2 (3วัน)","กล่อง 3 (7วัน)","กล่อง 4 (14วัน)","กล่อง 5 (จำได้ ✅)"];
  const BOX_COLORS = ["#6b7280","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#16a34a"];

  const totalWords = stats.total > 0 ? stats.total : 1;
  let barsHtml = "";
  for(let i = 0; i <= 5; i++){
    const pct = Math.round((counts[i] / totalWords) * 100);
    barsHtml += `
      <div class="stat-bar-row">
        <div class="stat-bar-label">${BOX_LABELS[i]}</div>
        <div class="stat-bar-wrap">
          <div class="stat-bar-fill" style="width:${pct}%;background:${BOX_COLORS[i]}"></div>
        </div>
        <div class="stat-bar-num">${counts[i]}</div>
      </div>`;
  }

  const pct   = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;
  const label = currentTopik === "topik1" ? "TOPIK 1" : "TOPIK 2";
  const wb    = getWrongBoxWords();
  const tomorrowDue = getTomorrowDueCount();

  document.getElementById("srsStatsContent").innerHTML = `
    <div class="stats-header">📊 สถิติ ${label}</div>
    <div class="stats-summary">
      <div class="stat-chip">คำทั้งหมด<br><b>${stats.total}</b></div>
      <div class="stat-chip">เรียนไปแล้ว<br><b>${stats.learned}</b></div>
      <div class="stat-chip">จำได้แล้ว ✅<br><b>${stats.mastered}</b></div>
      <div class="stat-chip stat-chip-due" style="cursor:pointer" onclick="openDueTodayInspector()">ทวนวันนี้<br><b>${stats.dueToday}</b></div>
      <div class="stat-chip stat-chip-tomorrow" style="cursor:pointer" onclick="openTomorrowDueInspector()">ทวนพรุ่งนี้<br><b>${tomorrowDue}</b></div>
      <div class="stat-chip">❌คำผิดวันนี้<br><b>${wb.length}/${WRONG_BOX_MAX}</b></div>
    </div>
    <div class="stat-progress-label">ความคืบหน้า ${pct}%</div>
    <div class="stat-progress-bar">
      <div class="stat-progress-fill" style="width:${pct}%"></div>
    </div>
    <div class="stat-bars">${barsHtml}</div>`;

  document.getElementById("dueChunkInput").value  = getDueChunkSize();
  goTo("srsStats");
}

// ============================================================
// SETTINGS
// ============================================================
function openGlobalSettings(){
  goTo("globalSettingsPanel");
}

function openSettings(){
  document.getElementById("dueChunkInput").value  = getDueChunkSize();
  document.getElementById("wrongChunkInput").value  = getWrongChunkSize();
  document.getElementById("practiceChunkInput").value = getPracticeChunkSize();
  document.querySelectorAll("#clearBoxChecks input").forEach(cb => cb.checked = false);
  goTo("settingsPanel");
}

function saveSettings(){
  const dc = parseInt(document.getElementById("dueChunkInput").value);
  const wc = parseInt(document.getElementById("wrongChunkInput").value);
  const pc = parseInt(document.getElementById("practiceChunkInput").value);
  if(!isNaN(dc) && dc >= 5) setDueChunkSize(dc);
  if(!isNaN(wc) && wc >= 5) setWrongChunkSize(wc);
  if(!isNaN(pc) && pc >= 5) setPracticeChunkSize(pc);
  alert("✅ บันทึกแล้ว!");
}

function clearSelectedBoxes(){
  const checked = [...document.querySelectorAll("#clearBoxChecks input[value]:checked")].map(cb => parseInt(cb.value));
  const clearWB = document.getElementById("clearWrongBoxCheck")?.checked;
  if(checked.length === 0 && !clearWB){ alert("ยังไม่ได้เลือกกล่องเลยครับ"); return; }

  if(!confirm("⚠️ ยืนยันรีเซ็ตกล่องที่เลือก?\n\nคำในกล่องเหล่านี้จะถูกส่งกลับกล่อง 0 ทั้งหมด")) return;

  let count = 0;
  if(checked.length > 0){
    const data = loadSRS();
    Object.keys(data).forEach(word => {
      if(checked.includes(data[word].box)){ data[word].box = 0; data[word].nextReview = null; count++; }
    });
    saveSRS(data);
  }
  let msg = count > 0 ? `✅ รีเซ็ต ${count} คำ กลับกล่อง 0 แล้ว` : "";
  if(clearWB){ clearWrongBox(); msg += (msg ? "\n" : "") + "✅ รีเซ็ตกล่องคำผิดเป็น 0 แล้ว"; }
  alert(msg);
  document.querySelectorAll("#clearBoxChecks input").forEach(cb => cb.checked = false);
}

function clearWrongBoxManual(){
  clearWrongBox();
  alert("✅ รีเซ็ตกล่องคำผิดเป็น 0 แล้วครับ! กลับมาเล่นทวนวันนี้ได้แล้ว");
}

function resetEverything(){
  if(!confirm(
    "⚠️ คุณต้องการคืนค่าทั้งหมดหรือไม่?\n\n" +
    "• รีเซ็ตทุกคำกลับกล่อง 0 ทุกภาษา/ระดับ\n• ล้างกล่องคำผิดทั้งหมด\n• อัปเดตคำศัพท์ใหม่\n• เคลียร์แคชเบราว์เซอร์\n\n" +
    "⛔ การกระทำนี้ไม่สามารถย้อนกลับได้!"
  )) return;

  BACKUP_TOPIKS.forEach(({ id }) => {
    // Reset SRS key
    const key = `topik_srs_${id}_v1`;
    try {
      const data = JSON.parse(localStorage.getItem(key) || "{}");
      Object.keys(data).forEach(word => {
        data[word].box = 0;
        data[word].nextReview = null;
      });
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}

    // Clear Wrong Box key
    localStorage.setItem(
      `topik_wrongbox_${id}`,
      JSON.stringify({ date: todayStr(), words: [] })
    );

    // Reset daily new words counter in settings
    const settingsKey = `topik_srs_settings_${id}`;
    try {
      const s = JSON.parse(localStorage.getItem(settingsKey) || "{}");
      s[`todayNewWords_${id}`] = 0;
      localStorage.setItem(settingsKey, JSON.stringify(s));
    } catch (e) {}

    // Reset migration flag for box5
    localStorage.removeItem(`topik_box5_migrated_v3_${id}`);
  });

  // Re-initialize vocabulary for all levels
  const origTopik = currentTopik;
  BACKUP_TOPIKS.forEach(({ id }) => {
    currentTopik = id;
    initAllVocab();
  });
  currentTopik = origTopik;

  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
    alert("✅ คืนค่าทั้งหมดเสร็จแล้ว! กำลัง reload...");
    location.reload();
  });
}


async function syncVocabAndClearCache(){
  if(!confirm("ยืนยันการอัปเดตเวอร์ชันใหม่?\nระบบจะทำการสำรองข้อมูล (Backup) ล่าสุดของคุณลงเครื่องโดยอัตโนมัติก่อนเริ่มการอัปเดต")) return;

  const updateBtn = document.getElementById("updateAppBtn");
  if (updateBtn) {
    updateBtn.disabled = true;
    updateBtn.innerText = "กำลังสำรองข้อมูล...";
  }

  try {
    // 1. เรียกใช้งาน backupData() เพื่อแปลงข้อมูลเป็นไฟล์และเริ่มกระบวนการดาวน์โหลดทันที
    backupData();
  } catch (err) {
    console.error("Backup failed:", err);
    alert("❌ ไม่สามารถสร้างไฟล์สำรองข้อมูลได้: " + err.message + "\nยกเลิกการอัปเดตเพื่อป้องกันข้อมูลสูญหาย");
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.innerText = "Update";
    }
    return;
  }

  // 2. หน่วงเวลาสั้น ๆ 1 วินาทีเพื่อให้ Browser จัดการคิวเรียกดาวน์โหลด
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. ตรวจสอบการดาวน์โหลดผ่านผู้ใช้ (เนื่องจาก JS ไม่สามารถตรวจสถานะการเขียนไฟล์สำเร็จผ่าน Sandbox ได้)
  if (!confirm("ระบบได้ทำการดาวน์โหลดไฟล์สำรองข้อมูลไปที่โฟลเดอร์ Download เรียบร้อยแล้ว\n\nตรวจสอบว่ามีไฟล์ดาวน์โหลดขึ้นที่เบราว์เซอร์ของคุณหรือไม่?")) {
    alert("ยกเลิกการอัปเดตแล้ว");
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.innerText = "Update";
    }
    return;
  }

  if (updateBtn) {
    updateBtn.innerText = "กำลังอัปเดต...";
  }

  try {
    // 4. ล้างแคชและทำการอัปเดตตาม Logic เดิมของแอป
    const origTopik = currentTopik;
    BACKUP_TOPIKS.forEach(({ id }) => {
      currentTopik = id;
      initAllVocab();
    });
    currentTopik = origTopik;

    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // ลองสั่ง Update Service Worker ด้วยหากมี
    if ("serviceWorker" in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update();
        }
      } catch (swErr) {
        console.warn("ServiceWorker update warning:", swErr);
      }
    }

    alert("✅ อัปเดตเสร็จแล้ว! กำลัง reload... \n1.กด'ตกลง'\n2.ปัดแอพทิ้งแล้วเข้าใหม่หลังอัพเดททุกครั้ง");
    location.reload();
  } catch (err) {
    console.error("Update failed:", err);
    alert("❌ เกิดข้อผิดพลาดระหว่างการอัปเดต: " + err.message);
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.innerText = "Update";
    }
  }
}


// ============================================================
// BACKUP / RESTORE
// ============================================================

const BACKUP_FORMAT_VERSION = 3;

const BACKUP_TOPIKS = [
  { id: "topik1", label: "TOPIK 1" },
  { id: "topik2", label: "TOPIK 2" },
  { id: "english_a1", label: "English A1" },
  { id: "english_a2", label: "English A2" },
  { id: "english_b1", label: "English B1" },
  { id: "english_b2", label: "English B2" },
];

// key ทั้งหมดที่ต้อง backup (ไม่รวม date keys)
function getBackupKeys() {
  const keys = [];
  BACKUP_TOPIKS.forEach(({ id }) => {
    keys.push(
      `topik_srs_${id}_v1`,
      `topik_srs_settings_${id}`,
      `topik_practice_boxes_${id}`,
    );
  });
  return keys;
}

function getBackupTopikLabel(topikId) {
  const item = BACKUP_TOPIKS.find(topik => topik.id === topikId);
  return item ? item.label : topikId;
}

function getBackupSrsKeys() {
  return BACKUP_TOPIKS.map(({ id }) => `topik_srs_${id}_v1`);
}

function getBackupSummary(payload) {
  const backupDate = payload?.backupDate || todayStr();
  const today = todayStr();
  return BACKUP_TOPIKS.map(({ id, label }) => {
    const srsKey = `topik_srs_${id}_v1`;
    const data = safeParseJSON(payload.localStorage[srsKey], {});
    const counts = calcBoxCounts(data);
    const isReviewable = item => item.box >= 1 && item.box <= 4 && item.nextReview;
    // เลยกำหนด ณ ตอนที่สร้างไฟล์ backup
    const overdueAtBackup = Object.values(data).filter(item => isReviewable(item) && item.nextReview <= backupDate).length;
    // เลยกำหนด ถ้านำมากู้คืนตอนนี้แบบ "คงตารางเดิม" (keep)
    const overdueNow = Object.values(data).filter(item => isReviewable(item) && item.nextReview <= today).length;
    return { id, label, counts, overdueAtBackup, overdueNow };
  });
}

// ---- BACKUP ----
function backupData() {
  const snapshot = {};
  getBackupKeys().forEach(key => {
    const val = localStorage.getItem(key);
    if (val !== null) snapshot[key] = val; // เก็บเป็น raw string
  });

  const vocabEdits = {};
  const levels = (typeof LEVEL_ORDER !== "undefined")
    ? LEVEL_ORDER
    : ["topik1", "topik2", "english_a1", "english_a2", "english_b1", "english_b2"];

  levels.forEach(levelId => {
    vocabEdits[levelId] = (typeof getVocabEditsList === "function")
      ? getVocabEditsList(levelId)
      : (function() {
          try {
            const raw = localStorage.getItem(`${levelId}_vocab_edits`);
            return raw ? JSON.parse(raw) : [];
          } catch (e) {
            return [];
          }
        })();
  });

  const payload = {
   backupFormat: BACKUP_FORMAT_VERSION,
   createdAt: new Date().toISOString(),
   backupDate: todayStr(),
   localStorage: snapshot,
   vocabEdits: vocabEdits,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const dateStr = todayStr();
  a.href     = url;
  a.download = `EN_KR_Vocab_backup_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- RESTORE: Step 1 — รับไฟล์ ----
let _pendingRestorePayload = null; // เก็บ payload รอยืนยัน
let _pendingRestoreMode    = "reset"; // "reset" | "keep"

function handleRestoreFile(event) {
  const file = event.target.files[0];
  event.target.value = ""; // reset input เพื่อเลือกไฟล์เดิมซ้ำได้
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    let payload;
    try {
      payload = JSON.parse(e.target.result);
    } catch(err) {
      alert("❌ ไฟล์เสียหายหรือไม่ใช่ไฟล์ JSON ที่ถูกต้องครับ");
      return;
    }

    // ตรวจ format
    if (!payload.backupFormat) {
      alert("❌ ไม่ใช่ไฟล์ Backup ของแอปนี้ครับ");
      return;
    }
    if (payload.backupFormat > BACKUP_FORMAT_VERSION) {
      alert(`❌ ไฟล์นี้สร้างจากแอปเวอร์ชันใหม่กว่า (format ${payload.backupFormat})\nกรุณาอัปเดตแอปก่อนครับ`);
      return;
    }
    if (!payload.localStorage || typeof payload.localStorage !== "object") {
      alert("❌ ข้อมูลในไฟล์ไม่สมบูรณ์ครับ");
      return;
    }

    _pendingRestorePayload = payload;
    _pendingRestoreMode    = "reset"; // default = เริ่มนับใหม่ (แนะนำ)
    showRestorePreview(payload);
  };
  reader.readAsText(file);
}

// ---- RESTORE: Step 2 — แสดง Preview ----
function showRestorePreview(payload) {
  const createdAt = payload.createdAt
    ? new Date(payload.createdAt).toLocaleString("th-TH", { dateStyle:"medium", timeStyle:"short" })
    : "ไม่ทราบ";

  const summary = getBackupSummary(payload);
  const totalOverdueAtBackup = summary.reduce((sum, item) => sum + item.overdueAtBackup, 0);
  const totalOverdueNow      = summary.reduce((sum, item) => sum + item.overdueNow, 0);

  // คำนวณ nextReview ถ้าเลือก reset
  const today = todayStr();
  const resetDates = calcResetDates(today);

  const BOX_LABELS = ["ใหม่","1วัน","3วัน","7วัน","14วัน","จำได้✅"];
  const BOX_COLORS = ["#6b7280","#3b82f6","#8b5cf6","#d97706","#ef4444","#16a34a"];

  function boxTable(counts) {
    return counts.map((c, i) =>
      `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border-light);font-size:14px">
        <span style="color:${BOX_COLORS[i]};font-weight:700">กล่อง ${i} — ${BOX_LABELS[i]}</span>
        <span style="font-weight:700">${c} คำ</span>
      </div>`
    ).join("");
  }

  document.getElementById("restoreModalBody").innerHTML = `
    <div style="background:var(--primary-light);border:1.5px solid var(--border-light);border-radius:10px;padding:12px 14px;margin-bottom:14px">
      <div style="font-size:13px;color:var(--primary);font-weight:700">📦 ไฟล์สำรองข้อมูล</div>
      <div style="font-size:14px;color:var(--text-main);margin-top:4px">สร้างเมื่อ: <b>${createdAt}</b></div>
    </div>

    ${summary.map(item => `
      <div style="font-weight:800;font-size:15px;color:var(--text-main);margin:14px 0 8px">${item.label}</div>
      ${boxTable(item.counts)}
    `).join("")}

    <div style="margin-top:16px;font-weight:800;font-size:15px;color:var(--text-main)">🔄 เลือกวิธีกู้คืน</div>

    <label id="restoreOptReset" style="display:flex;align-items:flex-start;gap:10px;margin-top:10px;padding:12px;border-radius:10px;border:2px solid var(--primary);background:var(--primary-light);cursor:pointer" onclick="setRestoreMode('reset')">
      <input type="radio" name="restoreMode" value="reset" checked class="no-jitter-input" style="margin-top:3px;accent-color:var(--primary);width:16px;height:16px;">
      <div>
        <div style="font-weight:700;color:var(--primary);font-size:14px">🔄 เริ่มนับรอบทวนใหม่จากวันนี้ <span style="background:var(--success-light);color:var(--success);font-size:11px;padding:2px 7px;border-radius:999px;font-weight:700">แนะนำ</span></div>
      </div>
    </label>

    <label id="restoreOptKeep" style="display:flex;align-items:flex-start;gap:10px;margin-top:8px;padding:12px;border-radius:10px;border:2px solid var(--border-light);background:var(--card-bg-white);cursor:pointer" onclick="setRestoreMode('keep')">
      <input type="radio" name="restoreMode" value="keep" class="no-jitter-input" style="margin-top:3px;accent-color:var(--text-muted);width:16px;height:16px;">
      <div>
        <div style="font-weight:700;color:var(--text-main);font-size:14px">📅 กู้คืนตามตารางทวนเดิม</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:3px">ตอน backup เลยกำหนดอยู่ <b style="color:${totalOverdueAtBackup > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${totalOverdueAtBackup} คำ</b></div>
        ${totalOverdueNow > 0
          ? `<div style="font-size:12px;color:var(--danger);margin-top:2px">⚠️ ถ้ากู้คืนตอนนี้ จะเลยกำหนดทันที <b>${totalOverdueNow} คำ</b></div>`
          : `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">ถ้ากู้คืนตอนนี้ จะยังไม่มีคำเลยกำหนด</div>`}
      </div>
    </label>

    <div style="margin-top:14px;background:var(--danger-light);border:1.5px solid var(--border-light);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--danger)">
      ⚠️ การกู้คืนจะ<b>เขียนทับข้อมูลปัจจุบันทั้งหมด</b> — ไม่สามารถย้อนกลับได้
    </div>
  `;

  document.getElementById("restoreModal").classList.remove("hidden");
}

function setRestoreMode(mode) {
  _pendingRestoreMode = mode;
  const resetEl = document.getElementById("restoreOptReset");
  const keepEl  = document.getElementById("restoreOptKeep");
  if (mode === "reset") {
    resetEl.style.border = "2px solid var(--primary)";
    resetEl.style.background = "var(--primary-light)";
    keepEl.style.border = "2px solid var(--border-light)";
    keepEl.style.background = "var(--card-bg-white)";
  } else {
    keepEl.style.border = "2px solid var(--primary)";
    keepEl.style.background = "var(--primary-light)";
    resetEl.style.border = "2px solid var(--border-light)";
    resetEl.style.background = "var(--card-bg-white)";
  }
}

// ---- RESTORE: Step 3 — ยืนยันและเขียน ----
function confirmRestore() {
  if (!_pendingRestorePayload) return;

  const btn = document.getElementById("restoreConfirmBtn");
  btn.disabled = true;
  btn.textContent = "⏳ กำลังกู้คืน...";

  try {
    const snap    = _pendingRestorePayload.localStorage;
    const today   = todayStr();
    const toWrite = {}; // key → value string ที่จะเขียนจริง

    getBackupKeys().forEach(key => {
      if (snap[key] === undefined) return; // ไม่มีใน backup → ข้าม

      // SRS data: ถ้าเลือก reset → คำนวณ nextReview ใหม่
      if (key.startsWith("topik_srs_") && key.endsWith("_v1") && _pendingRestoreMode === "reset") {
        const data = safeParseJSON(snap[key], {});
        Object.keys(data).forEach(word => {
          const item = data[word];
          if (item.box >= 1 && item.box <= 4 && item.nextReview) {

           const backupDate =
             _pendingRestorePayload?.backupDate || today;

           const oldDate = new Date(item.nextReview);
           const baseDate = new Date(backupDate);

           const diffDays = Math.round(
             (oldDate - baseDate) / 86400000
           );

           item.nextReview = addDays(
            today,
            Math.max(0, diffDays) /// แก้วันที่ต้องการทวน 0=ทวนเลยวันนี้, 1=ทวนพรุ้งนี้เป็นต้นไป
           );

          } else if (item.box === 5) {
            item.nextReview = addDays(today, BOX5_INTERVAL); // Box5: +30 วัน
          }
          data[word] = item;
        });
        toWrite[key] = JSON.stringify(data);
        return;
      }

      // อื่นๆ: เขียนตรงๆ
      toWrite[key] = snap[key];
    });

    // ล้างข้อมูล vocabEdits เดิมออกให้หมดก่อน (Clean snapshot)
    const levels = (typeof LEVEL_ORDER !== "undefined")
      ? LEVEL_ORDER
      : ["topik1", "topik2", "english_a1", "english_a2", "english_b1", "english_b2"];

    levels.forEach(levelId => {
      localStorage.removeItem(`${levelId}_vocab_edits`);
    });

    // เขียนลง localStorage
    Object.entries(toWrite).forEach(([k, v]) => {
      localStorage.setItem(k, v);
    });

     // รีเซ็ต Wrong Box ทุกภาษา/ทุก TOPIK และลบ flag migration เพื่อให้รันเติมคำวันแรกของไฟล์ใหม่ทันที
     BACKUP_TOPIKS.forEach(({ id }) => {
      localStorage.setItem(
        `topik_wrongbox_${id}`,
         JSON.stringify({
          date: todayStr(),
          words: []
        })
      );
      localStorage.removeItem(`topik_box5_migrated_v3_${id}`);
     });

    // Restore vocabEdits ถ้ามีใน backup และข้อมูลเป็น Array
    if (_pendingRestorePayload.vocabEdits) {
      Object.entries(_pendingRestorePayload.vocabEdits).forEach(([levelId, edits]) => {
        if (Array.isArray(edits)) {
          if (typeof saveVocabEditsList === "function") {
            saveVocabEditsList(levelId, edits);
          } else {
            localStorage.setItem(`${levelId}_vocab_edits`, JSON.stringify(edits));
          }
        }
      });
    }

    // อัปเดต badge แจ้งเตือนทันที
    if (typeof updateNotificationBadge === "function") {
      updateNotificationBadge();
    }

    _pendingRestorePayload = null;
    alert("✅ กู้คืนสำเร็จ! กำลัง reload...");
    location.reload();

  } catch(err) {
    btn.disabled = false;
    btn.textContent = "✅ กู้คืน";
    alert("❌ เกิดข้อผิดพลาด: " + err.message);
  }
}

function closeRestoreModal(event) {
  if (event.target === document.getElementById("restoreModal")) {
    document.getElementById("restoreModal").classList.add("hidden");
  }
}

// ---- Helper functions ----
function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); }
  catch(e) { return fallback; }
}

function calcBoxCounts(srsData) {
  const counts = [0, 0, 0, 0, 0, 0];
  const items = Object.values(srsData);
  const total = items.length;
  items.forEach(item => {
    let box = (item.box === undefined || item.box === null) ? 0 : Number(item.box);
    if (box >= 1) {
      counts[Math.min(box, 5)]++;
    }
  });
  counts[0] = Math.max(0, total - (counts[1] + counts[2] + counts[3] + counts[4] + counts[5]));
  return counts;
}

function calcResetDates(today) {
  // คืนค่า nextReview ของแต่ละ box ถ้าเริ่มนับใหม่
  return {
    1: addDays(today, 1),
    2: addDays(today, 3),
    3: addDays(today, 7),
    4: addDays(today, 14),
  };
}

// ============================================================
// SEARCH
// ============================================================
function getActiveSearchLangs() {
  const krCb = document.getElementById("searchFilterKR");
  const enCb = document.getElementById("searchFilterEN");
  const langs = [];
  if (krCb && krCb.checked) langs.push("ko-KR");
  if (enCb && enCb.checked) langs.push("en-US");
  return langs;
}

function syncSearchFilterChipStyles() {
  const allCb = document.getElementById("searchFilterAll");
  const krCb = document.getElementById("searchFilterKR");
  const enCb = document.getElementById("searchFilterEN");

  document.getElementById("searchFilterChipAll")?.classList.toggle("active", !!(allCb && allCb.checked));
  document.getElementById("searchFilterChipKR")?.classList.toggle("active", !!(krCb && krCb.checked));
  document.getElementById("searchFilterChipEN")?.classList.toggle("active", !!(enCb && enCb.checked));
}

function onSearchFilterAllChange() {
  const allCb = document.getElementById("searchFilterAll");
  const krCb = document.getElementById("searchFilterKR");
  const enCb = document.getElementById("searchFilterEN");

  if (allCb) {
    const checked = allCb.checked;
    if (krCb) krCb.checked = checked;
    if (enCb) enCb.checked = checked;
  }

  syncSearchFilterChipStyles();
  searchVocabulary();
}

function onSearchFilterLangChange() {
  const allCb = document.getElementById("searchFilterAll");
  const krCb = document.getElementById("searchFilterKR");
  const enCb = document.getElementById("searchFilterEN");

  if (krCb && enCb && allCb) {
    if (krCb.checked && enCb.checked) {
      allCb.checked = true;
    } else {
      allCb.checked = false;
    }
  }

  syncSearchFilterChipStyles();
  searchVocabulary();
}

function searchVocabulary(){
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const resultBox = document.getElementById("searchResult");
  if(!keyword){ resultBox.classList.add("hidden"); resultBox.innerHTML = ""; return; }

  const activeLangs = getActiveSearchLangs();
  if(activeLangs.length === 0){
    resultBox.innerHTML = `<div class="search-notfound">⚠️ กรุณาเลือกอย่างน้อย 1 ภาษา</div>`;
    resultBox.classList.remove("hidden");
    return;
  }

  const allSources = [
    { data: window.flashVocabData1,    level: "TOPIK1",  className: "level-topik1", lang: "ko-KR" },
    { data: window.flashVocabData2,    level: "TOPIK2",  className: "level-topik2", lang: "ko-KR" },
    { data: window.flashVocabDataEnA1, level: "EN A1",   className: "level-en-a1",   lang: "en-US" },
    { data: window.flashVocabDataEnA2, level: "EN A2",   className: "level-en-a2",   lang: "en-US" },
    { data: window.flashVocabDataEnB1, level: "EN B1",   className: "level-en-b1",   lang: "en-US" },
    { data: window.flashVocabDataEnB2, level: "EN B2",   className: "level-en-b2",   lang: "en-US" },
  ];

  const sources = allSources.filter(src => activeLangs.includes(src.lang));

  const foundBySource = sources.map(({ data, level, className, lang }) => {
    const matches = [];
    (data || []).forEach(item => {
      if(!item || typeof item.word !== "string" || typeof item.meaning !== "string") return;
      const word = item.word.toLowerCase();
      const meaning = item.meaning.toLowerCase();
      if(word.includes(keyword) || meaning.includes(keyword)) {
        matches.push({ word: item.word, meaning: item.meaning, level, className, lang });
      }
    });
    return matches;
  });

  const found = [];
  let hasMore = true;
  while(hasMore){
    hasMore = false;
    foundBySource.forEach(matches => {
      const item = matches.shift();
      if(item){
        found.push(item);
        hasMore = true;
      }
    });
  }

  if(found.length === 0){
    const rawQuery = document.getElementById("searchInput") ? document.getElementById("searchInput").value.trim() : "";
    const escapedQuery = rawQuery.replace(/'/g, "\\'");
    resultBox.innerHTML = `<div class="search-notfound">❌ ไม่พบคำศัพท์</div>` +
      (rawQuery ? `<div class="search-add-from-notfound"><button class="search-add-notfound-btn" onclick="openSearchAddLevelSelectPopup('${escapedQuery}')">➕ เพิ่มคำศัพท์นี้</button></div>` : "");
    resultBox.classList.remove("hidden");
    return;
  }

  resultBox.innerHTML = found.map(item => {
    const escapedWord = item.word.replace(/'/g, "\\'");
    const escapedMeaning = item.meaning.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    return `
    <div class="search-item">
      <div class="search-word-row">
        <div class="search-word ${item.className}">${item.word}</div>
        <button class="search-play-btn" onclick="event.stopPropagation(); speak('${escapedWord}', '${item.lang}')">🔊</button>
      </div>
      <div class="search-meaning-row">
        <div class="search-meaning">${item.meaning}</div>
        <button class="search-example-btn" onclick="event.stopPropagation(); showExamplePopup('${escapedWord}', '${item.level}')">📄</button>
      </div>
      <div class="search-level-row">
        <div class="search-level ${item.className}">${item.level}</div>
        <button class="search-edit-btn" onclick="event.stopPropagation(); openEditPopup('${escapedWord}', '${escapedMeaning}', mapLevelToId('${item.level}'))">!</button>
      </div>
    </div>`;
  }).join("");
  resultBox.classList.remove("hidden");
}

function clearSearchInput(){
  document.getElementById("searchInput").value = "";
  const resultBox = document.getElementById("searchResult");
  resultBox.innerHTML = "";
  resultBox.classList.add("hidden");
  document.getElementById("searchInput").focus();
}

function handleSearchEnter(event){
  if(event.key === "Enter"){
    searchVocabulary();
    document.getElementById("searchInput").blur();
  }
}

// ============================================================
// BOX INSPECTOR POPUP
// ============================================================
function openBoxInspector(boxNum){
  const data = loadSRS();
  const words = Object.values(data).filter(item => item.box === boxNum);

  const BOX_LABELS = ["ใหม่","1วัน","3วัน","7วัน","14วัน","จำได้✅"];
  const BOX_COLORS = ["#6b7280","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#16a34a"];
  const label = boxNum <= 5 ? BOX_LABELS[boxNum] : "❌คำผิด";
  const color = boxNum <= 5 ? BOX_COLORS[boxNum] : "#db2777";

  let listHtml = "";
  if(words.length === 0){
    listHtml = `<div class="box-inspector-empty">ไม่มีคำในกล่องนี้</div>`;
  } else {
    words.forEach((item, i) => {
      const nextReview = item.nextReview ? `<span class="box-inspector-date">${item.nextReview}</span>` : "";
      listHtml += `<div class="box-inspector-item">
        <span class="box-inspector-num">${i+1}.</span>
        <span class="box-inspector-word">${item.word}</span>
        <span class="box-inspector-meaning">${item.meaning}</span>
        ${nextReview}
      </div>`;
    });
  }

  document.getElementById("boxInspectorTitle").textContent = `กล่อง ${boxNum} — ${label} (${words.length} คำ)`;
  document.getElementById("boxInspectorTitle").style.color = color;
  document.getElementById("boxInspectorList").innerHTML = listHtml;
  document.getElementById("boxInspectorModal").classList.remove("hidden");
}

function openDueTodayInspector(){
  // ใช้เงื่อนไขเดียวกับ stats.dueToday ใน getSRSStats() เป๊ะๆ:
  // เฉพาะ box 1-5 ที่ nextReview ถึงกำหนดแล้ว (ไม่รวมคำใหม่ box 0)
  const data  = loadSRS();
  const today = todayStr();
  const words = Object.values(data)
    .filter(item => {
      let box = (item.box === undefined || item.box === null) ? 0 : Number(item.box);
      return (box >= 1 && box <= 4 && item.nextReview && item.nextReview <= today) ||
             (box === 5 && ((item.nextReview && item.nextReview <= today) || item.borrowedFor === today));
    })
    .sort((a, b) => {
      if ((a.nextReview || "") !== (b.nextReview || "")) {
        return (a.nextReview || "").localeCompare(b.nextReview || "");
      }
      return a.box - b.box;
    });

  let listHtml = "";
  if(words.length === 0){
    listHtml = `<div class="box-inspector-empty">ไม่มีคำให้ทวนวันนี้</div>`;
  } else {
    words.forEach((item, i) => {
      listHtml += `<div class="box-inspector-item">
        <span class="box-inspector-num">${i+1}.</span>
        <span class="box-inspector-word">${item.word}</span>
        <span class="box-inspector-meaning">${item.meaning}</span>
        <span class="box-inspector-date">กล่อง ${item.box}</span>
      </div>`;
    });
  }

  document.getElementById("boxInspectorTitle").textContent = `📅 ทวนวันนี้ (${words.length} คำ)`;
  document.getElementById("boxInspectorTitle").style.color = "#FACC15";
  document.getElementById("boxInspectorList").innerHTML = listHtml;
  document.getElementById("boxInspectorModal").classList.remove("hidden");
}

function openTomorrowDueInspector(){
  const data = loadSRS();
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const items = Object.values(data);

  // 1. Box 1-4 ที่ nextReview == tomorrow
  const box1to4Words = items.filter(item => {
    let box = (item.box === undefined || item.box === null) ? 0 : Number(item.box);
    return box >= 1 && box <= 4 && item.nextReview === tomorrow;
  });

  // 2. Box 5 ของวันพรุ่งนี้ ตาม Logic ของ processDailyBox5Queue
  const box5RealDue = items.filter(item =>
    Number(item.box) === 5 && item.nextReview && item.nextReview <= tomorrow
  );

  let box5Words = [];
  if (box5RealDue.length >= BOX5_CHUNK_SIZE) {
    box5Words = box5RealDue;
  } else {
    const candidates = items.filter(item =>
      Number(item.box) === 5 &&
      (!item.nextReview || item.nextReview > tomorrow)
    );
    const needed = BOX5_CHUNK_SIZE - box5RealDue.length;
    const borrowed = candidates.slice(0, needed);
    box5Words = [...box5RealDue, ...borrowed];
  }

  const allWords = [...box1to4Words, ...box5Words].sort((a, b) => {
    let boxA = Number(a.box);
    let boxB = Number(b.box);
    if (boxA !== boxB) return boxA - boxB;
    return (a.word || "").localeCompare(b.word || "");
  });

  let listHtml = "";
  if(allWords.length === 0){
    listHtml = `<div class="box-inspector-empty">ไม่มีคำให้ทวนวันพรุ่งนี้</div>`;
  } else {
    allWords.forEach((item, i) => {
      const isBorrowed = Number(item.box) === 5 && (!item.nextReview || item.nextReview > tomorrow);
      const tag = isBorrowed
        ? `<span class="box-inspector-date" style="background:rgba(14,165,233,0.2);color:#38bdf8">กล่อง 5 (ยืม)</span>`
        : `<span class="box-inspector-date">กล่อง ${item.box}</span>`;
      listHtml += `<div class="box-inspector-item">
        <span class="box-inspector-num">${i+1}.</span>
        <span class="box-inspector-word">${item.word}</span>
        <span class="box-inspector-meaning">${item.meaning}</span>
        ${tag}
      </div>`;
    });
  }

  document.getElementById("boxInspectorTitle").textContent = `📅 ทวนพรุ่งนี้ (${allWords.length} คำ)`;
  document.getElementById("boxInspectorTitle").style.color = "#38bdf8";
  document.getElementById("boxInspectorList").innerHTML = listHtml;
  document.getElementById("boxInspectorModal").classList.remove("hidden");
}

function openWrongBoxInspector(){
  const words = getWrongBoxWords();
  let listHtml = "";
  if(words.length === 0){
    listHtml = `<div class="box-inspector-empty">ไม่มีคำผิดวันนี้</div>`;
  } else {
    words.forEach((item, i) => {
      listHtml += `<div class="box-inspector-item">
        <span class="box-inspector-num">${i+1}.</span>
        <span class="box-inspector-word">${item.word}</span>
        <span class="box-inspector-meaning">${item.meaning}</span>
      </div>`;
    });
  }
  document.getElementById("boxInspectorTitle").textContent = `กล่องคำผิด (${words.length} คำ)`;
  document.getElementById("boxInspectorTitle").style.color = "#db2777";
  document.getElementById("boxInspectorList").innerHTML = listHtml;
  document.getElementById("boxInspectorModal").classList.remove("hidden");
}

function closeBoxInspector(){
  document.getElementById("boxInspectorModal").classList.add("hidden");
}

// ============================================================
// NEXT SET POOL — เก็บคำที่ยังไม่ได้เล่นในรอบนี้ (FIFO Queue)
// Logic: shuffle ครั้งเดียวตอนเริ่ม Session แล้วดึงออกทีละ chunk
//        พอ pool หมด → shuffle ใหม่ทั้งก้อน (รอบใหม่)
//        ถ้า pool เหลือน้อยกว่า chunkSize → เอาที่เหลือ + เติมจากรอบใหม่
// ============================================================
let practicePool = [];      // queue คำที่ยังไม่ได้เล่นในรอบนี้ (practice)
let wrongboxPool = [];      // queue คำที่ยังไม่ได้เล่นในรอบนี้ (wrongbox)
let practiceSourceWords = []; // คำทั้งหมดที่เลือกไว้ใน session
let wrongboxSourceWords = []; // คำทั้งหมดในกล่องคำผิด

/**
 * ดึง chunk ถัดไปจาก practicePool แบบ FIFO
 * - ถ้า pool มีพอ → splice ออก chunkSize คำ
 * - ถ้า pool เหลือน้อยกว่า chunkSize → เอาที่เหลือก่อน
 *   แล้ว shuffle ใหม่ทั้งก้อน เติมให้ครบ
 * - ถ้า pool หมดพอดี → shuffle ใหม่รอบหน้า
 */
function getNextPracticeChunk() {
  const chunkSize = getPracticeChunkSize();
  const selectedBoxes = getPracticeSelectedBoxes();

  // ถ้ายังไม่มี source (เช่นกด Next Set ครั้งแรกหลังเริ่ม) → สร้าง pool
  if (practiceSourceWords.length === 0) {
    practiceSourceWords = getPracticeWordsByBoxes(selectedBoxes, 99999);
    if (practiceSourceWords.length === 0) return [];
    practicePool = shuffleArray([...practiceSourceWords]);
  }

  let result = [];

  while (result.length < chunkSize) {
    if (practicePool.length === 0) {
      // จบรอบ → shuffle ใหม่ทั้งก้อนสำหรับรอบหน้า
      practicePool = shuffleArray([...practiceSourceWords]);
    }
    result.push(practicePool.shift());
  }

  return result;
}

// ฟังก์ชันเดิม (ใช้สำหรับชุดแรก ตอน startPracticeGame เรียกครั้งแรก)
function getNextPracticeSet() {
  return getNextPracticeChunk();
}

/**
 * ดึง chunk ถัดไปจาก wrongboxPool แบบ FIFO (logic เดียวกัน)
 */
function getNextWrongboxSet() {
  const chunkSize = getWrongChunkSize();
  const allWords  = getWrongBoxWords();

  if (allWords.length === 0) return [];

  // ตรวจว่า source ยังไม่ถูกสร้าง หรือจำนวนคำผิดเปลี่ยนไป (เพิ่ม/ลดระหว่างวัน)
  // → rebuild source + pool ใหม่ทั้งชุด
  if (
    wrongboxSourceWords.length === 0 ||
    wrongboxSourceWords.length !== allWords.length
  ) {
    wrongboxSourceWords = [...allWords];
    wrongboxPool = shuffleArray([...wrongboxSourceWords]);
  }

  let result = [];

  while (result.length < chunkSize) {
    if (wrongboxPool.length === 0) {
      // จบรอบ → shuffle ใหม่
      wrongboxPool = shuffleArray([...wrongboxSourceWords]);
    }
    result.push(wrongboxPool.shift());
  }

  return result;
}

// ============================================================
// PLAY NEXT SET — ฟังก์ชันหลัก
// ============================================================
function playNextSet() {
  // ป้องกัน double-click
  const btn = document.getElementById("nextSetBtn");
  if (btn) btn.disabled = true;

  // reset history เพื่อไม่ให้ย้อนกลับไปหน้าสรุปเก่า
  screenHistory = screenHistory.filter(id => id !== "finishScreen");
  wrongAnswers = [];

  if (srsSessionType === "wrongbox") {
    const words = getNextWrongboxSet();
    if (words.length === 0) { goToSRSDashboard(); return; }
    srsSessionWords = words;
    currentVocabulary = srsSessionWords.map(i => ({ word: i.word, meaning: i.meaning }));
    startWrongBoxGame("quiz"); // เริ่มต้นด้วยด่าน 1: จับคู่ (quiz)
  } else {
    // practice
    const words = getNextPracticeSet();
    if (words.length === 0) { goToSRSDashboard(); return; }
    srsSessionWords = words;
    srsSessionType = "practice"; // set ก่อนเรียก startPracticeGame
    startPracticeGame("quiz"); // เริ่มต้นด้วยด่าน 1: จับคู่ (quiz)
  }

  // re-enable หลัง render (setTimeout เล็กน้อย)
  setTimeout(() => { if (btn) btn.disabled = false; }, 500);
}

function playNextSetOtherMode() {
  const btn = document.getElementById("nextSetOtherModeBtn");
  if(btn) btn.disabled = true;

  screenHistory = screenHistory.filter(id => id !== "finishScreen");
  wrongAnswers = [];

  const otherMode = srsSessionMode === "quiz" ? "typing" : "quiz";

  if(srsSessionType === "wrongbox"){
    const words = getNextWrongboxSet();
    if(words.length === 0){ goToSRSDashboard(); return; }
    srsSessionWords = words;
    currentVocabulary = srsSessionWords.map(i => ({ word: i.word, meaning: i.meaning }));
    startWrongBoxGame(otherMode);
  } else {
    const words = getNextPracticeSet();
    if(words.length === 0){ goToSRSDashboard(); return; }
    srsSessionWords = words;
    srsSessionType = "practice";
    startPracticeGame(otherMode);
  }

  setTimeout(() => { if(btn) btn.disabled = false; }, 500);
}

function updateTitleVisibility(){
  const cur = document.querySelector(".screen:not(.hidden)")?.id;

  const hide = [
    "mainMenu",
    "flashcardGame",
    "quizGame",
    "typingGame",
    "srsStats",
    "globalSettingsPanel"
  ];

  document.getElementById("appTitle")
    .classList.toggle("hidden", hide.includes(cur));
}


// ============================================================
// VOCABULARY LIBRARY SYNC TOOL
// ============================================================
let _pendingSyncData = null;

async function syncVocabLibrary() {
  if (!confirm("ยืนยันการเริ่มซิงก์คลังคำศัพท์?\n\nระบบจะทำการสำรองข้อมูล (Backup) ข้อมูลล่าสุดของคุณลงเครื่องโดยอัตโนมัติก่อน เพื่อความปลอดภัยสูงสุด")) {
    return;
  }

  const syncBtn = document.getElementById("syncVocabBtn");
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerText = "กำลังสำรองข้อมูล...";
  }

  try {
    // 1. เรียกดาวน์โหลดข้อมูล
    backupData();
  } catch (err) {
    console.error("Backup failed during sync setup:", err);
    alert("❌ ไม่สามารถสร้างไฟล์สำรองข้อมูลได้: " + err.message + "\nยกเลิกการซิงก์ข้อมูลคลังเพื่อความปลอดภัย");
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerText = "🧹 ซิงก์คลังคำศัพท์";
    }
    return;
  }

  // หน่วงเวลาสั้น ๆ ให้บราวเซอร์รับเรื่อง
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 2. ให้ผู้ใช้ยืนยันการมีอยู่ของไฟล์ดาวน์โหลดจริง
  if (!confirm("ระบบได้ทำการทริกเกอร์ดาวน์โหลดไฟล์สำรองข้อมูล (Backup) แล้ว\n\nกรุณาตรวจสอบว่ามีไฟล์ดาวน์โหลดขึ้นที่เบราว์เซอร์ของคุณหรือไม่?\n\n- กด 'ตกลง' (OK) เพื่อเริ่มการคำนวณซิงก์คลังคำศัพท์\n- กด 'ยกเลิก' (Cancel) เพื่อยกเลิกกระบวนการซิงก์ข้อมูล")) {
    alert("ยกเลิกการซิงก์ข้อมูลเรียบร้อยแล้ว");
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerText = "🧹 ซิงก์คลังคำศัพท์";
    }
    return;
  }

  if (syncBtn) {
    syncBtn.innerText = "กำลังสแกนคลังคำศัพท์...";
  }

  // 3. ตรวจสอบว่าไฟล์ข้อมูลคำศัพท์ทั้งหมดโหลดเข้าแอปเรียบร้อยและไม่ใช่ค่าว่าง
  const failedTopiks = [];
  BACKUP_TOPIKS.forEach(({ id, label }) => {
    const vocab = getTopikVocab(id);
    if (!Array.isArray(vocab) || vocab.length === 0) {
      failedTopiks.push(label);
    }
  });

  if (failedTopiks.length > 0) {
    alert(`❌ การซิงก์ล้มเหลว: ไม่สามารถดึงคลังข้อมูลคำศัพท์ของ [${failedTopiks.join(", ")}] ได้ในขณะนี้ กรุณารีโหลดหน้าเว็บใหม่และตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้งครับ`);
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerText = "🧹 ซิงก์คลังคำศัพท์";
    }
    return;
  }

  // 4. คำนวณความแตกต่าง (Dry-run Scan)
  _pendingSyncData = {};
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  let addedInfoHTML = "";
  let updatedInfoHTML = "";
  let deletedInfoHTML = "";

  BACKUP_TOPIKS.forEach(({ id, label }) => {
    const vocab = getTopikVocab(id);
    const srsKeyName = `topik_srs_${id}_v1`;
    let data = {};
    try {
      data = JSON.parse(localStorage.getItem(srsKeyName) || "{}");
    } catch (e) {
      data = {};
    }

    const currentVocabMap = {};
    vocab.forEach(item => {
      currentVocabMap[item.word] = item.meaning;
    });

    let addedCount = 0;
    let updatedCount = 0;
    let deletedWords = [];
    let addedWords = [];
    let updatedWords = []; // { word, oldMeaning, newMeaning }

    // Clone ข้อมูลเพื่อประมวลผลล่วงหน้า
    const newData = JSON.parse(JSON.stringify(data));

    // ตรวจสอบการเพิ่มคำศัพท์ใหม่ หรืออัปเดตคำศัพท์เก่า
    vocab.forEach(item => {
      if (!newData[item.word]) {
        newData[item.word] = { word: item.word, meaning: item.meaning, box: 0, nextReview: null };
        addedCount++;
        addedWords.push(item.word);
      } else if (newData[item.word].meaning !== item.meaning) {
        updatedWords.push({
          word: item.word,
          oldMeaning: newData[item.word].meaning,
          newMeaning: item.meaning
        });
        newData[item.word].meaning = item.meaning;
        updatedCount++;
      }
    });

    // ตรวจสอบคำที่มีอยู่ใน SRS แต่ไม่มีในไฟล์ JS แล้ว
    Object.keys(data).forEach(word => {
      if (!currentVocabMap[word]) {
        deletedWords.push(word);
      }
    });

    _pendingSyncData[id] = {
      newData: newData,
      addedCount: addedCount,
      updatedCount: updatedCount,
      deletedWords: deletedWords
    };

    totalAdded += addedCount;
    totalUpdated += updatedCount;
    totalDeleted += deletedWords.length;

    if (addedWords.length > 0) {
      addedInfoHTML += `
        <div style="margin-top: 10px; font-weight: bold; color: #16a34a;">${label}:</div>
        <div style="font-size: 13px; color: var(--text-muted); background: var(--success-light); padding: 8px; border-radius: 6px; margin-top: 4px;">
          ${addedWords.join(", ")}
        </div>`;
    }

    if (updatedWords.length > 0) {
      const rows = updatedWords.map(u =>
        `<div style="padding:4px 0;border-bottom:1px solid rgba(37,99,235,0.15)">
          <b>${u.word}</b><br>
          <span style="text-decoration:line-through;opacity:0.7">${u.oldMeaning}</span> → <span style="color:#2563eb;font-weight:700">${u.newMeaning}</span>
        </div>`
      ).join("");
      updatedInfoHTML += `
        <div style="margin-top: 10px; font-weight: bold; color: #2563eb;">${label}:</div>
        <div style="font-size: 13px; color: var(--text-muted); background: rgba(37,99,235,0.08); padding: 8px; border-radius: 6px; margin-top: 4px;">
          ${rows}
        </div>`;
    }

    if (deletedWords.length > 0) {
      deletedInfoHTML += `
        <div style="margin-top: 10px; font-weight: bold; color: var(--danger);">${label}:</div>
        <div style="font-size: 13px; color: var(--text-muted); background: #fee2e2; padding: 8px; border-radius: 6px; margin-top: 4px;">
          ${deletedWords.join(", ")}
        </div>`;
    }
  });

  // 5. เรนเดอร์ลงใน Modal และแจ้งพรีวิว
  let bodyHTML = `
    <div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; color: var(--text-main);">
      📊 รายการปรับปรุงคลังคำศัพท์หลังสแกน:
    </div>
    <div style="background: var(--border-light); padding: 12px; border-radius: 10px; margin-bottom: 16px;">
      <div>➕ เพิ่มคำใหม่เข้าคลัง: <span style="font-weight:bold;color:#16a34a">${totalAdded} คำ</span></div>
      <div>🔄 ปรับปรุงความหมาย/ข้อมูล: <span style="font-weight:bold;color:#2563eb">${totalUpdated} คำ</span></div>
      <div>🗑️ คำศัพท์ที่ไม่มีอยู่ในไฟล์แล้ว: <span style="font-weight:bold;color:var(--danger)">${totalDeleted} คำ</span></div>
    </div>
  `;

  if (totalAdded > 0) {
    bodyHTML += `
      <div style="margin-bottom: 16px; border: 1px solid rgba(34,197,94,0.25); padding: 12px; border-radius: 10px; background: var(--success-light);">
        <div style="font-weight: 700; color: #16a34a; display:flex; align-items:center; gap:6px;">
          ➕ คำใหม่ที่จะเพิ่มเข้าคลัง
        </div>
        <div style="max-height: 120px; overflow-y: auto; margin-top: 10px; border-top: 1px solid rgba(34,197,94,0.2); padding-top: 8px;">
          ${addedInfoHTML}
        </div>
      </div>
    `;
  }

  if (totalUpdated > 0) {
    bodyHTML += `
      <div style="margin-bottom: 16px; border: 1px solid rgba(37,99,235,0.25); padding: 12px; border-radius: 10px; background: rgba(37,99,235,0.06);">
        <div style="font-weight: 700; color: #2563eb; display:flex; align-items:center; gap:6px;">
          🔄 คำที่ความหมายถูกปรับปรุง
        </div>
        <div style="max-height: 160px; overflow-y: auto; margin-top: 10px; border-top: 1px solid rgba(37,99,235,0.2); padding-top: 8px;">
          ${updatedInfoHTML}
        </div>
      </div>
    `;
  }

  if (totalDeleted > 0) {
    bodyHTML += `
      <div style="margin-bottom: 16px; border: 1px solid #fee2e2; padding: 12px; border-radius: 10px; background: #fff5f5;">
        <label style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--danger); cursor: pointer;">
          <input type="checkbox" id="syncDeleteCheckbox" class="practice-checkbox" style="accent-color: var(--danger);">
          ลบคำที่ไม่มีในไฟล์แล้วออกจากประวัติ SRS
        </label>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">
          * หากไม่ติ๊กเลือก คำเหล่านี้จะคงอยู่ในระบบ SRS ของท่านตามปกติโดยไม่มีคำใดถูกลบออก
        </div>
        <div style="max-height: 120px; overflow-y: auto; margin-top: 10px; border-top: 1px solid #fecaca; padding-top: 8px;">
          ${deletedInfoHTML}
        </div>
      </div>
    `;
  } else {
    bodyHTML += `
      <div style="color: var(--success); font-weight: bold; background: var(--success-light); padding: 10px; border-radius: 8px; font-size: 13px; text-align: center; border: 1px solid rgba(34,197,94,0.2);">
        ✨ คลังคำศัพท์ตรงกับไฟล์ข้อมูลเรียบร้อยแล้ว ไม่มีคำศัพท์ที่ถูกลบออกจากไฟล์หลัก
      </div>
    `;
  }

  bodyHTML += `
    <div style="font-size: 13px; color: var(--text-muted); text-align: center; margin-top: 12px;">
      * หมายเหตุ: ประวัติการทวนเดิมของคำอื่น ๆ (กล่องทวน, วันทวน, คะแนนผิด) จะคงอยู่ครบถ้วน 100%
    </div>
  `;

  document.getElementById("syncModalBody").innerHTML = bodyHTML;
  document.getElementById("syncModal").classList.remove("hidden");
}

function closeSyncModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById("syncModal").classList.add("hidden");

  const syncBtn = document.getElementById("syncVocabBtn");
  if (syncBtn) {
    syncBtn.disabled = false;
    syncBtn.innerText = "🧹 ซิงก์คลังคำศัพท์";
  }
}

function executeSyncVocab() {
  const deleteCheckbox = document.getElementById("syncDeleteCheckbox");
  const shouldDelete = deleteCheckbox ? deleteCheckbox.checked : false;

  let actualDeletedCount = 0;
  let actualAddedCount = 0;
  let actualUpdatedCount = 0;

  for (const topikId in _pendingSyncData) {
    const srsKeyName = `topik_srs_${topikId}_v1`;
    const syncInfo = _pendingSyncData[topikId];
    const dataToSave = syncInfo.newData;

    actualAddedCount += syncInfo.addedCount;
    actualUpdatedCount += syncInfo.updatedCount;

    if (shouldDelete && syncInfo.deletedWords.length > 0) {
      syncInfo.deletedWords.forEach(word => {
        delete dataToSave[word];
        actualDeletedCount++;
      });
    }

    localStorage.setItem(srsKeyName, JSON.stringify(dataToSave));
  }

  closeSyncModal();

  // เรียกใช้ initAllVocab เพื่อทวนสอบและรีเฟรชข้อมูลหน้าจอ SRS ทั้งหมด
  const origTopik = currentTopik;
  BACKUP_TOPIKS.forEach(({ id }) => {
    currentTopik = id;
    initAllVocab();
  });
  currentTopik = origTopik;

  alert(`🧹 ซิงก์คลังคำศัพท์เสร็จสมบูรณ์!\n\n- เพิ่มคำใหม่เข้าระบบ: ${actualAddedCount} คำ\n- อัปเดตข้อมูลความหมาย: ${actualUpdatedCount} คำ\n- ลบคำศัพท์เก่าออก: ${shouldDelete ? actualDeletedCount : 0} คำ\n\nระบบจะทำการโหลดหน้าจอใหม่...`);
  location.reload();
}

document.addEventListener("visibilitychange", () => {

  // เมื่อผู้ใช้กลับเข้าแอพ
  if (!document.hidden) {
    autoRefreshHomeDueIfNeeded();
  }

});

setInterval(autoRefreshHomeDueIfNeeded, 60000);

function showNewDayPopup(){
  document
    .getElementById("newDayPopup")
    ?.classList.remove("hidden");
}

function closeNewDayPopup(){
  document
    .getElementById("newDayPopup")
    ?.classList.add("hidden");
}

function goHomeFromNewDayPopup(){
  closeNewDayPopup();
  showMainMenu();
}

// ============================================================
// EXAMPLE SENTENCE POPUP FUNCTIONS
// ============================================================
function getWordDetails(word, levelOrTopik) {
  let list = null;
  const key = String(levelOrTopik || "").toLowerCase().replace(/\s+/g, "");
  
  if (key === "topik1") {
    list = window.flashVocabData1;
  } else if (key === "topik2") {
    list = window.flashVocabData2;
  } else if (key === "ena1" || key === "english_a1") {
    list = window.flashVocabDataEnA1;
  } else if (key === "ena2" || key === "english_a2") {
    list = window.flashVocabDataEnA2;
  } else if (key === "enb1" || key === "english_b1") {
    list = window.flashVocabDataEnB1;
  } else if (key === "enb2" || key === "english_b2") {
    list = window.flashVocabDataEnB2;
  }
  
  if (list) {
    const found = list.find(item => item && item.word === word);
    if (found) return found;
  }
  
  // Fallback: search in all arrays
  const allLists = [
    window.flashVocabData1,
    window.flashVocabData2,
    window.flashVocabDataEnA1,
    window.flashVocabDataEnA2,
    window.flashVocabDataEnB1,
    window.flashVocabDataEnB2
  ];
  for (const fallbackList of allLists) {
    if (!fallbackList) continue;
    const found = fallbackList.find(item => item && item.word === word);
    if (found) return found;
  }
  
  return null;
}

function detectLanguage(levelOrTopik) {
  const key = String(levelOrTopik || "").toLowerCase();
  if (key.includes("en") || key.includes("english")) {
    return "en-US";
  }
  return "ko-KR";
}

function showExamplePopup(word, levelOrTopik) {
  const details = getWordDetails(word, levelOrTopik);
  const popup = document.getElementById("examplePopup");
  const body = document.getElementById("exampleModalBody");
  if (!popup || !body) return;

  const meaning = details ? details.meaning : "";
  // Check both 'sentense' (spelling from request) and 'sentence'
  const sentence = details ? (details.sentense || details.sentence) : "";
  const translate = details ? details.translate : "";

  let contentHtml = `
    <div style="border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">
      <div style="font-size: 24px; font-weight: 800; color: #FACC15; margin-bottom: 4px;">${word}</div>
      <div style="font-size: 16px; color: var(--text-secondary);">${meaning}</div>
    </div>
  `;

  if (sentence && sentence.trim()) {
    const escapedSentence = sentence.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const lang = detectLanguage(levelOrTopik);
    contentHtml += `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <div style="font-size: 13px; color: var(--text-light); margin-bottom: 4px; font-weight: 600; display: flex; align-items: center; gap: 8px; white-space: nowrap;">
            <span>ตัวอย่างประโยค:</span>
            <button class="popup-speak-btn" onclick="speak('${escapedSentence}', '${lang}')">🔊</button>
          </div>
          <div style="font-size: 17px; font-weight: 700; color: #FFFFFF; line-height: 1.5; word-break: break-word;">${sentence}</div>
        </div>
        <div>
          <div style="font-size: 13px; color: var(--text-light); margin-bottom: 4px; font-weight: 600;">คำแปล:</div>
          <div style="font-size: 15px; color: #EAB308; line-height: 1.5; word-break: break-word;">${translate || '-'}</div>
        </div>
      </div>
    `;
  } else {
    contentHtml += `
      <div style="text-align: center; color: var(--text-secondary); padding: 24px 0; font-size: 15px; font-weight: 500;">
        ยังไม่มีตัวอย่างประโยค
      </div>
    `;
  }

  body.innerHTML = contentHtml;
  popup.classList.remove("hidden");
}

function closeExamplePopup(event) {
  if (event) {
    if (event.target !== event.currentTarget) return;
  }
  const popup = document.getElementById("examplePopup");
  if (popup) popup.classList.add("hidden");
}

function showFlashcardExample() {
  let word = "";
  if (typeof dueStage !== "undefined" && dueStage === 2) {
    if (typeof pendingList !== "undefined" && typeof fillIndex !== "undefined") {
      word = pendingList[fillIndex]?.word;
    }
  } else {
    if (typeof shuffledVocabulary !== "undefined" && typeof fcIndex !== "undefined") {
      word = shuffledVocabulary[fcIndex]?.word;
    }
  }
  if (word) {
    showExamplePopup(word, typeof currentTopik !== "undefined" ? currentTopik : "");
  }
}