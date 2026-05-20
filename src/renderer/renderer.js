const { ipcRenderer } = require('electron');

const timerScreen = document.querySelector('.timer-screen');
const timerDisplay = document.querySelector('.timer');
const phaseLabel = document.querySelector('.phase-label');
const controls = document.querySelector('.controls');
const graceContainer = document.querySelector('.grace-container');

const FOCUS_DURATION = 45 * 60;
const BREAK_DURATION = 15 * 60;
const GRACE_DURATION = 30;

const DEV_MODE = true;

let timeRemaining = FOCUS_DURATION;
let isRunning = false;
let isPaused = false;
let isBreak = false;
let isGrace = false;
let isConfirmingSkip = false;
let graceRemaining = GRACE_DURATION;
let hasExtended = false;
let interval = null;
let currentScreen = null;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function renderScreen(screen) {
    currentScreen = screen;

    graceContainer.innerHTML = '';
    timerScreen.style.display = 'none';

    if (screen === 'timer') {
        timerScreen.style.display = 'flex';
        phaseLabel.textContent = isGrace ? 'WRAP UP' : isBreak ? 'BREAK' : 'FOCUS';
        phaseLabel.style.color = isGrace ? 'var(--accent-amber)' : isBreak ? 'var(--accent-break)' : 'var(--accent-focus)';
        timerDisplay.textContent = isGrace ? formatTime(graceRemaining) : formatTime(timeRemaining);

        if (isGrace) {
            controls.innerHTML = `
                <button class="btn-extend" ${hasExtended ? 'disabled' : ''}>+5 min</button>
                <button class="btn-skip">Skip Break</button>
            `;
            if (!hasExtended) {
                document.querySelector('.btn-extend').addEventListener('click', extendFocus);
            }
            document.querySelector('.btn-skip').addEventListener('click', () => {
                isConfirmingSkip = true;
                renderScreen('confirm');
            });
        } else {
            controls.innerHTML = `<button class="btn-start">${isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}</button>`;
            const btn = document.querySelector('.btn-start');
            btn.classList.toggle('break', isBreak);
            btn.addEventListener('click', () => {
                if (isRunning) pauseTimer();
                else startTimer();
            });
        }
    } else if (screen === 'confirm') {
        timerScreen.style.display = 'none';
        graceContainer.innerHTML = `
            <div class="grace-screen">
                <div class="grace-screen__header">
                    <span class="grace-screen__label">WRAP UP</span>
                    <span class="grace-screen__timer">${formatTime(graceRemaining)}</span>
                </div>
                <div class="grace-screen__confirm">
                    <p class="grace-screen__heading">Sure?</p>
                    <p class="grace-screen__subtext">Breaks keep you sharp.</p>
                    <div class="grace-screen__buttons">
                        <button class="btn-take-break">Take the break</button>
                        <button class="btn-confirm-skip">Skip it</button>
                    </div>
                </div>
            </div>
        `;
        document.querySelector('.btn-take-break').addEventListener('click', () => {
            isConfirmingSkip = false;
            startBreak();
        });
        document.querySelector('.btn-confirm-skip').addEventListener('click', skipBreak);
    }
}

function tickUpdate() {
    if (currentScreen === 'timer') {
        timerDisplay.textContent = isGrace ? formatTime(graceRemaining) : formatTime(timeRemaining);
    } else if (currentScreen === 'confirm') {
        const timerEl = document.querySelector('.grace-screen__timer');
        if (timerEl) timerEl.textContent = formatTime(graceRemaining);
    }
}

function startTimer() {
    isRunning = true;
    if (DEV_MODE && !isPaused && timeRemaining === FOCUS_DURATION) timeRemaining = 10;
    isPaused = false;
    renderScreen('timer');

    interval = setInterval(() => {
        timeRemaining--;
        tickUpdate();

        if (timeRemaining <= 0) {
            clearInterval(interval);
            isRunning = false;
            startGrace();
        }
    }, 1000);
}

function pauseTimer() {
    isRunning = false;
    isPaused = true;
    clearInterval(interval);
    renderScreen('timer');
}

function startGrace() {
    isGrace = true;
    isConfirmingSkip = false;
    graceRemaining = GRACE_DURATION;
    hasExtended = false;
    renderScreen('timer');

    interval = setInterval(() => {
        graceRemaining--;
        tickUpdate();

        if (graceRemaining <= 0) {
            clearInterval(interval);
            isConfirmingSkip = false;
            startBreak();
        }
    }, 1000);
}

function extendFocus() {
    hasExtended = true;
    clearInterval(interval);
    isGrace = false;
    isRunning = true;
    timeRemaining = DEV_MODE ? 10 : 5 * 60;
    renderScreen('timer');

    interval = setInterval(() => {
        timeRemaining--;
        tickUpdate();

        if (timeRemaining <= 0) {
            clearInterval(interval);
            startGrace();
        }
    }, 1000);
}

function skipBreak() {
    clearInterval(interval);
    isGrace = false;
    isBreak = false;
    isConfirmingSkip = false;
    hasExtended = false;
    timeRemaining = FOCUS_DURATION;
    startTimer();
}

function startBreak() {
    clearInterval(interval);
    isGrace = false;
    isBreak = true;
    isConfirmingSkip = false;
    isRunning = true;
    isPaused = false;
    timeRemaining = DEV_MODE ? 10 : BREAK_DURATION;
    renderScreen('timer');

    interval = setInterval(() => {
        timeRemaining--;
        tickUpdate();

        if (timeRemaining <= 0) {
            clearInterval(interval);
            isBreak = false;
            isRunning = false;
            isPaused = false;
            timeRemaining = FOCUS_DURATION;
            renderScreen('timer');
        }
    }, 1000);
}

renderScreen('timer');