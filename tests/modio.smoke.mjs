// modio.smoke.mjs — minimal smoke test for the ported mod.io client.
// Run: node Plugins/TSICWebUI/Content/UI/Web/tests/modio.smoke.mjs

import { createClient, makeBaseUrl, listMods, emailRequest, listModfiles }
  from '../shared/modio.js';

function makeFakeFetcher(captured, response) {
  return async (req) => {
    captured.push({ url: req.url, method: req.method,
                    headers: Object.fromEntries(req.headers),
                    body: req.body ? await req.text() : null });
    return response();
  };
}
function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj),
    { status, headers: { 'content-type': 'application/json' } });
}

async function testBaseUrl() {
  const u = makeBaseUrl(123, 'live');
  if (u !== 'https://g-123.modapi.io/v1') throw new Error('bad live base: ' + u);
  const t = makeBaseUrl(123, 'test');
  if (t !== 'https://g-123.test.mod.io/v1') throw new Error('bad test base: ' + t);
}

async function testListMods() {
  const captured = [];
  const cfg = { gameId: 123, apiKey: 'pubkey', env: 'live',
                baseUrl: makeBaseUrl(123, 'live') };
  const c = createClient(cfg, () => null, {
    fetcher: makeFakeFetcher(captured,
      () => jsonResp({ data: [], result_count: 0, result_total: 0 })) });

  await listMods(c, { q: 'crafting', sort: 'popular', limit: 5,
                       tagsIn: 'horror,survival' });
  if (captured.length !== 1) throw new Error('expected 1 request');
  const u = new URL(captured[0].url);
  if (u.pathname !== '/v1/games/123/mods') throw new Error('bad path: ' + u.pathname);
  if (u.searchParams.get('_q') !== 'crafting') throw new Error('missing _q');
  if (u.searchParams.get('_sort') !== 'popular') throw new Error('missing _sort');
  if (u.searchParams.get('_limit') !== '5') throw new Error('missing _limit');
  if (u.searchParams.get('tags-in') !== 'horror,survival') throw new Error('missing tags-in');
  if (u.searchParams.get('api_key') !== 'pubkey') throw new Error('api_key missing in url');
}

async function testEmailRequest() {
  const captured = [];
  const cfg = { gameId: 9, apiKey: 'pk', env: 'live', baseUrl: makeBaseUrl(9, 'live') };
  const c = createClient(cfg, () => null, {
    fetcher: makeFakeFetcher(captured,
      () => jsonResp({ code: 200, message: 'Email Sent.' })) });

  await emailRequest(c, 'a@b.co');
  const body = captured[0].body || '';
  if (!body.includes('api_key=pk')) throw new Error('email body missing api_key');
  if (!body.includes('email=a%40b.co')) throw new Error('email body missing email');
}

async function testBearerWhenTokenPresent() {
  const captured = [];
  const cfg = { gameId: 1, apiKey: 'pk', env: 'live', baseUrl: makeBaseUrl(1, 'live') };
  const c = createClient(cfg, () => 'bearer-tok', {
    fetcher: makeFakeFetcher(captured, () => jsonResp({ data: [] })) });

  await listMods(c, { limit: 1 });
  if (captured[0].headers.authorization !== 'Bearer bearer-tok')
    throw new Error('expected Bearer header');
  if (new URL(captured[0].url).searchParams.get('api_key'))
    throw new Error('api_key should NOT be in url when token present');
}

async function testListModfilesDefaultSort() {
  const captured = [];
  const cfg = { gameId: 1, apiKey: 'pk', env: 'live', baseUrl: makeBaseUrl(1, 'live') };
  const c = createClient(cfg, () => null, {
    fetcher: makeFakeFetcher(captured, () => jsonResp({ data: [] })) });

  await listModfiles(c, 42);
  const u = new URL(captured[0].url);
  if (u.searchParams.get('_sort') !== '-date_added') throw new Error('default sort');
  if (u.searchParams.get('_limit') !== '1') throw new Error('default limit 1');
}

const tests = [testBaseUrl, testListMods, testEmailRequest,
               testBearerWhenTokenPresent, testListModfilesDefaultSort];
let pass = 0;
for (const t of tests) {
  try { await t(); console.log(`OK   ${t.name}`); pass++; }
  catch (e) { console.error(`FAIL ${t.name}: ${e.message}`); process.exitCode = 1; }
}
console.log(`${pass}/${tests.length} passed`);
