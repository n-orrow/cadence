> ⚠️ **Early development.** Cadence is functional but incomplete. See the roadmap below for what's built and what's coming.

# Cadence

> Work in rhythm, not willpower.

Cadence is a structured focus timer for Windows. Built around the idea that great work comes from consistent rhythm, it gives you fine-grained control over your working phases without getting in your face.

It is loosely inspired by the Pomodoro technique, but built for people who find standard Pomodoro timers too rigid or too simple.

---

## Releases

### v1.0-beta.1 - current

The core timer and workday template system.

- **Structured phases** - every phase is one hour, split into focus and break. Four splits available: 40/20, 45/15, 50/10, or 60/0 (full hour focus).
- **Context-aware splits** - phases following a 60/0 block unlock additional options including 0/60 and 30/30, subject to position rules that stop you rewarding yourself with a two-hour lunch on day one.
- **Grace period** - a 30-second wrap-up window at the end of every focus segment, with options to extend by 5 minutes, start the break immediately, or skip the break entirely (with a gentle nudge to reconsider).
- **Workday templates** - build named workday templates of up to 12 phases. Assign templates to days of the week. Templates persist between sessions.
- **Phase indicator** - a progress bar along the bottom of the window showing all phases in the current workday, with live progress on the active phase.
- **End of workday** - summary screen when all phases complete, with the option to add more phases or finish.
- **Pause and resume** - pause at any point during focus or break, resume from where you left off.
- **Session persistence** - window position remembered between sessions.
- **System tray** - lives in the tray when not in use. Left-click to show or hide. Right-click for settings and quit.

---

### v1.1 - planned

Quality of life and distraction tracking.

- **Distraction tally** - a button and configurable hotkey to count interruptions per phase. Hidden when count is zero. Feeds into end-of-day stats.
- **Soft start and wind-down** - subtle inset shadow colour shifts at the start and end of each focus segment to signal transitions without interrupting flow.
- **Tray icon state** - tray icon changes colour to reflect current state (focus, break, wrap up, idle).
- **Audio cues** - distinct sounds at the end of focus and break. Individually toggleable.
- **Autolock** - optionally lock the Windows workstation when a break begins. Off by default.
- **Session resume** - on relaunch within 30 minutes, prompt to resume from time remaining or continue from the next phase.

---

### v1.2 - planned

Stats, history, and the @todo list.

- **@todo list** - a lightweight plain-text task list. Tick items off during the day. Incomplete items carry over to the next day, completed items are discarded.
- **Daily stats** - phases completed, total focus time, and distraction tally per day.
- **Streaks and milestones** - consecutive days with at least one completed phase, and cumulative phase count milestones with small in-app celebrations.
- **Performance calendar** - a GitHub-style heatmap of daily focus history, colour-coded by total focus time or phases completed.
- **End of day wind-down** - the last 10 minutes of the final phase prompts a review of the @todo list and the option to carry items forward.

---

### v1.3 - planned

Meeting mode and integrations.

- **Meeting mode** - toggle via hotkey or button. Timer runs silently through phases and breaks, all prompts and notifications suppressed. On exit, option to skip to the next break or restart the current break if one was missed.
- **Teams status** - optionally set a Microsoft Teams status at the start of any focus phase. Entirely per-phase and opt-in, requires one-time Microsoft OAuth setup.

---

### Future

Under consideration, no committed timeline.

- **Persistent overlay mode** - an always-on-top mini window that shrinks to just the timer when unfocused, snapping to configurable screen positions.
- **Sidebar mode** - a docked sidebar that reserves screen real estate and integrates with Windows snap behaviour, combining the timer and @todo list in one persistent panel.
- **Packaged installer** - a proper `.exe` installer via electron-builder once the feature set is stable enough to warrant it.

---

## Running from source

You will need [Node.js](https://nodejs.org) (LTS recommended).

```bash
git clone https://github.com/n-orrow/cadence.git
cd cadence
npm install
npm start
```

There is no packaged installer yet. The releases page contains tagged source snapshots only.

---

## Tech stack

- [Electron](https://www.electronjs.org/)
- HTML / CSS / JavaScript
- [electron-builder](https://www.electron.build/) for packaging
- [electron-store](https://github.com/sindresorhus/electron-store) for local persistence

---

## Contributing

Contributions are welcome. Open an issue first if you want to discuss a change before putting in the work.

---

## License

[MIT](LICENSE)
