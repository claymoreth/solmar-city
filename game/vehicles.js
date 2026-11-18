// vehicles.js — cars, bikes and the Rival Phantom: stealing, driving, damage.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var TYPES = {
    car: { accel: 320, top: 390, steer: 2.4, w: 44, h: 22, grip: 0.92 },
    bike: { accel: 440, top: 545, steer: 3.1, w: 34, h: 14, grip: 0.97 },
    rival: { accel: 390, top: 470, steer: 2.7, w: 46, h: 22, grip: 0.94 },
  };
  S.vehicles = {
    list: [],
    TYPES: TYPES,

    spawn: function (x, y, type, color, driver) {
      var v = {
        x: x, y: y, angle: Math.random() * Math.PI * 2, speed: 0,
        type: type || 'car', color: color || '#c0392b',
        hp: 100, smoke: 0, driver: driver || null,
        barrier: false, reported: false, ramCd: 0, crashed: false,
        headlight: false, fleeT: 0,
      };
      if (type === 'rival') { v.hp = 120; v.color = '#111111'; }
      this.list.push(v);
      return v;
    },

    spawnParked: function () {
      var colors = ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#8e44ad', '#16a085', '#e67e22', '#ecf0f1'];
      var spots = [
        { x: 960, y: 420, type: 'car' }, { x: 1560, y: 960, type: 'car' },
        { x: 2160, y: 1560, type: 'car' }, { x: 300, y: 1560, type: 'car' },
        { x: 2700, y: 420, type: 'car' }, { x: 900, y: 2100, type: 'car' },
        { x: 2100, y: 420, type: 'bike' }, { x: 1500, y: 2100, type: 'bike' },
        { x: 3300, y: 960, type: 'bike' }, { x: 600, y: 900, type: 'car' },
        { x: 2760, y: 1560, type: 'car' }, { x: 3300, y: 2100, type: 'car' },
      ];
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i];
        var v = this.spawn(s.x, s.y, s.type, colors[i % colors.length], null);
        // Face along the nearest road, so a stolen car drives away cleanly.
        var onV = false;
        for (var r = 0; r < S.V_ROADS.length; r++) {
          if (Math.abs(s.x - S.V_ROADS[r]) <= S.ROAD_W / 2) { onV = true; break; }
        }
        v.angle = onV ? Math.PI / 2 : 0;
      }
    },

    nearest: function (x, y, maxDist) {
      var best = null, bestD = maxDist;
      for (var i = 0; i < this.list.length; i++) {
        var v = this.list[i];
        if (v.driver) continue;
        var d = S.dist(x, y, v.x, v.y);
        if (d < bestD) { bestD = d; best = v; }
      }
      return best;
    },

    // Drive one vehicle with player-style controls. Returns nothing; sets v.crashed on a hard hit.
    drive: function (v, ctrl, dt) {
      var t = TYPES[v.type];
      v.crashed = false;
      var target = 0;
      if (ctrl.throttle > 0) target = t.top;
      else if (ctrl.throttle < 0) target = -t.top * 0.45;
      if (ctrl.throttle !== 0) {
        var rate = t.accel * dt;
        if (v.speed < target) v.speed = Math.min(target, v.speed + rate);
        else if (v.speed > target) v.speed = Math.max(target, v.speed - rate);
      } else {
        v.speed -= v.speed * 1.4 * dt;
        if (Math.abs(v.speed) < 4) v.speed = 0;
      }
      var spd = Math.abs(v.speed);
      var steerAmt = ctrl.steer * t.steer * (v.speed >= 0 ? 1 : -1) * S.clamp(spd / 120, 0, 1);
      if (ctrl.handbrake) steerAmt *= 1.7;
      v.angle += steerAmt * dt * (ctrl.handbrake ? 1.5 : 1);
      var nx = v.x + Math.cos(v.angle) * v.speed * dt;
      var ny = v.y + Math.sin(v.angle) * v.speed * dt;
      var col = S.collide(nx, ny, t.w / 2);
      if (col.hit) {
        var impact = spd;
        v.x = col.x; v.y = col.y;
        v.speed *= -0.25;
        if (impact > 200) {
          v.crashed = true;
          this.damage(v, impact > 340 ? 34 : 16);
          if (v.type === 'bike' && v.driver === 'player' && S.player) {
            S.player.ejectFromBike(v);
          }
        } else if (impact > 90) {
          this.damage(v, 5);
        }
      } else {
        v.x = S.clamp(nx, 20, S.WORLD_W - 20);
        v.y = S.clamp(ny, 20, S.WORLD_H - 20);
      }
      if (v.ramCd > 0) v.ramCd -= dt;
      v.headlight = (S.G && S.G.timeOfDay === 'night');
    },

    damage: function (v, amt) {
      v.hp -= amt;
      if (v.hp < 55) v.smoke = 1;
      if (v.hp <= 0 && !v.dead) {
        v.dead = true;
        if (S.combat) S.combat.explode(v.x, v.y, v);
      }
    },

    // Vehicle-vs-vehicle collisions: push apart, ram damage to the Rival Phantom,
    // and a wanted bump when the player wrecks a civilian car.
    collideVehicles: function (dt) {
      var list = this.list;
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        if (a.dead) continue;
        for (var j = i + 1; j < list.length; j++) {
          var b = list[j];
          if (b.dead) continue;
          var d = S.dist(a.x, a.y, b.x, b.y);
          var minD = 46;
          if (d >= minD || d < 0.01) continue;
          var rel = Math.abs(a.speed - b.speed) + 40;
          var nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          var push = (minD - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          if (rel > 120) {
            var dmg = 8 + rel * 0.04;
            this.damage(a, dmg * 0.5);
            this.damage(b, dmg * 0.5);
            // Ramming the Rival Phantom hurts it (~30 per solid hit).
            var playerCar = (a.driver === 'player') ? a : (b.driver === 'player') ? b : null;
            var rival = (a.type === 'rival') ? a : (b.type === 'rival') ? b : null;
            if (playerCar && rival && rival.ramCd <= 0 && rel > 150) {
              rival.hp -= 30;
              rival.ramCd = 0.8;
              if (S.combat) S.combat.addParticles(rival.x, rival.y, 10, '#ffd75e', 200, 0.4);
              if (rival.hp <= 0) { rival.dead = true; if (S.combat) S.combat.explode(rival.x, rival.y, rival); }
            }
            // Wrecking a civilian car in front of the law draws attention.
            var civ = null;
            if (a.driver === 'traffic' && a.hp <= 0 && !a.reported) civ = a;
            if (b.driver === 'traffic' && b.hp <= 0 && !b.reported) civ = b;
            if (civ && playerCar) {
              civ.reported = true;
              if (S.police) S.police.addWanted(1);
            }
          }
          var avg = (a.speed + b.speed) / 2;
          a.speed = avg * 0.6; b.speed = avg * 0.6;
        }
      }
      // Sweep dead vehicles (keep barriers until mission ends).
      for (var k = this.list.length - 1; k >= 0; k--) {
        if (this.list[k].dead && !this.list[k].barrier) this.list.splice(k, 1);
      }
    },

    update: function (dt) {
      // Rival Phantom AI: flee from the player when a mission drives it.
      for (var i = 0; i < this.list.length; i++) {
        var v = this.list[i];
        if (v.type !== 'rival' || v.dead) continue;
        if (v.frozen) continue;
        var p = S.player;
        if (!p) continue;
        var dx = v.x - p.x, dy = v.y - p.y;
        var d = Math.hypot(dx, dy) || 1;
        var want = Math.atan2(dy, dx);
        // Steer toward the flee angle, with a little wobble so it looks alive.
        var diff = want - v.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        var steer = S.clamp(diff * 2, -1, 1);
        this.drive(v, { throttle: 1, steer: steer, handbrake: false }, dt);
      }
    },

    draw: function (ctx, cam) {
      var x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + 1340, y1 = cam.y + 780;
      for (var i = 0; i < this.list.length; i++) {
        var v = this.list[i];
        if (v.x < x0 || v.x > x1 || v.y < y0 || v.y > y1) continue;
        var t = TYPES[v.type];
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle);
        // Shadow.
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(-t.w / 2 + 3, -t.h / 2 + 4, t.w, t.h);
        // Body.
        ctx.fillStyle = v.color;
        if (v.type === 'bike') {
          ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h);
          ctx.fillStyle = '#222';
          ctx.beginPath(); ctx.arc(-t.w / 2 + 4, 0, 5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(t.w / 2 - 4, 0, 5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h);
          ctx.fillStyle = 'rgba(180,210,230,0.75)';
          ctx.fillRect(-t.w / 2 + 8, -t.h / 2 + 3, 12, t.h - 6);
          ctx.fillStyle = '#222';
          ctx.fillRect(t.w / 2 - 6, -t.h / 2 + 2, 4, 5);
          ctx.fillRect(t.w / 2 - 6, t.h / 2 - 7, 4, 5);
          if (v.type === 'rival') {
            ctx.fillStyle = '#e33';
            ctx.fillRect(-t.w / 2 + 2, -t.h / 2 + 2, 6, t.h - 4);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Verdana, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('RIVAL', 2, 3);
          }
          if (v.barrier) {
            ctx.fillStyle = '#ff8c00';
            ctx.fillRect(-t.w / 2, -t.h / 2 - 4, t.w, 4);
          }
        }
        // Smoke when damaged.
        if (v.smoke > 0 && Math.random() < 0.4) {
          if (S.combat) S.combat.addParticles(v.x - Math.cos(v.angle) * 14, v.y - Math.sin(v.angle) * 14, 1, '#888', 40, 0.8);
        }
        // Headlight cones at night.
        if (v.headlight && (v.driver === 'player' || v.type === 'rival')) {
          ctx.fillStyle = 'rgba(255,240,170,0.20)';
          ctx.beginPath();
          ctx.moveTo(t.w / 2, -8);
          ctx.lineTo(t.w / 2 + 130, -42);
          ctx.lineTo(t.w / 2 + 130, 42);
          ctx.lineTo(t.w / 2, 8);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    },
  };
})(window.SOLMAR);
