// combat.js — bullets, gang hostiles, the boss, explosions and particles.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  S.combat = {
    bullets: [],
    hostiles: [],
    particles: [],
    kills: 0,
    frozen: false,

    boss: function () {
      for (var i = 0; i < this.hostiles.length; i++) {
        if (this.hostiles[i].kind === 'boss') return this.hostiles[i];
      }
      return null;
    },

    spawnGang: function (x, y, count, opts) {
      opts = opts || {};
      for (var i = 0; i < count; i++) {
        var gx, gy, tries = 0;
        do {
          gx = S.clamp(x + (Math.random() - 0.5) * 260, 40, S.WORLD_W - 40);
          gy = S.clamp(y + (Math.random() - 0.5) * 260, 40, S.WORLD_H - 40);
          tries++;
        } while (S.pointInBuilding(gx, gy) && tries < 20);
        this.hostiles.push({
          kind: 'gang', x: gx, y: gy, angle: 0, hp: 60, maxHp: 60,
          speed: 130, walkPhase: Math.random() * 6, shootCd: 1 + Math.random(),
          dmg: 8, jacket: Math.random() < 0.5 ? '#a93226' : '#1a1a1a',
          pants: '#2c3e50', scale: 1.15,
        });
      }
    },

    spawnBoss: function (x, y) {
      // Nudge out of a building if the HQ point lands inside one.
      var offs = [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60], [120, 0], [-120, 0], [0, 120], [0, -120], [180, 0], [0, 180]];
      for (var o = 0; o < offs.length; o++) {
        if (!S.pointInBuilding(x + offs[o][0], y + offs[o][1])) {
          x += offs[o][0]; y += offs[o][1];
          break;
        }
      }
      var b = {
        kind: 'boss', x: x, y: y, angle: 0, hp: 500, maxHp: 500,
        speed: 110, walkPhase: 0, shootCd: 1.5,
        dmg: 16, jacket: '#6b1d1d', pants: '#2c3e50', scale: 1.7, crown: true,
      };
      this.hostiles.push(b);
      return b;
    },

    clearAll: function () {
      this.hostiles = [];
      this.bullets = [];
      this.particles = [];
    },

    nearestHostile: function (x, y, maxDist) {
      var best = null, bestD = maxDist;
      for (var i = 0; i < this.hostiles.length; i++) {
        var h = this.hostiles[i];
        var d = S.dist(x, y, h.x, h.y);
        if (d < bestD) { bestD = d; best = h; }
      }
      return best;
    },

    fireBullet: function (x, y, angle, speed, dmg, from) {
      this.bullets.push({ x: x, y: y, angle: angle, speed: speed, dmg: dmg, from: from, life: 1.2 });
    },

    damageHostile: function (h, dmg, sx, sy) {
      h.hp -= dmg;
      this.addParticles(h.x, h.y, 6, '#ff5a4e', 140, 0.3);
      if (h.hp <= 0) {
        var idx = this.hostiles.indexOf(h);
        if (idx >= 0) this.hostiles.splice(idx, 1);
        this.kills++;
        this.addParticles(h.x, h.y, 14, '#ff5a4e', 200, 0.5);
        if (S.missions) S.missions.onHostileDown(h);
        if (h.kind === 'boss' && S.missions) S.missions.onBossDown();
      }
    },

    gunshotNoise: function (x, y) {
      if (S.peds) S.peds.fleeFrom(x, y);
      // Firing near the law draws a star.
      if (S.police && S.police.wanted === 0 && S.police.nearestCopDist() < 800) {
        S.police.addWanted(1);
      }
    },

    explode: function (x, y, source) {
      this.addParticles(x, y, 26, '#ff9d2e', 320, 0.7);
      this.addParticles(x, y, 16, '#666', 120, 1.0);
      S.audio.explosion();
      S.G.shake = Math.max(S.G.shake, 8);
      var p = S.player;
      // Hurts the player only if it is close. Inside a car, the car takes the blast.
      if (p) {
        var dp = S.dist(p.x, p.y, x, y);
        if (dp < 110) {
          if (p.inCar && p.car) S.vehicles.damage(p.car, 20);
          else p.takeDamage(dp < 55 ? 30 : 12);
        }
      }
      // Chain: nearby hostiles and vehicles take damage.
      for (var i = this.hostiles.length - 1; i >= 0; i--) {
        var h = this.hostiles[i];
        if (S.dist(h.x, h.y, x, y) < 100) this.damageHostile(h, 50, x, y);
      }
      for (var j = 0; j < S.vehicles.list.length; j++) {
        var v = S.vehicles.list[j];
        if (v === source) continue;
        if (S.dist(v.x, v.y, x, y) < 110) S.vehicles.damage(v, 45);
      }
      // A civilian car blowing up in front of the law adds a star; a police car does not.
      if (source && source.driver === 'traffic' && !source.reported) {
        source.reported = true;
        if (S.police && p && p.inCar) S.police.addWanted(1);
      }
    },

    addParticles: function (x, y, n, color, speed, life) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var s = speed * (0.4 + Math.random() * 0.6);
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          color: color, life: life * (0.6 + Math.random() * 0.4), maxLife: life,
        });
      }
    },

    update: function (dt) {
      var p = S.player;
      // Bullets.
      for (var b = this.bullets.length - 1; b >= 0; b--) {
        var bl = this.bullets[b];
        bl.x += Math.cos(bl.angle) * bl.speed * dt;
        bl.y += Math.sin(bl.angle) * bl.speed * dt;
        bl.life -= dt;
        var dead = bl.life <= 0;
        if (!dead && S.pointInBuilding(bl.x, bl.y)) {
          this.addParticles(bl.x, bl.y, 3, '#bbb', 90, 0.2);
          dead = true;
        }
        if (!dead && bl.from === 'player') {
          for (var h = 0; h < this.hostiles.length; h++) {
            var ho = this.hostiles[h];
            if (S.dist(bl.x, bl.y, ho.x, ho.y) < 16 * ho.scale) {
              this.damageHostile(ho, bl.dmg, p ? p.x : bl.x, p ? p.y : bl.y);
              dead = true;
              break;
            }
          }
          // Player bullets also damage vehicles (the Rival Phantom can be
          // shot down, not only rammed).
          if (!dead) {
            for (var vi = 0; vi < S.vehicles.list.length; vi++) {
              var veh = S.vehicles.list[vi];
              if (veh.driver === 'player' || veh.dead) continue;
              if (S.dist(bl.x, bl.y, veh.x, veh.y) < 24) {
                S.vehicles.damage(veh, bl.dmg);
                this.addParticles(bl.x, bl.y, 3, '#ffd75e', 90, 0.2);
                dead = true;
                break;
              }
            }
          }
        }
        if (!dead && bl.from === 'hostile' && p && !p.inCar) {
          if (S.dist(bl.x, bl.y, p.x, p.y) < 16) {
            p.takeDamage(bl.dmg);
            dead = true;
          }
        }
        if (!dead && bl.from === 'hostile' && p && p.inCar && p.car) {
          if (S.dist(bl.x, bl.y, p.car.x, p.car.y) < 26) {
            S.vehicles.damage(p.car, bl.dmg * 0.5);
            dead = true;
          }
        }
        if (dead) this.bullets.splice(b, 1);
      }
      // Hostiles: chase the player on foot and shoot.
      if (p && !this.frozen) {
        for (var i = 0; i < this.hostiles.length; i++) {
          var ho2 = this.hostiles[i];
          var dx = p.x - ho2.x, dy = p.y - ho2.y;
          var d = Math.hypot(dx, dy) || 1;
          ho2.angle = Math.atan2(dy, dx);
          if (d > 90) {
            ho2.x += (dx / d) * ho2.speed * dt;
            ho2.y += (dy / d) * ho2.speed * dt;
            ho2.walkPhase += dt * 10;
          }
          var col = S.collide(ho2.x, ho2.y, 13);
          if (col.hit) { ho2.x = col.x; ho2.y = col.y; }
          ho2.shootCd -= dt;
          if (ho2.shootCd <= 0 && d < 520 && d > 40) {
            ho2.shootCd = ho2.kind === 'boss' ? 0.9 : 1.6 + Math.random();
            var spread = (Math.random() - 0.5) * 0.25;
            this.fireBullet(ho2.x + Math.cos(ho2.angle) * 20, ho2.y + Math.sin(ho2.angle) * 20, ho2.angle + spread, 620, ho2.dmg, 'hostile');
            S.audio.shot();
          }
          // Melee range: gang members punch the player.
          if (d < 26 && !p.inCar) p.takeDamage(ho2.dmg * 0.5 * dt * 10 * 0.1);
        }
      }
      // Particles.
      for (var q = this.particles.length - 1; q >= 0; q--) {
        var pt = this.particles[q];
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        pt.vx *= 0.94; pt.vy *= 0.94;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(q, 1);
      }
    },

    draw: function (ctx, cam) {
      var x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + 1340, y1 = cam.y + 780;
      // Hostiles.
      for (var i = 0; i < this.hostiles.length; i++) {
        var h = this.hostiles[i];
        if (h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1) continue;
        var moving = true;
        S.drawHuman(ctx, h.x, h.y, h.angle, {
          jacket: h.jacket, pants: h.pants, crown: h.crown,
          gun: true, gunAngle: 0, walkPhase: h.walkPhase, moving: moving, scale: h.scale,
        });
        // HP bar above the hostile.
        var w = 40 * h.scale;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(h.x - w / 2, h.y - 26 * h.scale, w, 5);
        ctx.fillStyle = h.kind === 'boss' ? '#ffd700' : '#e33';
        ctx.fillRect(h.x - w / 2, h.y - 26 * h.scale, w * Math.max(0, h.hp / h.maxHp), 5);
        if (h.kind === 'boss') {
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 13px Verdana, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('BIG MARCO', h.x, h.y - 34 * h.scale);
        }
      }
      // Bullets.
      ctx.fillStyle = '#ffe66d';
      for (var b = 0; b < this.bullets.length; b++) {
        var bl = this.bullets[b];
        ctx.beginPath(); ctx.arc(bl.x, bl.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      // Particles.
      for (var q = 0; q < this.particles.length; q++) {
        var pt = this.particles[q];
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
    },
  };
})(window.SOLMAR);
