// main.js — game loop, camera, input, day/night, screens and the debug API.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var canvas, ctx;
  var lastTs = 0;
  var saveT = 0;
  var victoryShown = false;

  S.G = {
    state: 'menu',
    time: 0,
    timeOfDay: 'day',
    todTimer: 0,
    keys: {},
    mouse: { x: 0, y: 0, wx: 700, wy: 380, down: false },
    cam: { x: 0, y: 0 },
    shake: 0,
  };

  function el(id) { return document.getElementById(id); }

  function showOnly(id) {
    var screens = ['menu-screen', 'pause-screen', 'map-screen', 'shop-screen', 'victory-screen', 'busted-screen'];
    for (var i = 0; i < screens.length; i++) {
      el(screens[i]).classList.toggle('hidden', screens[i] !== id);
    }
    el('hud').classList.toggle('hidden', id !== null && (id === 'menu-screen' || id === 'victory-screen' || id === 'busted-screen'));
  }

  S.main = {
    setState: function (st) {
      S.G.state = st;
      if (st === 'playing') showOnly(null);
      else if (st === 'paused') showOnly('pause-screen');
      else if (st === 'map') { showOnly('map-screen'); S.hud.drawMap(); }
      else if (st === 'shop') showOnly('shop-screen');
      else if (st === 'menu') showOnly('menu-screen');
      else if (st === 'victory') showOnly('victory-screen');
      else if (st === 'busted') showOnly('busted-screen');
    },

    startGame: function () {
      S.audio.unlock();
      this.setState('playing');
      if (!S.missions.active && S.missions.doneCount < 8) S.missions.startNext();
    },

    resume: function () { this.setState('playing'); },

    wasted: function () {
      var p = S.player;
      p.cash = Math.max(0, Math.round(p.cash * 0.9));
      p.hp = 100;
      p.x = S.POIS.hospital.x; p.y = S.POIS.hospital.y;
      if (p.inCar && p.car) { p.car.driver = null; p.inCar = false; p.car = null; }
      S.police.clearAll();
      S.combat.clearAll();
      el('busted-title').textContent = 'WASTED';
      el('busted-text').textContent = 'You woke up at the hospital. The city took 10% of your cash.';
      if (S.save) S.save.write();
      this.setState('busted');
    },

    busted: function () {
      var p = S.player;
      p.cash = Math.max(0, Math.round(p.cash * 0.9));
      p.hp = 100;
      p.x = S.POIS.hospital.x; p.y = S.POIS.hospital.y;
      if (p.inCar && p.car) { p.car.driver = null; p.inCar = false; p.car = null; }
      S.police.clearAll();
      S.combat.clearAll();
      el('busted-title').textContent = 'BUSTED';
      el('busted-text').textContent = 'The cops hauled you in. You lost 10% of your cash.';
      if (S.save) S.save.write();
      this.setState('busted');
    },

    showVictory: function () {
      if (victoryShown) return;
      victoryShown = true;
      var p = S.player;
      el('victory-cash').textContent = '$' + Math.round(p.cash);
      el('victory-level').textContent = 'LV ' + p.level + ' • ' + p.xp + ' XP';
      el('victory-kills').textContent = String(S.combat.kills);
      el('victory-missions').textContent = '8 / 8 complete';
      if (S.save) S.save.write();
      this.setState('victory');
    },

    freeRoam: function () {
      victoryShown = false;
      this.setState('playing');
    },

    playAgain: function () {
      victoryShown = false;
      if (S.save) S.save.clear();
      S.missions.clearPending();
      S.player.reset(150);
      S.missions.doneCount = 0;
      S.missions.active = null;
      S.missions.lastResult = null;
      S.missions.rival = null;
      S.combat.kills = 0;
      S.combat.clearAll();
      S.police.clearAll();
      S.vehicles.list = [];
      S.vehicles.spawnParked();
      S.traffic.init();
      S.peds.init();
      this.setState('playing');
      S.missions.startNext();
    },

    cycleTimeOfDay: function () {
      var order = ['day', 'dusk', 'night'];
      var i = order.indexOf(S.G.timeOfDay);
      S.G.timeOfDay = order[(i + 1) % 3];
      S.G.todTimer = 0;
      if (S.hud) {
        S.hud.toast(S.G.timeOfDay === 'day' ? 'Day — clear skies over Solmar' :
          S.G.timeOfDay === 'dusk' ? 'Dusk — the city lights up' : 'Night — street lights on');
      }
    },
  };

  function update(dt) {
    S.G.time += dt;
    // Time of day auto-advances every 300 seconds.
    S.G.todTimer += dt;
    if (S.G.todTimer >= 300) {
      S.G.todTimer = 0;
      S.main.cycleTimeOfDay();
    }
    S.player.update(dt, S.G);
    S.vehicles.collideVehicles(dt);
    S.vehicles.update(dt);
    S.traffic.update(dt);
    S.peds.update(dt);
    S.police.update(dt);
    S.combat.update(dt);
    S.missions.update(dt);
    // Camera follows the player.
    var p = S.player;
    S.G.cam.x = S.clamp(p.x - 640, 0, S.WORLD_W - 1280);
    S.G.cam.y = S.clamp(p.y - 360, 0, S.WORLD_H - 720);
    if (S.G.shake > 0) S.G.shake = Math.max(0, S.G.shake - dt * 30);
    // Autosave every 10 seconds.
    saveT += dt;
    if (saveT >= 10) { saveT = 0; if (S.save) S.save.write(); }
    S.hud.update();
  }

  function render() {
    var cam = S.G.cam;
    var shx = 0, shy = 0;
    if (S.G.shake > 0) {
      shx = (Math.random() - 0.5) * S.G.shake;
      shy = (Math.random() - 0.5) * S.G.shake;
    }
    ctx.save();
    ctx.clearRect(0, 0, 1280, 720);
    ctx.translate(-Math.round(cam.x + shx), -Math.round(cam.y + shy));
    S.drawCity(ctx, cam, S.G.timeOfDay);
    S.traffic.draw(ctx, cam);
    S.vehicles.draw(ctx, cam);
    S.peds.draw(ctx, cam);
    S.combat.draw(ctx, cam);
    S.player.draw(ctx);
    S.police.draw(ctx, cam);
    // Mission marker: pulsing yellow ring.
    var mk = S.missions.objectiveMarker();
    if (mk) {
      var pulse = 18 + Math.sin(S.G.time * 4) * 5;
      ctx.strokeStyle = 'rgba(255,215,94,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mk.x, mk.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,215,94,0.9)';
      ctx.beginPath(); ctx.arc(mk.x, mk.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Night: dark overlay, then lamp glows and headlights shine through.
    if (S.G.timeOfDay === 'night') {
      ctx.fillStyle = 'rgba(5,8,28,0.55)';
      ctx.fillRect(cam.x - 40, cam.y - 40, 1360, 800);
      for (var l = 0; l < S.LAMPS.length; l++) {
        var lm = S.LAMPS[l];
        if (lm.x < cam.x - 120 || lm.x > cam.x + 1400 || lm.y < cam.y - 120 || lm.y > cam.y + 840) continue;
        var g = ctx.createRadialGradient(lm.x, lm.y, 4, lm.x, lm.y, 110);
        g.addColorStop(0, 'rgba(255,214,120,0.35)');
        g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lm.x, lm.y, 110, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(lm.x, lm.y, 5, 0, Math.PI * 2); ctx.fill();
      }
      // Headlight pools under player-driven vehicles.
      var vlist = S.vehicles.list;
      for (var v = 0; v < vlist.length; v++) {
        var veh = vlist[v];
        if (!veh.headlight) continue;
        ctx.fillStyle = 'rgba(255,240,170,0.12)';
        ctx.beginPath(); ctx.arc(veh.x + Math.cos(veh.angle) * 90, veh.y + Math.sin(veh.angle) * 90, 60, 0, Math.PI * 2); ctx.fill();
      }
    } else if (S.G.timeOfDay === 'dusk') {
      ctx.fillStyle = 'rgba(70,40,90,0.18)';
      ctx.fillRect(cam.x - 40, cam.y - 40, 1360, 800);
    }
    ctx.restore();
    // Hurt flash.
    if (S.player.hurtT > 0) {
      ctx.fillStyle = 'rgba(220,30,30,' + (S.player.hurtT * 0.5) + ')';
      ctx.fillRect(0, 0, 1280, 720);
    }
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (S.G.state === 'playing') update(dt);
    render();
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space') e.preventDefault();
      S.G.keys[e.code] = true;
      if (e.repeat) return;
      var st = S.G.state;
      if (e.code === 'KeyR' && st === 'playing') S.player.reload();
      if (e.code === 'KeyE' && st === 'playing') S.player.tryEnterExit();
      if (e.code === 'KeyG' && st === 'playing') S.shop.tryOpenNear();
      if (e.code === 'KeyT' && st === 'playing') S.main.cycleTimeOfDay();
      if (e.code === 'KeyM') {
        if (st === 'playing') S.main.setState('map');
        else if (st === 'map') S.main.setState('playing');
      }
      if (e.code === 'Escape') {
        if (st === 'playing') S.main.setState('paused');
        else if (st === 'paused') S.main.setState('playing');
        else if (st === 'map') S.main.setState('playing');
        else if (st === 'shop') S.shop.close();
      }
    });
    window.addEventListener('keyup', function (e) { S.G.keys[e.code] = false; });
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      S.G.mouse.x = e.clientX - r.left;
      S.G.mouse.y = e.clientY - r.top;
      S.G.mouse.wx = S.G.cam.x + S.G.mouse.x;
      S.G.mouse.wy = S.G.cam.y + S.G.mouse.y;
    });
    canvas.addEventListener('mousedown', function (e) {
      S.audio.unlock();
      S.G.mouse.down = true;
      var r = canvas.getBoundingClientRect();
      S.G.mouse.x = e.clientX - r.left;
      S.G.mouse.y = e.clientY - r.top;
      S.G.mouse.wx = S.G.cam.x + S.G.mouse.x;
      S.G.mouse.wy = S.G.cam.y + S.G.mouse.y;
    });
    window.addEventListener('mouseup', function () { S.G.mouse.down = false; });
    el('btn-play').addEventListener('click', function () { S.main.startGame(); });
    el('btn-resume').addEventListener('click', function () { S.main.resume(); });
    el('btn-shop-falcon').addEventListener('click', function () { S.shop.buyFalcon(); });
    el('btn-shop-ammo').addEventListener('click', function () { S.shop.buyAmmo(); });
    el('btn-shop-repair').addEventListener('click', function () { S.shop.repair(); });
    el('btn-shop-close').addEventListener('click', function () { S.shop.close(); });
    el('btn-victory-roam').addEventListener('click', function () { S.main.freeRoam(); });
    el('btn-victory-again').addEventListener('click', function () { S.main.playAgain(); });
    el('btn-busted-ok').addEventListener('click', function () { S.main.setState('playing'); });
  }

  function boot() {
    canvas = el('game');
    ctx = canvas.getContext('2d');
    // Restore a previous save, if any.
    var saved = S.save.read();
    if (saved) {
      S.player.cash = saved.cash || 150;
      S.player.xp = saved.xp || 0;
      S.player.level = saved.level || 1;
      S.player.weapon = saved.weapon || 'pistol';
      S.player.magSize = S.player.weapon === 'falcon' ? 30 : 24;
      S.player.ammo = saved.ammo !== undefined ? saved.ammo : S.player.magSize;
      S.player.reserveAmmo = saved.reserveAmmo !== undefined ? saved.reserveAmmo : 48;
      S.missions.doneCount = saved.missionsDone || 0;
      if (saved.px) { S.player.x = saved.px; S.player.y = saved.py; }
    }
    S.vehicles.spawnParked();
    S.traffic.init();
    S.peds.init();
    S.G.cam.x = S.clamp(S.player.x - 640, 0, S.WORLD_W - 1280);
    S.G.cam.y = S.clamp(S.player.y - 360, 0, S.WORLD_H - 720);
    bindInput();
    showOnly('menu-screen');
    requestAnimationFrame(loop);
  }

  // --- Debug API for verification (not part of normal play) ---
  window.__game = {
    get state() { return S.G.state; },
    get player() { return S.player; },
    get mission() { return S.missions.active; },
    get missionsDone() { return S.missions.doneCount; },
    get cops() { return S.police.cops; },
    get wanted() { return S.police.wanted; },
    get heli() { return S.police.heli; },
    get timeOfDay() { return S.G.timeOfDay; },
    get hostiles() { return S.combat.hostiles; },
    get vehicles() { return S.vehicles.list; },
  };

  window.debug = {
    start: function () { S.main.startGame(); },
    setTimeOfDay: function (t) { S.G.timeOfDay = t; S.G.todTimer = 0; },
    giveCash: function (n) { S.player.addCash(n); },
    giveAmmo: function (n) { S.player.reserveAmmo += n; },
    giveWeapon: function (name) { S.player.weapon = name; S.player.magSize = name === 'falcon' ? 30 : 24; S.player.ammo = S.player.magSize; },
    god: function (on) { S.player.god = on !== false; },
    teleport: function (x, y) {
      var p = S.player;
      p.x = x; p.y = y;
      if (p.inCar && p.car) { p.car.x = x; p.car.y = y; }
      S.G.cam.x = S.clamp(p.x - 640, 0, S.WORLD_W - 1280);
      S.G.cam.y = S.clamp(p.y - 360, 0, S.WORLD_H - 720);
    },
    aimAt: function (x, y) { S.G.mouse.wx = x; S.G.mouse.wy = y; },
    setWanted: function (n) { S.police.setWanted(n); },
    freezeHostiles: function (on) { S.combat.frozen = on !== false; },
    freezeRival: function (on) {
      var rv = S.missions.rival;
      if (rv) rv.frozen = on !== false;
    },
    m1: function () { S.missions.clearPending(); S.missions.doneCount = 0; S.missions.active = null; S.missions.start(1); },
    m2: function () { S.missions.clearPending(); S.missions.doneCount = 1; S.missions.active = null; S.missions.start(2); },
    m3: function () { S.missions.clearPending(); S.missions.doneCount = 2; S.missions.active = null; S.missions.start(3); },
    m4: function () { S.missions.clearPending(); S.missions.doneCount = 3; S.missions.active = null; S.missions.start(4); },
    m5: function () { S.missions.clearPending(); S.missions.doneCount = 4; S.missions.active = null; S.missions.start(5); },
    m6: function () { S.missions.clearPending(); S.missions.doneCount = 5; S.missions.active = null; S.missions.start(6); },
    m7: function () { S.missions.clearPending(); S.missions.doneCount = 6; S.missions.active = null; S.missions.start(7); },
    m8: function () { S.missions.clearPending(); S.missions.doneCount = 7; S.missions.active = null; S.missions.start(8); },
    killHostile: function (h) { S.combat.damageHostile(h, 9999, S.player.x, S.player.y); },
    // Run the real simulation forward by N seconds in fixed steps (fast-forward).
    tick: function (seconds) {
      var steps = Math.ceil(seconds * 30);
      for (var i = 0; i < steps; i++) update(1 / 30);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.SOLMAR);
