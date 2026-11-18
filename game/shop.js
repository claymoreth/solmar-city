// shop.js — the Gun Shop (Falcon-9 + ammo) and the garage (repair + ammo).
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  S.shop = {
    kind: null, // 'gun' | 'garage' | null

    open: function (kind) {
      this.kind = kind;
      var p = S.player;
      var title = document.getElementById('shop-title');
      var cash = document.getElementById('shop-cash');
      var items = document.getElementById('shop-items');
      var falconBtn = document.getElementById('btn-shop-falcon');
      var ammoBtn = document.getElementById('btn-shop-ammo');
      var repairBtn = document.getElementById('btn-shop-repair');
      title.textContent = kind === 'gun' ? 'GUN SHOP' : 'GARAGE';
      cash.textContent = '$' + Math.round(p.cash);
      items.innerHTML = kind === 'gun'
        ? 'Falcon-9: damage 34, fast fire, 30-round mag.<br>Ammo: $30 for 24 rounds, added to your reserve.'
        : 'Repair your ride to full health.<br>Ammo: $30 for 24 rounds, added to your reserve.';
      falconBtn.disabled = (p.weapon === 'falcon' || p.cash < 500);
      falconBtn.textContent = p.weapon === 'falcon' ? 'Falcon-9 OWNED' : 'Buy Falcon-9 — $500';
      ammoBtn.disabled = (p.cash < 30);
      repairBtn.classList.toggle('hidden', kind !== 'garage');
      repairBtn.disabled = (p.cash < 50);
      if (S.main) S.main.setState('shop');
      if (S.audio) S.audio.click();
    },

    close: function () {
      this.kind = null;
      if (S.main) S.main.setState('playing');
    },

    buyFalcon: function () {
      var p = S.player;
      if (p.buyWeapon('falcon')) {
        S.audio.pickup();
        if (S.hud) S.hud.toast('Falcon-9 bought! Damage 34, fast fire.');
        if (S.save) S.save.write();
        this.open(this.kind);
      } else if (S.hud) {
        S.hud.toast('Not enough cash for the Falcon-9');
      }
    },

    buyAmmo: function () {
      var p = S.player;
      if (p.cash < 30) {
        if (S.hud) S.hud.toast('Not enough cash for ammo');
        return;
      }
      p.cash -= 30;
      p.reserveAmmo += 24;
      S.audio.pickup();
      if (S.hud) S.hud.toast('Ammo +24 (reserve ' + p.reserveAmmo + ')');
      if (S.save) S.save.write();
      this.open(this.kind);
    },

    repair: function () {
      var p = S.player;
      if (!p.inCar || !p.car) {
        if (S.hud) S.hud.toast('Drive a vehicle into the garage first');
        return;
      }
      if (p.cash < 50) {
        if (S.hud) S.hud.toast('Not enough cash for a repair');
        return;
      }
      p.cash -= 50;
      p.car.hp = 100;
      p.car.smoke = 0;
      S.audio.pickup();
      if (S.hud) S.hud.toast('Vehicle repaired to full health');
      if (S.save) S.save.write();
      this.open(this.kind);
    },

    // Called on the G key: opens the right shop when the player is near it.
    tryOpenNear: function () {
      var p = S.player;
      if (S.dist(p.x, p.y, S.POIS.gunshop.x, S.POIS.gunshop.y) < 150) {
        this.open('gun');
        return true;
      }
      if (S.dist(p.x, p.y, S.POIS.garage.x, S.POIS.garage.y) < 150) {
        this.open('garage');
        return true;
      }
      return false;
    },
  };
})(window.SOLMAR);
