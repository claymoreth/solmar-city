// save.js — autosave to localStorage (cash, missions, weapon, XP).
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var KEY = 'solmar-city-save-v1';

  S.save = {
    write: function () {
      try {
        var p = S.player;
        var data = {
          cash: Math.round(p.cash),
          xp: p.xp,
          level: p.level,
          weapon: p.weapon,
          ammo: p.ammo,
          reserveAmmo: p.reserveAmmo,
          missionsDone: S.missions.doneCount,
          px: Math.round(p.x),
          py: Math.round(p.y),
        };
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) { /* storage unavailable: play session-only */ }
    },
    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    },
    clear: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },
  };
})(window.SOLMAR);
