const { ipcRenderer } = require('electron');
const Store = require('electron-store');

const store = new Store();

// ─── ELEMENT REFERENCES ───────────────────────────────────────────────────────

const timerScreen     = document.querySelector('.timer-screen');
const timerDisplay    = document.querySelector('.timer');
const phaseLabel      = document.querySelector('.phase-label');
const controls        = document.querySelector('.controls');
const graceContainer  = document.querySelector('.grace-container');
const app             = document.querySelector('.app');
const settingsBtn     = document.querySelector('.settings-btn');
const backBtn         = document.querySelector('.back-btn');
const settingsScreen  = document.querySelector('.settings-screen');
const settingsHome    = document.querySelector('.settings-home');
const settingsSubpage = document.querySelector('.settings-subpage');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FOCUS_DURATION  = 45 * 60;
const BREAK_DURATION  = 15 * 60;
const GRACE_DURATION  = 30;
const SOFT_START_HOLD = 210;

const DEV_MODE = true;

const SPACE_WORDS = [
    'Pulsar', 'Vega', 'Nebula', 'Quasar', 'Solstice', 'Eclipse',
    'Horizon', 'Cosmos', 'Perihelion', 'Apogee', 'Equinox', 'Solaris',
    'Orbit', 'Photon', 'Cassini', 'Halcyon', 'Meridian', 'Syzygy',
    'Perigee', 'Parallax', 'Luminary', 'Celestia', 'Cygnus', 'Lyra',
    'Orion', 'Rigel', 'Sirius', 'Altair', 'Antares', 'Procyon',
    'Arcturus', 'Capella', 'Deneb', 'Fomalhaut', 'Spica', 'Pollux'
];

const SPLITS_STANDARD = [
    { focus: 40, break: 20 },
    { focus: 45, break: 15 },
    { focus: 50, break: 10 },
    { focus: 60, break: 0  },
];

const SPLITS_POST_HOUR = [
    { focus: 0,  break: 60 },
    { focus: 30, break: 30 },
    { focus: 40, break: 20 },
    { focus: 45, break: 15 },
    { focus: 50, break: 10 },
];

// ─── TIMER STATE ──────────────────────────────────────────────────────────────

let timeRemaining    = FOCUS_DURATION;
let isRunning        = false;
let isBreak          = false;
let isGrace          = false;
let isConfirmingSkip = false;
let isPaused         = false;
let graceRemaining   = GRACE_DURATION;
let hasExtended      = false;
let interval         = null;
let currentScreen    = null;
let isFirstFocus     = true;
let shadowTimers     = [];

// ─── WORKDAY STATE ────────────────────────────────────────────────────────────

let workday = store.get('workday', { name: '', phases: [] });

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────

function saveWorkday() {
    store.set('workday', workday);
}

// ─── SHADOW ───────────────────────────────────────────────────────────────────

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
        setShadowClass('shadow-red');
        isFirstFocus = false;
    }

    shadowTimers.push(setTimeout(() => {
        revalidateFromIndex(0);
        setShadowClass('shadow-black');
    }, SOFT_START_HOLD * 1000));

    shadowTimers.push(setTimeout(() => {
        setShadowClass('shadow-green');
    }, (totalSeconds - 90) * 1000));
}

function startGraceShadowSequence() {
    clearShadowTimers();
    setShadowClass('shadow-amber');
}

function startBreakShadowSequence(totalSeconds) {
    clearShadowTimers();
    setShadowClass('shadow-green');

    shadowTimers.push(setTimeout(() => {
        revalidateFromIndex(0);
        setShadowClass('shadow-black');
    }, SOFT_START_HOLD * 1000));

    shadowTimers.push(setTimeout(() => {
        setShadowClass('shadow-red');
    }, (totalSeconds - 90) * 1000));
}

// ─── FORMATTING ───────────────────────────────────────────────────────────────

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ─── TIMER SCREENS ────────────────────────────────────────────────────────────

function renderScreen(screen) {
    currentScreen = screen;

    graceContainer.innerHTML     = '';
    timerScreen.style.display    = 'none';
    settingsScreen.style.display = 'none';

    if (screen === 'timer') {
        timerScreen.style.display = 'flex';
        phaseLabel.textContent    = isGrace ? 'WRAP UP' : isBreak ? 'BREAK' : 'FOCUS';
        phaseLabel.style.color    = isGrace ? 'var(--accent-amber)' : isBreak ? 'var(--accent-break)' : 'var(--accent-focus)';
        timerDisplay.textContent  = isGrace ? formatTime(graceRemaining) : formatTime(timeRemaining);

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
        graceContainer.innerHTML  = `
            <div class="grace-screen">
                <div class="header">
                    <span class="label">WRAP UP</span>
                    <span class="countdown">${formatTime(graceRemaining)}</span>
                </div>
                <div class="confirm">
                    <p class="heading">Sure?</p>
                    <p class="subtext">Breaks keep you sharp.</p>
                    <div class="buttons">
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
        const countdownEl = document.querySelector('.grace-screen .countdown');
        if (countdownEl) countdownEl.textContent = formatTime(graceRemaining);
    }
}

// ─── TIMER CONTROLS ───────────────────────────────────────────────────────────

function startTimer() {
    isRunning = true;
    if (DEV_MODE && !isPaused && timeRemaining === FOCUS_DURATION) timeRemaining = 10;
    isPaused  = false;
    startFocusShadowSequence(timeRemaining);
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
    isPaused  = true;
    clearInterval(interval);
    clearShadowTimers();
    renderScreen('timer');
}

function startGrace() {
    isGrace          = true;
    isConfirmingSkip = false;
    graceRemaining   = GRACE_DURATION;
    hasExtended      = false;
    startGraceShadowSequence();
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
    hasExtended   = true;
    clearInterval(interval);
    clearShadowTimers();
    isGrace       = false;
    isRunning     = true;
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
    clearShadowTimers();
    isGrace          = false;
    isBreak          = false;
    isConfirmingSkip = false;
    isPaused         = false;
    hasExtended      = false;
    timeRemaining    = FOCUS_DURATION;
    startTimer();
}

function startBreak() {
    clearInterval(interval);
    clearShadowTimers();
    isGrace          = false;
    isBreak          = true;
    isConfirmingSkip = false;
    isRunning        = true;
    isPaused         = false;
    timeRemaining    = DEV_MODE ? 10 : BREAK_DURATION;
    startBreakShadowSequence(timeRemaining);
    renderScreen('timer');

    interval = setInterval(() => {
        timeRemaining--;
        tickUpdate();

        if (timeRemaining <= 0) {
            clearInterval(interval);
            isBreak       = false;
            isRunning     = false;
            isPaused      = false;
            timeRemaining = FOCUS_DURATION;
            renderScreen('timer');
        }
    }, 1000);
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

function openSettings() {
    timerScreen.style.display     = 'none';
    graceContainer.innerHTML      = '';
    settingsScreen.style.display  = 'flex';
    settingsHome.style.display    = 'block';
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
    settingsHome.style.display    = 'none';
    settingsSubpage.style.display = 'flex';
    backBtn.classList.remove('hidden');

    if (page === 'workday') {
        renderWorkdaySubpage();
    } else {
        settingsSubpage.innerHTML = `
            <p class="title">${page}</p>
            <p style="color: rgba(200,200,200,0.3); font-size: 0.8rem;">Coming soon.</p>
        `;
    }
}

settingsBtn.addEventListener('click', () => {
    if (settingsScreen.style.display === 'none' || settingsScreen.style.display === '') {
        openSettings();
    } else {
        closeSettings();
    }
});

backBtn.addEventListener('click', () => {
    settingsSubpage.style.display = 'none';
    settingsHome.style.display    = 'block';
    backBtn.classList.add('hidden');
});

document.querySelectorAll('.settings-nav .item').forEach(item => {
    item.addEventListener('click', () => openSubpage(item.dataset.page));
});

// ─── WORKDAY BUILDER ──────────────────────────────────────────────────────────

function randomSpaceWord() {
    const used      = workday.phases.map(p => p.name);
    const available = SPACE_WORDS.filter(w => !used.includes(w));
    const pool      = available.length > 0 ? available : SPACE_WORDS;
    return pool[Math.floor(Math.random() * pool.length)];
}

function getSplitForPhase(phase, index) {
    const splits = getSplitsForPhase(index);
    return splits[Math.min(phase.splitIndex, splits.length - 1)];
}

function getSplitsForPhase(index) {
    if (index === 0) return SPLITS_STANDARD;

    const isEarlyInDay = index < 2;
    const isNearEnd    = index >= workday.phases.length - 2 && workday.phases.length >= 7;
    const inLunchWindow = index >= 3 && index <= 4;

    // check if previous phase was also 0:60 - consecutive only allowed in lunch window
    const prev          = workday.phases[index - 1];
    const prevSplit     = prev ? getSplitForPhase(prev, index - 1) : null;
    const prevIsBreakOnly = prevSplit && prevSplit.break === 60;

    if (!isEarlyInDay && !isNearEnd && !(prevIsBreakOnly && !inLunchWindow)) {
        return SPLITS_POST_HOUR;
    }

    return SPLITS_STANDARD;
}

function clampSplitIndex(phase, splits) {
    if (phase.splitIndex >= splits.length) {
        phase.splitIndex = 1; // default to 45:15
    }
}

function revalidateFromIndex(startIndex) {
    for (let i = startIndex; i < workday.phases.length; i++) {
        const splits = getSplitsForPhase(i);
        clampSplitIndex(workday.phases[i], splits);
    }
}

function createPhase(overrides = {}) {
    return {
        id:         Date.now(),
        name:       randomSpaceWord(),
        splitIndex: 1,
        ...overrides
    };
}

function renderWorkdaySubpage() {
    settingsSubpage.innerHTML = `
        <p class="title">Workday</p>
        <div class="phase-builder"></div>
    `;
    renderPhaseBuilder();
}

function renderPhaseBuilder() {
    const builder     = document.querySelector('.phase-builder');
    builder.innerHTML = '';

    workday.phases.forEach((phase, index) => {
        builder.appendChild(createPhaseRow(phase, index));
    });

    if (workday.phases.length < 12) {
        const addBtn       = document.createElement('button');
        addBtn.className   = 'phase-add-btn';
        addBtn.textContent = '+ add phase';
        addBtn.addEventListener('click', addPhase);
        builder.appendChild(addBtn);
    }
}

function createPhaseRow(phase, index) {
    const row      = document.createElement('div');
    row.className  = 'phase-row';
    row.dataset.id = phase.id;

    const splits = getSplitsForPhase(index);
    clampSplitIndex(phase, splits);

    const split    = splits[phase.splitIndex];
    const focusPct = split.focus === 0 ? 0 : (split.focus / 60) * 100;
    const breakPct = split.break === 0 ? 0 : (split.break / 60) * 100;
    const showFocus = split.focus > 0;
    const showBreak = split.break > 0;

    row.innerHTML = `
        ${index === 0 ? `
            <div class="header">
                <span class="focus-label">Focus</span>
                <span class="break-label">Break</span>
            </div>
        ` : ''}
        <div class="bar" data-id="${phase.id}">
            ${showFocus ? `
                <div class="segment focus ${!showBreak ? 'first last' : 'first'}" style="width: ${focusPct}%">
                    <span class="label">${split.focus} min</span>
                </div>
            ` : ''}
            <div class="grabber"></div>
            ${showBreak ? `
                <div class="segment break ${!showFocus ? 'first last' : 'last'}" style="width: ${breakPct}%">
                    <span class="label">${split.break} min</span>
                </div>
            ` : ''}
        </div>
        <button class="phase-delete-btn" data-index="${index}">remove</button>
    `;

    const bar = row.querySelector('.bar');
    setupBarDrag(bar, phase, index);

    row.querySelector('.phase-delete-btn').addEventListener('click', () => {
        deletePhase(index);
    });

    return row;
}

function setupBarDrag(bar, phase, index) {
    bar.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const barRect = bar.getBoundingClientRect();

        const onMouseMove = (e) => {
            const splits     = getSplitsForPhase(index);
            const x          = e.clientX - barRect.left;
            const pct        = x / barRect.width;
            const snapPoints = splits.map(s => s.focus / 60);
            const distances  = snapPoints.map(p => Math.abs(pct - p));
            const nearest    = distances.indexOf(Math.min(...distances));

            if (phase.splitIndex !== nearest) {
                phase.splitIndex = nearest;
                revalidateFromIndex(index + 1);
                saveWorkday();
                renderPhaseBuilder();
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function deletePhase(index) {
    workday.phases.splice(index, 1);
    revalidateFromIndex(index);
    saveWorkday();
    renderPhaseBuilder();
}

function addPhase() {
    workday.phases.push(createPhase());
    saveWorkday();
    renderPhaseBuilder();

    const builder     = document.querySelector('.phase-builder');
    builder.scrollTop = builder.scrollHeight;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

revalidateFromIndex(0);
setShadowClass('shadow-black');
renderScreen('timer');