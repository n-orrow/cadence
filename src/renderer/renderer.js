const { ipcRenderer } = require('electron');

const timerDisplay = document.querySelector('.timer');
const phaseLabel = document.querySelector('.phase-label');
const startBtn = document.querySelector('.btn-start');

const FOCUS_DURATION = 45 * 60;
const BREAK_DURATION = 15 * 60;

let timeRemaining = FOCUS_DURATION;
let isRunning = false;
let isBreak = false;
let interval = null;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(timeRemaining);
    phaseLabel.textContent = isBreak ? 'BREAK' : 'FOCUS';
    phaseLabel.style.color = isBreak ? 'var(--accent-break)' : 'var(--accent-focus)';
}

function startTimer() {
    isRunning = true;
    startBtn.textContent = 'Pause';

    interval = setInterval(() => {
        timeRemaining--;
        updateDisplay();

        if (timeRemaining <= 0) {
            clearInterval(interval);
            isRunning = false;

            if (!isBreak) {
                // Focus ended - start grace period
                isBreak = true;
                timeRemaining = BREAK_DURATION;
                phaseLabel.textContent = 'BREAK';
                startBtn.textContent = 'Start';
                updateDisplay();
            } else {
                // Break ended
                isBreak = false;
                timeRemaining = FOCUS_DURATION;
                startBtn.textContent = 'Start';
                updateDisplay();
            }
        }
    }, 1000);
}

function pauseTimer() {
    isRunning = false;
    clearInterval(interval);
    startBtn.textContent = 'Start';
}

startBtn.addEventListener('click', () => {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});

updateDisplay();