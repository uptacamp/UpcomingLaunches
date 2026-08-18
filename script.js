// script.js — fetch upcoming launches and show only the next upcoming Florida launch (retro single-tile render)
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

// Exact same keywords used for the Florida badge — used to decide visibility
function isFloridaLaunch(l){
  if(!l?.pad) return false;
  const loc = l.pad.location || {};
  const padName = l.pad.name || '';
  const locName = loc.name || '';
  const locState = loc.state || '';
  const country = (loc.country_code || '').toUpperCase();

  // If country is present and not US, exclude immediately
  if(country && country !== 'US' && country !== 'USA') return false;

  const combined = `${padName} ${locName} ${locState} ${country}`.toLowerCase();

  // 1) explicit ", FL"
  if(/,\s*fl\b/i.test(padName) || /,\s*fl\b/i.test(locName)) return true;

  // 2) explicit state mention
  if(/\bflorida\b/i.test(combined) || /\bfl\b/i.test(combined)) return true;

  // 3) exact badge keyword list
  const keywords = [
    'kennedy',
    'kennedy space center',
    'cape canaveral',
    'canaveral',
    'patrick',
    'merritt island',
    'cocoa',
    'ksc',
    'ccafs',
    'ccsfs',
    'pad 39a',
    'pad 39b',
    'lc-39a',
    'lc-39b',
    'slc-40',
    'slc-41'
  ];

  for(const kw of keywords){
    if(combined.indexOf(kw) !== -1) return true;
  }

  return false;
}

// Render a single retro watch tile for the next Florida launch
function renderSingle(next, totalFlorida){
  listEl.innerHTML = '';
  if(!next){
    listEl.innerHTML = '<div class="empty">No upcoming Florida launches found.</div>';
    return;
  }

  const l = next;
  const tile = document.createElement('div');
  tile.className = 'watch-tile';

  // Florida badge
  if(isFloridaLaunch(l)){
    const badge = document.createElement('div');
    badge.className = 'fl-badge';
    badge.textContent = 'FLORIDA';
    tile.appendChild(badge);
  }

  // Main NET time
  const timeEl = document.createElement('h1');
  timeEl.className = 'watch-time';
  timeEl.textContent = (formatNet(l.net || l.window_start || l.window_end) || '').replace(/\s*\(local\)$/, '');
  tile.appendChild(timeEl);

  // Info row
  const infoRow = document.createElement('div');
  infoRow.className = 'watch-info';

  const left = document.createElement('div');
  left.className = 'info-left';
  const label1 = document.createElement('div');
  label1.className = 'info-label';
  label1.textContent = 'Pad';
  const value1 = document.createElement('div');
  value1.className = 'info-value';
  value1.textContent = l.pad?.name || l.pad?.location?.name || '—';
  left.appendChild(label1);
  left.appendChild(value1);

  const right = document.createElement('div');
  right.className = 'info-right';
  const label2 = document.createElement('div');
  label2.className = 'info-label';
  label2.textContent = 'Vehicle';
  const value2 = document.createElement('div');
  value2.className = 'info-value';
  value2.textContent = l.rocket?.configuration?.name || l.rocket?.name || '—';
  right.appendChild(label2);
  right.appendChild(value2);

  infoRow.appendChild(left);
  infoRow.appendChild(right);
  tile.appendChild(infoRow);

  listEl.appendChild(tile);
}

// Find the next Florida launch by scanning all launches in chronological order
function updateView(){
  const sorted = [...launchesAll].sort((a,b)=>{
    const ta = Date.parse(a.net || a.window_start || a.window_end || '') || Infinity;
    const tb = Date.parse(b.net || b.window_start || b.window_end || '') || Infinity;
    return ta - tb;
  });

  const nextFlorida = sorted.find(l => isFloridaLaunch(l));
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
  updateView();
});

load();
