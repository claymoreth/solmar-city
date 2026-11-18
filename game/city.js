// city.js — the world of Solmar City: roads, buildings, districts, POIs, lamps.
// Everything is generated from a fixed seed, so the city is the same every run.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  S.WORLD_W = 3600;
  S.WORLD_H = 2400;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  S.rng = mulberry32(20261118);
  S.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  S.dist = function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); };

  // Road network: vertical roads and horizontal roads, 140 px wide.
  S.ROAD_W = 140;
  S.V_ROADS = [300, 900, 1500, 2100, 2700, 3300];
  S.H_ROADS = [300, 900, 1500, 2100];

  S.onRoad = function (x, y) {
    for (var i = 0; i < S.V_ROADS.length; i++) {
      if (Math.abs(x - S.V_ROADS[i]) <= S.ROAD_W / 2) return true;
    }
    for (var j = 0; j < S.H_ROADS.length; j++) {
      if (Math.abs(y - S.H_ROADS[j]) <= S.ROAD_W / 2) return true;
    }
    return false;
  };

  S.DISTRICTS = [
    { name: 'Downtown', x: 0, y: 0, w: 1200, h: 1200, tint: '#2a3140' },
    { name: 'Northside', x: 1200, y: 0, w: 1200, h: 1200, tint: '#26303a' },
    { name: 'Hillside', x: 2400, y: 0, w: 1200, h: 1200, tint: '#2e3440' },
    { name: 'Beachside', x: 0, y: 1200, w: 1200, h: 1200, tint: '#2c3a3a' },
    { name: 'Old Market', x: 1200, y: 1200, w: 1200, h: 1200, tint: '#38322a' },
    { name: 'Port Solmar', x: 2400, y: 1200, w: 1200, h: 1200, tint: '#33302e' },
  ];

  S.districtAt = function (x, y) {
    for (var i = 0; i < S.DISTRICTS.length; i++) {
      var d = S.DISTRICTS[i];
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
    }
    return 'Solmar City';
  };

  // Points of interest.
  S.POIS = {
    garage: { x: 1450, y: 1250, label: 'GARAGE' },
    hospital: { x: 2600, y: 700, label: 'HOSPITAL' },
    gunshop: { x: 1150, y: 1550, label: 'GUN SHOP' },
    ganghq: { x: 3200, y: 2300, label: 'GANG HQ' },
    safehouse: { x: 700, y: 300, label: 'SAFEHOUSE' },
    m1drop: { x: 1600, y: 2200, label: 'DROP POINT' },
  };

  // Buildings: one or two per block between roads, with open ground around them.
  S.BUILDINGS = [];
  (function buildCity() {
    var rnd = S.rng;
    var palette = ['#4a5568', '#5d4a3a', '#3f4a5a', '#55483f', '#46525e', '#6b5a44', '#3d4a42'];
    var xs = [0].concat(S.V_ROADS.map(function (v) { return v + S.ROAD_W / 2; }));
    var xe = S.V_ROADS.map(function (v) { return v - S.ROAD_W / 2; }).concat([S.WORLD_W]);
    var ys = [0].concat(S.H_ROADS.map(function (v) { return v + S.ROAD_W / 2; }));
    var ye = S.H_ROADS.map(function (v) { return v - S.ROAD_W / 2; }).concat([S.WORLD_H]);
    for (var bi = 0; bi < xs.length; bi++) {
      for (var bj = 0; bj < ys.length; bj++) {
        var bw = xe[bi] - xs[bi], bh = ye[bj] - ys[bj];
        if (bw < 200 || bh < 200) continue;
        var n = rnd() < 0.6 ? 1 : 2;
        for (var k = 0; k < n; k++) {
          var w = 150 + rnd() * 180, h = 130 + rnd() * 160;
          var x = xs[bi] + 30 + rnd() * Math.max(1, bw - w - 60);
          var y = ys[bj] + 30 + rnd() * Math.max(1, bh - h - 60);
          S.BUILDINGS.push({
            x: x, y: y, w: w, h: h,
            color: palette[Math.floor(rnd() * palette.length)],
            lit: rnd() < 0.7,
          });
        }
      }
    }
  })();

  // Street lamps along the roads.
  S.LAMPS = [];
  (function placeLamps() {
    var i, j;
    for (i = 0; i < S.V_ROADS.length; i++) {
      for (j = 0; j < S.H_ROADS.length; j++) {
        S.LAMPS.push({ x: S.V_ROADS[i] + 62, y: S.H_ROADS[j] + 62 });
      }
    }
    for (i = 0; i < S.V_ROADS.length; i++) {
      for (var y = 500; y < S.WORLD_H; y += 500) {
        S.LAMPS.push({ x: S.V_ROADS[i] + 62, y: y });
      }
    }
    for (j = 0; j < S.H_ROADS.length; j++) {
      for (var x = 500; x < S.WORLD_W; x += 500) {
        S.LAMPS.push({ x: x, y: S.H_ROADS[j] + 62 });
      }
    }
  })();

  // Circle-vs-building collision: returns a corrected position.
  S.collide = function (x, y, r) {
    var out = { x: x, y: y, hit: false };
    for (var i = 0; i < S.BUILDINGS.length; i++) {
      var b = S.BUILDINGS[i];
      var cx = S.clamp(x, b.x, b.x + b.w);
      var cy = S.clamp(y, b.y, b.y + b.h);
      var dx = x - cx, dy = y - cy;
      var d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        out.hit = true;
        if (d2 > 0.01) {
          var d = Math.sqrt(d2);
          out.x = cx + (dx / d) * r;
          out.y = cy + (dy / d) * r;
        } else {
          out.x = x; out.y = b.y - r;
        }
        x = out.x; y = out.y;
      }
    }
    return out;
  };

  S.pointInBuilding = function (x, y) {
    for (var i = 0; i < S.BUILDINGS.length; i++) {
      var b = S.BUILDINGS[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
    return false;
  };

  // A random point on a road (for spawning traffic).
  S.randomRoadPoint = function () {
    var rnd = Math.random;
    if (rnd() < 0.5) {
      var vx = S.V_ROADS[Math.floor(rnd() * S.V_ROADS.length)];
      return { x: vx + (rnd() < 0.5 ? -35 : 35), y: rnd() * S.WORLD_H, vertical: true };
    }
    var hy = S.H_ROADS[Math.floor(rnd() * S.H_ROADS.length)];
    return { x: rnd() * S.WORLD_W, y: hy + (rnd() < 0.5 ? -35 : 35), vertical: false };
  };

  // --- Drawing ---
  S.drawCity = function (ctx, cam, timeOfDay) {
    var x0 = cam.x - 40, y0 = cam.y - 40, x1 = cam.x + 1320, y1 = cam.y + 760;
    // Ground, tinted per district.
    ctx.fillStyle = '#232a1e';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (var d = 0; d < S.DISTRICTS.length; d++) {
      var dt = S.DISTRICTS[d];
      if (dt.x + dt.w < x0 || dt.x > x1 || dt.y + dt.h < y0 || dt.y > y1) continue;
      ctx.fillStyle = dt.tint;
      ctx.fillRect(dt.x, dt.y, dt.w, dt.h);
    }
    // Roads.
    ctx.fillStyle = '#2e2e33';
    var i, j;
    for (i = 0; i < S.V_ROADS.length; i++) {
      ctx.fillRect(S.V_ROADS[i] - S.ROAD_W / 2, 0, S.ROAD_W, S.WORLD_H);
    }
    for (j = 0; j < S.H_ROADS.length; j++) {
      ctx.fillRect(0, S.H_ROADS[j] - S.ROAD_W / 2, S.WORLD_W, S.ROAD_W);
    }
    // Road centre dashes.
    ctx.strokeStyle = 'rgba(255,220,90,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (i = 0; i < S.V_ROADS.length; i++) {
      ctx.moveTo(S.V_ROADS[i], 0); ctx.lineTo(S.V_ROADS[i], S.WORLD_H);
    }
    for (j = 0; j < S.H_ROADS.length; j++) {
      ctx.moveTo(0, S.H_ROADS[j]); ctx.lineTo(S.WORLD_W, S.H_ROADS[j]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Buildings.
    for (var b = 0; b < S.BUILDINGS.length; b++) {
      var bd = S.BUILDINGS[b];
      if (bd.x + bd.w < x0 || bd.x > x1 || bd.y + bd.h < y0 || bd.y > y1) continue;
      ctx.fillStyle = '#16181d';
      ctx.fillRect(bd.x + 6, bd.y + 6, bd.w, bd.h);
      ctx.fillStyle = bd.color;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bd.x, bd.y, bd.w, bd.h);
      // Windows.
      var cols = Math.max(2, Math.floor(bd.w / 46));
      var rows = Math.max(2, Math.floor(bd.h / 46));
      for (var wx = 0; wx < cols; wx++) {
        for (var wy = 0; wy < rows; wy++) {
          var lit = bd.lit && ((wx * 7 + wy * 13 + b) % 3 !== 0);
          ctx.fillStyle = (timeOfDay === 'night' && lit) ? '#ffd76a' : 'rgba(180,200,220,0.35)';
          ctx.fillRect(bd.x + 12 + wx * ((bd.w - 24) / cols), bd.y + 12 + wy * ((bd.h - 24) / rows), 16, 14);
        }
      }
    }
    // POI markers.
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.textAlign = 'center';
    var keys = Object.keys(S.POIS);
    for (var p = 0; p < keys.length; p++) {
      var poi = S.POIS[keys[p]];
      if (poi.x < x0 || poi.x > x1 || poi.y < y0 || poi.y > y1) continue;
      ctx.fillStyle = 'rgba(255,215,94,0.9)';
      ctx.beginPath(); ctx.arc(poi.x, poi.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillText('!', poi.x, poi.y + 5);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(poi.label, poi.x, poi.y - 14);
    }
    // Street lamps (poles; glow is drawn at night by main.js).
    ctx.fillStyle = '#3a3f47';
    for (var l = 0; l < S.LAMPS.length; l++) {
      var lm = S.LAMPS[l];
      if (lm.x < x0 || lm.x > x1 || lm.y < y0 || lm.y > y1) continue;
      ctx.fillRect(lm.x - 2, lm.y - 2, 4, 4);
    }
  };
})(window.SOLMAR);
