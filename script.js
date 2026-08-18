// script.js — fetch upcoming launches and filter by country + ", FL" in pad/location
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

// Stricter Florida detection: require US country_code when present, then match ", FL" or known Florida keywords
function isFloridaLaunch(l){
  if(!l?.pad) return false;
  const loc = l.pad.location || {};
  const country = (loc.country_code || '').toUpperCase();
  // If country is present and not the United States, reject immediately (filters out Chinese launches)
  if(country && country !== 'US' && country !== 'USA') return false;

  const padName = l.pad.name || '';
  const locName = loc.name || '';
  const combined = `${padName} ${locName}`.toLowerCase();

  // 1) comma-style ", FL" in pad or location
  const commaFl = /,\s*fl\b/i;
  if(commaFl.test(padName) || commaFl.test(locName)) return true;

  // 2) known Florida site keywords (only after country check)
  const keywords = ['kennedy','kennedy space center','cape canaveral','canaveral','patrick','merritt island','cocoa','ksc','ccafs','ccsfs'];
  for(const kw of keywords){
    if(combined.indexOf(kw) !== -1) return true;
  }

  return false;
}

function render(list){
  listEl.innerHTML = '';
  if(!list.length){
    emptyEl.hidden = false;
    statsEl.textContent = '0 launches found';
    return;
  }
  emptyEl.hidden = true;
  debugEl.hidden = true;

  const total = list.length;
  const floridaCount = list.filter(isFloridaLaunch).length;
  statsEl.textContent = `${total} upcoming launch${total>1?'es':''} — ${floridaCount} Florida`;

  for(const l of list){
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

    if(isFloridaLaunch(l)){
      const fl = document.createElement('div');
      fl.style.marginTop = '8px';
      const flBadge = document.createElement('span');
      flBadge.className = 'badge badge--green';
      flBadge.textContent = 'Florida';
      fl.appendChild(flBadge);
      card.appendChild(fl);
    }

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
}

function matchesSearch(item, q){
  if(!q) return true;
  q = q.toLowerCase();
  return [item.name, item.launch_service_provider?.name, item.rocket?.configuration?.name, item.pad?.name, item.pad?.location?.name]
    .filter(Boolean)
    .some(s => s.toLowerCase().includes(q));
}

function updateView(){
  const q = searchInput.value.trim();
  const base = launchesAll;
  const filtered = q ? base.filter(l => matchesSearch(l, q)) : base;
  render(filtered);
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
