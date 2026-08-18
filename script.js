// script.js — fetch upcoming launches and show only the next upcoming Florida launch (robust detection)
const API = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=200&ordering=net';
const listEl = document.getElementById('launchList');
const statsEl = document.getElementById('stats');
const emptyEl = document.getElementById('empty');
const debugEl = document.getElementById('debug');
const searchInput = document.getElementById('searchInput');
let launchesAll = [];

function formatNet(net){
  if(!net) return 'TBD';
  try{
    const d = new Date(net);
    return d.toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'}) + ' (local)';
  }catch(e){return net}
}

function statusClass(statusName){
  if(!statusName) return 'badge badge--yellow';
  const s = statusName.toLowerCase();
  if(s.includes('success') || s.includes('go')) return 'badge badge--green';
  if(s.includes('hold') || s.includes('delay') || s.includes('scrub')) return 'badge badge--red';
  return 'badge badge--yellow';
}

// Robust Florida detection: prefer country_code when present (must be US), otherwise use text heuristics.
function isFloridaLaunch(l){
  if(!l?.pad) return false;
  const loc = l.pad.location || {};
  const padName = l.pad.name || '';
  const locName = loc.name || '';
  const locState = loc.state || '';
  const locRegion = loc.region || '';
  const country = (loc.country_code || '').toUpperCase();

  // If country is present and not US, reject immediately
  if(country && country !== 'US' && country !== 'USA') return false;

  const combined = `${padName} ${locName} ${locRegion} ${locState} ${country}`.toLowerCase();

  // 1) explicit ", FL" marker in pad or location
  if(/,\s*fl\b/i.test(padName) || /,\s*fl\b/i.test(locName)) return true;

  // 2) explicit state/region mention
  if(/\bflorida\b/i.test(combined) || /\bfl\b/i.test(combined)) return true;

  // 3) known Florida keywords
  const keywords = ['kennedy', 'kennedy space center', 'cape canaveral', 'canaveral', 'patrick', 'merritt island', 'cocoa', 'ksc', 'ccafs', 'ccsfs', 'pad 39a', 'pad 39b', 'lc-39a', 'lc-39b', 'slc-40', 'slc-41'];
  for(const kw of keywords){
    if(combined.indexOf(kw) !== -1) return true;
  }

  // 4) fallback: if country missing but pad id matches common Florida pad id patterns (not available here) — currently no-op
  return false;
}

function renderSingle(next, totalFlorida){
  listEl.innerHTML = '';
  if(!next){
    emptyEl.hidden = false;
    statsEl.textContent = 'No upcoming Florida launches found.';
    return;
  }
  emptyEl.hidden = true;
  statsEl.textContent = `Next Florida launch — ${totalFlorida} upcoming Florida launch${totalFlorida>1?'es':''} total`;

  const l = next;
  const card = document.createElement('article');
  card.className = 'card';

  const headerRow = document.createElement('div');
  headerRow.className = 'row';

  const title = document.createElement('h3');
  title.textContent = l.name || 'Unnamed';
  headerRow.appendChild(title);

  const statusWrap = document.createElement('div');
  statusWrap.style.marginLeft = 'auto';
  const sName = l.status?.name || (l.status? String(l.status): 'Unknown');
  const statusBadge = document.createElement('span');
  statusBadge.className = statusClass(sName) + ' badge';
  statusBadge.textContent = sName || 'Unknown';
  statusWrap.appendChild(statusBadge);
  headerRow.appendChild(statusWrap);

  card.appendChild(headerRow);

  const net = document.createElement('div');
  net.className = 'meta';
  net.innerHTML = `<strong>${formatNet(l.net || l.window_start || l.window_end)}</strong>`;
  card.appendChild(net);

  const providerEl = document.createElement('div');
  providerEl.className = 'field small';
  providerEl.innerHTML = `<div class="label">Provider</div><div class="value">${l.launch_service_provider?.name || '—'}</div>`;
  card.appendChild(providerEl);

  const rocketEl = document.createElement('div');
  rocketEl.className = 'field small';
  const rocketName = l.rocket?.configuration?.name || l.rocket?.name || '—';
  rocketEl.innerHTML = `<div class="label">Rocket</div><div class="value">${rocketName}</div>`;
  card.appendChild(rocketEl);

  const padName = l.pad?.name || l.pad?.location?.name || '—';
  const padLoc = l.pad?.location?.name || l.pad?.location?.state || '';
  const padEl = document.createElement('div');
  padEl.className = 'field small';
  padEl.innerHTML = `<div class="label">Pad</div><div class="value">${padName}${padLoc?` — ${padLoc}`:''}</div>`;
  card.appendChild(padEl);

  const fl = document.createElement('div');
  fl.style.marginTop = '8px';
  const flBadge = document.createElement('span');
  flBadge.className = 'badge badge--green';
  flBadge.textContent = 'Florida';
  fl.appendChild(flBadge);
  card.appendChild(fl);

  if(l.url){
    const a = document.createElement('a');
    a.href = l.url;
    a.textContent = 'Details';
    a.target = '_blank';
    a.className = 'small';
    a.style.display = 'inline-block';
    a.style.marginTop = '10px';
    card.appendChild(a);
  }

  listEl.appendChild(card);
}

function updateView(){
  // Sort all launches ascending by NET/window_start/window_end
  const sorted = [...launchesAll].sort((a,b)=>{
    const ta = Date.parse(a.net || a.window_start || a.window_end || '') || Infinity;
    const tb = Date.parse(b.net || b.window_start || b.window_end || '') || Infinity;
    return ta - tb;
  });

  // Find the first launch in chronological order that matches the Florida predicate
  const nextFlorida = sorted.find(l => isFloridaLaunch(l));

  // Count total Florida matches for the stats
  const totalFlorida = launchesAll.filter(isFloridaLaunch).length;

  if(!nextFlorida){
    renderSingle(null, 0);
    return;
  }

  renderSingle(nextFlorida, totalFlorida);
}

async function load(){
  try{
    statsEl.textContent = 'Loading upcoming launches…';
    const res = await fetch(API);
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const data = await res.json();
    const all = Array.isArray(data) ? data : (data.results || []);
    launchesAll = all;
    if(!launchesAll.length){
      debugEl.hidden = false;
      debugEl.textContent = JSON.stringify(data, null, 2);
      console.warn('Launches array empty — API returned:', data);
    } else {
      debugEl.hidden = true;
    }
    updateView();
  }catch(err){
    statsEl.textContent = 'Failed to load launches';
    emptyEl.hidden = false;
    debugEl.hidden = false;
    debugEl.textContent = `Fetch error: ${err.message}`;
    listEl.innerHTML = `<div class="empty">Error: ${err.message}</div>`;
    console.error(err);
  }
}

searchInput.addEventListener('input', ()=>{
  // keep search but it won't change next-only behavior; still update view if called
  updateView();
});

load();
