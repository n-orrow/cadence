# Cadence - Outstanding Tasks

## Assets
- [ ] Create final logo asset (rainbow waveform, as per concept sheet)
- [ ] Create state-specific tray icons:
  - [ ] Focus (red)
  - [ ] Break (green)
  - [ ] Wrap Up (amber)
  - [ ] Idle / not running (rainbow - default icon)
- [ ] Replace placeholder tray icon with final asset

---

## Timer
- [ ] Wire up tray icon switching based on current state (IPC from renderer to main)
- [ ] Soft start indicator - visual flag on timer for first 5 minutes of focus
- [ ] Wind-down indicator - visual flag on timer for last 5 minutes of focus
- [ ] Notifications - distinct audio cue at end of focus, end of break
- [ ] Pause during break

---

## Workday Mode
- [ ] Phase configuration UI (name, split selector, 4th phase rule)
- [ ] Phase stacking (up to 12 phases)
- [ ] Workday sequencing - auto-advance through phases
- [ ] Forced break phase after 60-min focus 4th phase
- [ ] Phase progress indicator - show where you are in the workday
- [ ] End of workday summary screen
- [ ] "Add more phases" option after workday completes
- [ ] Wind-down mode for last 10 minutes of final phase

---

## Workday Templates
- [ ] Save up to 2 named templates
- [ ] Assign templates to days of the week (mutually exclusive)
- [ ] Auto-load template on startup based on current day

---

## Meeting Mode
- [ ] Toggle via hotkey
- [ ] Toggle button visible on hover (to be designed once overlay approach is decided)
- [ ] Timer runs silently through phases and breaks
- [ ] All prompts, notifications, autolock and Teams updates suppressed
- [ ] On exit during focus: prompt to skip to next break
- [ ] On exit during break: restart break from zero automatically

---

## @todo List
- [ ] UI - plain text inputs, one item per line
- [ ] Tick off items during the day
- [ ] End of workday prompt to carry over incomplete items
- [ ] Persistence - carried over items saved for next day, completed items discarded

---

## Distraction Tally
- [ ] Button in panel
- [ ] Configurable hotkey
- [ ] Hidden when count is zero
- [ ] Per-phase tracking
- [ ] Feeds into end of day summary and stats

---

## Autolock
- [ ] Setting to enable/disable (off by default)
- [ ] Lock Windows workstation at start of break (`rundll32.exe user32.dll,LockWorkStation`)
- [ ] Suppressed during meeting mode

---

## Teams Integration
- [ ] One-time Microsoft OAuth setup in settings
- [ ] Per-phase Teams status selector (optional, no default)
- [ ] Set status at focus start
- [ ] Optionally clear status at break start
- [ ] Suppressed during meeting mode

---

## Stats and Persistence
- [ ] Daily stats - phases completed, total focus time, distraction tally
- [ ] Streak tracking - consecutive days with at least one completed phase
- [ ] Milestones - cumulative phase count with in-app celebration moments
- [ ] Session resume logic:
  - [ ] Gap < 30 mins: prompt to resume from time remaining or original start time
  - [ ] Gap > 30 mins: prompt to continue from next phase or start fresh

---

## Performance Calendar
- [ ] GitHub-style heatmap of daily focus history
- [ ] Colour coded by total focus time or phases completed
- [ ] Accessible from system tray menu

---

## Settings
- [ ] Resume mode preference (time remaining vs original start time)
- [ ] Autolock toggle
- [ ] Sound settings - enable/disable cues individually
- [ ] Teams OAuth setup
- [ ] Hotkey configuration (distraction tally, meeting mode)
- [ ] Accessible via system tray right-click

---

## General / Polish
- [ ] Turn off DEV_MODE before any release
- [ ] App launches to tray, does not grab focus on startup
- [ ] electron-builder packaging - produce .exe installer
- [ ] Test session persistence across restarts
- [ ] Window position persistence (done)
- [ ] Hide to tray on close (done)
