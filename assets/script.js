// assets/script.js — Cyweb core behavior (reconstructed and extended)
// Note: This implementation is original code, inspired by CydiaWeb behavior.
// It attempts to fetch Packages / Packages.gz and parse APT package metadata.
// Many repos will block cross-origin requests - see README for proxy options.

const state = {
  repos: JSON.parse(localStorage.getItem('cyweb.repos') || '[]'),
  indexes: {}, // repoUrl -> packages array
};

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

// tabs
qsa('.cydia-nav li').forEach(li=> li.addEventListener('click', ()=>{
  qsa('.cydia-nav li').forEach(x=>x.classList.remove('active'));
  li.classList.add('active');
  const tab = li.dataset.tab;
  qsa('.tab-panel').forEach(p=> p.classList.add('hidden'));
  document.getElementById(tab).classList.remove('hidden');
}));

// render repos
function saveRepos(){ localStorage.setItem('cyweb.repos', JSON.stringify(state.repos)); }
function renderRepos(){
  const list = qs('#repo-list');
  list.innerHTML = '';
  state.repos.forEach(r=>{
    const li = document.createElement('li');
    li.className = 'repo-item';
    li.innerHTML = `
      <img src="${r.icon || 'assets/logo.jpeg'}" alt="icon">
      <div class="repo-meta"><div style="font-weight:700">${r.name || r.url}</div><div style="color:#666;font-size:13px">${r.url}</div><div style="color:#999;font-size:12px">Compatibility: ${r.compat || 'any'}</div></div>
      <div class="repo-actions">
        <button data-url="${r.url}" class="btn-fetch">Fetch</button>
        <button data-url="${r.url}" class="btn-list">List</button>
        <button data-url="${r.url}" class="btn-remove">Remove</button>
      </div>
    `;
    list.appendChild(li);
  });
  qsa('.btn-fetch').forEach(b=> b.addEventListener('click', e=> fetchRepo(e.target.dataset.url)));
  qsa('.btn-list').forEach(b=> b.addEventListener('click', e=> showRepoPackages(e.target.dataset.url)));
  qsa('.btn-remove').forEach(b=> b.addEventListener('click', e=>{ state.repos = state.repos.filter(rr=> rr.url !== e.target.dataset.url); saveRepos(); renderRepos(); }));
}

// add repo
qs('#add-repo-btn').addEventListener('click', ()=>{
  const url = qs('#repo-url').value.trim();
  const name = qs('#repo-name').value.trim();
  if(!url) return alert('Enter repo URL');
  state.repos.push({url, name: name || url});
  saveRepos();
  renderRepos();
  qs('#repo-url').value=''; qs('#repo-name').value='';
});

// sample repos
qs('#add-sample').addEventListener('click', ()=>{
  const samples = [
    {url:'https://havoc.app/', name:'Havoc', compat:'iOS 12+'},
    {url:'https://repo.chariz.com/', name:'Chariz', compat:'iOS 10+'},
    {url:'https://apt.procurs.us/', name:'Procursus', compat:'iOS 11+'}
  ];
  samples.forEach(s=>{ if(!state.repos.some(r=> r.url === s.url)) state.repos.push(s); });
  saveRepos(); renderRepos();
});

qs('#refresh-all').addEventListener('click', ()=>{
  state.repos.forEach(r=> fetchRepo(r.url));
});

// fetch repo packages (try common locations)
async function fetchRepo(base){
  const tryPaths = ['Packages','Packages.gz','Packages.bz2','dists/stable/main/binary-amd64/Packages'];
  const tried = [];
  for(const p of tryPaths){
    const url = (base.endsWith('/')? base: base + '/') + p;
    tried.push(url);
    try{
      const resp = await fetch(url);
      if(!resp.ok) continue;
      let text;
      if(p.endsWith('.gz') || resp.headers.get('content-encoding')==='gzip'){
        const buf = await resp.arrayBuffer();
        const str = pako.ungzip(new Uint8Array(buf), { to: 'string' });
        text = str;
      } else {
        text = await resp.text();
      }
      parsePackages(base, text);
      alert('Fetched packages from ' + url);
      return;
    } catch(err){
      // continue to next path
      continue;
    }
  }
  alert('Failed to fetch Packages. Tried:\\n' + tried.join('\\n') + '\\nMany repos block cross-origin requests.');
}

// parse APT Packages content
function parsePackages(repoBase, raw){
  const blocks = raw.split(/\\n\\n+/).map(s=>s.trim()).filter(Boolean);
  const pkgs = [];
  for(const b of blocks){
    const lines = b.split(/\\n/);
    const obj = {};
    for(const l of lines){
      const m = l.match(/^([^:]+):\\s*(.*)$/);
      if(m) obj[m[1].trim()] = m[2].trim();
    }
    if(obj.Package) pkgs.push({...obj, repo: repoBase});
  }
  state.indexes[repoBase] = pkgs;
  // populate featured area with first packages
  const featured = qs('#featured');
  featured.innerHTML = '';
  pkgs.slice(0,6).forEach(p=>{
    const el = document.createElement('div'); el.className='card';
    el.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><img src="${p.Icon || 'assets/logo.jpeg'}" style="width:48px;height:48px;border-radius:8px"><div><div style="font-weight:700">${p.Package}</div><div style="color:#666;font-size:13px">${p.Version || ''}</div></div></div>`;
    el.addEventListener('click', ()=> openModalDetails(p));
    featured.appendChild(el);
  });
}

// show repo packages in modal list
function showRepoPackages(url){
  const pkgs = state.indexes[url] || [];
  if(!pkgs.length) return alert('No packages indexed for that repo. Fetch it first.');
  qs('#modal-title').textContent = 'Packages — ' + url;
  const body = qs('#modal-content');
  body.innerHTML = pkgs.map(p=>`<div class="card pkg-item" data-repo="${p.repo}" data-pkg="${p.Package}" style="cursor:pointer;padding:10px"><div style="font-weight:700">${p.Package}</div><div style="color:#666">${p.Version||''}</div></div>`).join('');
  // open modal
  qs('#details').classList.remove('hidden');
  qsa('.pkg-item').forEach(el=> el.addEventListener('click', ()=>{
    const repo = el.dataset.repo; const name = el.dataset.pkg;
    const pkg = (state.indexes[repo]||[]).find(x=> x.Package === name);
    openModalDetails(pkg);
  }));
}

// modal details
function openModalDetails(pkg){
  if(!pkg) return;
  qs('#modal-title').textContent = pkg.Package;
  qs('#modal-content').innerHTML = `
    <div style="display:flex;gap:12px;align-items:center">
      <img src="${pkg.Icon || 'assets/logo.jpeg'}" style="width:72px;height:72px;border-radius:10px">
      <div>
        <div style="font-weight:700;font-size:18px">${pkg.Name || pkg.Package}</div>
        <div style="color:#666">${pkg.Description || pkg['Short-Description'] || 'No description'}</div>
        <div style="color:#999;font-size:13px;margin-top:8px">Version: ${pkg.Version || '?'} — Maintainer: ${pkg.Maintainer || '?'}</div>
      </div>
    </div>
  `;
  qs('#details').classList.remove('hidden');
  qs('#modal-install').onclick = ()=>{
    alert('Simulated install — this demo will not perform real installs. .deb URL: ' + (pkg.Filename ? pkg.repo + pkg.Filename : 'unknown'));
  };
}

// modal back
qs('#modal-back').addEventListener('click', ()=> qs('#details').classList.add('hidden'));

// create repo form
qs('#create-repo-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = qs('#cr-name').value.trim();
  const url = qs('#cr-url').value.trim();
  const icon = qs('#cr-icon').value.trim();
  const compat = qs('#cr-compat').value.trim();
  if(!name || !url) return alert('Name and URL required');
  const created = JSON.parse(localStorage.getItem('cyweb.created') || '[]');
  created.push({name, url, icon, compat});
  localStorage.setItem('cyweb.created', JSON.stringify(created));
  // also add to main repo list
  if(!state.repos.some(r=> r.url === url)) { state.repos.push({name, url, icon, compat}); saveRepos(); renderRepos(); }
  e.target.reset();
  renderCreated();
});

function renderCreated(){
  const list = JSON.parse(localStorage.getItem('cyweb.created') || '[]');
  const out = qs('#created-repos');
  out.innerHTML = '<h4>Your created repos (local)</h4>' + (list.length ? list.map(r=>`<div class="card"><div style="font-weight:700">${r.name}</div><div style="color:#666">${r.url}</div><div style="color:#999">Compatibility: ${r.compat || 'any'}</div></div>`).join('') : '<div style="color:#666">No created repos yet</div>');
}

qs('#search-input').addEventListener('input', ()=>{
  const q = qs('#search-input').value.trim().toLowerCase();
  const all = Object.values(state.indexes).flat();
  const filtered = all.filter(p=> (p.Package||'').toLowerCase().includes(q) || (p.Name||'').toLowerCase().includes(q) || (p.Maintainer||'').toLowerCase().includes(q) );
  qs('#search-results').innerHTML = filtered.length ? filtered.map(p=>`<div class="card" data-repo="${p.repo}" data-pkg="${p.Package}"><div style="font-weight:700">${p.Package}</div><div style="color:#666">${p.Version||''}</div></div>`).join('') : '<div style="color:#666">No results</div>';
  qsa('#search-results .card').forEach(el=> el.addEventListener('click', ()=>{
    const repo = el.dataset.repo; const name = el.dataset.pkg;
    const pkg = (state.indexes[repo]||[]).find(x=> x.Package === name);
    openModalDetails(pkg);
  }));
});

// init
(function init(){
  renderRepos();
  renderCreated();
})();
