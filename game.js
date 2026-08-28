// =========================
// SHUFFLE
// =========================
function shuffleArray(array){
  for(let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// =========================
// VARIABLES
// =========================
let shuffledVocabulary = [];
let wrongAnswers = [];
let currentIndex = 0;
let quizIndex = 0;
let fcIndex = 0;
let fcForgotten = [];
let isDueMode = false;   // ← true เฉพาะ "ทวนวันนี้"
let fcAnimating = false;
let isFlipped = false;   // ← true เมื่อการ์ดพลิกแสดงด้านหลังแล้ว
let quizShowWord = true; // ← true = โชว์คำศัพท์ในQuiz, false = ปิดคำศัพท์

// ---- ด่าน 2 (Due Mode) ----
let pendingList     = [];   // คำที่กด "จำได้" จากด่าน 1 รอตัดสินในด่าน 2
let dueStage        = 1;    // 1 = Flashcard, 2 = FillBlank
let fillIndex       = 0;    // index ใน pendingList สำหรับด่าน 2
let fillWrongList   = [];   // คำที่เติมผิดในด่าน 2
let fillCorrectCount = 0;


// =========================
// SPEAK
// =========================
function getSpeechLang(){
  if(typeof currentTopik === "string" && currentTopik.startsWith("english_")){
    return "en-US";
  }
  return "ko-KR";
}

function speak(text, langCode){
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode || getSpeechLang();
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);
}
function speakThai(text){
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = 1.0;
  speechSynthesis.speak(utterance);
}

function speakQuizWord(){ speak(shuffledVocabulary[quizIndex].word); }
function speakFlashcard(){
  if(dueStage === 2){
    speak(pendingList[fillIndex].word);
  } else {
    speak(shuffledVocabulary[fcIndex].word);
  }
}

// =========================
// FLASHCARD MODE — ด่าน 1
// =========================
function showFlashcard(){
  fcAnimating = false;
  isFlipped = false;
  const currentWord = shuffledVocabulary[fcIndex];
  
  const inner = document.getElementById("flashcardInner");
  if(inner) inner.classList.remove("flipped");

  const stackWrapper = document.querySelector(".fc-stack-wrapper:not(.fill-stack-wrapper)");
  if(stackWrapper) stackWrapper.classList.remove("hidden");

  const container = document.getElementById("flashcardContainer");
  if(container) {
    container.className = "";
    container.classList.remove("hidden");
  }

  document.getElementById("fillStackWrapper")?.classList.add("hidden");

  document.getElementById("fcWord").textContent = currentWord.word;
  document.getElementById("fcWordBack").textContent = currentWord.word;
  document.getElementById("fcMeaning").textContent = currentWord.meaning;
  const badge = document.getElementById("flashcardProgress");
  badge.textContent = `ด่าน 1 — คำที่ ${fcIndex + 1} / ${shuffledVocabulary.length}`;
  badge.classList.remove("stage2");
  badge.classList.remove("hidden");
  speak(currentWord.word);
  updateTitleVisibility();
}

function flipCard(){
  // ถ้าการ์ดพลิกไปแล้ว หรือกำลัง animate เปลี่ยนการ์ด → ไม่ทำซ้ำ
  if (isFlipped || fcAnimating) return;
  isFlipped = true;
  const inner = document.getElementById("flashcardInner");
  if(inner) {
    inner.classList.add("flipped");
    const currentWord = shuffledVocabulary[fcIndex];
    if (currentWord && currentWord.meaning) {
      speakThai(currentWord.meaning);
    }
  }
}

function fcAnswer(known){
  if (fcAnimating) return;
  const currentWord = shuffledVocabulary[fcIndex];

  if(isDueMode){
    if(!known){
      // จำไม่ได้ → บันทึก SRS ทันที, กลับกล่อง 1
      recordAnswer(currentWord.word, false);
      addToWrongBox(currentWord);
      if(!fcForgotten.some(item => item.word === currentWord.word)){
        fcForgotten.push(currentWord);
      }
    } else {
      // จำได้ → เก็บใน pendingList รอด่าน 2
      if(!pendingList.some(item => item.word === currentWord.word)){
        pendingList.push({ word: currentWord.word, meaning: currentWord.meaning });
      }
    }
  }

  const nextIndex = fcIndex + 1;
  const isFinished = nextIndex >= shuffledVocabulary.length;
  const isWbFull = isDueMode && isWrongBoxFull();

  if(isFinished || isWbFull){
    fcIndex = nextIndex;
    if(isWbFull){
      finishStage1Early();
    } else {
      finishStage1();
    }
    return;
  }

  // Animate card slide transition
  fcAnimating = true;
  const container = document.getElementById("flashcardContainer");
  if(container) {
    container.classList.add("slide-out-left");
  }

  setTimeout(() => {
    fcIndex = nextIndex;
    isFlipped = false;
    const inner = document.getElementById("flashcardInner");
    if(inner) inner.classList.remove("flipped");

    const nextWord = shuffledVocabulary[fcIndex];
    document.getElementById("fcWord").textContent = nextWord.word;
    document.getElementById("fcWordBack").textContent = nextWord.word;
    document.getElementById("fcMeaning").textContent = nextWord.meaning;
    const badge = document.getElementById("flashcardProgress");
    badge.textContent = `ด่าน 1 — คำที่ ${fcIndex + 1} / ${shuffledVocabulary.length}`;
    badge.classList.remove("stage2");
    badge.classList.remove("hidden");
    speak(nextWord.word);
    updateTitleVisibility();

    if(container) {
      container.className = "pre-slide-in-right";
      container.offsetHeight; // trigger reflow
      container.className = "slide-in-right";
    }

    setTimeout(() => {
      if(container) container.className = "";
      fcAnimating = false;
    }, 250);
  }, 250);
}


// ด่าน 1 จบตามปกติ
function finishStage1(){
  if(!isDueMode || pendingList.length === 0){
    // ไม่มี pending → จบเกมเลย
    showSRSFinish(fcForgotten);
    return;
  }
  showStage2Popup();
}

// ด่าน 1 จบเพราะกล่องคำผิดเต็ม
function finishStage1Early(){
  pendingList = []; // ทิ้ง pending ทั้งหมด
  showSRSFinish(fcForgotten);
}

// Popup แจ้งเข้าด่าน 2
function showStage2Popup(){
  const popup = document.getElementById("stage2Popup");
  if(popup) popup.classList.remove("hidden");
  else confirmStage2(); // ถ้าไม่มี popup ให้ข้ามไปด่าน 2 เลย
}

function confirmStage2(){
  const popup = document.getElementById("stage2Popup");
  if(popup) popup.classList.add("hidden");
  startStage2();
}

// =========================
// ด่าน 2 — Fill Blank (SRS Due Mode)
// =========================
function startStage2(){
  dueStage   = 2;
  fillIndex  = 0;
  fillWrongList  = [];
  fillCorrectCount = 0;
  shuffleArray(pendingList);  // สับก่อนเริ่ม

  // แสดงหน้าเติมคำของด่าน 2 (ใช้หน้า flashcardGame แต่สลับ UI)
  showFillCard();
}

function showFillCard(){
  const word = pendingList[fillIndex];
  const badge = document.getElementById("flashcardProgress");
  badge.textContent = `ด่าน 2 — คำที่ ${fillIndex + 1} / ${pendingList.length}`;
  badge.classList.add("stage2");
  badge.classList.remove("hidden");

  // ใช้ fillStackWrapper ของด่าน 2 แทน 3D Card ของด่าน 1
  const stackWrapper = document.querySelector(".fc-stack-wrapper:not(.fill-stack-wrapper)");
  if(stackWrapper) stackWrapper.classList.add("hidden");
  const container = document.getElementById("flashcardContainer");
  if(container) container.classList.add("hidden");
  document.getElementById("fillStackWrapper")?.classList.remove("hidden");

  document.getElementById("fillMeaning").textContent = word.meaning;
  document.getElementById("fillInput").value = "";
  document.getElementById("fillInput").disabled = false;
  document.getElementById("fillResult").textContent = "";
  document.getElementById("fillResult").className = "result";
  document.getElementById("fillCheckBtn").disabled = false;

  const clearBtn = document.getElementById("fillClearBtn");
  clearBtn.classList.add("hidden");
  document.getElementById("fillInput").oninput = () => {
    clearBtn.classList.toggle("hidden", document.getElementById("fillInput").value.length === 0);
  };

  setTimeout(() => document.getElementById("fillInput").focus(), 100);
  speakThai(word.meaning);
}


function handleFillEnter(event){
  if(event.key === "Enter") checkFillAnswer();
}

function clearFillInput(){
  document.getElementById("fillInput").value = "";
  document.getElementById("fillClearBtn").classList.add("hidden");
  document.getElementById("fillResult").textContent = "";
  document.getElementById("fillResult").className = "result";
  document.getElementById("fillInput").focus();
}

function checkFillAnswer(){
  const input    = document.getElementById("fillInput");
  const checkBtn = document.getElementById("fillCheckBtn");
  const result   = document.getElementById("fillResult");
  if(checkBtn.disabled) return;

  const userAnswer = input.value.trim();
  const word = pendingList[fillIndex];

  const isEnglish = currentTopik?.startsWith("english_");

const isCorrect = isEnglish
  ? userAnswer.toLowerCase() === word.word.toLowerCase()
  : userAnswer === word.word;

if(isCorrect){
  // ✅ ถูก → เลื่อนกล่อง, บันทึก SRS
  result.textContent = "✅ ถูกต้อง!";
  result.className = "result correct";
  input.disabled = true;
  checkBtn.disabled = true;
  recordAnswer(word.word, true);
  fillCorrectCount++;
  setTimeout(() => nextFillCard(), 1000);

} else {
  // ❌ ผิดทันที ไม่ให้แก้ตัว → กลับกล่อง 1, บันทึก SRS
  result.innerHTML = `❌ เฉลย: <strong style="margin-left: 6px; font-size: 18px;">${word.word}</strong>`;
  result.className = "result wrong";
  input.disabled = true;
  checkBtn.disabled = true;
  recordAnswer(word.word, false);
  addToWrongBox(word);

  if(!fcForgotten.some(i => i.word === word.word)){
    fcForgotten.push(word);
  }

  if(!fillWrongList.some(i => i.word === word.word)){
    fillWrongList.push(word);
  }

  setTimeout(() => nextFillCard(), 1200);
}
}

function nextFillCard(){
  fillIndex++;
  if(fillIndex >= pendingList.length || (isDueMode && isWrongBoxFull())){
    finishStage2();
  } else {
    showFillCard();
  }
}

function finishStage2(){
  pendingList = []; // เคลียร์
  dueStage = 1;
  showSRSFinish(fcForgotten);
}

// =========================
// STOP FLASHCARD (ปุ่มหยุด)
// =========================
function stopFlashcard(){
  if(!confirm("⏹ หยุดเล่นกลางคัน?\n\nคำที่กดไปแล้วจะถูกบันทึก\nคำที่ยังไม่ได้เล่นจะไม่มีผล")) return;
  speechSynthesis.cancel();

  if(isDueMode){
    if(dueStage === 1){
      // กรณี 1: หยุดระหว่างด่าน 1
      // คำที่จำไม่ได้ → บันทึกแล้วตั้งแต่กดปุ่ม (ในฟังก์ชัน fcAnswer)
      // คำใน pendingList → ทิ้งได้เลย ไม่บันทึก
      pendingList = [];
    }
    // กรณี 2: หยุดระหว่างด่าน 2
    // คำที่ตอบแล้ว (ถูก/ผิด) → บันทึกแล้วตั้งแต่กด checkFillAnswer
    // คำที่ยังไม่แสดง → ไม่นับ ไม่บันทึก (ปล่อยทิ้ง)
  }

  // ปิด popup ด่าน 2 ถ้าเปิดอยู่
  document.getElementById("stage2Popup")?.classList.add("hidden");
  // ซ่อน 3D Card (ทั้ง wrapper และ container) และ fillStackWrapper
  document.querySelector(".fc-stack-wrapper:not(.fill-stack-wrapper)")?.classList.add("hidden");
  document.getElementById("flashcardContainer")?.classList.add("hidden");
  document.getElementById("fillStackWrapper")?.classList.add("hidden");
  dueStage = 1;

  // แสดงสรุปแทน goBack
  if(isDueMode){
    // สรุปเฉพาะคำที่ตัดสินแล้ว (fcForgotten + fillWrongList รวมกันแล้ว)
    showSRSFinish(fcForgotten);
  } else {
    goBack();
    renderSRSHome();
    updateNavButtons();
  }
}

// =========================
// TYPING GAME (ฝึกหัด / ทวนคำผิด)
// =========================
function showWord(){
  const currentWord = shuffledVocabulary[currentIndex];
  document.getElementById("meaning").textContent = currentWord.meaning;
  const input = document.getElementById("answerInput");
  const clearBtn = document.getElementById("clearAnswerBtn");
  input.value = "";
  input.disabled = false;
  clearBtn.classList.add("hidden");
  input.oninput = () => {
    clearBtn.classList.toggle("hidden", input.value.length === 0);
  };
  document.getElementById("checkBtn").disabled = false;
  document.getElementById("result").textContent = "";
  document.getElementById("result").className = "result";
  document.getElementById("progress").textContent =
    `คำที่ ${currentIndex + 1} / ${shuffledVocabulary.length}`;
  document.getElementById("progress").classList.remove("hidden");
  input.focus();
  updateTitleVisibility();
  speakThai(currentWord.meaning);
}


function clearAnswerInput(){
  const input = document.getElementById("answerInput");
  input.value = "";
  document.getElementById("clearAnswerBtn").classList.add("hidden");
  document.getElementById("result").textContent = "";
  document.getElementById("result").className = "result";
  input.focus();
}

function handleEnter(event){
  if(event.key === "Enter") checkAnswer();
}

function checkAnswer(){
  const input = document.getElementById("answerInput");
  const checkBtn = document.getElementById("checkBtn");
  const userAnswer = input.value.trim();
  if(checkBtn.disabled) return;

  const currentWord = shuffledVocabulary[currentIndex];
  const result = document.getElementById("result");

  const isEnglish = currentTopik?.startsWith("english_");

const isCorrect = isEnglish
  ? userAnswer.toLowerCase() === currentWord.word.toLowerCase()
  : userAnswer === currentWord.word;

if(isCorrect){
  result.textContent = "✅ ถูกต้อง!";
  result.className = "result correct";
  input.disabled = true;
  checkBtn.disabled = true;

  setTimeout(() => {
    currentIndex++;
    if(currentIndex >= shuffledVocabulary.length){
      showFinish();
    } else {
      showWord();
    }
  }, 1000);

} else {
  result.innerHTML = `❌ เฉลย: <strong style="margin-left: 6px; font-size: 18px;">${currentWord.word}</strong>`;
  result.className = "result wrong";
  input.value = "";
  input.focus();

  if(!wrongAnswers.some(item => item.word === currentWord.word)){
    wrongAnswers.push(currentWord);
  }
}
}

// =========================
// QUIZ GAME
// =========================
function showQuiz(){
  if(document.activeElement){
    document.activeElement.blur();
  }
  const nextBtn = document.getElementById("quizNextBtn");
  if(nextBtn) nextBtn.classList.add("hidden");

  // อัปเดต toggle button state
  const hideBtn = document.getElementById("quizModeHide");
  const showBtn = document.getElementById("quizModeShow");
  if(hideBtn) hideBtn.classList.toggle("active", !quizShowWord);
  if(showBtn) showBtn.classList.toggle("active", quizShowWord);

  const currentWord = shuffledVocabulary[quizIndex];
  const wordEl = document.getElementById("quizWord");
  wordEl.classList.remove("quiz-word-reveal");
  if(quizShowWord){
    wordEl.textContent = currentWord.word;
    wordEl.classList.remove("quiz-word-hidden");
  } else {
    wordEl.textContent = "🔊";
    wordEl.classList.add("quiz-word-hidden");
  }
  document.getElementById("quizProgress").textContent =
    `คำที่ ${quizIndex + 1} / ${shuffledVocabulary.length}`;
  document.getElementById("quizProgress").classList.remove("hidden");

  const container = document.getElementById("choicesContainer");
  container.innerHTML = "";

  const numChoices = Math.min(4, shuffledVocabulary.length);
  let choices = [currentWord.meaning];
  const otherMeanings = shuffleArray(
    shuffledVocabulary.map(item => item.meaning).filter(m => m !== currentWord.meaning)
  );
  for(let i = 0; choices.length < numChoices; i++){
    choices.push(otherMeanings[i]);
  }
  choices.sort(() => Math.random() - 0.5);

  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = choice;
    btn.onclick = () => checkQuizAnswer(choice, btn);
    container.appendChild(btn);
  });

  speak(currentWord.word);
  updateTitleVisibility();
}

function setQuizWordMode(mode){
  quizShowWord = (mode === "show");
  document.getElementById("quizModeHide").classList.toggle("active", !quizShowWord);
  document.getElementById("quizModeShow").classList.toggle("active", quizShowWord);

  const wordEl = document.getElementById("quizWord");
  const currentWord = shuffledVocabulary[quizIndex];
  if(quizShowWord){
    wordEl.textContent = currentWord.word;
    wordEl.classList.remove("quiz-word-hidden");
  } else {
    wordEl.textContent = "🔊";
    wordEl.classList.add("quiz-word-hidden");
  }
  speakQuizWord();
}

function checkQuizAnswer(choice, clickedBtn){
  const currentWord = shuffledVocabulary[quizIndex];
  const container = document.getElementById("choicesContainer");

  container.querySelectorAll(".choice-btn").forEach(btn => { btn.disabled = true; });

  // เผยคำศัพท์หลังตอบ (กรณีปิดคำศัพท์อยู่)
  if(!quizShowWord){
    const wordEl = document.getElementById("quizWord");
    wordEl.textContent = currentWord.word;
    wordEl.classList.remove("quiz-word-hidden");
    wordEl.classList.add("quiz-word-reveal");
  }

  if(choice === currentWord.meaning){
    if(clickedBtn) clickedBtn.classList.add("correct-choice-highlight");

    setTimeout(() => {
      advanceQuiz();
    }, 1000);
  } else {
    if(clickedBtn) clickedBtn.classList.add("wrong-choice-highlight");

    // Highlight the correct button green
    container.querySelectorAll(".choice-btn").forEach(btn => {
      if(btn.textContent === currentWord.meaning){
        btn.classList.add("correct-choice-highlight");
      }
    });

    if(!wrongAnswers.some(item => item.word === currentWord.word)){
      wrongAnswers.push(currentWord);
    }

    // Show "Next" button instead of transitioning automatically
    const nextBtn = document.getElementById("quizNextBtn");
    if(nextBtn) nextBtn.classList.remove("hidden");
  }
}

function advanceQuiz(){
  quizIndex++;
  if(quizIndex >= shuffledVocabulary.length){
    handleQuizFinished();
  } else {
    showQuiz();
  }
}

function handleQuizFinished(){
  if (srsSessionType === "practice" || srsSessionType === "wrongbox") {
    showStage2TransitionPopup();
  } else {
    showFinish();
  }
}

function showStage2TransitionPopup(){
  const popup = document.getElementById("stage2TransitionPopup");
  if(popup){
    popup.classList.remove("hidden");
  } else {
    confirmPracticeStage2();
  }
}

function confirmPracticeStage2(){
  const popup = document.getElementById("stage2TransitionPopup");
  if(popup) popup.classList.add("hidden");

  if (srsSessionType === "wrongbox") {
    startWrongBoxGame("typing", true);
    return;
  }
  if (srsSessionType === "practice") {
    startPracticeGame("typing", true);
    return;
  }
  console.warn("Unknown Stage2 session:", srsSessionType);
}

function goToNextQuiz(){
  advanceQuiz();
}

// =========================
// FINISH (ฝึกหัด / ทวนคำผิด)
// =========================
function showFinish(){
  goTo("finishScreen");

  const switchRow = document.getElementById("finishModeSwitchContainer");
  if (switchRow) switchRow.classList.add("hidden");
  const replayBtn = document.getElementById("replaySetBtn");
  if (replayBtn) replayBtn.classList.add("hidden");

  const wrongContainer = document.getElementById("wrongAnswers");
  if(wrongAnswers.length === 0){
    wrongContainer.innerHTML = `<div class="wrong-list"><h3>🎉 ตอบถูกทั้งหมด ยอดเยี่ยมมาก!</h3></div>`;
    return;
  }
  let html = `<div class="wrong-list"><h3>❌ คำที่ตอบผิด (${wrongAnswers.length} คำ)</h3>`;
  wrongAnswers.forEach((item, index) => {
    html += `<div class="wrong-item">${index+1}. <b>${item.word}</b> = ${item.meaning}</div>`;
  });
  html += `</div>`;
  wrongContainer.innerHTML = html;
}

function replayCurrentMode(){
  if(srsSessionType === "wrongbox"){
    startWrongBoxGame(srsSessionMode);
  } else {
    startPracticeGame(srsSessionMode);
  }
}

function switchMode(){
  const newMode = srsSessionMode === "quiz" ? "typing" : "quiz";
  if(srsSessionType === "wrongbox"){
    startWrongBoxGame(newMode);
  } else {
    startPracticeGame(newMode);
  }
}

function stopWrongBoxGame(){
  if(!confirm("⏹ หยุดเล่นกลางคัน?\n\nคำที่เล่นไปแล้วจะไม่ถูกบันทึก")) return;
  speechSynthesis.cancel();
  goToSRSDashboard();
}