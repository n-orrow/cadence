const { ipcRenderer } = require('electron');
const Store = require('electron-store');

const store = new Store();

// ─── ELEMENT REFERENCES ───────────────────────────────────────────────────────

const phaseLabel     = document.querySelector('.phase-label');
const timerDisplay   = document.querySelector('.timer');
const controls       = document.querySelector('.controls');
const graceContainer = document.querySelector('.grace-container');
const phaseIndicator = document.querySelector('.phase-indicator');

// ─── STATE ────────────────────────────────────────────────────────────────────

let currentState = null;

// ─── FORMATTING ───────────────────────────────────────────────────────────────

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────

function send(command) {
    ipcRenderer.send('sidebar-command', command);
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderSidebar(state) {
    currentState = state;

    const { timeRemaining, graceRemaining, isRunning, isBreak, isGrace,
        isPaused, hasExtended, isConfirmingSkip, currentPhaseIdx,
        phaseTimeElapsed, activeTemplateId } = state;

    const templates      = store.get('templates', []);
    const activeTemplate = activeTemplateId ? templates.find(t => t.id === activeTemplateId) : null;

    // hide grace container unless confirming skip
    graceContainer.innerHTML = '';

    if (isConfirmingSkip) {
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
        document.querySelector('.btn-take-break').addEventListener('click', () => send('startBreak'));
        document.querySelector('.btn-confirm-skip').addEventListener('click', () => send('skip'));
        return;
    }

    // phase label
    phaseLabel.textContent = isGrace ? 'WRAP UP' : isBreak ? 'BREAK' : 'FOCUS';
    phaseLabel.style.color = isGrace ? 'var(--accent-amber)' : isBreak ? 'var(--accent-break)' : 'var(--accent-focus)';

    // timer
    timerDisplay.textContent = isGrace ? formatTime(graceRemaining) : formatTime(timeRemaining);

    // controls
    if (isGrace) {
        controls.innerHTML = `
            <button class="btn-extend" ${hasExtended ? 'disabled' : ''}>+5 min</button>
            <button class="btn-start-break">Start</button>
            <button class="btn-skip">Skip</button>
        `;
        if (!hasExtended) {
            document.querySelector('.btn-extend').addEventListener('click', () => send('extend'));
        }
        document.querySelector('.btn-start-break').addEventListener('click', () => send('startBreak'));
        document.querySelector('.btn-skip').addEventListener('click', () => send('skipConfirm'));
    } else {
        const label = isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start';
        controls.innerHTML = `<button class="btn-start ${isBreak ? 'break' : ''}">${label}</button>`;
        document.querySelector('.btn-start').addEventListener('click', () => {
            if (isRunning) send('pause');
            else send('start');
        });
    }

    // phase indicator
    if (activeTemplate && phaseIndicator) {
        phaseIndicator.innerHTML     = '';
        phaseIndicator.style.display = 'flex';

        activeTemplate.phases.forEach((phase, index) => {
            const div = document.createElement('div');
            div.className = 'phase';

            if (index < currentPhaseIdx) {
                div.classList.add('completed');
            } else if (index === currentPhaseIdx) {
                const SPLITS_STANDARD = [
                    { focus: 40, break: 20 },
                    { focus: 45, break: 15 },
                    { focus: 50, break: 10 },
                    { focus: 60, break: 0  },
                ];
                const split        = SPLITS_STANDARD[Math.min(phase.splitIndex, SPLITS_STANDARD.length - 1)];
                const totalSeconds = (split.focus + split.break) * 60;
                const progress     = Math.min((phaseTimeElapsed / totalSeconds) * 100, 100);
                div.style.setProperty('--phase-progress', `${progress}%`);
                div.classList.add(isBreak || isGrace ? 'break' : 'focus');
            }

            phaseIndicator.appendChild(div);
        });
    } else if (phaseIndicator) {
        phaseIndicator.style.display = 'none';
    }
}

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcRenderer.on('timer-state', (event, state) => {
    renderSidebar(state);
});

// also handle the skip confirm command back from main
ipcRenderer.on('sidebar-command', (event, command) => {
    // not needed in sidebar - commands go the other way
});