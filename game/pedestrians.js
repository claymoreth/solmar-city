// pedestrians.js — people walking the sidewalks, running away from gunfire.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c', '#fd79a8', '#fdcb6e'];
  var PANTS = ['#2c3e50', '#34495e', '#5d4037', '#37474f', '#4a235a'];
  var HATS = ['#c0392b', '#2c3e50', '#f1c40f', '#7f8c8d'];

  S.peds = {
    list: [],
    maxPeds: 28,

    init: function () {
      this.list = [];
      for (var i = 0; i < this.maxPeds; i++) this.spawn(true);
    },

    spawn: function (anywhere) {
      var x, y, tries = 0;
      do {
        x = 100 + Math.random() * (S.WORLD_W - 200);
        y = 100 + Math.random() * (S.WORLD_H - 200);
        tries++;
      } while (S.pointInBuilding(x, y) && tries < 20);
      var ped = {
        x: x, y: y, angle: Math.random() * Math.PI * 2,
        speed: 40 + Math.random() * 30,
        shirt: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
        pants: PANTS[Math.floor(Math.random() * PANTS.length)],
        hat: Math.random() < 0.3 ? HATS[Math.floor(Math.random() * HATS.length)] : null,
        bag: Math.random() < 0.3,
        walkPhase: Math.random() * 6,
        tx: x, ty: y, waitT: 0,
        fleeing: false, fleeT: 0,
      };
      this.list.push(ped);
      return ped;
    },

    clearAll: function () { this.list = []; },

    fleeFrom: function (x, y) {
      for (var i = 0; i < this.list.length; i++) {
        var p = this.list[i];
        var d = S.dist(p.x, p.y, x, y);
        if (d < 420) {
          p.fleeing = true;
          p.fleeT = 2.5 + Math.random();
          var a = Math.atan2(p.y - y, p.x - x);
          p.tx = S.clamp(p.x + Math.cos(a) * 300, 40, S.WORLD_W - 40);
          p.ty = S.clamp(p.y + Math.sin(a) * 300, 40, S.WORLD_H - 40);
        }
      }
    },

    update: function (dt) {
      for (var i = this.list.length - 1; i >= 0; i--) {
        var p = this.list[i];
        if (p.fleeT > 0) p.fleeT -= dt;
        else p.fleeing = false;
        var dx = p.tx - p.x, dy = p.ty - p.y;
        var d = Math.hypot(dx, dy);
        if (d < 12) {
          if (p.waitT > 0) { p.waitT -= dt; continue; }
          if (Math.random() < 0.01) {
            p.waitT = 1 + Math.random() * 3;
            continue;
          }
          p.tx = S.clamp(p.x + (Math.random() - 0.5) * 500, 40, S.WORLD_W - 40);
          p.ty = S.clamp(p.y + (Math.random() - 0.5) * 500, 40, S.WORLD_H - 40);
          continue;
        }
        var spd = p.fleeing ? p.speed * 2.4 : p.speed;
        p.angle = Math.atan2(dy, dx);
        p.x += (dx / d) * spd * dt;
        p.y += (dy / d) * spd * dt;
        p.walkPhase += dt * (p.fleeing ? 16 : 8);
        var col = S.collide(p.x, p.y, 12);
        if (col.hit) { p.x = col.x; p.y = col.y; p.tx = p.x + (Math.random() - 0.5) * 300; p.ty = p.y + (Math.random() - 0.5) * 300; }
      }
      while (this.list.length < this.maxPeds) this.spawn(true);
    },

    draw: function (ctx, cam) {
      var x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + 1340, y1 = cam.y + 780;
      for (var i = 0; i < this.list.length; i++) {
        var p = this.list[i];
        if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        var moving = S.dist(p.x, p.y, p.tx, p.ty) > 12;
        S.drawHuman(ctx, p.x, p.y, p.angle, {
          jacket: p.shirt, pants: p.pants, hat: p.hat, bag: p.bag,
          walkPhase: p.walkPhase, moving: moving, scale: 1.1,
        });
      }
    },
  };
})(window.SOLMAR);
