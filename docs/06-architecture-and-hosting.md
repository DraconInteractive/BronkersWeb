# 06 — Architecture and Hosting (recommendation)

This is a recommendation, not part of the parity contract. Change it if you like. Keep the **engine/UI
split**, because that is what makes the 1-to-1 logic testable.

## 1. Shape of the app

- **Fully client-side, single page.** The original is one human against a local AI, with no network,
  accounts or persistence. The server only serves static files.
- No backend, no database, no API. (If multiplayer or saved games come later, add them then.)
- No persistence between page loads. The WPF app kept nothing between launches either: a reload equals a
  relaunch, with fresh goal sheets.

## 2. Stack

| Concern | Recommendation | Why |
|---|---|---|
| Language | TypeScript (strict) | Mirrors C#'s types, and makes the parity rules (identity, nullability) explicit |
| UI | Plain DOM + a tiny reactive store, or a light framework (Preact/Svelte/Lit) | The UI is small, and a heavy framework adds nothing |
| Build | Vite → static `dist/` | Simple, and the output is plain files |
| Tests | Vitest | Runs `07-parity-test-cases.md` against the engine with no DOM |
| Fonts | Self-hosted `.woff2` in `dist/` | No dependency on a third-party CDN from the server |

Build on a development machine (or CI) and copy `dist/` to the server. antiX is often installed on old
or 32-bit hardware where current Node.js builds may be unavailable. The server never needs Node.

## 3. Module layout

Mirror the original file-for-file so each piece can be checked against its source:

```
src/
  engine/                  # pure logic, no DOM, no timers (except ai.ts delays via injected scheduler)
    rng.ts                 # injectable RNG (default Math.random; seeded variant for tests)
    card.ts                # Card.cs
    deck.ts                # Deck.cs
    formation.ts           # GoalConfiguration.cs: Formation, Set, Run, inRunOrder
    goal.ts                # GoalConfiguration.cs: GoalConfiguration + the 10-goal sheet
    player.ts              # Player.cs + Hand.cs
    game.ts                # MainWindow.xaml.cs: state, setupRound, actions, tryEndRound, nextPlayer
    ai.ts                  # MainWindow.xaml.cs: processAITurn, getCardScores, tryGetFormation
    events.ts              # change notifications (replaces INotifyPropertyChanged/ObservableCollection)
  ui/
    stage.ts               # 1280×720 scaled stage
    header.ts, piles.ts, table.ts, goalPicker.ts, hand.ts, prompt.ts, help.ts
    selection.ts           # hand/formation selection model (05 §2)
    keyboard.ts            # arrow-key reorder (05 §3)
  main.ts
tests/
  parity/*.test.ts         # from docs/07
```

### Engine rules
- The engine owns **all** state and exposes the actions from `02` §8 and `03`. The UI calls actions and
  re-renders from state, and never mutates state directly. Hand reordering is also a state change (the order of
  `players[0].hand`), so put it on the engine as `moveHandCards(selected, step)`.
- Emit a change event after every mutation. The AI must yield to the renderer between steps (`05` §5).
- The AI's `delay(800)` goes through an injected scheduler so tests can run instantly.
- Guard against stale AI continuations. `processAITurn` captures `player` and keeps running after awaits,
  just like the original `async void`. Don't add cancellation that changes behaviour. Do make sure a page
  teardown doesn't throw.
- Use a unique `id` per card for DOM keys, so reorders don't re-create elements (arrival animation must
  run once per arrival).

## 4. Hosting on antiX Linux

antiX is Debian-based and **does not use systemd**. It ships sysVinit or runit. Use `service …` /
`/etc/init.d/…` (sysVinit) or `sv …` (runit) rather than `systemctl`.

### Option A: nginx (recommended)
```sh
sudo apt-get update
sudo apt-get install nginx
sudo mkdir -p /var/www/bronkers
# copy the built dist/ contents to /var/www/bronkers (e.g. rsync -av dist/ user@server:/var/www/bronkers/)
```
`/etc/nginx/sites-available/bronkers`:
```nginx
server {
    listen 80;
    server_name _;                 # or your hostname
    root /var/www/bronkers;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # hashed build assets can be cached for a long time
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    types { font/woff2 woff2; }
    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
```
```sh
sudo ln -s /etc/nginx/sites-available/bronkers /etc/nginx/sites-enabled/bronkers
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo service nginx restart          # sysVinit;  runit: sudo sv restart nginx
```
Make sure nginx starts at boot. sysVinit: `sudo update-rc.d nginx defaults`. runit: link the service
into the runsvdir in use, for example `/etc/service/` (check your antiX's runit layout).

### Option B: lighter servers
For very low-spec machines, `lighttpd` or `busybox httpd -p 80 -h /var/www/bronkers` work just as well.
The app is static files only.

### HTTPS
For exposure beyond a LAN, add TLS (for example certbot with the nginx plugin, or a reverse proxy in
front). The game needs no secure-context APIs, so plain HTTP works on a LAN.

## 5. Browser support
Target current evergreen browsers (Chromium, Firefox, Safari). Required features: ES2020, CSS transforms,
`Map` insertion order, stable `Array.sort`, `Math.fround`, all universally available.
The layout is landscape-first (fixed 16:9 stage). On portrait phones it will letterbox. That is
acceptable for parity with the original.
