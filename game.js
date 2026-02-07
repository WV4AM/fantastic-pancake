/* global Chess, Chessboard, confetti */

// =========================
// Gemstone Chess - game.js
// =========================

/* state */
let board = null;
let game = new Chess();
let botDepth = parseInt(localStorage.getItem("botDepth") || "2", 10); // difficulty level (1-25)
let playerColor = localStorage.getItem("playerColor") || "white";
let boardFlipped = localStorage.getItem("boardFlipped") === "true";
let soundsEnabled = localStorage.getItem("soundsEnabled") !== "false";
let botThinking = false;
let playerThinking = false;
let pendingPromotion = null; // {from, to, color}

// ---------- sounds ----------
function playSound(id) {
  if (!soundsEnabled) return;
  const el = document.getElementById(id);
  if (!el) return;
  try { el.currentTime = 0; el.play().catch(()=>{}); } catch(e) {}
}

// ---------- save/load ----------
function saveGame() {
  try {
    localStorage.setItem("chessHistory", JSON.stringify(game.history()));
    localStorage.setItem("playerColor", playerColor);
    localStorage.setItem("botDepth", botDepth.toString());
    localStorage.setItem("boardFlipped", boardFlipped ? "true" : "false");
    localStorage.setItem("soundsEnabled", soundsEnabled ? "true" : "false");
  } catch (e) { console.warn("saveGame error", e); }
}

function loadGame() {
  try {
    const hist = JSON.parse(localStorage.getItem("chessHistory") || "[]");
    if (hist.length) {
      game.reset();
      hist.forEach(m => game.move(m));
    }
  } catch (e) { console.warn("loadGame error", e); }
}

function loadSettings() {
  try {
    const s = localStorage.getItem("playerColor");
    const d = parseInt(localStorage.getItem("botDepth"), 10);
    const f = localStorage.getItem("boardFlipped");
    const snd = localStorage.getItem("soundsEnabled");
    if (s) playerColor = s;
    if (!isNaN(d)) botDepth = Math.max(1, Math.min(25, d));
    window.currentDifficulty = botDepth;
    if (f === "true") boardFlipped = true;
    if (snd === "false") soundsEnabled = false;
  } catch (e) { /* ignore */ }
}

// ---------- UI helpers ----------
function recolorBoard() {
  try {
    document.querySelectorAll("#board .square-55d63").forEach(sq => {
      const isLight = sq.classList.contains("white-1e1d7");
      sq.style.background = isLight ? "#66ccff" : "#003366";
    });
  } catch (e) {}
}

function updateCaptured() {
  const wEl = document.getElementById("captured-white");
  const bEl = document.getElementById("captured-black");
  if (!wEl || !bEl) return;
  wEl.innerHTML = "";
  bEl.innerHTML = "";

  const historyVerbose = game.history({ verbose: true });
  for (const mv of historyVerbose.filter(m => m.captured)) {
    const img = document.createElement("img");
    img.src = `img/chesspieces/wikipedia/${mv.color}${mv.captured.toUpperCase()}.png`;
    img.alt = mv.captured;
    img.style.width = "28px";
    img.style.height = "28px";
    img.style.margin = "2px";
    if (mv.color === "w") wEl.appendChild(img);
    else bEl.appendChild(img);
  }
}

function updateHistoryUI() {
  const histEl = document.getElementById("history");
  if (!histEl) return;
  const moves = game.history();
  histEl.innerHTML = "";
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) histEl.innerHTML += `<strong>${Math.floor(i/2)+1}.</strong> ${moves[i]} `;
    else histEl.innerHTML += `${moves[i]}<br>`;
  }
}

// ---------- confetti & endgame ----------
let confettiStopper = null;

function launchConfettiLoop(color = "#66ccff") {
  if (typeof confetti !== "function") return () => {};
  let running = true;
  (function frame() {
    if (!running) return;
    confetti({ particleCount: 8, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors: [color, "#ffffff"] });
    confetti({ particleCount: 8, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors: [color, "#ffffff"] });
    requestAnimationFrame(frame);
  })();
  return () => { running = false; };
}

function showEndgameModal(message, color = "#66ccff", withConfetti = false) {
  const overlay = document.getElementById("overlay");
  const main = document.getElementById("mainContent");
  const modal = document.getElementById("endgameModal");
  if (!overlay || !modal) return;
  overlay.style.display = "block";
  main?.classList.add("blurred");
  modal.innerHTML = `<div style="padding:12px; color:#fff;">
    <div style="font-size:18px; margin-bottom:10px; text-shadow:0 0 8px ${color}">${message}</div>
    <div><button id="endgameOk" style="background:#004080;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">OK</button></div>
  </div>`;
  modal.style.boxShadow = `0 0 30px ${color}`;
  modal.classList.add("show");

  if (withConfetti) {
    if (confettiStopper) { confettiStopper(); confettiStopper = null; }
    confettiStopper = launchConfettiLoop(color);
  }

  const okBtn = document.getElementById("endgameOk");
  if (okBtn) {
    okBtn.onclick = () => {
      modal.classList.remove("show");
      overlay.style.display = "none";
      main?.classList.remove("blurred");
      if (confettiStopper) { confettiStopper(); confettiStopper = null; }
    };
  }
}

// ---------- endgame check ----------
function checkGameEndAndUpdate() {
  updateCaptured();
  updateHistoryUI();
  recolorBoard();

  if (game.in_checkmate()) {
    const winner = game.turn() === "w" ? "Black" : "White";
    const color = winner === "White" ? "#66ccff" : "#003366";
    // playerWin if the side that just moved was the opponent of game.turn()
    // (game.turn() is the side to move after checkmate)
    const playerWon = (winner.toLowerCase() === "white" && playerColor === "white") ||
                      (winner.toLowerCase() === "black" && playerColor === "black");
    showEndgameModal(`Checkmate — ${winner} wins!`, color, playerWon);
    if (playerWon) playSound("winSound"); else playSound("loseSound");
    return true;
  }

  if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition() || game.insufficient_material()) {
    showEndgameModal("It's a draw!", "#cccccc", true);
    playSound("drawSound");
    return true;
  }

  return false;
}

// ---------- afterMove flow ----------
function afterMove() {
  saveGame();
  updateCaptured();
  updateHistoryUI();
  recolorBoard();

  if (checkGameEndAndUpdate()) {
    playerThinking = false;
    botThinking = false;
    return;
  }

  const turn = game.turn(); // 'w' or 'b'
  const botShouldMove = (playerColor === "white" && turn === "b") || (playerColor === "black" && turn === "w");

  if (botShouldMove) {
    // give tiny delay so UI updates show
    setTimeout(() => {
      // ensure not already thinking
      if (!botThinking) makeBestMove();
    }, 200);
  } else {
    playerThinking = false;
  }
}

// ---------- drag & drop ----------
function onDragStart(source, piece) {
  if (game.game_over()) return false;
  if ((game.turn() === "w" && piece.search(/^b/) !== -1) ||
      (game.turn() === "b" && piece.search(/^w/) !== -1)) return false;
  if (playerThinking) return false;
}

function onDrop(source, target) {
  // promotion check
  const verbose = game.moves({ verbose: true });
  const promo = verbose.find(m => m.from === source && m.to === target && (m.flags && m.flags.includes("p")));
  if (promo) {
    pendingPromotion = { from: source, to: target, color: promo.color };
    const tmp = game.move({ from: source, to: target, promotion: "q" }); // show queen temporarily
    if (!tmp) return "snapback";
    board.position(game.fen());
    openPromotionModal(promo.color);
    return;
  }

  const move = game.move({ from: source, to: target, promotion: "q" });
  if (!move) return "snapback";
  if (move.captured) playSound("captureSound"); else playSound("moveSound");
  playerThinking = true;
  afterMove();
}

function onSnapEnd() { board.position(game.fen()); recolorBoard(); }

// ---------- promotion modal ----------
function openPromotionModal(color) {
  const modal = document.getElementById("promotionModal");
  const overlay = document.getElementById("overlay");
  const main = document.getElementById("mainContent");
  if (!modal) return;
  modal.querySelectorAll("button[data-piece]").forEach(btn => {
    const p = btn.getAttribute("data-piece");
    const img = btn.querySelector("img");
    if (img) img.src = `img/chesspieces/wikipedia/${color}${p.toUpperCase()}.png`;
  });
  overlay.style.display = "block";
  main?.classList.add("blurred");
  modal.classList.add("show");
}

document.addEventListener("click", (e) => {
  const el = e.target;
  const btn = el.closest && el.closest("button[data-piece]");
  if (!btn) return;
  if (!pendingPromotion) return;
  const piece = btn.getAttribute("data-piece");
  // undo temporary queen move
  try { game.undo(); } catch (e) {}
  const mv = game.move({ ...pendingPromotion, promotion: piece });
  if (!mv) {
    board.position(game.fen());
    pendingPromotion = null;
    closePromotionModal();
    return;
  }
  if (mv.captured) playSound("captureSound"); else playSound("moveSound");
  board.position(game.fen());
  pendingPromotion = null;
  closePromotionModal();
  afterMove();
});

document.getElementById("cancelPromotion")?.addEventListener("click", () => {
  cancelPromotion();
});

function cancelPromotion() {
  try { game.undo(); } catch(e) {}
  board.position(game.fen());
  pendingPromotion = null;
  closePromotionModal();
  playerThinking = false;
}

function closePromotionModal() {
  const modal = document.getElementById("promotionModal");
  const overlay = document.getElementById("overlay");
  const main = document.getElementById("mainContent");
  if (modal) modal.classList.remove("show");
  if (overlay) overlay.style.display = "none";
  main?.classList.remove("blurred");
}

// ---------- Strong & Fast Chess AI ----------
// Iterative deepening + negamax + alpha-beta + quiescence + PST eval
class ChessAI {
  constructor(opts = {}) {
    this.maxDepth = opts.maxDepth || 6;
    this.nodes = 0;
    this.tt = new Map();
    this.startTime = 0;
    this.timeLimitMs = opts.timeLimitMs || 2000;
    this.PIECE_VALUE = { p:100, n:320, b:330, r:500, q:900, k:20000 };
    this.PST = {
      p: [
         0,0,0,0,0,0,0,0,
         5,10,10,-20,-20,10,10,5,
         5,-5,-10,0,0,-10,-5,5,
         0,0,0,20,20,0,0,0,
         5,5,10,25,25,10,5,5,
         10,10,20,30,30,20,10,10,
         50,50,50,50,50,50,50,50,
         0,0,0,0,0,0,0,0
      ],
      n: [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,0,5,5,0,-20,-40,
        -30,5,10,15,15,10,5,-30,
        -30,0,15,20,20,15,0,-30,
        -30,5,15,20,20,15,5,-30,
        -30,0,10,15,15,10,0,-30,
        -40,-20,0,0,0,0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50
      ],
      b: [
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,0,0,0,0,0,0,-10,
        -10,0,5,10,10,5,0,-10,
        -10,5,5,10,10,5,5,-10,
        -10,0,10,10,10,10,0,-10,
        -10,10,10,10,10,10,10,-10,
        -10,5,0,0,0,0,5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20
      ],
      r: [
        0,0,0,0,0,0,0,0,
        5,10,10,10,10,10,10,5,
        -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5,
        0,0,0,5,5,0,0,0
      ],
      q: [
        -20,-10,-10,-5,-5,-10,-10,-20,
        -10,0,0,0,0,0,0,-10,
        -10,0,5,5,5,5,0,-10,
        -5,0,5,5,5,5,0,-5,
        0,0,5,5,5,5,0,-5,
        -10,5,5,5,5,5,0,-10,
        -10,0,5,0,0,0,0,-10,
        -20,-10,-10,-5,-5,-10,-10,-20
      ],
      k: [
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
        20,20,0,0,0,0,20,20,
        20,30,10,0,0,10,30,20
      ]
    };
  }

  pstValue(piece, sqIndex) {
    const type = piece.type;
    const table = this.PST[type];
    if (!table) return 0;
    if (piece.color === 'b') {
      const file = sqIndex % 8;
      const rank = Math.floor(sqIndex / 8);
      const mirrored = (7 - rank) * 8 + file;
      return table[mirrored];
    }
    return table[sqIndex];
  }

  evaluateBoard(game) {
    let score = 0;
    const board = game.board();
    for (let r=0;r<8;r++){
      for (let f=0;f<8;f++){
        const p = board[r][f];
        if (!p) continue;
        const idx = r*8+f;
        const val = this.PIECE_VALUE[p.type] || 0;
        const pst = this.pstValue(p, idx);
        score += (p.color === 'w' ? 1 : -1) * (val + pst);
      }
    }
    const moves = game.moves().length;
    score += (game.turn() === 'w' ? 1 : -1) * (moves * 0.2);
    return score;
  }

  quiescence(game, alpha, beta) {
    const stand = this.evaluateBoard(game);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    const moves = game.moves({verbose:true}).filter(m => (m.flags && (m.flags.includes('c') || m.flags.includes('p'))));
    for (let m of moves) {
      game.move(m);
      const score = -this.quiescence(game, -beta, -alpha);
      game.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  negamax(game, depth, alpha, beta, color=1) {
    this.nodes++;
    if (Date.now() - this.startTime > this.timeLimitMs) {
      return color * this.evaluateBoard(game);
    }
    if (depth === 0) return color * this.quiescence(game, -Infinity, Infinity);
    if (game.game_over()) {
      if (game.in_checkmate()) return -999999 * color;
      return 0;
    }
    let max = -Infinity;
    let moves = game.moves({verbose:true});
    moves.sort((a,b) => {
      const av = (a.captured ? (this.PIECE_VALUE[a.captured]||0) : 0) + (a.promotion ? 200 : 0);
      const bv = (b.captured ? (this.PIECE_VALUE[b.captured]||0) : 0) + (b.promotion ? 200 : 0);
      return bv - av;
    });
    for (let m of moves) {
      game.move(m);
      const val = -this.negamax(game, depth-1, -beta, -alpha, -color);
      game.undo();
      if (val > max) max = val;
      if (val > alpha) alpha = val;
      if (alpha >= beta) break;
      if (Date.now() - this.startTime > this.timeLimitMs) break;
    }
    return max;
  }

  findBestMove(game, level=3, isSecondTime=false) {
    const depthTarget = {1:1, 2:2, 3:3, 4:4, 5:5, 6:6};
    const timeCaps = {1:300, 2:700, 3:2000, 4:3000, 5:5000, 6:8000};
    const targetDepth = Math.min(this.maxDepth, depthTarget[level] || 3);
    const timeCap = Math.min(10000, timeCaps[level] || 2000);
    const randomness = {1:0.6,2:0.4,3:0.15,4:0.07,5:0.03,6:0.01}[level] || 0.15;

    this.startTime = Date.now();
    this.timeLimitMs = timeCap;
    this.nodes = 0;

    const moves = game.moves({verbose:true});
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (let depth=1; depth<=targetDepth; depth++) {
      if (Date.now() - this.startTime > this.timeLimitMs) break;
      let localBest = null;
      let localBestScore = -Infinity;
      const ordered = moves.slice().sort((a,b) => {
        const av = (a.captured ? (this.PIECE_VALUE[a.captured]||0) : 0) + (a.promotion ? 200 : 0);
        const bv = (b.captured ? (this.PIECE_VALUE[b.captured]||0) : 0) + (b.promotion ? 200 : 0);
        return bv - av;
      });
      for (let m of ordered) {
        if (Date.now() - this.startTime > this.timeLimitMs) break;
        game.move(m);
        const score = -this.negamax(game, depth-1, -Infinity, Infinity, -1);
        game.undo();
        if (score > localBestScore) { localBestScore = score; localBest = m; }
      }
      if (localBest !== null) { bestMove = localBest; bestScore = localBestScore; }
    }

    if (Math.random() < randomness) return moves[Math.floor(Math.random()*moves.length)];
    return bestMove;
  }
}

// compatibility wrapper used by UI

// ----- Stockfish integration: replaces makeBestMove and wires levels 1..20 to depth 1..20 -----
// Requires stockfish.js and stockfish.wasm to be in the same folder as index.html.
// This code creates a worker that importScripts('./stockfish.js') so the loader will load the wasm.
// The worker is created from a Blob and persists as window._sfWorker.


(function(){
  let engine;

  function initSFWorker() {
    if (engine) return engine;
    engine = new Worker("stockfish.js");
    engine.onmessage = function(event) {
      const line = (event.data || "").trim();
      console.log("SF:", line);
      if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        const best = parts[1];
        applyEngineMove(best);
      }
    };
    return engine;
  }

  function sendCmd(cmd) {
    const w = initSFWorker();
    w.postMessage(cmd);
  }

  function applyEngineMove(uci) {
    if (!uci || uci.length < 4) {
      botThinking = false;
      return;
    }

    // Safety: Don't apply move if game is in an unexpected state
    if (game.game_over()) {
      botThinking = false;
      return;
    }

    const from = uci.slice(0,2);
    const to = uci.slice(2,4);
    const promo = uci.length >= 5 ? uci[4] : undefined;
    try {
      const mv = game.move({ from, to, promotion: promo });
      if (!mv) {
        console.error("Engine move was invalid");
        botThinking = false;
        return;
      }
      board.position(game.fen());
      playSound(mv && mv.captured ? "captureSound" : "moveSound");
      saveGame();
      updateCaptured();
      updateHistoryUI();
      recolorBoard();
      checkGameEndAndUpdate();
    } catch(e) {
      console.error("Engine move failed:", e);
    } finally {
      botThinking = false;
      playerThinking = false;
    }
  }

  window.makeBestMove = function() {
    if (botThinking || game.game_over()) return;
    botThinking = true;
    const level = (typeof window.currentDifficulty !== 'undefined') ? window.currentDifficulty : (botDepth || 3);
    const depth = Math.max(1, Math.min(20, level));
    initSFWorker();
    sendCmd("ucinewgame");
    sendCmd("position fen " + game.fen());
    const skill = Math.min(20, Math.floor((level - 1) / 1.25));
    const movetime = 200 + (level * 400);
    sendCmd("setoption name Skill Level value " + skill);
    sendCmd("go movetime " + movetime);
  };
})(); // end integration IIFE

// ---------- buttons & wiring ----------
function wireButtons() {
  const restartBtn = document.getElementById("restartBtn");
  const drawBtn = document.getElementById("drawBtn");
  const undoBtn = document.getElementById("undoBtn");
  const flipBtn = document.getElementById("flipBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const overlay = document.getElementById("overlay");
  const settingsModal = document.getElementById("settingsModal");
  const closeSettings = document.getElementById("closeSettings");
  const applySettings = document.getElementById("applySettings");
  const main = document.getElementById("mainContent");
  const soundToggle = document.getElementById("soundToggle");
  const difficultySelect = document.getElementById("difficultySelect");

  // sync UI with settings
  if (soundToggle) soundToggle.checked = !!soundsEnabled;
  if (difficultySelect) difficultySelect.value = (botDepth || 2).toString();
  const sideRadio = document.querySelector(`input[name="side"][value="${playerColor}"]`);
  if (sideRadio) sideRadio.checked = true;

  restartBtn?.addEventListener("click", () => {
    game.reset();
    board.start();
    saveGame();
    updateCaptured();
    updateHistoryUI();
    recolorBoard();
    // if player chose black, make bot move
    if (playerColor === "black") setTimeout(makeBestMove, 300);
  });

  drawBtn?.addEventListener("click", () => {
    showEndgameModal("Draw agreed!", "#cccccc", true);
    playSound("drawSound");
    // restart after brief moment so user sees modal/confetti
    setTimeout(() => {
      game.reset();
      board.start();
      saveGame();
      updateCaptured();
      updateHistoryUI();
      recolorBoard();
      if (playerColor === "black") setTimeout(makeBestMove, 300);
    }, 1000);
  });

  undoBtn?.addEventListener("click", () => {
    // Prevent undo while bot is thinking or promotion is pending
    if (botThinking || pendingPromotion) {
      console.warn("Cannot undo: bot is thinking or promotion pending");
      return;
    }

    // Terminate Stockfish worker to prevent stale move applications
    if (window._sfWorker) {
      window._sfWorker.terminate();
      window._sfWorker = null;
      console.log("Stockfish worker terminated for undo");
    }

    // Try to undo the move
    const undone = game.undo();
    if (!undone) {
      console.log("No moves to undo");
      return;
    }

    // Update board and UI
    board.position(game.fen());
    saveGame();
    updateCaptured();
    updateHistoryUI();
    recolorBoard();
    playerThinking = false;
    botThinking = false;

    // Close any open modals
    const settingsModal = document.getElementById("settingsModal");
    const overlay = document.getElementById("overlay");
    if (settingsModal?.classList.contains("show")) {
      settingsModal.classList.remove("show");
      overlay.style.display = "none";
      main?.classList.remove("blurred");
    }
  });

  flipBtn?.addEventListener("click", () => {
    board.flip();
    boardFlipped = !boardFlipped;
    localStorage.setItem("boardFlipped", boardFlipped ? "true" : "false");
    recolorBoard();
  });

  settingsBtn?.addEventListener("click", () => {
    if (!settingsModal || !overlay) return;
    overlay.style.display = "block";
    settingsModal.classList.add("show");
    main?.classList.add("blurred");
    // sync inputs
    const sideEl = document.querySelector(`input[name="side"][value="${playerColor}"]`);
    if (sideEl) sideEl.checked = true;
    if (difficultySelect) difficultySelect.value = (botDepth || 2).toString();
    if (soundToggle) soundToggle.checked = !!soundsEnabled;
  });

  closeSettings?.addEventListener("click", () => {
    if (settingsModal) settingsModal.classList.remove("show");
    if (overlay) overlay.style.display = "none";
    main?.classList.remove("blurred");
  });

  applySettings?.addEventListener("click", () => {
    // save sound setting immediately
    if (soundToggle) {
      soundsEnabled = !!soundToggle.checked;
      localStorage.setItem("soundsEnabled", soundsEnabled ? "true" : "false");
    }

    // difficultySelect: label still "Level X" but value is seconds
    if (difficultySelect) {
      const val = parseInt(difficultySelect.value, 10);
      if (!isNaN(val)) {
        botDepth = Math.max(1, Math.min(25, val));
        window.currentDifficulty = botDepth; // keep a runtime copy used by makeBestMove
        localStorage.setItem("botDepth", botDepth.toString());
      }
    }

    // side change: if changed, reset game so orientation and turns match
    const selectedSide = document.querySelector("input[name='side']:checked")?.value;
    const sideChanged = selectedSide && selectedSide !== playerColor;
    if (sideChanged) {
      playerColor = selectedSide;
      localStorage.setItem("playerColor", playerColor);
      // reorient board and reset game
      board.orientation(playerColor);
      game.reset();
      board.start();
      saveGame();
      updateCaptured();
      updateHistoryUI();
      recolorBoard();
      if (playerColor === "black") setTimeout(makeBestMove, 300);
    } else {
      saveGame();
    }

    if (settingsModal) settingsModal.classList.remove("show");
    if (overlay) overlay.style.display = "none";
    main?.classList.remove("blurred");
  });

  overlay?.addEventListener("click", () => {
    // close settings if open
    if (settingsModal?.classList.contains("show")) {
      settingsModal.classList.remove("show");
      overlay.style.display = "none";
      main?.classList.remove("blurred");
    }
    // if promotion open, cancel it
    const promo = document.getElementById("promotionModal");
    if (promo && promo.classList.contains("show")) cancelPromotion();
  });
}

// ---------- init ----------
window.addEventListener("load", () => {
  loadSettings();
  loadGame();

  board = Chessboard("board", {
    draggable: true,
    position: game.fen() || "start",
    onDragStart,
    onDrop,
    onSnapEnd,
    orientation: playerColor
  });

  if (boardFlipped) board.flip();

  recolorBoard();
  updateCaptured();
  updateHistoryUI();
  wireButtons();

  // if it's bot's turn on load, make it move
  const turn = game.turn();
  const botShouldMove = (playerColor === "white" && turn === "b") || (playerColor === "black" && turn === "w");
  if (botShouldMove) setTimeout(makeBestMove, 300);
});