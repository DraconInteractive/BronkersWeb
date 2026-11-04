# 04 — UI Layout and Visuals

Aesthetic details (exact colours, fonts, pixel sizes, easing) **may** change. The **structure** may not:
regions, what each shows, and the metaphors (felt table, playing cards, sticky-note goal sheet with
pencil circles, gold rings for live controls). Values below are the originals, given as the default.

---

## 1. Stage and scaling

- The game is laid out on a fixed **1280 × 720** stage. The stage is **scaled uniformly** to fit the
  browser viewport (letterboxed, like a WPF `Viewbox Stretch=Uniform`). The page background outside the
  stage uses the same felt colour, so no border shows.
- Web implementation: a 1280×720 absolutely-sized container, centred, with
  `transform: scale(min(vw/1280, vh/720))` recomputed on resize. Text and hit areas scale with it.
- Original window title: "Bronkers". Use it as the page `<title>`.

## 2. Stage grid (top to bottom)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Bronkers                                        Opponent: 13 cards      (?)    │  row 0: auto
├───────────────┬───────────────────────────────────────────────────────────────┤
│ [deck] [disc] │  Goal [ sticky note ▾ ] [Lay down]                            │
│ Deck: 77 left │  [Set slot] [Set slot] [Run slot]          (scrolls vertically)│  row 1: 1.3*
│  Discard pile │  Player 1                                                     │
│               │  [formation] [formation] ...                                  │
├───────────────┴───────────────────────────────────────────────────────────────┤
│                     ╭╮╭╮╭╮╭╮╭╮╭╮╭╮╭╮╭╮╭╮╭╮╭╮╭╮   (fanned hand)                  │  row 2: 1*
├───────────────────────────────────────────────────────────────────────────────┤
│                 Pick up from the deck or discard pile                          │  row 3: auto
│                          [ Finish actions / Discard ]                          │
└───────────────────────────────────────────────────────────────────────────────┘
```
Rows 1 and 2 share the leftover height in a **1.3 : 1** ratio.

### Row 0: header
- Left: **"Bronkers"**, Georgia bold 22, colour OnFelt, margin 24 left / 18 top.
- Right, vertically centred, 64 px from the right edge: **"Opponent: {n} cards"** (Segoe UI 14, OnFelt).
  Every time `n` changes, fade opacity 0.2 → 1 over 0.4 s. This flash is the only cue that the AI drew from
  the deck.
- Far right (24 px margin): **"?" help button**, a 28×28 circle in Note colour, Segoe UI Semibold 15,
  Pencil colour; hover = NoteHover. Tooltip/aria-label "Controls".

### Row 1, left: piles (box 270 px wide, margin 24 left / 8 top, scales DOWN only to fit)
Side by side, 24 px apart:
1. **Deck**: a card back (§4.2) acting as a button, with the label **"Deck: {count} left"** below
   (Segoe UI 13, OnFeltMuted, 8 px gap).
2. **Discard pile**: a button showing the stacked discards, newest on top. When empty, it shows a dashed
   rounded outline the size of a card (OnFeltMuted, 2 px, dash 4/3, radius 10). Label **"Discard pile"**.

Both piles share the **pickup ring** (§6.1).

### Row 1, right: table area
Starts 316 px from the stage's left, 24 px right margin, scrolls vertically when needed. Top to bottom:

**A. Own goal section** (shown only while `players[0].laidDown == 0`)
- One line: label **"Goal"** (Segoe UI 14, OnFelt), the **goal picker** (§7, 190×32), and the **Lay down**
  button (small action button, padding 20×6, font 14, 12 px left margin).
- 10 px below: the current goal's formations in a wrapping row (§8). Nothing shows if no goal is chosen.

**B. Table rows**: one per player, in player order, each shown only once that player has laid down
this round:
- Label **"Player {index}"** with a 0-based index ("Player 0" = human, "Player 1" = AI). Segoe UI 13,
  OnFeltMuted, 8 px below.
- That player's goal formations in a wrapping row (§8).

### Row 2: hand
The human's hand in a **fan** (§5), centred, 16 px side margins, scaled DOWN only if it does not fit.

### Row 3: prompt and action (centred, 24 px side margins, 28 px bottom margin)
1. **Prompt text** (Segoe UI 14, OnFeltMuted, 12 px below). Text rules are in `05` §7.
2. **Status message** (Segoe UI 14, Accent). Hidden when null or empty. Never shown in practice (`08`).
3. One cell holding **Finish actions** and **Discard**, overlapped in the same spot. At most one is visible,
   and the space is reserved even when neither is.

---

## 3. Colour tokens (original values)

| Token | Hex | Used for |
|---|---|---|
| Felt | `#1F5C43` | Stage and page background |
| FeltEdge | `#143D2D` | Disabled action button background |
| OnFelt | `#E9F1EA` | Title, header text, "Goal" label |
| OnFeltMuted | `#A9C4B3` | Labels, prompt, dashed outlines, disabled button text |
| Accent | `#F2C14E` | Action buttons, selection/pickup/slot rings, return button, status text |
| AccentHover | `#F7D27A` | Hover state of the above |
| OnAccent | `#2A2108` | Text/icons on accent |
| CardFace | `#FBF8F1` | Card face, card-back frame |
| CardEdge | `#D6CFC0` | Card border |
| CardBlack | `#1E2329` | Spades, Clubs |
| CardRed | `#C22F35` | Hearts, Diamonds |
| CardBack | `#7A2230` | Card back panel |
| Note | `#FBF1BE` | Sticky note (goal picker, help) |
| NoteHover | `#F6E08C` | Note hover / open |
| NoteSelected | `#F2C14E` | Selected goal cell |
| NoteRule | `#BDAF74` | Goal sheet grid lines |
| Pencil | `#33302A` | Handwriting on notes |
| Help backdrop | `#000000` at 60 % (`#99000000`) | Overlay |

## 4. Typography

| Original font | Role | Web suggestion (self-host, see `06`) |
|---|---|---|
| Georgia (bold) | Title, card ranks, card-back "B" | Georgia, then a serif such as "Gelasio"/"Noto Serif" |
| Segoe UI / Semibold | UI text, buttons | `system-ui`, "Segoe UI", "Noto Sans", sans-serif |
| Segoe UI Symbol | Suit glyphs ♥ ♦ ♠ ♣ | A font with these glyphs, e.g. "DejaVu Sans"/"Noto Sans Symbols 2" |
| Segoe Print | Handwriting on the goal sheet and help note | A handwriting web font, e.g. "Patrick Hand", "Caveat" |

## 4.1 Card face (124 × 176, radius 10, 1 px CardEdge border, CardFace fill)
- Colour: red for Hearts/Diamonds, black for Spades/Clubs.
- Top-left (10 px in, 8 px down): rank (Georgia bold 24) above the suit glyph (16), centred on each other.
- Centre: suit glyph at 54.
- Bottom-right (10 px in, 8 px up): the same rank and suit stack, **rotated 180°**.
- Rank text: 1 → `A`, 11 → `J`, 12 → `Q`, 13 → `K`, otherwise the number (2–10). Suits: ♥ U+2665,
  ♦ U+2666, ♠ U+2660, ♣ U+2663.
- Wild 2s have **no** special marking.
- Soft drop shadow in the hand (blur 8, offset 2 down, 22 % black).

## 4.2 Card back (124 × 176)
CardFace frame (radius 10, CardEdge border, 8 px padding) holding an inner CardBack panel (radius 6) with
a centred **"B"** (Georgia bold 44, CardFace colour, 85 % opacity).

---

## 5. Hand fan (`FanPanel.cs`)

For `n` cards, card `i` (0-based) has `offset = i - (n-1)/2`.
- Rotation: `offset × 1.2°` about the card centre.
- Vertical drop: `0.5 × offset²` px.
- Horizontal: cards overlap, each advancing **46 px** (124 − 78). The last card is fully visible.
- Panel height: `176 + 0.5 × offset(0)²`. The hand has 40 px top padding (room for lift) and 12 px bottom.
- Order on screen = order of `players[0].hand` (the arrow keys reorder it, `05` §3).

Per-card states (independent, additive vertical offsets):
| State | Effect |
|---|---|
| Arrival (card enters the hand) | Opacity 0→1 in 0.2 s, and Y −36→0 in 0.24 s, cubic ease-out. **Once per card arrival**, not on reorder. |
| Hover | Y −8 in 0.12 s (back to 0 on leave) |
| Selected | Y −28 in 0.14 s, plus a 3 px Accent ring (radius 10) over the card |
Cursor: pointer.

## 6. Rings and buttons

### 6.1 Pickup ring (deck and discard pile)
Live (enabled): 3 px Accent ring, radius 10, over the card. Hover/focus: AccentHover, 5 px.
Disabled: no ring, not clickable.

### 6.2 Action buttons (Finish actions, Discard, Lay down)
Accent fill, radius 8, OnAccent text (Segoe UI Semibold 16, padding 36×10; Lay down uses 14 and 20×6).
Hover: AccentHover. Disabled: FeltEdge fill, OnFeltMuted text, default cursor.

### 6.3 Discard landing
A card **newly** added to the discard pile fades in (0.16 s) and scales 1.18 → 1 (0.24 s, cubic ease-out).
Only that card animates. The web build may render just the top one or two cards, as long as it looks the same.

---

## 7. Goal picker ("sticky note")

**Closed (190 × 32):** a Note-coloured tab (radius 3; NoteHover on hover or when open). Inside, 12 px
padding, handwriting font 14, Pencil colour:
- left: the selected goal's `name`, or **"Choose a goal"** if none;
- right: **"+{points}"** of the selected goal (empty if none);
- far right: a small chevron (V, 10×5, 1.5 px pencil stroke, round caps).

**Open:** a dropdown 4 px below, styled as a sticky note (Note fill, radius 2, padding 8/8/7/0, drop shadow
blur 10, offset 3, 40 %). Its content is a **2-column goal sheet** in a 268 px wrap panel, mimicking
`reference/goal_outline.jpeg`:

```
 pts │  goal A   │  goal B
─────┼───────────┼──────────
  1  │   2S      │   3S
  3  │  1S 1R    │   2R
  5  │  2S 1R    │   4S
  8  │  3S 1R    │  1S 2R
 10  │   3R      │  2S 2R
```
- Each row: a **points cell** (44×48) shown only for the first goal of the pair, then two **goal cells**
  (112×48). Cells have right and bottom 1 px NoteRule lines. Handwriting: points 16, names 15.
- Goal cell hover: NoteHover fill. Selected goal: NoteSelected fill.
- **Completed goal**: a hand-drawn pencil ellipse around the name (1.5 px, round caps), and the cell is
  **disabled** (not selectable). Original path, stretched to the cell with 8×4 margin:
  `M8,30 C2,10 40,0 70,2 C100,4 118,16 116,30 C114,46 80,54 50,52 C20,50 2,38 10,22 C12,18 18,14 26,10`
- Selecting a cell sets the goal and closes the dropdown. Clicking outside closes it.

## 8. Formation display (goal slots and table rows)

A formation is drawn as **half-size cards** (62 × 88 visual) overlapping so 26 px of each shows and the
last is whole, followed by a **dotted slot button**. A **return button** can sit below it.

- **Empty formation**: only the dotted slot, 62×88, radius 6, 2 px OnFeltMuted dashes (4/3), with the
  centred text **"Set\n3+ cards"** or **"Run\n4+ cards"** (Segoe UI 12, OnFeltMuted). Right margin 20.
- **Filled formation**: the cards, about 6 px gap, then a small dotted slot 36×52 with a **"+"**
  (Segoe UI 20). Right margin 36.
- The slot gets a **2 px Accent ring** (radius 6, 3 px outside) when enabled. Hover/focus: AccentHover, 3 px.
- Formation cards are selectable only when the slot is enabled. Selected: a gold ring (5 px at full
  scale, about 2.5 px visual) and lifted 12 px full scale (about 6 px visual). No hover lift, no arrival animation.
- **Return button** (own goal section only, `05` §4.4): 44×24, radius 6, Accent fill (AccentHover on
  hover), a down-arrow icon in OnAccent (path `M6,1 V12 M1,7.5 L6,12.5 L11,7.5`, 2 px, round),
  centred 5 px below the formation. Tooltip "Return to hand". Aria label "Return selected cards to hand".
  In the own goal section, the button's space is **always reserved** even when hidden, so slots don't jump.
- Formations wrap onto new lines when the row is full (2 px bottom margin each).

## 9. Help overlay

- The "?" button toggles it. It covers the **entire viewport** with a 60 % black backdrop that **blocks
  all game input**. Clicking the backdrop or the ✕ button closes it.
- Centred note, 600 px wide (on the scaled stage), Note fill, radius 2, padding 28/20/28/16, shadow
  (blur 16, offset 4, 45 %).
- Header: **"Controls"** (handwriting 22, Pencil), with a ✕ round button (28×28 note style, font 12)
  on the right. Aria label "Close controls".
- A two-column table. Action column is Segoe UI Semibold 14, 20 px gap. Detail column is Segoe UI 14, wraps.
  10 px between rows. Exact text:

| Action | Detail |
|---|---|
| Pick up | Click the deck or the discard pile. |
| Select cards | Click cards in your hand. The arrow keys move selected cards. |
| Choose a goal | Click the yellow note. |
| Place cards | Select cards, then click a dotted slot. |
| Take cards back | Click cards in a slot, then the gold arrow. |
| Lay down | Click Lay down when every slot is filled. |
| Add cards | Select cards, then click the + beside a set or run. |
| End your turn | Click Finish actions, select a card, then click Discard. |

## 10. Game over overlay (WEB ADDITION, `02` §7.5)

Built like the help overlay (§9), so it matches the existing design:
- A full-viewport 60 % black backdrop that blocks all input. Unlike help, **clicking the backdrop does
  nothing**, and there is no ✕.
- A centred sticky note (Note fill, radius 2, same shadow as help), about 420 px wide on the scaled stage,
  with centred content:
  - Title **"Game over"** (handwriting 22, Pencil).
  - One line (Segoe UI 14, Pencil) from `finishers`:
    - `[0]` → "You completed every goal."
    - `[1]` → "Your opponent completed every goal."
    - `[0, 1]` → "You and your opponent both completed every goal."
  - A **New game** action button (§6.2 style), 16 px below. Aria label "New game".
- The game table stays rendered, frozen, underneath.
- Shown while `gameOver` is true. It sits above the help overlay. If help is open when the game ends,
  close help.

## 11. Accessibility labels (keep as aria-labels)
Deck: "Pick up from deck". Discard pile: "Pick up from discard pile". Goal picker: "Goal". Slot buttons:
the slot text ("Set\n3+ cards" / "Run\n4+ cards"). Help: "Controls". Close: "Close controls".
Return: "Return selected cards to hand".
