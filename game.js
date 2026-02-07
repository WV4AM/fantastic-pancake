// Function to highlight valid moves
function highlightValidMoves(piece) {
    // Logic to highlight valid moves for the picked piece
    const validMoves = getValidMoves(piece);
    validMoves.forEach(move => {
        const cell = document.getElementById(move);
        if (cell) {
            cell.style.backgroundColor = 'yellow';
        }
    });
}

// Function to reset the board
function resetBoard() {
    const cells = document.querySelectorAll('.board-cell');
    cells.forEach(cell => {
        cell.style.backgroundColor = '';
    });
}

// Add event listener to the endgame modal close action
const endgameModal = document.getElementById('endgame-modal');
endgameModal.addEventListener('close', resetBoard);