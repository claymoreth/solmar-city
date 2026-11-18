// police.js — wanted stars, pursuing cops, roadblocks, spikes and the heli.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  S.police = {
    wanted: 0,
    cops: [],
    spikes: [],
    heli: null,
    hiddenTimer: 0,
    spawnT: 0,
    arrestT: 0,
    blockT: 0,

    setWanted: function (n) {
      this.wanted = S.clamp(n, 0, 5);
      if (this.wanted === 0) this.hiddenTimer = 0;
      if (this.wanted < 5 && this.heli) this.heli = null;
      if (this.wanted === 0) this.arrestT = 0;
    },

    addWanted: function (n) {
      if (this.wanted < 5) this.setWanted(this.wanted + n);
    },

    nearestCopDist: function () {
      var p = S.player;
      var best = 1e9;
      for (var i = 0; i < this.cops.length; i++) {
        var d = S.dist(p.x, p.y, this.cops[i].x, this.cops[i].y);
        if (d < best) best = d;
      }
      return best;
    },

    spawnCopCar: function (x, y) {
      var c = S.vehicles.spawn(x, y, 'car', '#1d3a5f', 'cop');
      c.isCop = true;
      this.cops.push({ kind: 'car', v: c, x: c.x, y: c.y, angle: 0, speed: 0 });
      return c;
    },

    spawnFootCop: function (x, y) {
      this.cops.push({
        kind: 'foot', x: x, y: y, angle: 0, speed: 150,
        walkPhase: Math.random() * 6,
      });
    },

    spawnNearPlayer: function (kind) {
      var p = S.player;
      var a = Math.random() * Math.PI * 2;
      var r = 900 + Math.random() * 300;
      var x = S.clamp(p.x + Math.cos(a) * r, 60, S.WORLD_W - 60);
      var y = S.clamp(p.y + Math.sin(a) * r, 60, S.WORLD_H - 60);
      if (kind === 'car') return this.spawnCopCar(x, y);
      this.spawnFootCop(x, y);
      return null;
    },

    clearAll: function () {
      for (var i = 0; i < this.cops.length; i++) {
        var c = this.cops[i];
        if (c.kind === 'car' && c.v) {
          var idx = S.vehicles.list.indexOf(c.v);
          if (idx >= 0) S.vehicles.list.splice(idx, 1);
        }
      }
      this.cops = [];
      this.spikes = [];
      this.heli = null;
      this.wanted = 0;
      this.hiddenTimer = 0;
      this.arrestT = 0;
    },

    dropSpike: function (x, y) {
      this.spikes.push({ x: x, y: y, life: 25 });
    },

    makeRoadblock: function () {
      var p = S.player;
      // Two barrier cars ahead of the player, on the road he is driving.
      for (var i = 0; i < 2; i++) {
        var fx = p.x + Math.cos(p.angle) * (320 + i * 60);
        var fy = p.y + Math.sin(p.angle) * (320 + i * 60);
        fx = S.clamp(fx, 60, S.WORLD_W - 60);
        fy = S.clamp(fy, 60, S.WORLD_H - 60);
        var v = S.vehicles.spawn(fx, fy, 'car', '#ff8c00', null);
        v.barrier = true;
        v.angle = p.angle + Math.PI / 2;
      }
      if (S.hud) S.hud.toast('Roadblock ahead!');
    },

    update: function (dt) {
      var p = S.player;
      if (!p) return;
      // Wanted decay: 20 seconds unseen by the nearest cop drops one star.
      if (this.wanted > 0) {
        var nd = this.nearestCopDist();
        if (nd > 520) {
          this.hiddenTimer += dt;
          if (this.hiddenTimer >= 20) {
            this.hiddenTimer = 0;
            this.setWanted(this.wanted - 1);
            if (S.hud) S.hud.toast(this.wanted > 0 ? 'Wanted level down — keep hiding' : 'You lost the cops');
          }
        } else {
          this.hiddenTimer = 0;
        }
      }
      // Keep the right number of cops on the street.
      var wantCars = this.wanted >= 1 ? Math.min(1 + Math.floor(this.wanted / 2), 3) : 0;
      var wantFoot = this.wanted >= 2 ? Math.min(this.wanted - 1, 3) : 0;
      var cars = 0, foot = 0;
      for (var i = 0; i < this.cops.length; i++) {
        if (this.cops[i].kind === 'car') cars++;
        else foot++;
      }
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        if (cars < wantCars) this.spawnNearPlayer('car');
        else if (foot < wantFoot) this.spawnNearPlayer('foot');
        this.spawnT = 1.2;
      }
      // Roadblocks at wanted 3+.
      this.blockT -= dt;
      if (this.wanted >= 3 && this.blockT <= 0) {
        this.makeRoadblock();
        this.blockT = 26;
      }
      // Heli at wanted 5.
      if (this.wanted >= 5 && !this.heli) {
        this.heli = { x: p.x - 300, y: p.y - 300, angle: 0 };
        if (S.hud) S.hud.toast('Police helicopter overhead!');
      }
      if (this.heli) {
        var h = this.heli;
        var hd = S.dist(h.x, h.y, p.x, p.y);
        if (hd > 1) {
          h.x += ((p.x - h.x) / hd) * 340 * dt;
          h.y += ((p.y - h.y) / hd) * 340 * dt;
        }
        h.angle += dt * 6;
      }
      // Spike strips expire.
      for (var s = this.spikes.length - 1; s >= 0; s--) {
        this.spikes[s].life -= dt;
        if (this.spikes[s].life <= 0) this.spikes.splice(s, 1);
      }
      // Cop behaviour.
      var arrestNear = false;
      for (var c = this.cops.length - 1; c >= 0; c--) {
        var cop = this.cops[c];
        if (cop.kind === 'car') {
          var v = cop.v;
          if (!v || v.dead) { this.cops.splice(c, 1); continue; }
          var dx = p.x - v.x, dy = p.y - v.y;
          var d = Math.hypot(dx, dy) || 1;
          var want = Math.atan2(dy, dx);
          var diff = want - v.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          var steer = S.clamp(diff * 2.2, -1, 1);
          // Far away the cops lose the trail: they slow down and wander, so a
          // player who keeps his distance can actually shake the heat off.
          // And a cruiser is a touch slower than a stolen car at full tilt,
          // so a clean straight-line escape works — the player still has to
          // drive it, the cops stay faster than anyone on foot.
          var throttle = 0.9;
          if (d > 900) {
            throttle = 0.5;
            steer = S.clamp(steer + Math.sin(S.G.time * 1.3 + c) * 0.5, -1, 1);
          }
          S.vehicles.drive(v, { throttle: throttle, steer: steer, handbrake: false }, dt);
          cop.x = v.x; cop.y = v.y; cop.angle = v.angle;
          // Drop spikes when close behind the player's car.
          if (p.inCar && d < 260 && Math.random() < dt * 0.25) {
            this.dropSpike(v.x - Math.cos(v.angle) * 30, v.y - Math.sin(v.angle) * 30);
          }
          // Ram the player on foot.
          if (!p.inCar && d < 30) p.takeDamage(10 * dt);
        } else {
          var fdx = p.x - cop.x, fdy = p.y - cop.y;
          var fd = Math.hypot(fdx, fdy) || 1;
          cop.angle = Math.atan2(fdy, fdx);
          cop.x += (fdx / fd) * cop.speed * dt;
          cop.y += (fdy / fd) * cop.speed * dt;
          cop.walkPhase += dt * 11;
          var fcol = S.collide(cop.x, cop.y, 12);
          if (fcol.hit) { cop.x = fcol.x; cop.y = fcol.y; }
          if (fd < 26) arrestNear = true;
          if (fd > 1400) {
            // Too far: teleport the cop closer so the chase never dies.
            var a = Math.random() * Math.PI * 2;
            cop.x = S.clamp(p.x + Math.cos(a) * 800, 40, S.WORLD_W - 40);
            cop.y = S.clamp(p.y + Math.sin(a) * 800, 40, S.WORLD_H - 40);
          }
        }
      }
      // Arrest: a foot cop standing on the player for 1.2 seconds busts him.
      if (arrestNear && !p.inCar) {
        this.arrestT += dt;
        if (this.arrestT >= 1.2) {
          this.arrestT = 0;
          if (S.main) S.main.busted();
        }
      } else {
        this.arrestT = Math.max(0, this.arrestT - dt * 2);
      }
      // Spikes vs the player's car.
      if (p.inCar && p.car) {
        for (var sp = 0; sp < this.spikes.length; sp++) {
          var sk = this.spikes[sp];
          if (S.dist(p.car.x, p.car.y, sk.x, sk.y) < 30) {
            p.car.speed *= 0.35;
            S.vehicles.damage(p.car, 15);
            this.spikes.splice(sp, 1);
            if (S.hud) S.hud.toast('Spike strip! Tires damaged');
            break;
          }
        }
      }
      // Prune cops when the heat is off, and clear leftover roadblocks too.
      if (this.wanted === 0) {
        for (var q = this.cops.length - 1; q >= 0; q--) {
          var cc = this.cops[q];
          if (cc.kind === 'car' && cc.v) {
            var ix = S.vehicles.list.indexOf(cc.v);
            if (ix >= 0) S.vehicles.list.splice(ix, 1);
          }
          this.cops.splice(q, 1);
        }
        this.spikes = [];
        S.vehicles.list = S.vehicles.list.filter(function (v) { return !v.barrier; });
      }
    },

    draw: function (ctx, cam) {
      var x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + 1340, y1 = cam.y + 780;
      // Spikes.
      ctx.fillStyle = '#222';
      for (var s = 0; s < this.spikes.length; s++) {
        var sk = this.spikes[s];
        if (sk.x < x0 || sk.x > x1 || sk.y < y0 || sk.y > y1) continue;
        ctx.beginPath(); ctx.arc(sk.x, sk.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#888';
        ctx.beginPath(); ctx.arc(sk.x, sk.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
      }
      // Foot cops.
      for (var i = 0; i < this.cops.length; i++) {
        var cop = this.cops[i];
        if (cop.kind !== 'foot') continue;
        if (cop.x < x0 || cop.x > x1 || cop.y < y0 || cop.y > y1) continue;
        S.drawHuman(ctx, cop.x, cop.y, cop.angle, {
          jacket: '#274b73', pants: '#1d2f45', hat: '#1d3a5f', vest: true,
          gun: true, gunAngle: 0, walkPhase: cop.walkPhase, moving: true, scale: 1.15,
        });
      }
      // Heli: shadow + body + spotlight pool on the ground.
      if (this.heli) {
        var h = this.heli;
        var p = S.player;
        ctx.fillStyle = 'rgba(255,244,180,0.10)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 130, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(6, 8, 26, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(h.angle * 0.1);
        ctx.fillStyle = '#22303f';
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.stroke();
        ctx.restore();
      }
    },
  };
})(window.SOLMAR);
