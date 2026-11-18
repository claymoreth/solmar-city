// hud.js — HUD text, minimap, full-city map and toast messages.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var toastTimer = null;

  function el(id) { return document.getElementById(id); }

  S.hud = {
    toast: function (msg) {
      var t = el('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.remove('hidden');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3200);
    },

    update: function () {
      var p = S.player;
      if (!p) return;
      el('cash-text').textContent = '$' + Math.round(p.cash);
      el('hp-text').textContent = Math.max(0, Math.round(p.hp));
      el('hp-fill').style.width = Math.max(0, p.hp) + '%';
      el('ammo-text').textContent = 'Ammo ' + p.ammo + ' / ' + p.reserveAmmo + (p.reloading ? ' (reloading...)' : '') + ' — ' + p.weaponStats().name;
      el('level-text').textContent = 'LV ' + p.level + ' • ' + p.xp + ' XP';
      var def = S.missions.currentDef();
      var active = S.missions.active;
      if (active) {
        var d = S.missions.defs[active.n - 1];
        el('mission-text').textContent = d.name;
        el('objective-text').textContent = d.objective;
        el('counter-text').textContent = S.missions.counterText();
      } else if (def) {
        el('mission-text').textContent = def.name + ' — ready';
        el('objective-text').textContent = def.objective;
        el('counter-text').textContent = '';
      } else {
        el('mission-text').textContent = 'All missions complete';
        el('objective-text').textContent = 'Free roam — Solmar City is yours';
        el('counter-text').textContent = '';
      }
      var w = S.police.wanted;
      el('wanted-text').textContent = w > 0 ? '★'.repeat(w) + '☆'.repeat(5 - w) : '';
      var tod = S.G.timeOfDay;
      el('tod-text').textContent = tod === 'day' ? '☀ DAY' : tod === 'dusk' ? '◐ DUSK' : '☾ NIGHT';
      el('district-text').textContent = S.districtAt(p.x, p.y);
      this.drawMinimap();
    },

    drawMinimap: function () {
      var cv = el('minimap');
      if (!cv) return;
      var ctx = cv.getContext('2d');
      var sx = 200 / S.WORLD_W, sy = 140 / S.WORLD_H;
      ctx.fillStyle = '#0e1420';
      ctx.fillRect(0, 0, 200, 140);
      ctx.fillStyle = '#3a3f47';
      var i;
      for (i = 0; i < S.V_ROADS.length; i++) ctx.fillRect(S.V_ROADS[i] * sx - 2, 0, 4, 140);
      for (i = 0; i < S.H_ROADS.length; i++) ctx.fillRect(0, S.H_ROADS[i] * sy - 2, 200, 4);
      // Mission marker.
      var mk = S.missions.objectiveMarker();
      if (mk) {
        ctx.fillStyle = '#ffd75e';
        ctx.beginPath(); ctx.arc(mk.x * sx, mk.y * sy, 5, 0, Math.PI * 2); ctx.fill();
      }
      // Cops.
      ctx.fillStyle = '#ff4d4d';
      for (i = 0; i < S.police.cops.length; i++) {
        var c = S.police.cops[i];
        ctx.beginPath(); ctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
      }
      // Heli.
      if (S.police.heli) {
        ctx.fillStyle = '#4db8ff';
        ctx.beginPath(); ctx.arc(S.police.heli.x * sx, S.police.heli.y * sy, 4, 0, Math.PI * 2); ctx.fill();
      }
      // Rival.
      if (S.missions.rival) {
        ctx.fillStyle = '#c060ff';
        ctx.beginPath(); ctx.arc(S.missions.rival.x * sx, S.missions.rival.y * sy, 4, 0, Math.PI * 2); ctx.fill();
      }
      // Player.
      var p = S.player;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd75e';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
    },

    drawMap: function () {
      var cv = el('map-canvas');
      if (!cv) return;
      var ctx = cv.getContext('2d');
      var sx = 900 / S.WORLD_W, sy = 600 / S.WORLD_H;
      ctx.fillStyle = '#0e1420';
      ctx.fillRect(0, 0, 900, 600);
      for (var d = 0; d < S.DISTRICTS.length; d++) {
        var dt = S.DISTRICTS[d];
        ctx.fillStyle = dt.tint;
        ctx.fillRect(dt.x * sx, dt.y * sy, dt.w * sx, dt.h * sy);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 13px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dt.name.toUpperCase(), (dt.x + dt.w / 2) * sx, (dt.y + dt.h / 2) * sy);
      }
      ctx.fillStyle = '#3a3f47';
      var i;
      for (i = 0; i < S.V_ROADS.length; i++) ctx.fillRect(S.V_ROADS[i] * sx - 5, 0, 10, 600);
      for (i = 0; i < S.H_ROADS.length; i++) ctx.fillRect(0, S.H_ROADS[i] * sy - 5, 900, 10);
      ctx.fillStyle = '#ffd75e';
      ctx.font = 'bold 11px Verdana, sans-serif';
      var keys = Object.keys(S.POIS);
      for (var k = 0; k < keys.length; k++) {
        var poi = S.POIS[keys[k]];
        ctx.beginPath(); ctx.arc(poi.x * sx, poi.y * sy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(poi.label, poi.x * sx, poi.y * sy - 9);
      }
      var p = S.player;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd75e';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 9, 0, Math.PI * 2); ctx.stroke();
    },
  };
})(window.SOLMAR);
