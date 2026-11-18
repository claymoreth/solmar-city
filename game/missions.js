// missions.js — the story: eight missions in order, each with cash and XP.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var DEFS = [
    { name: 'M1 — First Delivery', objective: 'Reach the Old Market drop point', cash: 200, xp: 100 },
    { name: 'M2 — Hot Wheels', objective: 'Escape the 2-star heat: reach the safehouse', cash: 350, xp: 150 },
    { name: 'M3 — Grand Theft Falcon', objective: 'Steal the golden Falcon GT and bring it to the garage', cash: 500, xp: 200 },
    { name: 'M4 — Beachside Defense', objective: 'Defend Beachside: take down 6 gang members', cash: 500, xp: 250 },
    { name: 'M5 — Turf War', objective: 'Take back Old Market: defeat 8 gang members', cash: 600, xp: 300 },
    { name: 'M6 — Hot Pursuit', objective: 'Chase the Rival Phantom and stop it — do not let it escape', cash: 700, xp: 350 },
    { name: 'M7 — The Trap', objective: 'You walked into a 4-star trap. Lose the heat to survive', cash: 800, xp: 400 },
    { name: 'M8 — King of Solmar', objective: 'Storm Gang HQ and bring down BIG MARCO', cash: 1500, xp: 1000 },
  ];

  S.missions = {
    defs: DEFS,
    doneCount: 0,
    active: null,
    lastResult: null,
    rival: null,
    _timer: null,

    clearPending: function () {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    },

    currentDef: function () {
      return this.doneCount < DEFS.length ? DEFS[this.doneCount] : null;
    },

    startNext: function () {
      if (this.active || this.doneCount >= DEFS.length) return false;
      var n = this.doneCount + 1;
      this.start(n);
      return true;
    },

    start: function (n) {
      if (n < 1 || n > 8) return false;
      if (this.active) return false;
      this.active = { n: n, data: {}, t: 0 };
      var d = this.active.data;
      var p = S.player;
      if (n === 2) {
        S.police.setWanted(2);
        S.police.spawnNearPlayer('car');
        S.police.spawnNearPlayer('car');
      } else if (n === 3) {
        d.falcon = S.vehicles.spawn(2000, 700, 'car', '#ffd700', null);
        d.falcon.isMissionCar = true;
        if (S.hud) S.hud.toast('The golden Falcon GT is parked near Hillside');
      } else if (n === 4) {
        S.combat.spawnGang(600, 1800, 6);
        d.total = 6; d.kills = 0;
      } else if (n === 5) {
        S.combat.spawnGang(1600, 1800, 8);
        d.total = 8; d.kills = 0;
      } else if (n === 6) {
        var rv = S.vehicles.spawn(p.x + 400, p.y + 200, 'rival', '#111111', null);
        this.rival = rv;
        d.rival = rv;
        d.escapeT = 0;
        if (S.hud) S.hud.toast('The Rival Phantom is running — chase it down!');
      } else if (n === 7) {
        S.police.setWanted(4);
        S.police.spawnNearPlayer('car');
        S.police.spawnNearPlayer('car');
        S.police.spawnNearPlayer('car');
        S.police.spawnNearPlayer('foot');
        S.police.spawnNearPlayer('foot');
        if (S.hud) S.hud.toast('It is a trap — 4 stars! Lose them all to survive');
      } else if (n === 8) {
        var boss = S.combat.spawnBoss(3200, 2300);
        S.combat.spawnGang(3200, 2300, 5);
        d.boss = boss;
        if (S.hud) S.hud.toast('BIG MARCO is at Gang HQ. End this.');
      }
      if (S.hud) S.hud.toast('Mission started: ' + DEFS[n - 1].name);
      return true;
    },

    onHostileDown: function (h) {
      if (!this.active) return;
      var d = this.active.data;
      if ((this.active.n === 4 || this.active.n === 5) && h.kind === 'gang') {
        d.kills = (d.kills || 0) + 1;
      }
    },

    onBossDown: function () {
      if (this.active && this.active.n === 8) this.complete(8);
    },

    fail: function (reason) {
      if (!this.active) return;
      var n = this.active.n;
      this.lastResult = { status: 'failed', n: n, reason: reason };
      this.active = null;
      S.audio.fail();
      if (S.hud) S.hud.toast('Mission failed: ' + reason + ' — you can try again');
      if (S.save) S.save.write();
    },

    complete: function (n) {
      var def = DEFS[n - 1];
      if (!def) return;
      var p = S.player;
      p.addCash(def.cash);
      p.addXp(def.xp);
      this.doneCount = n;
      this.lastResult = { status: 'complete', n: n, name: def.name, reward: def.cash, xp: def.xp };
      this.active = null;
      S.audio.mission();
      if (S.hud) S.hud.toast(def.name + ' complete! +$' + def.cash + '  +' + def.xp + ' XP');
      if (S.save) S.save.write();
      if (n === 8) {
        if (S.main) S.main.showVictory();
        return;
      }
      // The next mission starts shortly after, so the story keeps flowing.
      var self = this;
      this.clearPending();
      this._timer = setTimeout(function () { self._timer = null; self.startNext(); }, 2500);
    },

    update: function (dt) {
      if (!this.active) return;
      var a = this.active;
      var d = a.data;
      var p = S.player;
      a.t += dt;
      if (a.n === 1) {
        if (S.dist(p.x, p.y, S.POIS.m1drop.x, S.POIS.m1drop.y) < 70) this.complete(1);
      } else if (a.n === 2) {
        if (S.dist(p.x, p.y, S.POIS.safehouse.x, S.POIS.safehouse.y) < 80) {
          S.police.setWanted(0);
          this.complete(2);
        }
      } else if (a.n === 3) {
        if (d.falcon && p.inCar && p.car === d.falcon &&
            S.dist(p.x, p.y, S.POIS.garage.x, S.POIS.garage.y) < 130) {
          this.complete(3);
        }
      } else if (a.n === 4 || a.n === 5) {
        if ((d.kills || 0) >= d.total) this.complete(a.n);
      } else if (a.n === 6) {
        var rv = d.rival;
        if (!rv || rv.dead || rv.hp <= 0) {
          this.rival = null;
          this.complete(6);
          return;
        }
        var dist = S.dist(p.x, p.y, rv.x, rv.y);
        if (dist > 1000) {
          d.escapeT += dt;
          if (d.escapeT >= 12) {
            this.rival = null;
            this.fail('The Rival Phantom got away');
            return;
          }
        } else {
          d.escapeT = 0;
        }
      } else if (a.n === 7) {
        if (S.police.wanted === 0) this.complete(7);
      } else if (a.n === 8) {
        var boss = S.combat.boss();
        if (!boss) this.complete(8);
      }
    },

    objectiveMarker: function () {
      if (!this.active) return null;
      var d = this.active.data;
      var p = S.player;
      switch (this.active.n) {
        case 1: return { x: S.POIS.m1drop.x, y: S.POIS.m1drop.y };
        case 2: return { x: S.POIS.safehouse.x, y: S.POIS.safehouse.y };
        case 3: return d.falcon ? { x: d.falcon.x, y: d.falcon.y } : { x: S.POIS.garage.x, y: S.POIS.garage.y };
        case 4: return { x: 600, y: 1800 };
        case 5: return { x: 1600, y: 1800 };
        case 6: return d.rival ? { x: d.rival.x, y: d.rival.y } : null;
        case 7: return null;
        case 8: return { x: 3200, y: 2300 };
        default: return null;
      }
    },

    counterText: function () {
      if (!this.active) return '';
      var d = this.active.data;
      if (this.active.n === 4 || this.active.n === 5) {
        return 'Gang down: ' + (d.kills || 0) + ' / ' + d.total;
      }
      if (this.active.n === 6 && d.rival) {
        return 'Rival HP: ' + Math.max(0, Math.round(d.rival.hp)) + '  •  Distance: ' + Math.round(S.dist(S.player.x, S.player.y, d.rival.x, d.rival.y)) + 'px' +
          (d.escapeT > 0 ? '  •  HE IS GETTING AWAY!' : '');
      }
      if (this.active.n === 8) {
        var boss = S.combat.boss();
        return boss ? 'BIG MARCO HP: ' + Math.max(0, Math.round(boss.hp)) + ' / 500' : '';
      }
      if (this.active.n === 7) {
        return 'Wanted: ' + S.police.wanted + ' stars — stay hidden';
      }
      return '';
    },
  };
})(window.SOLMAR);
