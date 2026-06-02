const {ipcRenderer} = require('electron');
const Store = require('electron-store');

const store = new Store();

// ─── ELEMENT REFERENCES ───────────────────────────────────────────────────────

const timerScreen = document.querySelector('.timer-screen');
const timerDisplay = document.querySelector('.timer');
const phaseLabel = document.querySelector('.phase-label');
const controls = document.querySelector('.controls');
const graceContainer = document.querySelector('.grace-container');
const app = document.querySelector('.app');
const settingsBtn = document.querySelector('.settings-btn');
const backBtn = document.querySelector('.back-btn');
const settingsScreen = document.querySelector('.settings-screen');
const settingsHome = document.querySelector('.settings-home');
const settingsSubpage = document.querySelector('.settings-subpage');
const phaseIndicator = document.querySelector('.phase-indicator');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FOCUS_DURATION = 45 * 60;
const BREAK_DURATION = 15 * 60;
const GRACE_DURATION = 30;
const SOFT_START_HOLD = 210;

const DEV_MODE = false;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SPACE_WORDS = [
    'Pulsar', 'Vega', 'Nebula', 'Quasar', 'Solstice', 'Eclipse',
    'Horizon', 'Cosmos', 'Perihelion', 'Apogee', 'Equinox', 'Solaris',
    'Orbit', 'Photon', 'Cassini', 'Halcyon', 'Meridian', 'Syzygy',
    'Perigee', 'Parallax', 'Luminary', 'Celestia', 'Cygnus', 'Lyra',
    'Orion', 'Rigel', 'Sirius', 'Altair', 'Antares', 'Procyon',
    'Arcturus', 'Capella', 'Deneb', 'Fomalhaut', 'Spica', 'Pollux'
];

const SPLITS_STANDARD = [
    {focus: 40, break: 20},
    {focus: 45, break: 15},
    {focus: 50, break: 10},
    {focus: 60, break: 0},
];

const SPLITS_POST_HOUR = [
    {focus: 0, break: 60},
    {focus: 30, break: 30},
    {focus: 40, break: 20},
    {focus: 45, break: 15},
    {focus: 50, break: 10},
    {focus: 60, break: 0},
];

// ─── TIMER STATE ──────────────────────────────────────────────────────────────

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

// ─── WORKDAY STATE ────────────────────────────────────────────────────────────

let activeTemplate = null;
let currentPhaseIdx = 0;
let phaseTimeElapsed = 0;

// ─── TEMPLATE STATE ───────────────────────────────────────────────────────────

let templates = store.get('templates', []);
let dayAssign = store.get('dayAssign', {Mon: null, Tue: null, Wed: null, Thu: null, Fri: null, Sat: null, Sun: null});
let editingTemplate = null;
let subpageStack = [];

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────

function saveTemplates() {
    store.set('templates', templates);
}

function saveDayAssign() {
    store.set('dayAssign', dayAssign);
}

// ─── ACTIVE TEMPLATE ──────────────────────────────────────────────────────────

function getActiveTemplate() {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = dayNames[new Date().getDay()];
    const assigned = dayAssign[today];

    if (!assigned || assigned === 'off') return null;
    return templates.find(t => t.id === assigned) || null;
}

function getCurrentPhaseSplit() {
    if (!activeTemplate) return {focus: 45, break: 15};
    const phase = activeTemplate.phases[currentPhaseIdx];
    if (!phase) return {focus: 45, break: 15};
    const splits = getBuilderSplitsForPhase(currentPhaseIdx, activeTemplate.phases);
    return splits[Math.min(phase.splitIndex, splits.length - 1)];
}

function getPhaseDuration(phaseIdx) {
    if (!activeTemplate) return 60 * 60;
    const phase = activeTemplate.phases[phaseIdx];
    if (!phase) return 60 * 60;
    const splits = getBuilderSplitsForPhase(phaseIdx, activeTemplate.phases);
    const split = splits[Math.min(phase.splitIndex, splits.length - 1)];
    return (split.focus + split.break) * 60;
}

function getBuilderSplitsForPhase(index, phases) {
    if (index === 0) return SPLITS_STANDARD;

    const isEarlyInDay = index < 2;
    const isNearEnd = index >= phases.length - 2 && phases.length >= 7;
    const inLunchWindow = index >= 3 && index <= 4;
    const prev = phases[index - 1];
    const prevSplit = prev ? getBuilderSplitsForPhase(index - 1, phases)[Math.min(prev.splitIndex, SPLITS_STANDARD.length - 1)] : null;
    const prevIsBreakOnly = prevSplit && prevSplit.break === 60;

    if (!isEarlyInDay && !isNearEnd && !(prevIsBreakOnly && !inLunchWindow)) {
        return SPLITS_POST_HOUR;
    }

    return SPLITS_STANDARD;
}

// ─── PHASE INDICATOR ──────────────────────────────────────────────────────────

function renderPhaseIndicator() {
    if (!activeTemplate || !phaseIndicator) return;

    const phases = activeTemplate.phases;
    phaseIndicator.innerHTML = '';
    phaseIndicator.style.display = 'flex';

    phases.forEach((phase, index) => {
        const div = document.createElement('div');
        div.className = 'phase';

        if (index < currentPhaseIdx) {
            div.classList.add('completed');
        } else if (index === currentPhaseIdx) {
            const totalSeconds = getPhaseDuration(index);
            const progress = Math.min((phaseTimeElapsed / totalSeconds) * 100, 100);
            div.style.setProperty('--phase-progress', `${progress}%`);

            if (isBreak || isGrace) {
                div.classList.add('break');
            } else {
                div.classList.add('focus');
            }
        }

        phaseIndicator.appendChild(div);
    });
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

    graceContainer.innerHTML = '';
    timerScreen.style.display = 'none';
    settingsScreen.style.display = 'none';

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

        renderPhaseIndicator();

    } else if (screen === 'confirm') {
        timerScreen.style.display = 'none';
        graceContainer.innerHTML = `
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
    phaseTimeElapsed++;

    if (currentScreen === 'timer') {
        timerDisplay.textContent = isGrace ? formatTime(graceRemaining) : formatTime(timeRemaining);
        renderPhaseIndicator();
    } else if (currentScreen === 'confirm') {
        const countdownEl = document.querySelector('.grace-screen .countdown');
        if (countdownEl) countdownEl.textContent = formatTime(graceRemaining);
    }
}

// ─── TIMER CONTROLS ───────────────────────────────────────────────────────────

function getFocusDuration() {
    if (!activeTemplate) return DEV_MODE ? 10 : FOCUS_DURATION;
    const split = getCurrentPhaseSplit();
    return DEV_MODE ? 10 : split.focus * 60;
}

function getBreakDuration() {
    if (!activeTemplate) return DEV_MODE ? 10 : BREAK_DURATION;
    const split = getCurrentPhaseSplit();
    return DEV_MODE ? 10 : split.break * 60;
}

function startTimer() {
    isRunning = true;
    timeRemaining = getFocusDuration();
    isPaused = false;
    startFocusShadowSequence(timeRemaining);
    renderScreen('timer');

    setTrayIcon('focus');

    interval = setInterval(() => {
        timeRemaining--;
        tickUpdate();

        if (timeRemaining <= 0) {
            clearInterval(interval);
            isRunning = false;

            const split = getCurrentPhaseSplit();
            if (split.break === 0) {
                // 60:0 phase - no grace, no break, advance directly
                advancePhase();
            } else {
                startGrace();
            }
        }
    }, 1000);
}

function pauseTimer() {
    isRunning = false;
    isPaused = true;
    clearInterval(interval);
    clearShadowTimers();
    renderScreen('timer');
    setTrayIcon('idle');
}

function startGrace() {
    isGrace = true;
    isConfirmingSkip = false;
    graceRemaining = GRACE_DURATION;
    hasExtended = false;
    startGraceShadowSequence();
    renderScreen('timer');

    setTrayIcon('focus');

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
    clearShadowTimers();
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
    clearShadowTimers();
    isGrace = false;
    isBreak = false;
    isConfirmingSkip = false;
    isPaused = false;
    hasExtended = false;
    advancePhase();
}

function startBreak() {
    clearInterval(interval);
    clearShadowTimers();
    isGrace = false;
    isBreak = true;
    isConfirmingSkip = false;
    isRunning = true;
    isPaused = false;
    timeRemaining = getBreakDuration();

    setTrayIcon('break');

    if (timeRemaining <= 0) {
        // 0:60 break-only phase - go straight to break duration
        timeRemaining = DEV_MODE ? 10 : 60 * 60;
    }

    startBreakShadowSequence(timeRemaining);
    renderScreen('timer');

    interval = setInterval(() => {
        timeRemaining--;
        tickUpdate();

        if (timeRemaining <= 0) {
            clearInterval(interval);
            isBreak = false;
            isRunning = false;
            isPaused = false;
            advancePhase();
        }
    }, 1000);
}

function advancePhase() {
    if (!activeTemplate) {
        // no template - just reset to default
        timeRemaining = FOCUS_DURATION;
        phaseTimeElapsed = 0;
        renderScreen('timer');
        setTrayIcon('idle');
        return;
    }

    if (currentPhaseIdx < activeTemplate.phases.length - 1) {
        currentPhaseIdx++;
        phaseTimeElapsed = 0;
        timeRemaining = getFocusDuration();
        isBreak = false;
        isGrace = false;
        renderScreen('timer');
    } else {
        // end of workday
        showWorkdaySummary();
    }
}

function showWorkdaySummary() {
    clearInterval(interval);
    clearShadowTimers();
    isRunning = false;
    isBreak = false;
    isGrace = false;
    isConfirmingSkip = false;

    timerScreen.style.display = 'none';
    graceContainer.innerHTML = '';
    settingsScreen.style.display = 'none';

    graceContainer.innerHTML = `
        <div class="grace-screen">
            <div class="confirm">
                <p class="heading">Workday complete.</p>
                <p class="subtext">Nice work today.</p>
                <div class="buttons">
                    <button class="btn-take-break">Add more phases</button>
                    <button class="btn-confirm-skip">Done</button>
                </div>
            </div>
        </div>
    `;

    document.querySelector('.btn-take-break').addEventListener('click', () => {
        // add more phases - go to builder for active template
        openSettings();
        openSubpage('templates');
        openSubpage('builder', activeTemplate);
    });

    document.querySelector('.btn-confirm-skip').addEventListener('click', () => {
        currentPhaseIdx = 0;
        phaseTimeElapsed = 0;
        timeRemaining = getFocusDuration();
        renderScreen('timer');
    });
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

function openSettings() {
    timerScreen.style.display = 'none';
    graceContainer.innerHTML = '';
    settingsScreen.style.display = 'flex';
    settingsHome.style.display = 'block';
    settingsSubpage.style.display = 'none';
    subpageStack = [];
    settingsBtn.classList.add('active');
    settingsBtn.innerHTML = '&#10005;';
    backBtn.classList.add('hidden');
}

function closeSettings() {
    settingsScreen.style.display = 'none';
    settingsBtn.classList.remove('active');
    settingsBtn.innerHTML = '&#9881;';
    backBtn.classList.add('hidden');
    subpageStack = [];

    // refresh active template in case it was edited
    activeTemplate = getActiveTemplate();
    if (activeTemplate) {
        currentPhaseIdx = 0;
        phaseTimeElapsed = 0;
    }

    renderScreen('timer');
}

function openSubpage(page, context = null) {
    subpageStack.push({page, context});
    settingsHome.style.display = 'none';
    settingsSubpage.style.display = 'flex';
    backBtn.classList.remove('hidden');

    if (page === 'templates') {
        renderTemplatesSubpage();
    } else if (page === 'builder') {
        renderBuilderSubpage(context);
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
    subpageStack.pop();

    if (subpageStack.length === 0) {
        settingsSubpage.style.display = 'none';
        settingsHome.style.display = 'block';
        backBtn.classList.add('hidden');
    } else {
        const prev = subpageStack[subpageStack.length - 1];
        subpageStack.pop();
        openSubpage(prev.page, prev.context);
    }
});

document.querySelectorAll('.settings-nav .item').forEach(item => {
    item.addEventListener('click', () => openSubpage(item.dataset.page));
});

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select.open').forEach(s => s.classList.remove('open'));
});

// ─── CUSTOM SELECT ────────────────────────────────────────────────────────────

function buildCustomSelect(day, currentValue) {
    const options = [
        {value: 'none', label: 'No template', separator: false},
        {value: 'off', label: 'Off', separator: false},
        ...templates.map((t, i) => ({value: t.id, label: t.name, separator: i === 0}))
    ];

    const selected = options.find(o => o.value === (currentValue || 'none')) || options[0];

    const el = document.createElement('div');
    el.className = 'custom-select';
    el.dataset.day = day;
    el.innerHTML = `
        <div class="trigger">
            <span class="selected-label">${selected.label}</span>
            <span class="arrow">&#9660;</span>
        </div>
        <div class="dropdown">
            ${options.map(o => `
                <div class="option ${o.value === (currentValue || 'none') ? 'selected' : ''} ${o.separator ? 'separator' : ''}" data-value="${o.value}">
                    ${o.label}
                </div>
            `).join('')}
        </div>
    `;

    const trigger = el.querySelector('.trigger');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select.open').forEach(s => {
            if (s !== el) s.classList.remove('open');
        });
        el.classList.toggle('open');
    });

    el.querySelectorAll('.option').forEach(opt => {
        opt.addEventListener('click', () => {
            const val = opt.dataset.value;
            dayAssign[day] = val === 'none' ? null : val;
            saveDayAssign();
            el.querySelector('.selected-label').textContent = opt.textContent.trim();
            el.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            el.classList.remove('open');
        });
    });

    return el;
}

// ─── TEMPLATES SUBPAGE ────────────────────────────────────────────────────────

function renderTemplatesSubpage() {
    settingsSubpage.innerHTML = `
        <p class="title">Templates</p>
        <div class="templates-page">
            <div class="day-assign"></div>
            <div class="templates-section">
                <p class="section-label">Workday Templates</p>
                <div class="template-list">
                    ${templates.length === 0 ? `
                        <p class="templates-empty">No templates yet.</p>
                    ` : templates.map(t => `
                        <div class="template-row" data-id="${t.id}">
                            <input class="template-name-input" type="text" value="${t.name}" data-id="${t.id}" />
                            <div class="template-actions">
                                <button class="template-btn edit" data-id="${t.id}" title="Edit">&#9998;</button>
                                <button class="template-btn duplicate" data-id="${t.id}" title="Duplicate">&#10697;</button>
                                <button class="template-btn delete" data-id="${t.id}" title="Delete">&#10005;</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="phase-add-btn add-template-btn">+ add new template</button>
            </div>
        </div>
    `;

    const dayAssignEl = document.querySelector('.day-assign');
    DAYS.forEach(day => {
        const row = document.createElement('div');
        row.className = 'day-row';
        row.innerHTML = `<span class="day-label">${day}</span>`;
        row.appendChild(buildCustomSelect(day, dayAssign[day]));
        dayAssignEl.appendChild(row);
    });

    document.querySelectorAll('.template-name-input').forEach(input => {
        input.addEventListener('change', () => {
            const t = templates.find(t => t.id === input.dataset.id);
            if (t) {
                t.name = input.value.trim() || randomSpaceWord();
                input.value = t.name;
                saveTemplates();
            }
        });
    });

    document.querySelectorAll('.template-btn.edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const t = templates.find(t => t.id === btn.dataset.id);
            if (t) openSubpage('builder', t);
        });
    });

    document.querySelectorAll('.template-btn.duplicate').forEach(btn => {
        btn.addEventListener('click', () => {
            const t = templates.find(t => t.id === btn.dataset.id);
            if (t) {
                const duped = {
                    id: Date.now().toString(),
                    name: `${t.name} copy`,
                    phases: JSON.parse(JSON.stringify(t.phases))
                };
                templates.push(duped);
                saveTemplates();
                renderTemplatesSubpage();
            }
        });
    });

    document.querySelectorAll('.template-btn.delete').forEach(btn => {
        btn.addEventListener('click', () => {
            templates = templates.filter(t => t.id !== btn.dataset.id);
            DAYS.forEach(day => {
                if (dayAssign[day] === btn.dataset.id) dayAssign[day] = null;
            });
            saveTemplates();
            saveDayAssign();
            renderTemplatesSubpage();
        });
    });

    document.querySelector('.add-template-btn').addEventListener('click', () => {
        const newTemplate = {
            id: Date.now().toString(),
            name: randomSpaceWord(),
            phases: []
        };
        templates.push(newTemplate);
        saveTemplates();
        openSubpage('builder', newTemplate);
    });
}

// ─── BUILDER SUBPAGE ──────────────────────────────────────────────────────────

function renderBuilderSubpage(template) {
    editingTemplate = template;

    settingsSubpage.innerHTML = `
        <div class="builder-header">
            <input class="builder-name-input" type="text" value="${template.name}" placeholder="Template name" />
        </div>
        <div class="phase-builder"></div>
    `;

    document.querySelector('.builder-name-input').addEventListener('change', (e) => {
        editingTemplate.name = e.target.value.trim() || randomSpaceWord();
        e.target.value = editingTemplate.name;
        saveTemplates();
    });

    renderPhaseBuilder();
}

// ─── PHASE BUILDER ────────────────────────────────────────────────────────────

function randomSpaceWord() {
    const used = (editingTemplate ? editingTemplate.phases : []).map(p => p.name);
    const available = SPACE_WORDS.filter(w => !used.includes(w));
    const pool = available.length > 0 ? available : SPACE_WORDS;
    return pool[Math.floor(Math.random() * pool.length)];
}

function getSplitForPhase(phase, index) {
    const splits = getSplitsForPhase(index);
    return splits[Math.min(phase.splitIndex, splits.length - 1)];
}

function getSplitsForPhase(index) {
    if (!editingTemplate) return SPLITS_STANDARD;
    return getBuilderSplitsForPhase(index, editingTemplate.phases);
}

function clampSplitIndex(phase, splits) {
    if (phase.splitIndex >= splits.length) {
        phase.splitIndex = 1;
    }
}

function revalidateFromIndex(startIndex) {
    if (!editingTemplate) return;
    for (let i = startIndex; i < editingTemplate.phases.length; i++) {
        const splits = getSplitsForPhase(i);
        clampSplitIndex(editingTemplate.phases[i], splits);
    }
}

function createPhase(overrides = {}) {
    return {
        id: Date.now().toString(),
        splitIndex: 1,
        ...overrides
    };
}

function renderPhaseBuilder() {
    const builder = document.querySelector('.phase-builder');
    if (!builder || !editingTemplate) return;
    builder.innerHTML = '';

    editingTemplate.phases.forEach((phase, index) => {
        builder.appendChild(createPhaseRow(phase, index));
    });

    if (editingTemplate.phases.length < 12) {
        const addBtn = document.createElement('button');
        addBtn.className = 'phase-add-btn';
        addBtn.textContent = '+ add phase';
        addBtn.addEventListener('click', addPhase);
        builder.appendChild(addBtn);
    }
}

function createPhaseRow(phase, index) {
    const row = document.createElement('div');
    row.className = 'phase-row';
    row.dataset.id = phase.id;

    const splits = getSplitsForPhase(index);
    clampSplitIndex(phase, splits);

    const split = splits[phase.splitIndex];
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
            const splits = getSplitsForPhase(index);
            const x = e.clientX - barRect.left;
            const pct = x / barRect.width;
            const snapPoints = splits.map(s => s.focus / 60);
            const distances = snapPoints.map(p => Math.abs(pct - p));
            const nearest = distances.indexOf(Math.min(...distances));

            if (phase.splitIndex !== nearest) {
                phase.splitIndex = nearest;
                revalidateFromIndex(index + 1);
                saveTemplates();
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
    editingTemplate.phases.splice(index, 1);
    revalidateFromIndex(index);
    saveTemplates();
    renderPhaseBuilder();
}

function addPhase() {
    editingTemplate.phases.push(createPhase());
    saveTemplates();
    renderPhaseBuilder();

    const builder = document.querySelector('.phase-builder');
    builder.scrollTop = builder.scrollHeight;
}

function setTrayIcon(state) {
    console.log('setTrayIcon called:', state);
    ipcRenderer.send('set-tray-icon', state);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

activeTemplate = getActiveTemplate();
if (activeTemplate) {
    currentPhaseIdx = 0;
    phaseTimeElapsed = 0;
    timeRemaining = getFocusDuration();
}

setTimeout(() => setTrayIcon('idle'), 500);
setShadowClass('shadow-black');
renderScreen('timer');