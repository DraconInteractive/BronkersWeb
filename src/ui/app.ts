import { Card, suitSymbols } from '../engine/card';
import { Game, Phase, LAY_DOWN_FIRST_MESSAGE } from '../engine/game';
import type { Formation } from '../engine/formation';
import { HandDrag } from './handDrag';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
}
function button(label: string, className: string, action: () => void) {
  const el = element('button',className,label); el.type = 'button'; el.addEventListener('click',action); return el;
}
function cardFace(card: Card) {
  const face = element('span',`card-face ${card.suit < 2 ? 'red' : 'black'}`);
  for (const position of ['corner top','corner bottom']) {
    const corner = element('span',position);
    corner.append(element('span','rank',card.label),element('span','suit',suitSymbols[card.suit])); face.append(corner);
  }
  face.append(element('span','center-suit',suitSymbols[card.suit]));
  return face;
}
export function mountApp(root: HTMLElement, game: Game) {
  root.innerHTML = `
  <main class="stage" aria-label="Bronkers card table">
    <header class="header"><h1>Bronkers<span class="title-dot">.</span></h1><div class="header-right"><span class="opponent">Opponent: 13 cards</span><button class="help-button" aria-label="Controls" title="Controls">?</button></div></header>
    <section class="play-area" aria-label="Playing table">
      <div class="piles"><div class="pile"><button class="deck pile-card" aria-label="Pick up from deck"><span class="card-back"><span>B</span></span></button><span class="deck-label">Deck: 77 left</span></div><div class="pile"><button class="discard pile-card" aria-label="Pick up from discard pile"></button><span>Discard pile</span></div></div>
      <div class="table-area"><nav class="table-tabs" aria-label="Table view" hidden></nav><section class="own-goal"><div class="goal-heading"><span class="goal-label">Goal</span><div class="picker-wrap"><button class="goal-picker" aria-label="Goal" aria-expanded="false"><span class="goal-name">Choose a goal</span><span class="goal-points"></span><span class="chevron">⌄</span></button><div class="goal-sheet" hidden></div></div><button class="action lay-down">Lay down</button></div><div class="own-formations formations"></div></section><div class="table-rows"></div></div>
    </section>
    <section class="hand-area" aria-label="Your hand"><div class="hand-scroll"><div class="hand"></div></div><div class="hand-pagination" aria-label="Hand pages" hidden><button class="hand-previous" aria-label="Previous hand page">‹</button><span class="hand-page" aria-live="polite"></span><button class="hand-next" aria-label="Next hand page">›</button></div></section>
    <footer class="footer"><p class="prompt" role="status" aria-live="polite"></p><div class="action-space"><button class="action finish">Finish actions</button><button class="action discard-action">Discard</button></div></footer>
  </main>
  <div class="overlay help-overlay" hidden><section class="note help-note" role="dialog" aria-modal="true" aria-labelledby="help-title"><header><h2 id="help-title">Controls</h2><button class="close-help" aria-label="Close controls">×</button></header><p class="rules-intro">Build your goal with sets and runs, lay it down, then empty your hand. Every 2 is wild.</p><dl></dl><div class="rules-footnote">A set is 3+ cards of one rank. A run is 4+ consecutive cards of one suit. Aces can be low or high.</div></section></div>
  <div class="overlay round-overlay" hidden><section class="note round-note" role="dialog" aria-modal="true" aria-labelledby="round-title"><span class="finish-mark">♣</span><h2 id="round-title">Round complete</h2><p class="round-winner"></p><table class="round-results"><thead><tr><th scope="col">Player</th><th scope="col">Laid down</th><th scope="col">Cards left</th></tr></thead><tbody></tbody></table><button class="action next-round">Next round</button></section></div>
  <div class="overlay gameover-overlay" hidden><section class="note gameover-note" role="dialog" aria-modal="true" aria-labelledby="gameover-title"><span class="finish-mark">♣</span><h2 id="gameover-title">Game over</h2><p class="finisher"></p><button class="action new-game">New game</button></section></div>`;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const stage = $('.stage');
  const help = $('.help-overlay');
  const gameover = $('.gameover-overlay');
  const roundOverlay = $('.round-overlay');
  const picker = $<HTMLButtonElement>('.goal-picker');
  const sheet = $('.goal-sheet');
  const hand = $('.hand');
  const handNodes = new Map<Card,HTMLButtonElement>();
  let helpOpen = false; let pickerOpen = false;
  let handPage = 0;
  let handPageSize = Infinity;
  let tableView: 'own' | number = 'own';
  let oldOpponentCount = -1; let oldDiscard: Card | undefined;
  const handDrag = new HandDrag({
    hand, game, node: card => handNodes.get(card), face: cardFace,
    page: () => handPage,
    setPage: page => { handPage = page; layoutHand(); layoutTable(); },
    pageButton: step => $<HTMLButtonElement>(step < 0 ? '.hand-previous' : '.hand-next'),
  });
  const helpButton = $<HTMLButtonElement>('.help-button');
  function showHelp(open: boolean) {
    if (open && game.paused) return;
    if (open) handDrag.cancel();
    helpOpen = open; help.hidden = !open;
    if (open) { pickerOpen = false; sheet.hidden = true; picker.setAttribute('aria-expanded','false'); $('.close-help').focus(); }
    else helpButton.focus();
    stage.inert = open || game.paused;
  }
  helpButton.onclick = () => showHelp(!helpOpen);
  $('.close-help').onclick = () => showHelp(false);
  help.onclick = event => { if (event.target === help) showHelp(false); };
  const instructions = [
    ['Pick up','Click the deck or the discard pile.'],
    ['Select cards','Click cards in your hand. The arrow keys move selected cards.'],
    ['Choose a goal','Click the yellow note.'],
    ['Place cards','Select cards, then click a dotted slot.'],
    ['Take cards back','Click cards in a slot, then the gold arrow.'],
    ['Lay down','Click Lay down when every slot is filled.'],
    ['Add cards','Select cards, then click the + beside a set or run.'],
    ['End your turn','Click Finish actions, select a card, then click Discard.'],
    ['Reorder cards','Drag a card to its new position. Tapping selects cards; dragging keeps your selection. Arrow keys also move selected cards.'],
    ['Hand pages','Use ‹ / › if your hand spans multiple pages. While dragging, hold over a page button to switch pages.'],
    ['Round results','See who laid down and who went out, then confirm to continue.'],
    ['Table views','On small screens, tap Your goal or a player tab to switch table views.'],
  ];
  for (const [action,detail] of instructions) $('.help-note dl').append(element('dt','',action),element('dd','',detail));
  $('.deck').onclick = () => game.humanPickup();
  $('.discard').onclick = () => game.humanPickup(true);
  $('.finish').onclick = () => game.humanFinish();
  $('.discard-action').onclick = () => game.humanDiscard();
  $('.lay-down').onclick = () => game.humanLayDown();
  function moveSelected(step: -1 | 1) {
    game.moveHandCards(step);
    if (!root.classList.contains('desktop') && game.selectedHand.length) {
      handPage = Math.floor(game.human.hand.indexOf(game.selectedHand[0]) / handPageSize);
      layoutHand();
    }
  }
  $('.hand-previous').onclick = () => { handPage--; layoutHand(); };
  $('.hand-next').onclick = () => { handPage++; layoutHand(); };
  $('.next-round').onclick = () => { handPage = 0; game.confirmRound(); if (!game.gameOver) picker.focus(); };
  $('.new-game').onclick = () => { game.newGame(); picker.focus(); };
  picker.onclick = () => { pickerOpen = !pickerOpen; sheet.hidden = !pickerOpen; picker.setAttribute('aria-expanded',String(pickerOpen)); positionGoalSheet(); };
  const outsideClick = (event: MouseEvent) => {
    if (!(event.target instanceof Node) || $('.picker-wrap').contains(event.target)) return;
    pickerOpen = false; sheet.hidden = true; picker.setAttribute('aria-expanded','false');
  };
  document.addEventListener('click',outsideClick);
  document.addEventListener('pointerdown',outsideClick);
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && handDrag.dragging) { event.preventDefault(); handDrag.cancel(); return; }
    if (game.paused) { if (event.key === 'Tab') { event.preventDefault(); $(game.roundResult ? '.next-round' : '.new-game').focus(); } return; }
    if (event.key === 'Escape') { if (helpOpen) showHelp(false); else { pickerOpen = false; sheet.hidden = true; picker.setAttribute('aria-expanded','false'); } }
    if (helpOpen && event.key === 'Tab') { event.preventDefault(); $('.close-help').focus(); }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && game.selectedHand.length) {
      event.preventDefault(); if (!handDrag.dragging) moveSelected(event.key === 'ArrowLeft' ? -1 : 1);
    }
  };
  window.addEventListener('keydown',keydown);
  function positionGoalSheet() {
    if (root.classList.contains('desktop')) {
      sheet.style.left = ''; sheet.style.top = ''; return;
    }
    const anchor = picker.getBoundingClientRect();
    const width = 256;
    const height = Math.min(260, (window.visualViewport?.height ?? innerHeight) - 16);
    sheet.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth-width-8))}px`;
    sheet.style.top = `${Math.max(8, Math.min(anchor.bottom+4, (window.visualViewport?.height ?? innerHeight)-height-8))}px`;
  }
  function scaleStage() {
    handDrag.cancel();
    const height = window.visualViewport?.scale === 1 ? window.visualViewport.height : innerHeight;
    const desktop = innerWidth > 900 && height > 540;
    root.classList.toggle('desktop',desktop);
    root.style.setProperty('--viewport-height',`${height}px`);
    stage.style.transform = desktop ? `scale(${Math.min(innerWidth/1280,height/720)})` : '';
    layoutHand(); layoutTable(); positionGoalSheet();
  }
  function layoutHand() {
    const desktop = root.classList.contains('desktop');
    const n = game.human.hand.length;
    if (desktop) {
      const span = Math.max(124,(n-1)*46+124);
      hand.style.width = `${span}px`;
      hand.style.height = `${176+0.5*((n-1)/2)**2}px`;
      hand.style.transform = `scale(${Math.min(1,1200/span)})`;
      hand.style.removeProperty('--hand-columns');
      $('.hand-pagination').hidden = true;
      game.human.hand.forEach((card,i) => {
        const el = handNodes.get(card); if (!el) return;
        const offset = i-(n-1)/2;
        el.hidden = false; el.style.left = `${i*46}px`; el.style.top = '';
        el.style.setProperty('--angle',`${offset*1.2}deg`);
        el.style.setProperty('--drop',`${0.5*offset**2}px`);
      });
      return;
    }
    const available = Math.max(1,$('.hand-scroll').clientWidth-24);
    const landscape = innerWidth > innerHeight && innerHeight <= 540;
    const baseColumns = Math.max(1,Math.min(n || 1,Math.floor((available+4)/48)));
    const width = Math.min(landscape ? 60 : 70,(available-(baseColumns-1)*4)/baseColumns);
    const step = width - Math.min(12,width*0.25);
    const columns = Math.max(1,Math.min(n || 1,Math.floor((available-width)/step)+1));
    const height = width*((window.visualViewport?.height ?? innerHeight) < 550 && !landscape ? 1.22 : 176/124);
    handPageSize = columns*(landscape || (window.visualViewport?.height ?? innerHeight) < 650 ? 1 : 2);
    const pageCount = Math.max(1,Math.ceil(n/handPageSize));
    handPage = Math.max(0,Math.min(handPage,pageCount-1));
    const start = handPage*handPageSize;
    const rows = Math.max(1,Math.ceil(Math.min(handPageSize,n-start)/columns));
    hand.style.width = `${width+(columns-1)*step}px`;
    hand.style.height = `${rows*height+(rows-1)*8}px`;
    hand.style.transform = '';
    hand.style.setProperty('--hand-columns',String(columns));
    hand.style.setProperty('--hand-card-width',`${width}px`);
    hand.style.setProperty('--hand-card-height',`${height}px`);
    $('.hand-pagination').hidden = pageCount === 1;
    $('.hand-page').textContent = `Hand ${handPage+1}/${pageCount}`;
    $<HTMLButtonElement>('.hand-previous').disabled = handPage === 0 || game.paused;
    $<HTMLButtonElement>('.hand-next').disabled = handPage === pageCount-1 || game.paused;
    game.human.hand.forEach((card,i) => {
      const el = handNodes.get(card); if (!el) return;
      el.hidden = i < start || i >= start+handPageSize;
      const position = i-start;
      el.style.left = `${(position%columns)*step}px`;
      el.style.top = `${Math.floor(position/columns)*(height+8)}px`;
      el.style.setProperty('--angle','0deg'); el.style.setProperty('--drop','0px');
    });
  }
  function layoutTable() {
    const desktop = root.classList.contains('desktop');
    const views: Array<{key: 'own' | number; label: string}> = [];
    if (!game.human.laidDown) views.push({key:'own',label:'Your goal'});
    game.players.forEach((p,i) => { if (p.laidDown) views.push({key:i,label:`Player ${i}`}); });
    if (!views.some(v => v.key === tableView)) tableView = views[0]?.key ?? 'own';
    const tabs = $('.table-tabs');
    tabs.hidden = views.length < 2;
    tabs.replaceChildren(...views.map(view => {
      const tab = button(view.label,'table-tab',() => { tableView = view.key; layoutTable(); });
      tab.disabled = game.paused;
      tab.setAttribute('aria-pressed',String(view.key === tableView)); return tab;
    }));
    $('.own-goal').classList.toggle('mobile-inactive',tableView !== 'own');
    $('.table-rows').classList.toggle('mobile-inactive',tableView === 'own');
    root.querySelectorAll<HTMLElement>('.table-player').forEach(el => el.classList.toggle('mobile-inactive',Number(el.dataset.player) !== tableView));
    for (const group of root.querySelectorAll<HTMLElement>('.formations')) {
      const columns = desktop ? 2 : Math.max(1,getComputedStyle(group).gridTemplateColumns.split(' ').length);
      const rows = Math.max(1,Math.ceil(group.children.length/columns));
      group.style.setProperty('--formation-rows',String(rows));
      const rowHeight = (group.clientHeight - Math.max(0, rows-1)*4)/rows;
      const cardHeight = desktop ? 88 : Math.max(32,Math.min(62,rowHeight-(group.classList.contains('own-formations') ? 30 : 10)));
      group.style.setProperty('--table-card-height',`${cardHeight}px`);
      for (const row of group.querySelectorAll<HTMLElement>('.formation-row')) {
        const cards = row.querySelector<HTMLElement>('.formation-cards')!;
        const count = cards.children.length;
        const cardWidth = desktop ? 62 : cardHeight*62/88;
        const available = Math.max(cardWidth,row.clientWidth-58);
        const step = desktop ? 26 : count > 1 ? Math.max(0,Math.min(22,(available-cardWidth)/(count-1))) : 0;
        cards.style.width = count ? `${(count-1)*step+cardWidth}px` : '0px';
        cards.style.setProperty('--table-card-width',`${cardWidth}px`);
        [...cards.children].forEach((el,i) => { (el as HTMLElement).style.left = `${i*step}px`; });
      }
    }
  }
  function renderFormation(f: Formation, own: boolean, key: string) {
    const wrapper = element('div','formation'); const row = element('div','formation-row');
    const enabled = game.slotEnabled(f);
    const explainLayDown = game.needsLayDownToAdd(f);
    const cards = element('div','formation-cards');
    cards.style.width = f.cards.length ? `${(f.cards.length-1)*26+62}px` : '0px';
    f.cards.forEach((card,i) => {
      const el = button('',`table-card ${game.selectedFormationCards.includes(card) ? 'selected' : ''}`,() => explainLayDown ? game.place(f) : game.selectFormation(f,card));
      el.append(cardFace(card)); el.style.left = `${i*26}px`; el.disabled = !enabled && !explainLayDown;
      el.setAttribute('aria-disabled',String(!enabled));
      if (explainLayDown) { el.title = LAY_DOWN_FIRST_MESSAGE; el.tabIndex = -1; }
      el.setAttribute('aria-label',card.displayStr()); el.setAttribute('aria-pressed',String(game.selectedFormationCards.includes(card)));
      el.dataset.focus = `${key}-card-${card.id}`; cards.append(el);
    });
    const slot = button(f.cards.length ? '+' : `${f.kind}\n${f.kind === 'Set' ? '3' : '4'}+ cards`,`slot ${f.cards.length ? 'filled-slot' : 'empty-slot'}`,() => game.place(f));
    slot.disabled = !enabled && !explainLayDown;
    slot.setAttribute('aria-disabled',String(!enabled));
    if (explainLayDown) slot.title = LAY_DOWN_FIRST_MESSAGE;
    slot.setAttribute('aria-label',f.cards.length ? `Add cards to ${f.kind.toLowerCase()}` : `${f.kind}\n${f.kind === 'Set' ? '3' : '4'}+ cards`);
    slot.dataset.focus = `${key}-slot`;
    row.append(cards,slot); wrapper.append(row);
    if (own) {
      const returnSpace = element('div','return-space');
      const back = button('↓','return-button',() => game.returnToHand(f)); back.title = 'Return to hand'; back.setAttribute('aria-label','Return selected cards to hand');
      back.style.visibility = enabled && f.cards.some(c => game.selectedFormationCards.includes(c)) ? 'visible' : 'hidden';
      returnSpace.append(back); wrapper.append(returnSpace);
    }
    return wrapper;
  }
  function render() {
    handDrag.validate();
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus : undefined;
    const p = game.human;
    const opponent = game.players[1];
    const count = opponent.laidDown ? opponent.hand.length : 13;
    if (count !== oldOpponentCount) {
      $('.opponent').textContent = `Opponent: ${count} cards`;
      if (oldOpponentCount >= 0) $('.opponent').animate([{opacity:0.2},{opacity:1}],{duration:400});
      oldOpponentCount = count;
    }
    $('.deck-label').textContent = `Deck: ${game.deck.count} left`;
    $<HTMLButtonElement>('.deck').disabled = !game.canPickup;
    $<HTMLButtonElement>('.discard').disabled = !game.canPickup || !game.discardPile.length;
    const top = game.discardPile.at(-1);
    if (top !== oldDiscard) {
      $('.discard').replaceChildren(...(top ? [cardFace(top)] : []));
      if (top) $('.discard .card-face').animate([{opacity:0,transform:'scale(1.18)'},{opacity:1,transform:'scale(1)'}],{duration:240,easing:'ease-out'});
      oldDiscard = top;
    }
    $('.own-goal').hidden = p.laidDown;
    $('.goal-name').textContent = p.goal?.name ?? 'Choose a goal';
    $('.goal-points').textContent = p.goal ? `+${p.goal.points}` : '';
    $<HTMLButtonElement>('.lay-down').disabled = !game.acting || !p.canLayDown;
    sheet.replaceChildren();
    p.goals.forEach((goal,i) => {
      if (i%2 === 0) sheet.append(element('span','points-cell',String(goal.points)));
      const cell = button(goal.name,`goal-cell ${goal === p.goal ? 'current' : ''} ${goal.completed ? 'completed' : ''}`,() => { pickerOpen = false; game.chooseGoal(i); picker.focus(); });
      cell.disabled = goal.completed || game.paused; cell.setAttribute('aria-label',`${goal.name}, ${goal.points} points${goal.completed ? ', completed' : ''}`); sheet.append(cell);
    });
    sheet.hidden = !pickerOpen || p.laidDown; picker.setAttribute('aria-expanded',String(!sheet.hidden));
    $('.own-formations').replaceChildren(...(p.goal?.formations.map((f,i) => renderFormation(f,true,`own-${i}`)) ?? []));
    $('.table-rows').replaceChildren();
    game.players.forEach((player,index) => {
      if (!player.laidDown || !player.goal) return;
      const row = element('section','table-player'); row.dataset.player = String(index); row.append(element('h2','player-label',`Player ${index}`));
      const forms = element('div','formations'); forms.append(...player.goal.formations.map((f,i) => renderFormation(f,false,`player-${index}-${i}`))); row.append(forms); $('.table-rows').append(row);
    });
    for (const [card,el] of handNodes) if (!p.hand.includes(card)) { el.remove(); handNodes.delete(card); }
    p.hand.forEach((card,i) => {
      let el = handNodes.get(card);
      if (!el) {
        el = button('','hand-card arrival',() => game.selectHand(card)); el.append(cardFace(card));
        el.setAttribute('aria-label',card.displayStr()); handNodes.set(card,el);
        el.addEventListener('animationend',() => el!.classList.remove('arrival'),{once:true});
      }
      if (hand.children[i] !== el) hand.insertBefore(el,hand.children[i] ?? null);
      el.classList.toggle('selected',game.selectedHand.includes(card)); el.setAttribute('aria-pressed',String(game.selectedHand.includes(card))); el.disabled = game.paused;
    });
    layoutHand(); layoutTable(); positionGoalSheet();
    $('.prompt').textContent = game.statusMessage ?? game.prompt;
    $('.prompt').classList.toggle('status-message',!!game.statusMessage);
    $('.finish').hidden = !game.acting;
    $('.discard-action').hidden = !game.myTurn || game.phase !== Phase.SelectDiscard;
    $<HTMLButtonElement>('.discard-action').disabled = game.selectedHand.length !== 1;
    helpButton.disabled = game.paused;
    picker.disabled = game.paused;
    if (game.roundResult) {
      const newlyOpen = roundOverlay.hidden;
      helpOpen = false; help.hidden = true; pickerOpen = false; sheet.hidden = true;
      picker.setAttribute('aria-expanded','false');
      roundOverlay.hidden = false; stage.inert = true;
      $('.round-winner').textContent = game.roundResult.winner === 0 ? 'You won the round.' : `Your opponent won the round.`;
      $('.round-results tbody').replaceChildren(...game.roundResult.players.map(player => {
        const row = element('tr',player.index === game.roundResult!.winner ? 'round-winning-row' : '');
        const name = element('th','',player.index === 0 ? 'You (Player 0)' : `Opponent (Player ${player.index})`);
        name.scope = 'row';
        const laid = element('td','',player.laidDown ? 'Yes' : 'No');
        if (player.goal) laid.append(element('span','round-goal',player.goal));
        row.append(name,laid,element('td','',String(player.cardsRemaining))); return row;
      }));
      $('.next-round').textContent = game.finishers.length ? 'Continue' : 'Next round';
      if (newlyOpen) $('.next-round').focus();
    } else roundOverlay.hidden = true;
    if (game.gameOver) {
      const newlyOpen = gameover.hidden;
      helpOpen = false; help.hidden = true; gameover.hidden = false; stage.inert = true;
      $('.finisher').textContent = game.finishers.length === 2 ? 'You and your opponent both completed every goal.' : game.finishers[0] === 0 ? 'You completed every goal.' : 'Your opponent completed every goal.';
      if (newlyOpen) $('.new-game').focus();
    } else { gameover.hidden = true; stage.inert = helpOpen || game.roundResult !== null; }
    if (focused) root.querySelector<HTMLElement>(`[data-focus="${focused}"]`)?.focus({preventScroll:true});
  }
  const unsubscribe = game.subscribe(render);
  window.addEventListener('resize',scaleStage);
  window.visualViewport?.addEventListener('resize',scaleStage);
  const resizeObserver = new ResizeObserver(() => { layoutHand(); layoutTable(); });
  resizeObserver.observe($('.hand-scroll'));
  resizeObserver.observe($('.table-area'));
  render(); scaleStage();
  return () => { handDrag.dispose(); unsubscribe(); document.removeEventListener('click',outsideClick); document.removeEventListener('pointerdown',outsideClick); window.removeEventListener('keydown',keydown); window.removeEventListener('resize',scaleStage); window.visualViewport?.removeEventListener('resize',scaleStage); resizeObserver.disconnect(); game.dispose(); };
}
