// script.js — fetch upcoming launches and show only the next upcoming Florida launch (retro single-tile render)
const API = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=200&ordering=net';
const listEl = document.getElementById('launchList');
const statsEl = document.getElementById('stats');
const emptyEl = document.getElementById('empty');
const debugEl = document.getElementById('debug');
let launchesAll = [];

// Countdown control handles so we can stop when the view updates
let countdownInterval = null;
let countdownAbort = null;

// Return formatted parts: { dateLabel: 'Mon Aug 20', timeLabel: '5:30 PM' }
function formatNetParts(net){
  if(!net) return { dateLabel: 'TBD', timeLabel: '' };
  try{
    const d = new Date(net);
    // weekday short (e.g., Mon)
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
    // month + day (e.g., Aug 20)
    const monthDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d);
    // time (e.g., 5:30 PM)
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
    return { dateLabel: `${weekday} ${monthDay}`, timeLabel: time };
  }catch(e){
    return { dateLabel: net, timeLabel: '' };
  }
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

// Stop any running countdown (clear interval and abort any outstanding time fetch)
function stopCountdown(){
  if(countdownInterval){
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if(countdownAbort){
    try{ countdownAbort.abort(); }catch(e){}
    countdownAbort = null;
  }
}

// Start an "atomic" countdown using an authoritative time source for America/New_York.
// targetIso is an ISO string for the launch time (UTC-aware). The countdown will show D:HH:MM:SS
async function startAtomicCountdown(targetIso, displayEl){
  stopCountdown();

  // Resolve target time as epoch ms
  const targetMs = Date.parse(targetIso);
  if(isNaN(targetMs)){
    displayEl.textContent = 'TBD';
    return;
  }

  // Fetch world time for America/New_York to establish a reliable 'now' in the Eastern timezone
  const timeUrl = 'https://worldtimeapi.org/api/timezone/America/New_York';
  let serverNowMs = Date.now();
  let perfStart = performance.now();

  try{
    countdownAbort = new AbortController();
    const res = await fetch(timeUrl, { signal: countdownAbort.signal });
    if(res.ok){
      const json = await res.json();
      // worldtimeapi provides unixtime (seconds) and datetime; prefer unixtime for simplicity
      if(json.unixtime){
        serverNowMs = (json.unixtime * 1000) + (json.raw_offset || 0) * 1000 + (json.dst_offset || 0) * 1000;
      }else if(json.datetime){
        serverNowMs = Date.parse(json.datetime);
      }
    }
  }catch(e){
    // If the fetch fails, fall back to local clock (not ideal but still works)
    try{ console.warn('worldtimeapi fetch failed, falling back to local time', e); }catch(_){}
    serverNowMs = Date.now();
  }finally{
    perfStart = performance.now();
    countdownAbort = null;
  }

  // Update the display every 250ms for smooth seconds rollover
  function tick(){
    const nowMs = serverNowMs + (performance.now() - perfStart);
    let diff = Math.max(0, targetMs - nowMs);

    const totalSeconds = Math.floor(diff / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);

    // Format: D:HH:MM:SS with zero padding for HH/MM/SS, days as variable width
    const daysStr = String(days);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    displayEl.textContent = '(-' + `${daysStr}:${hh}:${mm}:${ss}` + ')';

    if(diff <= 0){
      // countdown finished — clear interval and show zeros
      stopCountdown();
      return;
    }
  }

  // run immediately and then every second
  tick();
  countdownInterval = setInterval(tick, 1000);
}

// Render a single retro watch tile for the next Florida launch — populate listEl directly
function renderSingle(next, totalFlorida){
  // ensure listEl acts as the tile container (avoid nesting another .watch-tile)
  listEl.className = 'watch-tile';
  listEl.innerHTML = '';

  stopCountdown();

  if(!next){
    listEl.innerHTML = '<div class="empty">No upcoming Florida launches found.</div>';
    return;
  }

  const l = next;

  // Time wrapper
  const tWrap = document.createElement('div');
  tWrap.className = 'time-wrap';

  // Small label above the date
  const label = document.createElement('div');
  label.className = 'next-label';
  label.textContent = 'Next Launch:';
  tWrap.appendChild(label);

  // Build the NET display using weekday + month/day and time, omitting the year to save space
  const parts = formatNetParts(l.net || l.window_start || l.window_end);
  const dateLine = parts.dateLabel; // e.g., "Mon Aug 20"
  const timeLine = parts.timeLabel; // e.g., "5:30 PM"

  const timeEl = document.createElement('h1');
  timeEl.className = 'watch-time';
  // Put date and time on separate lines for responsive stacking; same size
  timeEl.textContent = `${dateLine}${timeLine ? '\n' + timeLine : ''}`;
  timeEl.title = `${dateLine}${timeLine ? ', ' + timeLine : ''}`;

  tWrap.appendChild(timeEl);

  // New countdown row below the date/time — no labels per request
  const countdownEl = document.createElement('div');
  countdownEl.className = 'watch-time countdown'; 
  countdownEl.textContent = '...';
  // make it a separate row
  tWrap.appendChild(countdownEl);

  listEl.appendChild(tWrap);

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

  // Start the atomic countdown using the launch's NET (or window_start/window_end fallback)
  const targetIso = l.net || l.window_start || l.window_end;
  startAtomicCountdown(targetIso, countdownEl);
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
