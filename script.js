// script.js — fetch upcoming launches and show only the next upcoming Florida launch (retro single-tile render)
const API = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=200&ordering=net';
const listEl = document.getElementById('launchList');
const statsEl = document.getElementById('stats');
const emptyEl = document.getElementById('empty');
const debugEl = document.getElementById('debug');
let launchesAll = [];

function formatNet(net){
  if(!net) return 'TBD';
  try{
    const d = new Date(net);
    return d.toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'}) + ' (local)';
  }catch(e){return net}
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

function showSpaceXLogo(){
  // Remove tile styles to avoid overlap and display only the logo
  listEl.className = '';
  listEl.innerHTML = `
    <div class="logo-wrap">
      <img class="spacex-logo" src="https://upload.wikimedia.org/wikipedia/commons/d/de/SpaceX-Logo.svg" alt="SpaceX logo"/>
    </div>
  `;
}

// Render a single retro watch tile for the next Florida launch — populate listEl directly
function renderSingle(next, totalFlorida){
  // ensure listEl acts as the tile container (avoid nesting another .watch-tile)
  listEl.className = 'watch-tile';
  listEl.innerHTML = '';

  if(!next){
    listEl.innerHTML = '<div class="empty">No upcoming Florida launches found.</div>';
    return;
  }

  const l = next;

  // Main NET time
  const timeEl = document.createElement('h1');
  timeEl.className = 'watch-time';
  timeEl.textContent = (formatNet(l.net || l.window_start || l.window_end) || '').replace(/\s*\(local\)$/, '');
  listEl.appendChild(timeEl);

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
  listEl.appendChild(infoRow);
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
    // fetch the API
    const res = await fetch(API);
    // If anything other than a 200 OK, show the SpaceX logo and nothing else
    if(res.status !== 200){
      showSpaceXLogo();
      return;
    }

    const data = await res.json();
    const all = Array.isArray(data) ? data : (data.results || []);
    launchesAll = all;
    updateView();
  }catch(err){
    // On network or parsing errors, show the SpaceX logo instead of error text
    console.error(err);
    showSpaceXLogo();
  }
}

load();
