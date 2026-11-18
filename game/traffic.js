// traffic.js — cars driving the city roads, stopping for jams, fleeing from chaos.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#8e44ad', '#16a085', '#e67e22', '#d5dbdb', '#2ecc71'];

  S.traffic = {
    cars: [],
    maxCars: 16,

    init: function () {
      this.cars = [];
      for (var i = 0; i < this.maxCars; i++) this.spawn(true);
    },

    spawn: function (anywhere) {
      var pt = S.randomRoadPoint();
      var dir = Math.random() < 0.5 ? 1 : -1;
      var car = {
        x: pt.x, y: pt.y, vertical: pt.vertical, dir: dir,
        speed: 90 + Math.random() * 70,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        hp: 100, dead: false, reported: false, ramCd: 0,
        type: 'car', driver: 'traffic', barrier: false, smoke: 0,
        angle: pt.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      };
      if (!anywhere) {
        // Spawn just outside the camera view so cars stream in naturally.
        var cam = S.G.cam;
        var side = Math.floor(Math.random() * 4);
        if (side === 0) { car.x = cam.x - 100; car.y = cam.y + Math.random() * 720; }
        else if (side === 1) { car.x = cam.x + 1380; car.y = cam.y + Math.random() * 720; }
        else if (side === 2) { car.x = cam.x + Math.random() * 1280; car.y = cam.y - 100; }
        else { car.x = cam.x + Math.random() * 1280; car.y = cam.y + 820; }
        // Snap to a road.
        if (car.vertical) {
          var vx = S.V_ROADS[0];
          var bd = 1e9;
          for (var i = 0; i < S.V_ROADS.length; i++) {
            var d = Math.abs(S.V_ROADS[i] - car.x);
            if (d < bd) { bd = d; vx = S.V_ROADS[i]; }
          }
          car.x = vx + (car.dir > 0 ? 35 : -35);
        } else {
          var hy = S.H_ROADS[0];
          var bd2 = 1e9;
          for (var j = 0; j < S.H_ROADS.length; j++) {
            var d2 = Math.abs(S.H_ROADS[j] - car.y);
            if (d2 < bd2) { bd2 = d2; hy = S.H_ROADS[j]; }
          }
          car.y = hy + (car.dir > 0 ? 35 : -35);
        }
      }
      this.cars.push(car);
      return car;
    },

    clearAll: function () { this.cars = []; },

    update: function (dt) {
      var p = S.player;
      for (var i = this.cars.length - 1; i >= 0; i--) {
        var c = this.cars[i];
        if (c.dead) { this.cars.splice(i, 1); continue; }
        // Slow down for the car ahead or the player.
        var blocked = false;
        var ahead = c.speed * 1.1 + 60;
        for (var j = 0; j < this.cars.length; j++) {
          if (i === j) continue;
          var o = this.cars[j];
          var dx = o.x - c.x, dy = o.y - c.y;
          var along = c.vertical ? dy * c.dir : dx * c.dir;
          var side = c.vertical ? Math.abs(dx) : Math.abs(dy);
          if (along > 0 && along < ahead && side < 40) { blocked = true; break; }
        }
        if (p && p.inCar && p.car) {
          var pdx = p.car.x - c.x, pdy = p.car.y - c.y;
          var palong = c.vertical ? pdy * c.dir : pdx * c.dir;
          var pside = c.vertical ? Math.abs(pdx) : Math.abs(pdy);
          if (palong > 0 && palong < ahead && pside < 40) blocked = true;
        }
        var target = blocked ? 0 : c.speed;
        if (c.vertical) c.y += c.dir * target * dt;
        else c.x += c.dir * target * dt;
        // Out of the world: respawn on another road.
        if (c.x < -80 || c.x > S.WORLD_W + 80 || c.y < -80 || c.y > S.WORLD_H + 80) {
          this.cars.splice(i, 1);
          this.spawn(true);
        }
      }
      // Keep the streets busy.
      while (this.cars.length < this.maxCars) this.spawn(true);
      // Hand traffic cars to the shared vehicle physics for collisions.
      S.vehicles.list = S.vehicles.list.filter(function (v) { return v.driver !== 'traffic'; });
      for (var k = 0; k < this.cars.length; k++) S.vehicles.list.push(this.cars[k]);
    },

    draw: function (ctx, cam) {
      var x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + 1340, y1 = cam.y + 780;
      for (var i = 0; i < this.cars.length; i++) {
        var c = this.cars[i];
        if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(-22 + 3, -11 + 4, 44, 22);
        ctx.fillStyle = c.color;
        ctx.fillRect(-22, -11, 44, 22);
        ctx.fillStyle = 'rgba(180,210,230,0.75)';
        ctx.fillRect(-14, -8, 12, 16);
        ctx.fillStyle = '#222';
        ctx.fillRect(16, -9, 4, 5);
        ctx.fillRect(16, 4, 4, 5);
        ctx.restore();
        if (c.hp < 55 && Math.random() < 0.3) {
          if (S.combat) S.combat.addParticles(c.x, c.y, 1, '#888', 40, 0.8);
        }
      }
    },
  };
})(window.SOLMAR);
