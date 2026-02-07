function undo() {
    if (history.length > 0) {
        let lastAction = history.pop();
        // Revert the last action
        // ... (code for reverting last action)
    }
}

function terminateStockfishWorker(worker) {
    if (worker) {
        worker.terminate();
        console.log('Stockfish worker terminated.');
    }
}

// Existing functionality below remains unchanged
// ... (rest of game.js code)
