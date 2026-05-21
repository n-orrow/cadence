const { ipcRenderer } = require('electron');

const timerScreen = document.querySelector('.timer-screen');
const timerDisplay = document.querySelector('.timer');
const phaseLabel = document.querySelector('.phase-label');
const controls = document.querySelector('.controls');
const graceContainer = document.querySelector('.grace-container');
const app = document.querySelector('.app');
const backBtn = document.querySelector('.back-btn');
const settingsBtn = document.querySelector('.settings-btn');
const settingsScreen = document.querySelector('.settings-screen');
const settingsHome = document.querySelector('.settings-home');
const settingsSubpage = document.querySelector('.settings-subpage');

const FOCUS_DURATION = 45 * 60;
const BREAK_DURATION = 15 * 60;
const GRACE_DURATION = 30;
const SOFT_START_DURATION = 300;       // 5 minutes
const WIND_DOWN_DURATION = 300;        // 5 minutes
const SOFT_START_HOLD = 210;           // hold before fading back to black
const WIND_DOWN_TRANSITION_START = 210; // hold before transitioning to next colour

const DEV_MODE = true;

let timeRemaining = FOCUS_DURATION;
let isRunning = false;
let isBreak = false;
let isGrace = false;
let isConfirmingSkip = false;
let isPaused = false;
let graceRemaining = GRACE_DURATION;
let hasExtended = false;
let interval = null;
let currentScreen = null;
let isFirstFocus = true;
let shadowTimers = [];

// ─── SHADOW ──────────────────────────────────────────────────────────────────

function setShadowClass(shadowClass) {
    app.classList.remove('shadow-red', 'shadow-green', 'shadow-amber', 'shadow-black');
    app.classList.add(shadowClass);
}

function clearShadowTimers() {
    shadowTimers.forEach(t => clearTimeout(t));
    shadowTimers = [];
}

function startFocusShadowSequence(totalSeconds) {
    clearShadowTimers();

    if (isFirstFocus) {
        // cold start - transition from black to red
        setShadowClass('shadow-red');
        isFirstFocus = false;
    }
    // already red from break wind-down on subsequent cycles, so just hold

    // at 210s fade red back to black
    shadowTimers.push(setTimeout(() => {
        setShadowClass('shadow-black');
    }, SOFT_START_HOLD * 1000));

    // at (totalSeconds - 90)s fade black to green
    const windDownTransitionAt = (totalSeconds - 90) * 1000;
    shadowTimers.push(setTimeout(() => {
        setShadowClass('shadow-green');
    }, windDownTransitionAt));
}

function startGraceShadowSequence() {
    clearShadowTimers();
    // green to amber over 5s (handled by CSS transition)
    setShadowClass('shadow-amber');
}

function startBreakShadowSequence(totalSeconds) {
    clearShadowTimers();

    // amber to green over 5s (handled by CSS transition)
    setShadowClass('shadow-green');

    // at 210s fade green back to black
    shadowTimers.push(setTimeout(() => {
        setShadowClass('shadow-black');
    }, SOFT_START_HOLD * 1000));

    // at (totalSeconds - 90)s fade black to red
    const windDownTransitionAt = (totalSeconds - 90) * 1000;
    shadowTimers.push(setTimeout(() => {
        setShadowClass('shadow-red');
    }, windDownTransitionAt));
}

// ─── FORMATTING ──────────────────────────────────────────────────────────────

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ─── SCREENS ─────────────────────────────────────────────────────────────────

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
                <button class="btn-start-break">Start</button>
                <button class="btn-skip">Skip</button>
            `;
            if (!hasExtended) {
                document.querySelector('.btn-extend').addEventListener('click', extendFocus);
            }
            document.querySelector('.btn-start-break').addEventListener('click', startBreak);
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

// ─── TIMER CONTROLS ──────────────────────────────────────────────────────────

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
    isPaused = false;
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

// ─── SETTINGS ────────────────────────────────────────────────────────────────

function openSettings() {
    timerScreen.style.display = 'none';
    graceContainer.innerHTML = '';
    settingsScreen.style.display = 'flex';
    settingsHome.style.display = 'block';
    settingsSubpage.style.display = 'none';
    settingsBtn.classList.add('active');
    settingsBtn.innerHTML = '&#10005;';
    backBtn.classList.add('hidden');
}

function closeSettings() {
    settingsScreen.style.display = 'none';
    settingsBtn.classList.remove('active');
    settingsBtn.innerHTML = '&#9881;';
    backBtn.classList.add('hidden');
    renderScreen('timer');
}

function openSubpage(page) {
    settingsHome.style.display = 'none';
    settingsSubpage.style.display = 'flex';
    settingsSubpage.innerHTML = `
        <p class="settings-subpage-title">${page}</p>
        <p style="color: rgba(200,200,200,0.3); font-size: 0.8rem;">Coming soon.</p>
    `;
    backBtn.classList.remove('hidden');
}

backBtn.addEventListener('click', () => {
    settingsSubpage.style.display = 'none';
    settingsHome.style.display = 'block';
    backBtn.classList.add('hidden');
});

settingsBtn.addEventListener('click', () => {
    if (settingsScreen.style.display === 'none' || settingsScreen.style.display === '') {
        openSettings();
    } else {
        closeSettings();
    }
});

document.querySelectorAll('.settings-nav__item').forEach(item => {
    item.addEventListener('click', () => openSubpage(item.dataset.page));
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
renderScreen('timer');