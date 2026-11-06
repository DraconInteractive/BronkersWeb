# Approved web adaptations

The user approved browser-based play on iOS, Android, and Windows, including
responsive layouts and touch equivalents for keyboard controls. These are UI
additions; formation validation, turn timing, and goal progression retain
the original behavior.

- **Desktop:** the 1280×720 table scales uniformly to fit the viewport. The felt
  background, left piles, right table, bottom fan, sticky-note goal sheet and
  prompt/action area follow the original layout.
- **Smaller screens:** the game fits the live viewport, including browser toolbar
  changes and safe-area padding. Portrait places the piles above the goals; short
  landscape screens place them beside the table. Hand cards overlap slightly in compact rows,
  with one row on short screens and up to two on taller screens. When the hand
  cannot fit at a readable size, explicit previous/next page buttons make every
  card reachable. The game page and hand do not scroll. Player tabs show one
  table view at a time on phones, and formation spacing adapts to its available
  width. Desktop still shows every laid-down player row together.
- **Touch reordering:** tap a card to select it, or drag it to reorder the hand.
  Mouse and pen use the same gesture. A small movement threshold distinguishes
  taps from drags, and dragging preserves the current selection. The move-arrow
  toolbar is removed. Keyboard arrows still move selected cards as a group.
  Dropping outside the hand, pressing Escape, or a canceled pointer restores the
  original position. On paged hands, holding over a page button for half a second
  changes pages during the drag. Reordering never places or discards a card.
- **Help:** includes touch controls, hand paging, table views and a brief explanation of sets, runs
  and wilds. The arrow keys still work while help is open, as in the original.
- **Accessibility:** named buttons, pressed selection states, visible focus,
  modal focus handling and a live turn prompt supplement the original controls.
  Reduced-motion CSS minimizes arrival and selection transitions.
- **Opponent count (approved 2026-11-06):** the header shows "Opponent: 13 cards"
  throughout the opponent's uncommitted goal, including pickup, shelving and
  discard. It does not flash on concealed changes. Committing to laydown reveals
  the actual hand count, which then updates normally. Each new round resets the
  header to 13. This changes only the header presentation; the AI still uses its
  actual hand internally, and round results still report actual cards remaining.
- **Blocked opponent adds:** clicking or tapping an opponent's formation or its
  + before laying down explains: "Lay down your goal before adding cards to your
  opponent's formations." The explanation replaces the normal prompt in gold,
  keeping the mobile layout compact. Selected cards and table contents stay
  untouched. Locked adds remain unavailable (`aria-disabled`) but can explain
  their restriction; keyboard users can focus the + and press Enter for the hint.
  The hint clears on laydown, goal changes, working on own formations, pickup,
  finishing actions, turn changes or a new round. Other invalid moves retain their
  existing behavior.
- **Round results (approved 2026-11-05):** every round end opens a confirmation
  screen naming the player who went out and showing each player's laydown status,
  laid-down goal and cards remaining. Results use a snapshot of the finished round.
  The table is frozen underneath; no pickup, goal changes, selection, reordering
  or AI actions can occur. Next round deals only after confirmation. Completed
  goals persist. Help closes when results open, and the confirmation button takes
  focus. Backdrop clicks and Escape do not dismiss results.
- **Game over:** when any player has completed all goals, the final round results
  appear first. Continue opens the game-over screen instead of dealing another
  round; New game then starts a fresh session.

There is no score tally, persistence, multiplayer service, or account system.
Refreshing the browser starts a new session, matching the specified default.

Automated coverage uses desktop Chromium and Firefox and mobile Chromium.
Playwright WebKit binaries are downloaded but cannot run until the host's
missing WebKit libraries are supplied. Real iOS Safari, Android and Windows
device testing remains part of manual acceptance testing.

Mobile regression tests cover 320×480 through 428×926 portrait viewports and
667×375 through 932×430 landscape viewports. They check actual card and slot
bounds, page through the complete hand, and assert that game regions do not
overflow; merely hiding scrollbars does not satisfy these checks. Help notes may
scroll when needed to keep their text readable.

### Suit readability (2026-11-06)

Cards use fixed SVG suit silhouettes across devices, with round club lobes and a
pointed spade. Corner pips are larger, especially on phones; compact centre pips
leave room for the corners. Traditional red/black colours and card overlap remain.

Suit placement follows the card's role across all orientations: hand cards show
only the top-left corner, including drag previews; discard cards show both corners
and the centre pip; formation cards show both corners without a centre pip.

### Adaptive opponent goals (2026-11-06)

Before pickup and after drawing, the AI reassesses unfinished goals against its
hand and private formations, weighting reward points by estimated missing cards.
All goals use `points^1.5 / (missingCards + 1)^2` without an immediate-completion
bonus or priority. It can change goals and reallocate shelved cards, and locks
the chosen goal once laid down. Search is bounded for phone performance
and never reuses one card across multiple formations. See `03` §0 for scoring,
limits, and tie-breaks. Reward points guide decisions but do not introduce a score
total or change game-winning rules.
