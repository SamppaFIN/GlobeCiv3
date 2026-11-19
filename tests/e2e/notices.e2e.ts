import { expect, test } from '@playwright/test';

// MIT and OFL ask that their texts travel with the copies, so the published game serves them (STORY-081)
test('the published game serves the third-party licence texts', async ({ request }) => {
  const res = await request.get('THIRD-PARTY-NOTICES.md');
  expect(res.status()).toBe(200);
  const text = await res.text();
  for (const work of ['three.js', 'Zustand', 'Phosphor Icons', 'SIL OPEN FONT LICENSE Version 1.1', 'Freeciv']) {
    expect(text).toContain(work);
  }
});
