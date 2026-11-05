import { test, expect, type Page } from '@playwright/test';

async function clickHand(page: Page, index: number) {
 const card = page.locator('.hand-card').nth(index);
 while (!(await card.isVisible())) await page.getByRole('button',{name:'Next hand page',exact:true}).click();
 await card.scrollIntoViewIfNeeded();
 await card.click({position:{x:16,y:35}});
}
test('initial deal, goal picker, pickup, discard and AI handoff',async ({page}) => {
 const errors: string[] = []; page.on('pageerror',e => errors.push(e.message));
 await page.goto('/');
 await expect(page).toHaveTitle('Bronkers');
 await expect(page.locator('.hand-card')).toHaveCount(13);
 await expect(page.locator('.deck-label')).toHaveText('Deck: 77 left');
 await page.getByRole('button',{name:'Goal',exact:true}).click();
 await page.getByRole('button',{name:'2S, 1 points',exact:true}).click();
 await expect(page.locator('.own-formations .empty-slot')).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Lay down',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Pick up from deck',exact:true}).click();
 await expect(page.locator('.hand-card')).toHaveCount(14);
 await expect(page.locator('.deck-label')).toHaveText('Deck: 76 left');
 await page.getByRole('button',{name:'Finish actions',exact:true}).click();
 await expect(page.getByRole('button',{name:'Discard',exact:true})).toBeDisabled();
 await clickHand(page,0);
 await page.getByRole('button',{name:'Discard',exact:true}).click();
 await expect(page.locator('.prompt')).toHaveText("Opponent is picking up...");
 await page.getByRole('button',{name:'Goal',exact:true}).click();
 await page.getByRole('button',{name:'1S 1R, 3 points',exact:true}).click();
 await expect(page.locator('.goal-name')).toHaveText('1S 1R');
 await expect(page.locator('.prompt')).toHaveText('Pick up from the deck or discard pile',{timeout:10000});
 await expect(page.locator('.hand-card')).toHaveCount(13);
 await expect(page.getByRole('button',{name:'Pick up from deck',exact:true})).toBeEnabled();
 expect(errors).toEqual([]);
});
test('selection, reordering without arrival replay, help and narrow layout',async ({page},info) => {
 await page.goto('/');
 const original = await page.locator('.hand-card').evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
 await clickHand(page,0);
 await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(1);
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('.hand-card').nth(1)).toHaveAttribute('aria-label',original[0]!);
 await expect(page.locator('.hand-card.arrival')).toHaveCount(0);
 await page.getByRole('button',{name:'Controls',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Controls'})).toBeVisible();
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('.hand-card').nth(2)).toHaveAttribute('aria-label',original[0]!);
 await page.getByRole('button',{name:'Close controls'}).click();
 await expect(page.getByRole('dialog',{name:'Controls'})).toBeHidden();
 const width = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
 expect(width.scroll).toBeLessThanOrEqual(width.viewport);
 await page.screenshot({path:`/tmp/bronkers-${info.project.name}.png`,fullPage:true});
});

async function selectByName(page: Page, name: string) {
 const card = page.locator('.hand').getByRole('button',{name,exact:true});
 while (!(await card.isVisible())) await page.getByRole('button',{name:'Next hand page',exact:true}).click();
 await card.scrollIntoViewIfNeeded(); await card.click({position:{x:16,y:35}});
}
async function fillGoal(page: Page) {
 await page.getByRole('button',{name:'Goal',exact:true}).click();
 await page.getByRole('button',{name:'2S, 1 points',exact:true}).click();
 await page.getByRole('button',{name:'Pick up from deck',exact:true}).click();
 for (const [index,names] of [[0,['5 of Hearts','5 of Spades','5 of Diamonds']],[1,['8 of Hearts','8 of Spades','8 of Diamonds']]] as const) {
   for (const name of names) await selectByName(page,name);
   await page.locator('.own-formations .slot').nth(index).click();
 }
 await expect(page.getByRole('button',{name:'Lay down',exact:true})).toBeEnabled();
 await expect(page.locator('.hand-card')).toHaveCount(2);
}
test('place, return, lay down, add last cards and deal a new round',async ({page}) => {
 await page.goto('/tests/e2e/fixture.html');
 await fillGoal(page);
 const formation = page.locator('.own-formations .formation').first();
 await formation.getByRole('button',{name:'5 of Hearts',exact:true}).click({position:{x:10,y:20}});
 await formation.getByRole('button',{name:'Return selected cards to hand'}).click();
 await expect(page.locator('.hand-card')).toHaveCount(5);
 await expect(page.getByRole('button',{name:'Lay down',exact:true})).toBeDisabled();
 for (const name of ['5 of Hearts','5 of Spades','5 of Diamonds']) await selectByName(page,name);
 await formation.locator('.slot').click();
 await page.getByRole('button',{name:'Lay down',exact:true}).click();
 await expect(page.locator('.own-goal')).toBeHidden();
 await expect(page.getByRole('heading',{name:'Player 0'})).toBeVisible();
 await selectByName(page,'5 of Clubs');
 await page.locator('.table-rows .slot').first().click();
 await expect(page.locator('.hand-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Finish actions',exact:true}).click();
 await selectByName(page,'King of Hearts');
 await page.getByRole('button',{name:'Discard',exact:true}).click();
 const result=page.getByRole('dialog',{name:'Round complete'});
 await expect(result).toBeVisible();
 await expect(result.locator('.round-winner')).toHaveText('You won the round.');
 await expect(result.getByRole('rowheader',{name:'You (Player 0)',exact:true})).toBeVisible();
 await expect(result.locator('tbody tr').first().locator('td').first()).toContainText('Yes');
 await expect(result.locator('tbody tr').last().locator('td').first()).toHaveText('No');
 await expect(page.locator('.hand-card')).toHaveCount(0);
 // Neither backdrop clicks nor keyboard shortcuts skip confirmation.
 await page.locator('.round-overlay').click({position:{x:2,y:2}});
 await page.keyboard.press('Escape');
 await expect(result).toBeVisible();
 await page.getByRole('button',{name:'Next round',exact:true}).click();
 await expect(result).toBeHidden();
 await expect(page.locator('.hand-card')).toHaveCount(13);
 await expect(page.locator('.goal-name')).toHaveText('Choose a goal');
 await page.getByRole('button',{name:'Goal',exact:true}).click();
 await expect(page.getByRole('button',{name:'2S, 1 points, completed',exact:true})).toBeDisabled();
});
test('game over freezes table and New game resets the goal sheet',async ({page}) => {
 await page.goto('/tests/e2e/fixture.html?final');
 await fillGoal(page);
 await page.getByRole('button',{name:'Lay down',exact:true}).click();
 await selectByName(page,'5 of Clubs');
 await page.locator('.table-rows .slot').first().click();
 await page.getByRole('button',{name:'Finish actions',exact:true}).click();
 await selectByName(page,'King of Hearts');
 await page.getByRole('button',{name:'Discard',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Round complete'})).toBeVisible();
 await expect(page.getByRole('dialog',{name:'Game over'})).toBeHidden();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Round complete'})).toBeHidden();
 await expect(page.getByRole('dialog',{name:'Game over'})).toBeVisible();
 await expect(page.locator('.finisher')).toHaveText('You completed every goal.');
 await page.getByRole('button',{name:'New game',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Game over'})).toBeHidden();
 await expect(page.locator('.hand-card')).toHaveCount(13);
 await page.getByRole('button',{name:'Goal',exact:true}).click();
 await expect(page.getByRole('button',{name:'2S, 1 points',exact:true})).toBeEnabled();
});
test('small portrait and landscape layouts keep controls reachable',async ({page}) => {
 for (const size of [{width:320,height:568},{width:844,height:390}]) {
   await page.setViewportSize(size); await page.goto('/');
   await page.getByRole('button',{name:'Goal',exact:true}).click();
   await page.getByRole('button',{name:'2S 2R, 10 points',exact:true}).click();
   await expect(page.locator('.own-formations .slot')).toHaveCount(4);
   await page.getByRole('button',{name:'Pick up from deck',exact:true}).click();
   await page.getByRole('button',{name:'Finish actions',exact:true}).click();
   await clickHand(page,13);
   await expect(page.getByRole('button',{name:'Discard',exact:true})).toBeEnabled();
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
   await expect(page.getByRole('button',{name:'Discard',exact:true})).toBeInViewport({ratio:1});
 }
});

test('phone play fits the viewport and every card is reachable without scrolling',async ({page}) => {
 for (const size of [{width:320,height:480},{width:320,height:568},{width:360,height:640},{width:390,height:720},{width:428,height:926},{width:667,height:375},{width:844,height:390},{width:932,height:430}]) {
   await page.setViewportSize(size); await page.goto('/');
   await page.getByRole('button',{name:'Goal',exact:true}).click();
   await page.getByRole('button',{name:'2S 2R, 10 points',exact:true}).click();
   await page.getByRole('button',{name:'Pick up from deck',exact:true}).click();
   const seen = new Set<number>();
   for (;;) {
     const visible = await page.locator('.hand-card').evaluateAll(nodes => nodes.flatMap((node,index) => (node as HTMLElement).hidden ? [] : [index]));
     visible.forEach(i => seen.add(i));
     const outside = await page.evaluate(() => {
       const parent = document.querySelector('.table-area')!.getBoundingClientRect();
       const hand = document.querySelector('.hand-scroll')!.getBoundingClientRect();
       const outside: string[] = [];
       for (const el of document.querySelectorAll<HTMLElement>('.slot, .hand-card:not([hidden])')) {
         if (!el.checkVisibility()) continue;
         const r=el.getBoundingClientRect(); const container=el.classList.contains('slot') ? parent : hand;
         if (r.left < container.left-1 || r.right > container.right+1 || r.top < container.top-5 || r.bottom > container.bottom+1) outside.push(el.getAttribute('aria-label')!);
       }
       return outside;
     });
     expect(outside,`${size.width}×${size.height}: no clipped cards or formation slots`).toEqual([]);
     const next = page.getByRole('button',{name:'Next hand page',exact:true});
     if (!(await next.isVisible()) || await next.isDisabled()) break;
     await next.click();
   }
   expect(seen.size,`${size.width}×${size.height}: all 14 cards reachable`).toBe(14);
   await expect(page.getByRole('button',{name:'Finish actions',exact:true})).toBeInViewport({ratio:1});
   const overflows = await page.evaluate(() => ['html','.hand-scroll','.table-area','.formation-row'].flatMap(selector => [...document.querySelectorAll(selector)].filter(el => el.checkVisibility() && (el.scrollWidth > el.clientWidth+1 || el.scrollHeight > el.clientHeight+1)).map(() => selector)));
   expect(overflows,`${size.width}×${size.height}: game regions fit`).toEqual([]);
 }
});
test('mobile player tabs fit crowded laid-down formations and preserve the hand',async ({page}) => {
 await page.setViewportSize({width:390,height:720});
 await page.goto('/tests/e2e/fixture.html?crowded');
 await page.getByRole('button',{name:'Goal',exact:true}).click();
 await page.getByRole('button',{name:'2S 2R, 10 points',exact:true}).click();
 const original = await page.locator('.hand-card').evaluateAll(nodes => nodes.map(el => el.getAttribute('aria-label')));
 await page.getByRole('button',{name:'Player 1',exact:true}).click();
 await expect(page.locator('.own-goal')).toBeHidden();
 await expect(page.getByRole('heading',{name:'Player 1',exact:true})).toBeVisible();
 for (const row of await page.locator('.table-rows .formation-row').all()) {
   expect(await row.evaluate(el => el.scrollWidth <= el.clientWidth+1)).toBe(true);
 }
 await page.getByRole('button',{name:'Your goal',exact:true}).click();
 await expect(page.locator('.own-goal')).toBeVisible();
 expect(await page.locator('.hand-card').evaluateAll(nodes => nodes.map(el => el.getAttribute('aria-label')))).toEqual(original);
 // Resizing into the desktop layout shows both players without mobile tabs.
 await page.setViewportSize({width:1280,height:720});
 await expect(page.locator('.own-goal')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Player 1',exact:true})).toBeVisible();
 await expect(page.locator('.table-tabs')).toBeHidden();
});

test('AI round results show laydowns, close help and wait for confirmation',async ({page},info) => {
 for (const both of [false,true]) {
   await page.goto(`/tests/e2e/fixture.html?round-ai${both ? '&both' : ''}`);
   await page.getByRole('button',{name:'Controls',exact:true}).click();
   await expect(page.getByRole('dialog',{name:'Controls'})).toBeVisible();
   const result=page.getByRole('dialog',{name:'Round complete'});
   await expect(result).toBeVisible({timeout:10000});
   await expect(page.getByRole('dialog',{name:'Controls'})).toBeHidden();
   await expect(result.locator('.round-winner')).toHaveText('Your opponent won the round.');
   const rows=result.locator('tbody tr');
   await expect(rows.first().locator('td').first()).toContainText(both ? 'Yes' : 'No');
   await expect(rows.last().locator('td').first()).toContainText('Yes');
   await expect(rows.last().locator('td').last()).toHaveText('0');
   const next=page.getByRole('button',{name:'Next round',exact:true});
   await expect(next).toBeFocused();
   await page.keyboard.press('Tab');await expect(next).toBeFocused();
   if (info.project.name==='mobile-chromium') {
     for (const viewport of [{width:320,height:480},{width:844,height:390}]) {
       await page.setViewportSize(viewport);
       await expect(next).toBeInViewport({ratio:1});
       expect(await result.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
     }
   }
   await next.click();
   await expect(result).toBeHidden();
   await expect(page.locator('.hand-card')).toHaveCount(13);
   await expect(page.locator('.prompt')).toHaveText('Pick up from the deck or discard pile');
 }
});
