// player.js — Rio Vega: walk, sprint, drive, fight, reload. Also draws every
// human in the game (Rio, police, pedestrians, gang) as a clear top-down person.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var WEAPONS = {
    pistol: { name: 'Pistol', dmg: 18, cd: 0.28, mag: 24, price: 0 },
    falcon: { name: 'Falcon-9', dmg: 34, cd: 0.14, mag: 30, price: 500 },
  };

  // One shared human renderer: head, body, animated legs, optional hat/vest/bag/gun.
  S.drawHuman = function (ctx, x, y, angle, o) {
    o = o || {};
    var scale = o.scale || 1;
    var walk = o.walkPhase || 0;
    var moving = o.moving || false;
    var legSwing = moving ? Math.sin(walk) * 6 : 0;
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 4 * scale, 13 * scale, 8 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);
    // Legs (pants).
    ctx.fillStyle = o.pants || '#2c4a6b';
    ctx.fillRect(-4 * scale, -9 * scale + legSwing * 0.4, 7 * scale, 12 * scale);
    ctx.fillRect(-4 * scale, -3 * scale - legSwing * 0.4, 7 * scale, 12 * scale);
    ctx.fillStyle = '#111';
    ctx.fillRect(-4 * scale, 3 * scale + legSwing * 0.4, 7 * scale, 4 * scale);
    ctx.fillRect(-4 * scale, 9 * scale - legSwing * 0.4, 7 * scale, 4 * scale);
    // Body (jacket/shirt).
    ctx.fillStyle = o.jacket || '#888';
    ctx.beginPath(); ctx.arc(0, 0, 11 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-9 * scale, -8 * scale, 18 * scale, 16 * scale);
    if (o.vest) {
      ctx.fillStyle = '#1d3a5f';
      ctx.fillRect(-9 * scale, -6 * scale, 18 * scale, 12 * scale);
      ctx.fillStyle = '#c8d4e0';
      ctx.fillRect(-9 * scale, -2 * scale, 18 * scale, 3 * scale);
    }
    // Bag strap.
    if (o.bag) {
      ctx.strokeStyle = '#3a2a18';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath(); ctx.moveTo(-8 * scale, -8 * scale); ctx.lineTo(8 * scale, 8 * scale); ctx.stroke();
    }
    // Arms + gun (pointing at aim angle relative to facing).
    var gunAngle = (o.gunAngle !== undefined) ? o.gunAngle : 0;
    ctx.save();
    ctx.rotate(gunAngle);
    ctx.fillStyle = o.skin || '#e8b98a';
    ctx.fillRect(8 * scale, -8 * scale, 10 * scale, 4 * scale);
    ctx.fillRect(8 * scale, 4 * scale, 10 * scale, 4 * scale);
    if (o.gun) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(14 * scale, -1.5 * scale, 12 * scale, 3 * scale);
    }
    ctx.restore();
    // Head.
    ctx.fillStyle = o.skin || '#e8b98a';
    ctx.beginPath(); ctx.arc(0, 0, 8 * scale, 0, Math.PI * 2); ctx.fill();
    // Hair.
    ctx.fillStyle = o.hair || '#222';
    ctx.beginPath(); ctx.arc(-1 * scale, -1 * scale, 7 * scale, Math.PI * 0.6, Math.PI * 1.7); ctx.fill();
    if (o.hat) {
      ctx.fillStyle = o.hat;
      ctx.beginPath(); ctx.arc(0, -1 * scale, 8.5 * scale, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(-9 * scale, -3 * scale, 18 * scale, 3 * scale);
    }
    if (o.crown) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(-7 * scale, -5 * scale);
      ctx.lineTo(-3 * scale, -12 * scale);
      ctx.lineTo(0, -6 * scale);
      ctx.lineTo(3 * scale, -12 * scale);
      ctx.lineTo(7 * scale, -5 * scale);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  S.player = {
    x: 700, y: 380, angle: 0,
    hp: 100, cash: 150, xp: 0, level: 1,
    weapon: 'pistol', ammo: 24, reserveAmmo: 48,
    reloading: false, reloadT: 0,
    inCar: false, car: null,
    walkPhase: 0, speed: 0,
    punchCd: 0, shootCd: 0, punchAnim: 0, muzzleT: 0, hurtT: 0,
    magSize: 24, god: false,

    weaponStats: function () { return WEAPONS[this.weapon]; },

    reset: function (cash) {
      this.x = 700; this.y = 380; this.angle = 0;
      this.hp = 100; this.cash = (cash === undefined) ? 150 : cash;
      this.xp = 0; this.level = 1;
      this.weapon = 'pistol'; this.ammo = 24; this.reserveAmmo = 48;
      this.magSize = 24;
      this.reloading = false; this.reloadT = 0;
      this.inCar = false; this.car = null;
      this.punchCd = 0; this.shootCd = 0; this.punchAnim = 0; this.muzzleT = 0; this.hurtT = 0;
      this.god = false;
    },

    addCash: function (n) { this.cash += n; },
    addXp: function (n) {
      this.xp += n;
      while (this.xp >= this.level * 500) {
        this.xp -= this.level * 500;
        this.level++;
        if (S.hud) S.hud.toast('Level up! You are now LV ' + this.level);
      }
    },

    aimAngle: function () {
      var m = S.G.mouse;
      return Math.atan2(m.wy - this.y, m.wx - this.x);
    },

    update: function (dt, input) {
      if (this.inCar && this.car) { this.updateInCar(dt, input); return; }
      var mx = (input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0);
      var my = (input.keys['KeyS'] ? 1 : 0) - (input.keys['KeyW'] ? 1 : 0);
      var len = Math.hypot(mx, my) || 1;
      var sprint = !!input.keys['ShiftLeft'] || !!input.keys['ShiftRight'];
      var spd = sprint ? 320 : 200;
      var moving = (mx !== 0 || my !== 0);
      this.speed = moving ? spd : 0;
      if (moving) {
        this.x += (mx / len) * spd * dt;
        this.y += (my / len) * spd * dt;
        this.walkPhase += dt * (sprint ? 14 : 9);
        this.angle = Math.atan2(my, mx);
      }
      var col = S.collide(this.x, this.y, 14);
      if (col.hit) { this.x = col.x; this.y = col.y; }
      this.x = S.clamp(this.x, 20, S.WORLD_W - 20);
      this.y = S.clamp(this.y, 20, S.WORLD_H - 20);
      this.punchCd -= dt; this.shootCd -= dt; this.punchAnim -= dt; this.muzzleT -= dt; this.hurtT -= dt;
      if (this.reloading) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) {
          this.reloading = false;
          var need = this.magSize - this.ammo;
          var take = Math.min(need, this.reserveAmmo);
          this.ammo += take; this.reserveAmmo -= take;
          if (S.hud) S.hud.toast(take > 0 ? 'Reloaded' : 'No reserve ammo');
        }
      }
      if ((input.keys['KeyF'] || S.G.mouse.down) && this.shootCd <= 0 && !this.reloading) {
        this.tryAttack();
      }
      S.audio.setEngine(false, 0);
    },

    updateInCar: function (dt, input) {
      var car = this.car;
      if (!car) { this.inCar = false; return; }
      if (car.dead) {
        this.inCar = false; this.car = null;
        this.takeDamage(15);
        if (S.hud) S.hud.toast('Your ride blew up!');
        S.audio.setEngine(false, 0);
        return;
      }
      var throttle = (input.keys['KeyW'] ? 1 : 0) + (input.keys['KeyS'] ? -1 : 0);
      var steer = (input.keys['KeyD'] ? 1 : 0) + (input.keys['KeyA'] ? -1 : 0);
      var handbrake = !!input.keys['Space'];
      S.vehicles.drive(car, { throttle: throttle, steer: steer, handbrake: handbrake }, dt);
      if (!this.inCar) return; // ejected from a bike by a hard crash
      this.x = car.x; this.y = car.y; this.angle = car.angle;
      this.punchCd -= dt; this.shootCd -= dt; this.muzzleT -= dt; this.hurtT -= dt;
      if ((input.keys['KeyF'] || S.G.mouse.down) && this.shootCd <= 0 && this.ammo > 0 && !this.reloading) {
        var st = this.weaponStats();
        this.ammo--;
        this.shootCd = st.cd + 0.05; this.muzzleT = 0.07;
        var aim = this.aimAngle();
        S.audio.shot();
        if (S.combat) {
          S.combat.fireBullet(this.x + Math.cos(aim) * 26, this.y + Math.sin(aim) * 26, aim, 900, st.dmg, 'player');
          S.combat.gunshotNoise(this.x, this.y);
        }
      }
      S.audio.setEngine(true, Math.abs(car.speed) / (S.vehicles.TYPES[car.type].top || 400));
    },

    tryAttack: function () {
      var aim = this.aimAngle();
      var target = S.combat ? S.combat.nearestHostile(this.x, this.y, 56) : null;
      if (target) {
        this.punchCd = 0.38; this.shootCd = 0.38; this.punchAnim = 0.22;
        S.audio.punch();
        S.combat.damageHostile(target, 18, this.x, this.y);
        if (S.combat) S.combat.addParticles(this.x + Math.cos(aim) * 34, this.y + Math.sin(aim) * 34, 4, '#fff2a8', 120, 0.25);
        return;
      }
      if (this.ammo > 0) {
        var st = this.weaponStats();
        this.ammo--;
        this.shootCd = st.cd; this.muzzleT = 0.07;
        S.audio.shot();
        if (S.combat) {
          S.combat.fireBullet(this.x + Math.cos(aim) * 22, this.y + Math.sin(aim) * 22, aim, 900, st.dmg, 'player');
          S.combat.gunshotNoise(this.x, this.y);
        }
        S.G.shake = Math.max(S.G.shake, 2);
      } else {
        this.punchCd = 0.38; this.shootCd = 0.38; this.punchAnim = 0.22;
        S.audio.punch();
        if (S.hud) S.hud.toast('Out of ammo — press R to reload or G at the garage to buy more');
      }
    },

    reload: function () {
      if (this.reloading || this.ammo >= this.magSize || this.reserveAmmo <= 0) return;
      this.reloading = true; this.reloadT = 1.1;
      S.audio.reload();
    },

    buyWeapon: function (name) {
      var w = WEAPONS[name];
      if (!w) return false;
      if (this.weapon === name) return false;
      if (this.cash < w.price) return false;
      this.cash -= w.price;
      this.weapon = name;
      this.magSize = w.mag;
      this.ammo = w.mag;
      return true;
    },

    tryEnterExit: function () {
      if (this.inCar) {
        var car = this.car;
        car.driver = null;
        this.inCar = false; this.car = null;
        // Step out to the side of the car.
        this.x = car.x - Math.sin(car.angle) * 34;
        this.y = car.y + Math.cos(car.angle) * 34;
        var col = S.collide(this.x, this.y, 14);
        if (col.hit) { this.x = col.x; this.y = col.y; }
        S.audio.setEngine(false, 0);
        return true;
      }
      var v = S.vehicles.nearest(this.x, this.y, 70);
      if (v) {
        v.driver = 'player';
        this.inCar = true; this.car = v;
        this.x = v.x; this.y = v.y;
        if (S.hud) S.hud.toast(v.type === 'bike' ? 'On the bike — watch the hard turns' : 'Car stolen. Drive!');
        return true;
      }
      return false;
    },

    ejectFromBike: function (bike) {
      if (!this.inCar || this.car !== bike) return;
      bike.driver = null;
      this.inCar = false; this.car = null;
      this.x = bike.x - Math.sin(bike.angle) * 40;
      this.y = bike.y + Math.cos(bike.angle) * 40;
      var col = S.collide(this.x, this.y, 14);
      if (col.hit) { this.x = col.x; this.y = col.y; }
      this.takeDamage(12);
      if (S.hud) S.hud.toast('You were thrown off the bike! -12 HP');
      S.audio.setEngine(false, 0);
    },

    takeDamage: function (n) {
      if (this.god) return;
      this.hp -= n;
      this.hurtT = 0.3;
      if (this.hp <= 0) {
        this.hp = 0;
        if (S.main) S.main.wasted();
      }
    },

    draw: function (ctx) {
      if (this.inCar) return;
      var aim = this.aimAngle();
      var rel = aim - this.angle;
      S.drawHuman(ctx, this.x, this.y, this.angle, {
        jacket: '#4a3423', pants: '#2c4a6b', skin: '#e8b98a', hair: '#1a1a1a',
        gun: this.ammo > 0 || this.reloading, gunAngle: rel,
        walkPhase: this.walkPhase, moving: this.speed > 0, scale: 1.15,
      });
      // Muzzle flash.
      if (this.muzzleT > 0) {
        ctx.fillStyle = '#ffe66d';
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(aim) * 34, this.y + Math.sin(aim) * 34, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
})(window.SOLMAR);
