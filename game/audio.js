// audio.js — all sounds are synthesised with WebAudio, no audio files.
window.SOLMAR = window.SOLMAR || {};
(function (S) {
  var ctx = null;
  var engineNodes = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    var c = ensure();
    if (!c) return;
    try {
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.12, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  function noiseBurst(dur, vol, lowFreq) {
    var c = ensure();
    if (!c) return;
    try {
      var len = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = c.createBufferSource();
      src.buffer = buf;
      var filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lowFreq || 1200;
      var g = c.createGain();
      g.gain.value = vol || 0.2;
      src.connect(filt); filt.connect(g); g.connect(c.destination);
      src.start();
    } catch (e) { /* ignore */ }
  }

  S.audio = {
    unlock: function () { ensure(); },
    shot: function () { noiseBurst(0.09, 0.22, 900); tone(180, 0.08, 'square', 0.08, 60); },
    punch: function () { noiseBurst(0.06, 0.16, 500); },
    reload: function () { tone(300, 0.06, 'square', 0.12); setTimeout(function () { tone(420, 0.06, 'square', 0.12); }, 120); },
    pickup: function () { tone(660, 0.09, 'sine', 0.14); setTimeout(function () { tone(880, 0.12, 'sine', 0.14); }, 90); },
    mission: function () {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 'triangle', 0.16); }, i * 110); });
    },
    explosion: function () { noiseBurst(0.5, 0.3, 400); tone(90, 0.4, 'sine', 0.2, 40); },
    fail: function () { tone(220, 0.25, 'sawtooth', 0.1, 110); },
    click: function () { tone(700, 0.04, 'square', 0.08); },
    setEngine: function (on, rpm) {
      var c = ensure();
      if (!c) return;
      try {
        if (on && !engineNodes) {
          var o = c.createOscillator();
          var g = c.createGain();
          o.type = 'sawtooth';
          o.frequency.value = 60;
          g.gain.value = 0.0;
          o.connect(g); g.connect(c.destination);
          o.start();
          engineNodes = { o: o, g: g };
        }
        if (!engineNodes) return;
        if (!on) {
          engineNodes.g.gain.setTargetAtTime(0.0, c.currentTime, 0.1);
          return;
        }
        engineNodes.o.frequency.setTargetAtTime(55 + rpm * 140, c.currentTime, 0.1);
        engineNodes.g.gain.setTargetAtTime(0.035, c.currentTime, 0.1);
      } catch (e) { /* ignore */ }
    },
  };
})(window.SOLMAR);
