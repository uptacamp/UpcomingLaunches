// script.js — fetch upcoming launches and filter to Florida pads
const API = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=100&ordering=net';
const listEl = document.getElementById('launchList');
const statsEl = document.getElementById('stats');
const emptyEl = document.getElementById('empty');
const searchInput = document.getElementById('searchInput');
let launches = [];

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
  if(s.includes('success') || s.includes('go') || s.includes('success')) return 'badge badge--green';
  if(s.includes('hold') || s.includes('delay') || s.includes('scrub')) return 'badge badge--red';
  return 'badge badge--yellow';
}

function render(list){
  listEl.innerHTML = '';
  if(!list.length){
    emptyEl.hidden = false;
    statsEl.textContent = '0 Florida launches found';
    return;
  }
  emptyEl.hidden = true;
  statsEl.textContent = `${list.length} Florida launch${list.length>1?'es':''} (showing up to ${list.length})`;

  for(const l of list){
    const card = document.createElement('article');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = l.name || 'Unnamed';
    card.appendChild(title);

    const row = document.createElement('div');
    row.className = 'row';
    const net = document.createElement('div');
    net.className = 'meta';
    net.innerHTML = `<strong>${formatNet(l.net || l.window_start || l.window_end)}</strong>`;
    row.appendChild(net);

    const status = document.createElement('div');
    status.style.marginLeft = 'auto';
    const sName = l.status?.name || (l.status? String(l.status): 'Unknown');
    const badge = document.createElement('span');
    badge.className = statusClass(sName) + ' badge';
    badge.textContent = sName || 'Unknown';
    status.appendChild(badge);
    row.appendChild(status);
    card.appendChild(row);

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

function filterFlorida(all){
  return all.filter(l => {
    const loc = l.pad?.location || {};
    const padName = l.pad?.name || '';
    const checks = [loc.name, loc.region, loc.state, padName, loc.country_code];
    return checks.filter(Boolean).some(v => /florida/i.test(String(v)) || /^FL$/i.test(String(v)));
  });
}

async function load(){
  try{
    statsEl.textContent = 'Loading upcoming launches…';
    const res = await fetch(API);
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const data = await res.json();
    const all = data.results || [];
    launches = filterFlorida(all);
    render(launches);
  }catch(err){
    statsEl.textContent = 'Failed to load launches';
    emptyEl.hidden = false;
    listEl.innerHTML = `<div class="empty">Error: ${err.message}</div>`;
    console.error(err);
  }
}

searchInput.addEventListener('input', ()=>{
  const q = searchInput.value.trim();
  render(launches.filter(l => matchesSearch(l,q)));
});

load();
