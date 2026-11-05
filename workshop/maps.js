// 🗺 맵 편집기: shared/maps/<이름>.json 을 칸 단위로 칠하고 구역 네모를 그린다. 저장하면 게임을 새로고침할 때 반영.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  // 글자 뜻 (shared/map.ts 와 같아야 한다). solid = 지나갈 수 없음
  const PALETTE = [
    ['지형', [['#', '벽', '#3a3026', 1], ['.', '바닥', '#8a7a62'], ['D', '나무문', '#b07a3a'], ['H', '숨겨진 문', '#7a5ab0'], ['S', '아래층 계단', '#7fa6c4'], ['R', '은신처 자리', '#6f8f6a']]],
    ['드나들기', [['P', '시작 위치', '#f2e6c8'], ['<', '마을로 (계단)', '#9fd0ff'], ['>', '1층으로 (계단)', '#9fd0ff']]],
    ['몬스터 (붙여 놓으면 한 무리)', [['w', '늑대', '#c95a4a'], ['r', '거대쥐', '#c98a6a'], ['b', '멧돼지', '#a04a3a']]],
    ['채집', [['t', '나무', '#5f8a3a', 1], ['m', '버섯', '#a8865a', 1], ['o', '광맥', '#8a8a9a', 1], ['h', '약초', '#5a9ad0', 1]]],
    ['마을·이벤트 (벽 자리에)', [['G', '잡화점 문', '#e0a040', 1], ['I', '여관 문', '#e0a040', 1], ['K', '지도 제작소 문', '#e0a040', 1], ['A', '제단', '#e0c060', 1], ['F', '모닥불', '#ff8a30', 1], ['M', '상인 (옛날)', '#d07a30', 1]]],
  ];
  const INFO = Object.fromEntries(PALETTE.flatMap(([, list]) => list.map(([ch, name, color, solid]) => [ch, { name, color, solid: !!solid }])));
  const ZONES = ['entrance', 'hall', 'greathall', 'maze', 'deep', 'shrine', 'town'];
  const ZONE_KO = { entrance: '입구', hall: '기둥 홀', greathall: '대전당', maze: '이끼 미로', deep: '깊은 동굴', shrine: '잊힌 사당', town: '마을' };
  const ZONE_COLOR = { entrance: '#d9b35a', hall: '#c9c9c9', greathall: '#f0e0a0', maze: '#6fb06a', deep: '#a0603a', shrine: '#e0a0e0', town: '#7ab0ff' };

  let maps = {};
  let key = '';
  let rows = []; // string[] 를 칸 배열로
  let data = null;
  let ch = '.';
  let tool = 'paint'; // paint | zone
  let zoneSel = 'maze';
  let cell = 18;
  let undo = [];
  let bad = new Set(); // 검사에서 걸린 칸
  let drag = null;
  let dirty = false;

  const say = (t, isBad) => {
    $('mapStatus').textContent = t;
    $('mapStatus').classList.toggle('bad', !!isBad);
  };

  function grid() {
    return rows.map((r) => r.split(''));
  }

  function snapshot() {
    undo.push(JSON.stringify({ rows, zones: data.zones }));
    if (undo.length > 80) undo.shift();
  }

  function draw() {
    const cv = $('mapCanvas');
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    cv.width = w * cell;
    cv.height = h * cell;
    const g = cv.getContext('2d');
    g.font = `bold ${Math.round(cell * 0.62)}px "Malgun Gothic", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        const k = rows[r][c] ?? '#';
        const info = INFO[k];
        // 몬스터·채집 등은 바닥 위에 표시
        g.fillStyle = k === '#' ? '#2a231b' : k === '.' ? '#6f6250' : info && !info.solid ? '#6f6250' : '#2a231b';
        g.fillRect(c * cell, r * cell, cell, cell);
        if (k !== '#' && k !== '.' && info) {
          g.fillStyle = info.color;
          g.beginPath();
          g.arc(c * cell + cell / 2, r * cell + cell / 2, cell * 0.42, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#111';
          g.fillText(k, c * cell + cell / 2, r * cell + cell / 2 + 1);
        }
        if (bad.has(`${c},${r}`)) {
          g.strokeStyle = '#ff4040';
          g.lineWidth = 2;
          g.strokeRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
        }
      }
    // 격자
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    for (let c = 0; c <= w; c++) g.strokeRect(c * cell, 0, 0, h * cell);
    for (let r = 0; r <= h; r++) g.strokeRect(0, r * cell, w * cell, 0);
    // 구역 네모 (위에 있는 것이 이긴다 = 목록 첫 번째)
    data.zones.slice().reverse().forEach((z) => {
      const [c0, r0, c1, r1] = z.rect;
      g.fillStyle = (ZONE_COLOR[z.zone] || '#fff') + '22';
      g.fillRect(c0 * cell, r0 * cell, (c1 - c0 + 1) * cell, (r1 - r0 + 1) * cell);
      g.strokeStyle = ZONE_COLOR[z.zone] || '#fff';
      g.lineWidth = 2;
      g.strokeRect(c0 * cell + 1, r0 * cell + 1, (c1 - c0 + 1) * cell - 2, (r1 - r0 + 1) * cell - 2);
      g.fillStyle = ZONE_COLOR[z.zone] || '#fff';
      g.font = `12px "Malgun Gothic", sans-serif`;
      g.textAlign = 'left';
      g.fillText(ZONE_KO[z.zone] || z.zone, c0 * cell + 4, r0 * cell + 10);
      g.textAlign = 'center';
      g.font = `bold ${Math.round(cell * 0.62)}px "Malgun Gothic", sans-serif`;
    });
    if (drag && tool === 'zone' && drag.c1 !== undefined) {
      const c0 = Math.min(drag.c0, drag.c1), c1 = Math.max(drag.c0, drag.c1);
      const r0 = Math.min(drag.r0, drag.r1), r1 = Math.max(drag.r0, drag.r1);
      g.strokeStyle = '#fff';
      g.setLineDash([4, 3]);
      g.strokeRect(c0 * cell, r0 * cell, (c1 - c0 + 1) * cell, (r1 - r0 + 1) * cell);
      g.setLineDash([]);
    }
    renderZones();
    $('mapSize').textContent = `${w} × ${h}칸`;
  }

  function renderZones() {
    $('zoneList').innerHTML = data.zones.length
      ? data.zones.map((z, i) => `<div class="zrow"><span class="dot" style="background:${ZONE_COLOR[z.zone]}"></span>${ZONE_KO[z.zone] || z.zone} <small>[${z.rect.join(', ')}]</small><button type="button" data-zdel="${i}">지우기</button></div>`).join('')
      : `<p class="note">구역 네모가 없어. 전부 기본 구역(${ZONE_KO[data.zone]})이야.</p>`;
    $('baseZone').value = data.zone;
  }

  function at(e) {
    const r = $('mapCanvas').getBoundingClientRect();
    return { c: Math.floor((e.clientX - r.left) / cell), r: Math.floor((e.clientY - r.top) / cell) };
  }

  function setCell(c, r, k) {
    if (r < 0 || r >= rows.length || c < 0 || c >= rows[r].length) return;
    if (rows[r][c] === k) return;
    if (k === 'P') rows = rows.map((row) => row.replace('P', '.')); // 시작 위치는 하나
    rows[r] = rows[r].slice(0, c) + k + rows[r].slice(c + 1);
    dirty = true;
  }

  // ───────── 검사: 시작 위치에서 갈 수 있는지 ─────────
  function check() {
    const g = grid();
    const h = g.length, w = g[0].length;
    let start = null;
    g.forEach((row, r) => row.forEach((k, c) => { if (k === 'P') start = [c, r]; }));
    if (!start) return say('시작 위치(P)가 없어', true), false;
    const pass = (c, r) => g[r] && g[r][c] && g[r][c] !== '#' && !(INFO[g[r][c]] || {}).solid;
    const seen = new Set([start.join()]);
    const q = [start];
    while (q.length) {
      const [c, r] = q.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = [c + dc, r + dr];
        if (pass(...n) && !seen.has(n.join())) { seen.add(n.join()); q.push(n); }
      }
    }
    bad = new Set();
    let lost = 0, stuck = 0;
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        const k = g[r][c];
        if (pass(c, r) && !seen.has(`${c},${r}`)) { bad.add(`${c},${r}`); lost++; }
        // 채집물·문·제단: 옆 칸 하나는 갈 수 있어야 쓸 수 있다
        if ('tmohGIKAFM'.includes(k) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${c + dc},${r + dr}`))) { bad.add(`${c},${r}`); stuck++; }
      }
    // 맨 가장자리가 막혀 있는지
    let edge = 0;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if ((r === 0 || c === 0 || r === h - 1 || c === w - 1) && pass(c, r)) { bad.add(`${c},${r}`); edge++; }
    draw();
    if (lost || stuck || edge) {
      say(`문제 ${lost + stuck + edge}칸 (빨간 테두리): 못 가는 칸 ${lost} · 쓸 수 없는 채집물·문 ${stuck} · 바깥이 뚫린 칸 ${edge}`, true);
      return false;
    }
    say('검사 통과: 모든 칸에 갈 수 있어');
    return true;
  }

  async function save() {
    if (!check() && !confirm('문제가 있는 채로 저장할까?')) return;
    const res = await fetch('/api/maps/' + key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, rows }) });
    if (!res.ok) return say('저장 못 함: ' + (await res.text()), true);
    maps[key] = await res.json();
    dirty = false;
    say('저장됨 · 게임을 새로고침하면 바뀐 맵으로 (몬스터·채집물 자리도)');
  }

  function load(k) {
    if (dirty && !confirm('저장 안 한 칠하기가 있어. 버리고 다른 맵을 열까?')) {
      $('mapSel').value = key;
      return;
    }
    key = k;
    data = JSON.parse(JSON.stringify(maps[k]));
    rows = data.rows.slice();
    undo = [];
    bad = new Set();
    dirty = false;
    $('mapNote').textContent = data.note || '';
    draw();
    say(`${data.name} 불러옴`);
  }

  function resize(dc, dr) {
    snapshot();
    const w = rows[0].length;
    if (dc > 0) rows = rows.map((r) => r + '#');
    if (dc < 0 && w > 5) rows = rows.map((r) => r.slice(0, -1));
    if (dr > 0) rows.push('#'.repeat(rows[0].length));
    if (dr < 0 && rows.length > 5) rows.pop();
    dirty = true;
    draw();
  }

  // ───────── 화면 만들기 ─────────
  function buildPalette() {
    $('palette').innerHTML = PALETTE.map(([group, list]) => `<div class="pgroup"><div class="pg">${group}</div>${list
      .map(([k, name, color]) => `<button type="button" class="pal${k === ch ? ' on' : ''}" data-ch="${esc(k)}" title="${esc(name)} (${esc(k)})"><span class="sw" style="background:${color}">${esc(k)}</span>${esc(name)}</button>`)
      .join('')}</div>`).join('');
    $('zoneSel').innerHTML = ZONES.map((z) => `<option value="${z}">${ZONE_KO[z]}</option>`).join('');
    $('baseZone').innerHTML = $('zoneSel').innerHTML;
    $('zoneSel').value = zoneSel;
  }

  async function start() {
    buildPalette();
    try {
      maps = await (await fetch('/api/maps')).json();
    } catch (e) {
      return say('맵을 못 읽었어 (작업실 서버로 열었는지 확인)', true);
    }
    $('mapSel').innerHTML = Object.entries(maps).map(([k, m]) => `<option value="${k}">${esc(m.name)} (${k})</option>`).join('');
    load(Object.keys(maps)[0] === 'arena' && maps.floor1 ? 'floor1' : Object.keys(maps)[0]);
    $('mapSel').value = key;
  }

  $('palette').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ch]');
    if (!b) return;
    ch = b.dataset.ch;
    tool = 'paint';
    $('toolZone').classList.remove('on');
    for (const x of document.querySelectorAll('.pal')) x.classList.toggle('on', x === b);
  });
  $('toolZone').addEventListener('click', () => {
    tool = tool === 'zone' ? 'paint' : 'zone';
    $('toolZone').classList.toggle('on', tool === 'zone');
    say(tool === 'zone' ? '구역 네모: 맵 위에서 끌어서 네모를 그려 (먼저 그린 것보다 나중 것이 이긴다)' : '칠하기');
  });
  $('zoneSel').addEventListener('change', () => (zoneSel = $('zoneSel').value));
  $('baseZone').addEventListener('change', () => {
    snapshot();
    data.zone = $('baseZone').value;
    dirty = true;
    draw();
  });
  $('zoneList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zdel]');
    if (!b) return;
    snapshot();
    data.zones.splice(Number(b.dataset.zdel), 1);
    dirty = true;
    draw();
  });
  $('mapSel').addEventListener('change', () => load($('mapSel').value));
  $('zoomIn').addEventListener('click', () => { cell = Math.min(40, cell + 4); draw(); });
  $('zoomOut').addEventListener('click', () => { cell = Math.max(8, cell - 4); draw(); });
  $('undo').addEventListener('click', doUndo);
  $('check').addEventListener('click', check);
  $('saveMap').addEventListener('click', save);
  $('playMap').addEventListener('click', () => window.open(`${window.GAME_URL}/?map=${key}&dev=1`, '_blank'));
  for (const [id, dc, dr] of [['colAdd', 1, 0], ['colDel', -1, 0], ['rowAdd', 0, 1], ['rowDel', 0, -1]]) $(id).addEventListener('click', () => resize(dc, dr));

  function doUndo() {
    const s = undo.pop();
    if (!s) return say('더 되돌릴 게 없어');
    const v = JSON.parse(s);
    rows = v.rows;
    data.zones = v.zones;
    dirty = true;
    draw();
  }
  addEventListener('keydown', (e) => {
    if ($('maps').hidden) return;
    if (e.ctrlKey && e.code === 'KeyZ') { e.preventDefault(); doUndo(); }
    if (e.ctrlKey && e.code === 'KeyS') { e.preventDefault(); save(); }
  });

  const cv = $('mapCanvas');
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('mousedown', (e) => {
    const p = at(e);
    snapshot();
    if (tool === 'zone') {
      drag = { c0: p.c, r0: p.r, c1: p.c, r1: p.r };
    } else if (e.altKey) {
      // Alt+누르기: 그 칸 글자를 집는다
      const k = rows[p.r]?.[p.c];
      if (k) document.querySelector(`.pal[data-ch="${CSS.escape(k)}"]`)?.click();
      return;
    } else {
      drag = { erase: e.button === 2 };
      setCell(p.c, p.r, drag.erase ? '#' : ch);
    }
    draw();
  });
  cv.addEventListener('mousemove', (e) => {
    const p = at(e);
    const k = rows[p.r]?.[p.c];
    $('mapHover').textContent = k ? `열 ${p.c}, 줄 ${p.r} · ${INFO[k]?.name || k}` : '';
    if (!drag) return;
    if (tool === 'zone') { drag.c1 = p.c; drag.r1 = p.r; }
    else setCell(p.c, p.r, drag.erase ? '#' : ch);
    draw();
  });
  addEventListener('mouseup', () => {
    if (drag && tool === 'zone' && drag.c1 !== undefined) {
      const rect = [Math.min(drag.c0, drag.c1), Math.min(drag.r0, drag.r1), Math.max(drag.c0, drag.c1), Math.max(drag.r0, drag.r1)];
      data.zones.unshift({ zone: zoneSel, rect }); // 나중에 그린 게 이긴다
      dirty = true;
    }
    drag = null;
    if (data) draw();
  });

  window.MapEditor = { start };
})();
