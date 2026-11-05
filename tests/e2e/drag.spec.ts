import { expect, test, type Page } from '@playwright/test';

async function order(page: Page) { return page.locator('.hand-card').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))); }
async function point(page: Page, index: number) {
 const box = await page.locator('.hand-card').nth(index).boundingBox();
 if (!box) throw Error(`Card ${index} not visible`);
 return {x:box.x+14,y:box.y+Math.min(35,box.height/2)};
}
async function drag(page: Page, from: number, to: number, touch = false) {
 const start = await point(page,from); const end = await point(page,to);
 if (touch) {
   const cdp = await page.context().newCDPSession(page);
   const points = (x:number,y:number) => [{x,y,id:1,radiusX:6,radiusY:6,force:1}];
   try {
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(start.x,start.y)});
     for (let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(start.x+(end.x-start.x)*i/8,start.y+(end.y-start.y)*i/8)});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   } finally { await cdp.detach(); }
 } else {
   await page.mouse.move(start.x,start.y); await page.mouse.down();
   await page.mouse.move(end.x,end.y,{steps:8}); await page.mouse.up();
 }
}

test('drag reorders one card without selecting it, and taps still select',async ({page},info) => {
 await page.goto('/tests/e2e/fixture.html');
 const original = await order(page);
 await expect(page.locator('.hand-card:not([hidden]).arrival')).toHaveCount(0);
 await drag(page,0,3,info.project.name === 'mobile-chromium');
 expect(await order(page)).toEqual([original[1],original[2],original[3],original[0],...original.slice(4)]);
 await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(0);
 await expect(page.locator('.drag-preview')).toHaveCount(0);
 const tapped = page.locator('.hand-card').nth(1);
 if (info.project.name === 'mobile-chromium') await tapped.tap({position:{x:14,y:30}});
 else await tapped.click({position:{x:14,y:30}});
 await expect(tapped).toHaveAttribute('aria-pressed','true');
 const selected = await tapped.getAttribute('aria-label');
 await drag(page,1,4,info.project.name === 'mobile-chromium');
 await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(1);
 await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveAttribute('aria-label',selected!);
 await expect(page.locator('.hand-card.arrival')).toHaveCount(0);
 // The next intentional tap toggles selection normally after a drag.
 await page.locator('.hand-card[aria-pressed=true]').click({position:{x:14,y:30}});
 await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Move selected cards right'})).toHaveCount(0);
 await expect(page.getByText('Select cards to move',{exact:true})).toHaveCount(0);
});

test('Escape and dropping outside the hand cancel a drag without playing a card',async ({page}) => {
 await page.goto('/tests/e2e/fixture.html');
 const original = await order(page);
 for (const cancel of ['escape','outside']) {
   const start=await point(page,0),end=await point(page,3);
   await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:6});
   await expect(page.locator('.drag-preview')).toBeVisible();
   if (cancel==='escape') await page.keyboard.press('Escape');
   else await page.mouse.move(5,5,{steps:3});
   await page.mouse.up();
   expect(await order(page)).toEqual(original);
   await expect(page.locator('.drag-preview')).toHaveCount(0);
   await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(0);
 }
});

test('small phone cards overlap and can be dragged across rows',async ({page},info) => {
 await page.setViewportSize({width:390,height:720});await page.goto('/');
 const original=await order(page);
 const bounds=await page.locator('.hand-card').evaluateAll(nodes=>nodes.slice(0,2).map(n=>n.getBoundingClientRect().toJSON()));
 expect(bounds[0].right-bounds[1].left).toBeGreaterThan(0);
 expect(bounds[0].right-bounds[1].left).toBeLessThan(bounds[0].width/2);
 await drag(page,0,10,info.project.name === 'mobile-chromium');
 expect(await order(page)).toEqual([...original.slice(1,11),original[0],...original.slice(11)]);
 await expect(page.locator('.hand-pagination')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
});

test('holding a drag over the next page moves a card across hand pages',async ({page}) => {
 await page.setViewportSize({width:320,height:568});await page.goto('/');
 const original=await order(page),start=await point(page,0);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+12,start.y);
 const next=await page.getByRole('button',{name:'Next hand page'}).boundingBox();
 if(!next)throw Error('Expected a second hand page');
 await page.mouse.move(next.x+next.width/2,next.y+next.height/2,{steps:5});
 await expect(page.locator('.hand-page')).toHaveText('Hand 2/2');
 const end=await point(page,12);
 await page.mouse.move(end.x,end.y,{steps:6});await page.mouse.up();
 expect(await order(page)).toEqual([...original.slice(1),original[0]]);
 await expect(page.locator('.drag-preview')).toHaveCount(0);
 await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(0);
});

test('an AI render during a drag does not lose the gesture or change selection',async ({page}) => {
 await page.goto('/');await page.getByRole('button',{name:'Pick up from deck',exact:true}).click();
 await page.getByRole('button',{name:'Finish actions',exact:true}).click();
 await page.locator('.hand-card').first().click({position:{x:14,y:30}});
 await page.getByRole('button',{name:'Discard',exact:true}).click();
 const original=await order(page),start=await point(page,0),end=await point(page,3);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+12,start.y);
 await expect(page.locator('.prompt')).toHaveText('Opponent is taking their actions...');
 await page.mouse.move(end.x,end.y,{steps:6});await page.mouse.up();
 expect(await order(page)).toEqual([original[1],original[2],original[3],original[0],...original.slice(4)]);
 await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(0);
 await expect(page.locator('.drag-preview')).toHaveCount(0);
});

test('dropping selected cards over a goal slot only cancels the reorder',async ({page}) => {
 await page.goto('/tests/e2e/fixture.html');
 await page.getByRole('button',{name:'Goal',exact:true}).click();
 await page.getByRole('button',{name:'2S, 1 points',exact:true}).click();
 await page.getByRole('button',{name:'Pick up from deck',exact:true}).click();
 for (let index=0;index<3;index++) await page.locator('.hand-card').nth(index).click({position:{x:14,y:30}});
 const original=await order(page),start=await point(page,0);
 const slot=await page.locator('.own-formations .slot').first().boundingBox();
 if(!slot)throw Error('Expected goal slot');
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+12,start.y);
 await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2,{steps:8});await page.mouse.up();
 expect(await order(page)).toEqual(original);
 await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(3);
 await expect(page.locator('.table-card')).toHaveCount(0);
});

test('touch cancellation restores the original hand and removes the preview',async ({page},info) => {
 test.skip(info.project.name !== 'mobile-chromium','Touch events use the Chromium protocol.');
 await page.goto('/tests/e2e/fixture.html');
 const original=await order(page),start=await point(page,0),end=await point(page,3);
 const cdp=await page.context().newCDPSession(page);
 try {
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...end,id:1}]});
   await expect(page.locator('.drag-preview')).toBeVisible();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   expect(await order(page)).toEqual(original);
   await expect(page.locator('.drag-preview')).toHaveCount(0);
   await expect(page.locator('.hand-card[aria-pressed=true]')).toHaveCount(0);
 } finally {await cdp.detach();}
});

test('tapping the hand closes an open goal sheet and selects the card',async ({page},info) => {
 await page.goto('/tests/e2e/fixture.html');
 await page.getByRole('button',{name:'Goal',exact:true}).click();
 await expect(page.locator('.goal-sheet')).toBeVisible();
 const card=page.locator('.hand-card').first();
 if(info.project.name==='mobile-chromium')await card.tap({position:{x:14,y:30}});
 else await card.click({position:{x:14,y:30}});
 await expect(page.locator('.goal-sheet')).toBeHidden();
 await expect(card).toHaveAttribute('aria-pressed','true');
});

test('touch dragging leaves goal, pickup and turn-action buttons responsive',async ({page},info) => {
 test.skip(info.project.name !== 'mobile-chromium','This check uses touch gestures.');
 await page.goto('/tests/e2e/fixture.html');
 await page.getByRole('button',{name:'Goal',exact:true}).tap();
 await page.getByRole('button',{name:'2S, 1 points',exact:true}).tap();
 await page.getByRole('button',{name:'Pick up from deck',exact:true}).tap();
 await drag(page,0,3,true);
 await page.getByRole('button',{name:'Controls',exact:true}).tap();
 await expect(page.getByRole('dialog',{name:'Controls'})).toBeVisible();
 await page.getByRole('button',{name:'Close controls',exact:true}).tap();
 await page.getByRole('button',{name:'Finish actions',exact:true}).tap();
 await expect(page.locator('.prompt')).toHaveText('Select one card to discard');
 await page.locator('.hand-card').first().tap({position:{x:14,y:30}});
 await expect(page.getByRole('button',{name:'Discard',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Discard',exact:true}).tap();
 await expect(page.locator('.prompt')).toHaveText('Opponent is picking up...');
});
