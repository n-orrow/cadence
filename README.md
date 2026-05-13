# Cadence

> Work in rhythm, not willpower.

Cadence is a structured focus timer for Windows. It lives as a slim bar at the top of your screen, out of the way until you need it. Built around the idea that great work comes from consistent rhythm, it gives you fine-grained control over your working phases without getting in your face.

It is loosely inspired by the Pomodoro technique, but built for people who find standard Pomodoro timers too rigid or too simple.

---

## Features

- **Structured phases** — every phase is one hour, split into focus and break. Choose from three splits: 40/20, 45/15, or 50/10.
- **Workday mode** — stack up to 12 phases into a named workday and run them sequentially.
- **Workday templates** — save up to two templates and assign them to days of the week.
- **Meeting mode** — toggle Cadence into a silent, non-interrupting state when you get pulled into a call. It keeps running in the background and picks up when you come back.
- **@todo list** — a lightweight task list that travels with your workday. Incomplete items carry over to the next day.
- **Distraction tally** — a single button (or hotkey) to count interruptions per phase. Feeds into your end-of-day summary.
- **Autolock** — optionally lock your Windows workstation when a break starts. No cheating.
- **Teams status** — optionally set a Microsoft Teams status at the start of any focus phase.
- **Performance calendar** — a GitHub-style heatmap of your focus history.
- **Streaks and milestones** — track consecutive days and cumulative focus phases.

---

## Installation

Downloads available on the [Releases](../../releases) page. Grab the latest `.exe` installer and run it.

Cadence is Windows only.

---

## Building from source

You will need [Node.js](https://nodejs.org) (LTS recommended).

```bash
git clone https://github.com/YOUR_USERNAME/cadence.git
cd cadence
npm install
npm start
```

To package as an installer:

```bash
npm run build
```

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
