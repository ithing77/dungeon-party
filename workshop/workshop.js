// 작은 에버퀘스트 작업실: 🖼 이미지(이 게임 그림) / 🗂 리소스(공용 창고 구경) / 🔊 소리(칸마다 파일·음량)
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  function say(text, bad) {
    $('status').textContent = text;
    $('status').classList.toggle('bad', Boolean(bad));
  }

  // ───────── 탭 ─────────
  let mapsStarted = false;
  function showTab(name) {
    for (const b of document.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === name);
    for (const id of ['maps', 'images', 'res', 'sound']) $(id).hidden = id !== name;
    if (name === 'maps' && !mapsStarted) {
      mapsStarted = true;
      window.MapEditor.start();
    }
    if (name === 'res' && !$('resFrame').src) $('resFrame').src = 'resources.html';
    if (name === 'sound') loadSounds();
    try { localStorage.setItem('mmTab', name); } catch (e) {}
  }
  for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => showTab(b.dataset.tab));

  // ───────── 🖼 이미지 ─────────
  // 게임 코드가 찾는 그림 이름. 파일이 없으면 게임은 코드로 그린 임시 그림을 쓴다.
  const IMAGES = [
    ['던전', [
      ['wall_stone_01', '돌벽'], ['floor_stone_01', '돌바닥'], ['ceiling_01', '천장'], ['door_wood_01', '나무문'],
      ['wall_hidden_01', '숨겨진 문', '없으면 그 구역 벽 그림에 줄눈만 덧그림'], ['stairs_down_01', '계단'],
    ]],
    ['구역: 입구', [['wall_stone_02', '금 간 돌벽 (변형)']]],
    ['구역: 이끼 미로', [['wall_moss_01', '이끼 벽'], ['wall_moss_02', '뿌리 벽 (변형)'], ['floor_wet_01', '젖은 바닥']]],
    ['구역: 깊은 동굴', [['wall_cave_01', '동굴 벽'], ['wall_cave_02', '수정 벽 (변형)'], ['floor_cave_01', '동굴 바닥'], ['ceiling_cave_01', '동굴 천장']]],
    ['구역: 잊힌 사당', [['wall_shrine_01', '사당 벽'], ['wall_shrine_02', '조각 벽 (변형)']]],
    ['횃불·소품', [['prop_torch', '벽 횃불'], ['decor', '바닥 소품 8칸', '4×2: 뼈·상자·거미줄·돌무더기 / 통·해골초·쇠사슬·수정']]],
    ['마을', [['wall_town_01', '마을 벽'], ['floor_town_01', '마을 바닥'], ['prop_campfire', '모닥불'], ['npc_merchant', '상인 (예전, 지금은 안 씀)']]],
    ['건물·이벤트 앞면 (벽에 보임)', [['facade_shop', '잡화점 문'], ['facade_inn', '여관 문'], ['facade_map', '지도 제작소 문'], ['facade_altar', '사당 제단']]],
    ['건물·이벤트 안 (들어가면 보이는 그림)', [['interior_shop', '잡화점 안'], ['interior_inn', '여관 안'], ['interior_map', '지도 제작소 안'], ['event_altar', '잊힌 제단']]],
    ['스킬 아이콘', [['skills', '스킬 4칸', '도발·방패·급소 사격·뒤로 빠지기 (4×1)']]],
    ['몬스터', [
      ['mon_wolf_idle', '늑대 기본'], ['mon_wolf_hit', '늑대 맞음'], ['mon_rat_idle', '거대쥐 기본'], ['mon_rat_hit', '거대쥐 맞음'],
      ['mon_boar_idle', '멧돼지 기본'], ['mon_boar_hit', '멧돼지 맞음'],
    ]],
    ['묶음 그림', [['nodes', '채집물 8칸', '윗줄 캘 수 있음 · 아랫줄 캔 뒤 (4×2)'], ['items', '아이템 아이콘 20칸', '4×5, 순서는 shared/items.ts']]],
    ['손 (1인칭 무기)', [['hand_sword', '검 든 손 (전사)'], ['hand_dagger', '단검 든 손 (사냥꾼)', '없으면 검 든 손'], ['hand_bow', '활 든 손 (쏠 때만)']]],
    ['초상화', [['portrait_warrior', '전사'], ['portrait_hunter', '사냥꾼']]],
  ];
  let files = [];

  async function loadImages() {
    try {
      files = await (await fetch('/api/images')).json();
    } catch (e) {
      say('그림 목록을 못 읽었어. 바탕화면 작업실 아이콘으로 열었는지 확인해 줘.', true);
      return;
    }
    const known = new Set(IMAGES.flatMap(([, list]) => list.map(([n]) => n)));
    const extra = files.filter((f) => !known.has(f.name.replace(/\.png$/, ''))).map((f) => [f.name.replace(/\.png$/, ''), f.name]);
    const groups = extra.length ? [...IMAGES, ['기타', extra]] : IMAGES;
    $('imageGroups').innerHTML = groups.map(([group, list]) => `<div class="group">${esc(group)}</div><div class="cards">${list.map(([name, label, hint]) => {
      const f = files.find((x) => x.name === name + '.png');
      return f
        ? `<div class="card" data-img="${esc(name)}"><img class="thumb" loading="lazy" src="${window.ASSET_BASE}${encodeURIComponent(f.name)}?v=${f.bytes}" alt=""><div class="n">${esc(label)}</div><div class="p">${esc(f.name)} · ${f.size ? f.size.join('×') : ''}</div></div>`
        : `<div class="card missing" title="${esc(hint || '')}"><div class="thumb"></div><div class="n">${esc(label)}</div><div class="p">${esc(name)}.png · 아직 없음${hint ? ' · ' + esc(hint) : ' · 임시 그림'}</div></div>`;
    }).join('')}</div>`).join('');
  }

  $('imageGroups').addEventListener('click', (e) => {
    const card = e.target.closest('[data-img]');
    if (!card) return;
    for (const c of document.querySelectorAll('.card.on')) c.classList.remove('on');
    card.classList.add('on');
    const f = files.find((x) => x.name === card.dataset.img + '.png');
    const label = card.querySelector('.n').textContent;
    const path = 'C:\\AI\\MightMagic\\assets\\' + f.name;
    $('imageSide').innerHTML = `<img src="${window.ASSET_BASE}${encodeURIComponent(f.name)}?v=${f.bytes}" alt="${esc(label)}">
      <h3>${esc(label)}</h3>
      <div class="kv"><div>파일</div><div>${esc(f.name)}</div><div>크기</div><div>${f.size ? f.size.join(' × ') : '?'}</div>
      <div>용량</div><div>${(f.bytes / 1024 / 1024).toFixed(1)} MB</div><div>경로</div><div>${esc(path)}</div></div>
      <p class="note" style="margin-top:10px"><button type="button" id="copyPath">📋 경로 복사</button> <span id="copied"></span></p>
      <p class="note">다시 만들고 싶으면 대화창에 "${esc(label)} 다시 만들어 줘" 라고 말해 줘.</p>`;
    $('copyPath').onclick = () => navigator.clipboard.writeText(path).then(() => { $('copied').textContent = '복사했어'; });
  });

  // ───────── 🔊 소리 ─────────
  // 게임이 소리를 내는 칸. 이름(키)은 client/src/sound.ts 와 같아야 한다.
  const SLOTS = [
    ['전투', [['swordSwing', '칼 휘두르기'], ['swordHit', '칼에 맞음'], ['bowShot', '활 쏘기'], ['arrowHit', '화살 맞음'], ['partyHurt', '파티원이 맞음'], ['partyDown', '파티원 쓰러짐']]],
    ['늑대', [['wolfBite', '늑대가 묾'], ['wolfAggro', '늑대가 알아챔'], ['wolfHurt', '늑대 아파함'], ['wolfDie', '늑대 쓰러짐']]],
    ['거대쥐', [['ratBite', '쥐가 묾'], ['ratAggro', '쥐가 알아챔'], ['ratHurt', '쥐 아파함'], ['ratDie', '쥐 쓰러짐']]],
    ['멧돼지', [['boarAttack', '멧돼지 들이받음'], ['boarAggro', '멧돼지 무리가 알아챔'], ['boarHurt', '멧돼지 아파함'], ['boarDie', '멧돼지 쓰러짐']]],
    ['던전', [['footstep', '발소리'], ['doorOpen', '문 열기'], ['doorClose', '문 닫기'], ['hiddenDoor', '숨겨진 문'], ['stairs', '계단 오르내림']]],
    ['채집', [['gatherWood', '나무 베기'], ['gatherPick', '광맥 캐기'], ['gatherHerb', '약초·버섯 따기'], ['gatherDone', '채집 끝']]],
    ['화면·마을', [['uiClick', '버튼·장착'], ['coin', '돈 받음·냄'], ['pickup', '가방 주움'], ['bagFull', '가방 꽉 참']]],
    ['환경음: 구역에 계속 깔림 (긴 고리 소리)', [
      ['amb_entrance', '입구'], ['amb_hall', '기둥 홀'], ['amb_greathall', '대전당'], ['amb_maze', '이끼 미로'],
      ['amb_deep', '깊은 동굴'], ['amb_shrine', '잊힌 사당'], ['amb_town', '마을'],
    ]],
    ['환경음: 건물 안', [['amb_shop', '잡화점 안'], ['amb_inn', '여관 안'], ['amb_map', '지도 제작소 안'], ['amb_altar', '제단 앞']]],
    ['환경음: 가까울수록 커짐', [['loop_torch', '벽 횃불 타닥임'], ['loop_campfire', '모닥불']]],
    ['환경음: 가끔 들리는 먼 소리 (8~22초마다)', [
      ['spot_entrance', '입구'], ['spot_maze', '이끼 미로'], ['spot_deep', '깊은 동굴'], ['spot_greathall', '대전당'], ['spot_town', '마을'],
    ]],
  ];
  const PAGE = 100;
  let slots = {};
  let lib = [];
  let credits = {};
  let shown = PAGE;
  let saveTimer = null;
  let audio = null;
  let soundsLoaded = false;

  const slotOf = (kind) => (slots[kind] = slots[kind] || { files: [], gain: 0.7 });
  const usable = (item) => /^CC(0| BY)/.test((item.packInfo && item.packInfo.license) || '');
  const libUrl = (src) => '/lib/' + src.split('/').map(encodeURIComponent).join('/');
  const sfxUrl = (name) => window.ASSET_BASE + 'sfx/' + encodeURIComponent(name);

  function listen(url, gain = 1, rate = 1, max = 0) {
    if (audio) audio.pause();
    audio = new Audio(url);
    audio.volume = Math.min(1, gain);
    audio.playbackRate = rate;
    audio.preservesPitch = false;
    audio.play().catch(() => say('이 파일은 재생하지 못했어.', true));
    if (max) {
      const a = audio;
      setTimeout(() => a.pause(), max * 1000);
    }
  }

  function trySlot(kind) {
    const s = slotOf(kind);
    if (!s.files.length) return say('이 칸엔 아직 소리가 없어.', true);
    const name = s.files[Math.floor(Math.random() * s.files.length)];
    listen(sfxUrl(name), s.gain ?? 0.7, s.rate || 1, s.max || 0);
  }

  // 슬라이더를 끄는 동안 여러 번 쓰지 않게 잠깐 기다렸다 저장한다.
  function save(now) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      say('저장하는 중…');
      const res = await fetch('/api/sounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(slots) });
      if (!res.ok) return say('저장 못 함: ' + (await res.text()), true);
      slots = await res.json();
      credits = await (await fetch('/assets/sfx/credits.json')).json();
      say('저장됨 · 게임을 새로고침하면 들려');
      renderSlots();
      renderList();
    }, now ? 0 : 350);
  }

  const nameOf = (file) => (credits[file] && credits[file].src.split('/').pop()) || file;

  function renderSlots() {
    $('slots').innerHTML = SLOTS.map(([group, list]) => `<div class="group">${group}</div><div class="grid">${list.map(([kind, label]) => {
      const s = slotOf(kind);
      const filesHtml = s.files.length
        ? s.files.map((name) => `<div class="file"><button type="button" data-play-file="${esc(name)}">듣기</button><span title="${esc((credits[name] && credits[name].src) || name)}">${esc(nameOf(name))}</span><button type="button" data-kind="${kind}" data-remove="${esc(name)}">빼기</button></div>`).join('')
        : '<p class="empty">파일 없음 · 소리 안 남</p>';
      const gain = s.gain ?? 0.7;
      return `<div class="slot">
        <div class="slot-head"><b>${label} <small>${kind}</small></b><button type="button" data-try="${kind}">듣기</button><button type="button" data-pick="${kind}">소리 찾기</button></div>
        ${filesHtml}
        <label class="range"><span>음량</span><input type="range" min="0" max="1.5" step="0.05" value="${gain}" data-kind="${kind}" data-field="gain"><em>${Math.round(gain * 100)}%</em></label>
        <label class="range"><span>높낮이</span><input type="range" min="0.5" max="1.5" step="0.05" value="${s.rate || 1}" data-kind="${kind}" data-field="rate"><em>${Math.round((s.rate || 1) * 100)}%</em></label>
        <label class="range"><span>길이 제한</span><input type="range" min="0" max="3" step="0.05" value="${s.max || 0}" data-kind="${kind}" data-field="max"><em>${s.max ? s.max.toFixed(2) + '초' : '없음'}</em></label>
      </div>`;
    }).join('')}</div>`).join('');
  }

  function matches() {
    const q = $('q').value.trim().toLowerCase();
    const cat = $('cat').value;
    return lib.filter((item) => {
      if (cat && item.cat !== cat) return false;
      if ($('onlyOk').checked && !usable(item)) return false;
      return !q || `${item.name} ${item.src} ${(item.packInfo && item.packInfo.name) || ''}`.toLowerCase().includes(q);
    });
  }

  function renderList() {
    if (!lib.length) return;
    const found = matches();
    const usedBy = {};
    for (const [kind, s] of Object.entries(slots)) for (const name of s.files) if (credits[name]) (usedBy[credits[name].src] = usedBy[credits[name].src] || []).push(kind);
    const label = Object.fromEntries(SLOTS.flatMap(([, list]) => list));
    $('count').textContent = `${found.length.toLocaleString()}개`;
    $('list').innerHTML = found.slice(0, shown).map((item) => {
      const ok = usable(item);
      const used = usedBy[item.src] ? `<span class="used">${usedBy[item.src].map((k) => label[k]).join(', ')}에 사용 중</span>` : '';
      return `<div class="row"><button type="button" data-play-lib="${esc(item.src)}">듣기</button><div class="name">${esc(item.name)} ${used}<span class="sub">${esc((item.packInfo && item.packInfo.name) || '')} · ${esc((item.packInfo && item.packInfo.license) || '라이선스 모름')}</span></div><button type="button" data-add="${esc(item.src)}"${ok ? '' : ' disabled title="나눠 줄 수 없는 라이선스"'}>칸에 넣기</button></div>`;
    }).join('');
    $('more').hidden = found.length <= shown;
  }

  function showSoundView(libView) {
    $('usedView').hidden = libView;
    $('libView').hidden = !libView;
    $('tabUsed').classList.toggle('on', !libView);
    $('tabLib').classList.toggle('on', libView);
    if (libView) loadLibrary();
  }

  async function loadLibrary() {
    if (lib.length) return;
    say('보관함을 읽는 중…');
    try {
      lib = await (await fetch('/lib/index.json')).json();
      const cats = [...new Set(lib.map((i) => i.cat))].filter(Boolean);
      $('cat').innerHTML = '<option value="">모든 종류</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
      say('');
      renderList();
    } catch (e) {
      say('보관함을 못 읽었어.', true);
    }
  }

  async function loadSounds() {
    if (soundsLoaded) return;
    soundsLoaded = true;
    $('target').innerHTML = SLOTS.map(([group, list]) => `<optgroup label="${group}">${list.map(([k, l]) => `<option value="${k}">${l}에 넣기</option>`).join('')}</optgroup>`).join('');
    try {
      slots = await (await fetch('/assets/sfx/sound.json')).json();
      credits = await (await fetch('/assets/sfx/credits.json')).json();
    } catch (e) {
      slots = {};
      credits = {};
    }
    renderSlots();
  }

  $('tabUsed').addEventListener('click', () => showSoundView(false));
  $('tabLib').addEventListener('click', () => showSoundView(true));
  $('slots').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.try) trySlot(b.dataset.try);
    if (b.dataset.playFile) {
      const s = Object.values(slots).find((x) => x.files.includes(b.dataset.playFile)) || {};
      listen(sfxUrl(b.dataset.playFile), s.gain ?? 0.7, s.rate || 1, s.max || 0);
    }
    if (b.dataset.remove) {
      const s = slotOf(b.dataset.kind);
      s.files = s.files.filter((n) => n !== b.dataset.remove);
      save(true);
    }
    if (b.dataset.pick) {
      $('target').value = b.dataset.pick;
      showSoundView(true);
    }
  });
  $('slots').addEventListener('input', (e) => {
    const { kind, field } = e.target.dataset;
    if (!kind) return;
    const s = slotOf(kind);
    const v = Number(e.target.value);
    if (field === 'max' && v === 0) delete s.max;
    else s[field] = v;
    e.target.parentElement.querySelector('em').textContent = field === 'max' ? (v ? v.toFixed(2) + '초' : '없음') : Math.round(v * 100) + '%';
    save();
  });
  $('list').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.playLib) listen(libUrl(b.dataset.playLib));
    if (b.dataset.add) {
      slotOf($('target').value).files.push('lib:' + b.dataset.add);
      save(true);
    }
  });
  ['q', 'cat', 'onlyOk'].forEach((id) => $(id).addEventListener('input', () => {
    shown = PAGE;
    renderList();
  }));
  $('more').addEventListener('click', () => {
    shown += PAGE;
    renderList();
  });

  loadImages();
  let first = 'maps';
  try { first = localStorage.getItem('mmTab') || first; } catch (e) {}
  showTab((window.STATIC ? ['maps', 'images', 'sound'] : ['maps', 'images', 'res', 'sound']).includes(first) ? first : 'maps');
})();
