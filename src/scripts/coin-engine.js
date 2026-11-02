// @ts-nocheck
// Ported from the Biggify prototype (build/alex-prototype, commit 1bb0973). Owner's rule: animations always play,
// so the reduced-motion switch below is fixed to false. Screenshot mode (?shot) is kept for tooling.
// coin-engine.js: drawn coins for fast, animated pages. No photos and no downloaded images.
//
// How it stays fast:
//  - Every coin face is drawn once in SVG, rasterized once to a canvas sprite (shadow baked
//    in), and reused by every <img> and canvas that shows it. Sprites are drawn in a priority
//    queue, one per task, so the page keeps painting while they are prepared.
//  - A river row is one track of plain <img> coins, laid out twice, moved by one compositor
//    animation (transform only). Depth is row opacity, so a river needs one sprite per design.
//  - A flip is a 2D turn (scaleX through zero) plus a reeded-edge band: composited, no 3D layers.
//  - One shine at a time; every animation is transform or opacity.
//  - Loops (speed easing, pointer lean, loupe) run in requestAnimationFrame only while needed,
//    read nothing from layout, and write transforms only.
//  - Rivers and loupes pause when offscreen or when the tab is hidden.
//  - Reduced motion: no animation, no flips, no shine, no loupe; rivers become still mosaics.
//
// API (window.CoinEngine; full notes and examples in the prototype README):
//   spec(seed, type?, metal?)          -> a coin description {front, back, m, anc}
//   coin(spec, sizePx, {priority, direct, noflip}) -> <div class="coin"> (flips on hover or tap)
//   river(host, options)               -> endless rows of coins inside host
//   grid(host, {count, size, seed})    -> a static grid of coins
//   loupe(host, river, options)        -> a magnifier drawn from cached sprites
//   flip(el, on), shine(el), sprite(face, px, opts), watch(el, onVisibleChange)
//   <span data-coin="type:metal:seed" data-d="80"> placeholders are filled on load
//
// Types: liberty, laureate, eagle, wreath, shield, sun, crown, owl.
// Metals: gold, rose, silver, toned, copper, bronze, nickel.
(function () {
  var shot = /[?&]shot/.test(location.search);
  var reduce = false; // owner rule: animations always play (no reduced-motion opt-out)
  var fine = window.matchMedia && matchMedia("(pointer:fine)").matches;
  if (shot) document.documentElement.classList.add("shot");
  if (reduce) document.documentElement.classList.add("calm");

  // =====================================================================================
  // 1-2. DESIGNS AND SPECS: palettes, shapes, legends, and svg(face) which draws one face
  // =====================================================================================
  function rng(seed) { var s = Math.floor(seed) % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function f1(n) { return (Math.round(n * 10) / 10).toString(); }

  // Metal palettes: highlight, light, mid, dark, deep shadow
  var M = {
    gold: ["#fff6cf", "#f2d27c", "#cf9f3e", "#8c621d", "#3f2b0a"],
    rose: ["#ffe2c4", "#ecb57c", "#c27d45", "#7c4521", "#34190a"],
    silver: ["#ffffff", "#e3e7eb", "#aeb5bd", "#717981", "#2f343a"],
    toned: ["#fff3d6", "#e6cf98", "#c08e58", "#7b4f8e", "#24557d"],
    copper: ["#ffd5b3", "#e59a66", "#b35f34", "#73361a", "#2f1408"],
    bronze: ["#eed9a6", "#c4a066", "#8a6838", "#563e20", "#251a0c"],
    nickel: ["#f4f1ea", "#cfcac0", "#9d978c", "#68635a", "#2c2a26"]
  };

  // ---------- shared shapes (put into each coin's own SVG <defs> when its sprite is drawn) ----------
  var BUST = "M104 44C88 46 78 56 76 70C75 76 73 80 70 84L60 98C62 100 66 100 68 101L66 106L69 109L66 113C67 116 67 120 68 124C70 130 78 133 84 132C86 140 86 148 82 158C100 164 124 164 144 158C136 150 130 144 128 136C142 130 152 116 152 96C152 66 132 44 104 44Z";
  var BUST_D = "M72 87q4-3 8 0M69 81q6-4 13-2M116 94c7-3 12 2 11 9c-1 6-6 9-11 7M96 50c14 0 30 10 38 26M101 57c14 2 26 12 31 28M121 104c10 0 20-6 26-16M127 117c8 2 16-2 22-10M84 61C102 63 124 71 142 85M82 67C100 69 122 77 140 91";
  function starPts(cx, cy, R, r) { var p = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r : R; p.push(f1(cx + Math.cos(a) * k) + "," + f1(cy + Math.sin(a) * k)); } return p.join(" "); }
  function ell(cx, cy, rx, ry, deg) { return '<ellipse cx="' + f1(cx) + '" cy="' + f1(cy) + '" rx="' + f1(rx) + '" ry="' + f1(ry) + '" transform="rotate(' + f1(deg) + " " + f1(cx) + " " + f1(cy) + ')"/>'; }
  function rad(d) { return d * Math.PI / 180; }

  function laurel() {
    var s = "", ang = Math.atan2(26, 58) * 180 / Math.PI;
    for (var i = 0; i <= 8; i++) {
      var t = i / 8, x = 84 + 58 * t, y = 61 + 26 * t;
      s += ell(x - 2, y - 4, 7.5, 2.6, ang - 38) + ell(x + 1, y + 4, 7.5, 2.6, ang + 38);
    }
    return s;
  }
  function eagle() {
    var s = '<path d="M100 72c-9 0-13 8-13 18v34c0 12 6 22 13 28c7-6 13-16 13-28V90c0-10-4-18-13-18z"/><circle cx="100" cy="64" r="9"/><path d="M93 61l-11 4l11 4z"/>';
    [-1, 1].forEach(function (side) {
      var sx = 100 + side * 8, sy = 88;
      for (var i = 0; i < 7; i++) {
        var a = side < 0 ? 168 + i * 14 : 12 - i * 14, L = 50 - Math.abs(i - 2) * 3;
        s += ell(sx + Math.cos(rad(a)) * L / 2, sy + Math.sin(rad(a)) * L / 2, L / 2, 5.2, a);
      }
    });
    for (var j = 0; j < 5; j++) { var b = 70 + j * 10, L2 = 26; s += ell(100 + Math.cos(rad(b)) * L2 / 2, 142 + Math.sin(rad(b)) * L2 / 2, L2 / 2, 4, b); }
    return '<g transform="translate(100 100) scale(.92) translate(-100 -100)">' + s + "</g>";
  }
  function wreath(cx, cy, R, from, to, n) {
    var s = "", dir = to > from ? 1 : -1;
    for (var i = 0; i <= n; i++) {
      var a = from + (to - from) * i / n, x = cx + Math.cos(rad(a)) * R, y = cy + Math.sin(rad(a)) * R, t = a + 90 * dir;
      s += ell(x + Math.cos(rad(a)) * 4.5, y + Math.sin(rad(a)) * 4.5, 8, 3, t - 35 * dir) + ell(x - Math.cos(rad(a)) * 4.5, y - Math.sin(rad(a)) * 4.5, 8, 3, t + 35 * dir);
      if (i % 3 === 1) s += '<circle cx="' + f1(x + Math.cos(rad(a)) * 10) + '" cy="' + f1(y + Math.sin(rad(a)) * 10) + '" r="2"/>';
    }
    return s;
  }
  function rays() {
    var s = "";
    for (var i = 0; i < 24; i++) {
      var a = i * 15, L = i % 2 ? 50 : 61, w = 4.2;
      s += '<polygon points="' + [[a - w, 27], [a, L], [a + w, 27]].map(function (p) { return f1(100 + Math.cos(rad(p[0])) * p[1]) + "," + f1(100 + Math.sin(rad(p[0])) * p[1]); }).join(" ") + '"/>';
    }
    return s + '<circle cx="100" cy="100" r="24"/>';
  }
  function stripes() {
    var s = "";
    for (var x = 78; x <= 122.5; x += 7.3) { var y2 = 152 - 0.917 * Math.pow(Math.abs(x - 100), 1.2) - 4; s += "M" + f1(x) + " 86V" + f1(y2); }
    return s;
  }

  var DEFS = (function () {
    var g = "";
    Object.keys(M).forEach(function (k) {
      var c = M[k];
      g += k === "toned"
        ? '<radialGradient id="f-' + k + '" cx=".4" cy=".36" r=".72"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".42" stop-color="' + c[1] + '"/><stop offset=".64" stop-color="' + c[2] + '"/><stop offset=".83" stop-color="' + c[3] + '"/><stop offset="1" stop-color="' + c[4] + '"/></radialGradient>'
        : '<radialGradient id="f-' + k + '" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".38" stop-color="' + c[1] + '"/><stop offset=".78" stop-color="' + c[2] + '"/><stop offset="1" stop-color="' + c[3] + '"/></radialGradient>';
      g += '<radialGradient id="p-' + k + '" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="' + c[2] + '"/><stop offset=".55" stop-color="' + c[3] + '"/><stop offset="1" stop-color="' + c[4] + '"/></radialGradient>';
      g += '<linearGradient id="r-' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".5" stop-color="' + c[2] + '"/><stop offset="1" stop-color="' + c[4] + '"/></linearGradient>';
      g += '<linearGradient id="v-' + k + '" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".55" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient>';
      g += '<linearGradient id="q-' + k + '" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient>';
    });
    g += '<radialGradient id="patina"><stop offset="0" stop-color="#4c7a5e" stop-opacity=".6"/><stop offset="1" stop-color="#4c7a5e" stop-opacity="0"/></radialGradient>';
    g += '<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".68" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>';
    g += '<path id="arc-t" d="M30 100A70 70 0 0 1 170 100"/><path id="arc-t2" d="M26 100A74 74 0 0 1 174 100"/><path id="arc-b" d="M22 100A78 78 0 0 0 178 100"/>';
    g += '<g id="s-bust"><path d="' + BUST + '"/></g><g id="s-bust-d"><path d="' + BUST_D + '"/></g><g id="s-laurel">' + laurel() + "</g>";
    g += '<g id="s-eagle">' + eagle() + '</g><g id="s-eagle-d"><path d="M93 96h14v12c0 6-4 9-7 11c-3-2-7-5-7-11zM93 101h14"/></g>';
    g += '<g id="s-wreath">' + wreath(100, 104, 62, 95, 200, 9) + wreath(100, 104, 62, 85, -20, 9) + '<circle cx="100" cy="166" r="4"/></g>';
    g += '<g id="s-rays">' + rays() + '</g><g id="s-rays-d"><polygon points="' + starPts(100, 100, 15, 6.5) + '"/></g>';
    g += '<g id="s-shield"><path d="M72 66h56v36c0 28-16 42-28 50c-12-8-28-22-28-50z"/><polygon points="' + starPts(56, 104, 7, 3) + '"/><polygon points="' + starPts(144, 104, 7, 3) + '"/></g><g id="s-shield-d"><path d="M72 84h56' + stripes() + '"/></g>';
    g += '<g id="s-owl"><path d="M100 64c-20 0-30 18-30 42c0 26 12 44 30 50c18-6 30-24 30-50c0-24-10-42-30-42z"/><path d="M80 72l-6-15l14 8zM120 72l6-15l-14 8zM88 155h8v7h-8zM104 155h8v7h-8z"/>' + ell(57, 62, 8, 3, -35) + ell(66, 52, 8, 3, -70) + ell(50, 74, 8, 3, -10) + '<path d="M70 38a11 11 0 1 0 12 15a8.5 8.5 0 1 1-12-15z"/>' +
      '<text x="150" y="96" font-size="17" font-family="Times New Roman,serif" text-anchor="middle">Α</text><text x="150" y="117" font-size="17" font-family="Times New Roman,serif" text-anchor="middle">Θ</text><text x="150" y="138" font-size="17" font-family="Times New Roman,serif" text-anchor="middle">Ε</text></g>';
    g += '<g id="s-owl-d"><circle cx="89" cy="92" r="10"/><circle cx="111" cy="92" r="10"/><circle cx="89" cy="92" r="3"/><circle cx="111" cy="92" r="3"/><path d="M100 99l-4 9h8zM84 120l4 4l4-4m4 0l4 4l4-4m4 0l4 4l4-4M86 131l4 4l4-4m4 0l4 4l4-4m4 0l4 4l4-4M74 110c4 20 12 34 22 40M126 110c-4 20-12 34-22 40"/></g>';
    g += '<g id="s-crown"><path d="M66 106L70 70L84 88L100 60L116 88L130 70L134 106Z"/><path d="M63 106h74v12H63z"/><circle cx="70" cy="67" r="4.5"/><circle cx="100" cy="56" r="5"/><circle cx="130" cy="67" r="4.5"/></g><g id="s-crown-d"><circle cx="78" cy="112" r="2.4"/><circle cx="92" cy="112" r="2.4"/><circle cx="108" cy="112" r="2.4"/><circle cx="122" cy="112" r="2.4"/><path d="M100 70v26M88 98h24"/></g>';
    return g;
  })();

  // ---------- words on the coins (invented, generic; no real coin is copied) ----------
  var LAT = ["PROVIDENTIA", "CONCORDIA", "LIBERTAS", "FORTVNA REDVX", "VIRTVS AVG", "PAX AETERNA", "SALVS PVBLICA", "FIDES MILITVM"];
  var LEG = ["LIBERTY", "PROVIDENTIA", "CONCORDIA", "UNITY · PEACE", "LIBERTAS", "REPUBLIC", "FORTITUDO"];
  var DEN = ["ONE DOLLAR", "HALF DOLLAR", "QUARTER", "TEN CENTS", "FIVE CENTS", "TWENTY UNITS", "ONE CROWN", "TWO SHILLINGS"];
  var NUM = [["ONE", "DOLLAR"], ["1", "CENT"], ["5", "CENTS"], ["10", "CENTS"], ["½", "CROWN"], ["20", "UNITS"], ["ONE", "DIME"]];
  var PAIR = { liberty: ["eagle", "wreath"], laureate: ["owl"], owl: ["laureate"], eagle: ["liberty"], wreath: ["liberty", "crown"], shield: ["sun"], sun: ["shield"], crown: ["wreath"] };
  var TYPES = ["liberty", "liberty", "liberty", "eagle", "eagle", "wreath", "wreath", "shield", "sun", "sun", "crown", "laureate", "laureate", "owl"];

  var CAP = ' font-family="Palatino Linotype,Book Antiqua,Palatino,Times New Roman,serif" font-weight="700"';
  function arcText(id, txt, size, sp) { return '<text font-size="' + (size || 12.5) + '" letter-spacing="' + (sp || 2.4) + '"' + CAP + '><textPath href="#' + id + '" startOffset="50%" text-anchor="middle">' + txt + "</textPath></text>"; }
  function line(x, y, txt, size, sp, fam) { return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" letter-spacing="' + (sp || 1) + '" text-anchor="middle"' + (fam || CAP) + ">" + txt + "</text>"; }

  var DESIGN = {
    liberty: function (f) {
      var s = '<use href="#s-bust"/>';
      for (var i = 0; i < 13; i++) { var a = rad(125 + i * 290 / 12); s += '<polygon points="' + starPts(100 + Math.cos(a) * 76, 100 + Math.sin(a) * 76, 5.4, 2.3) + '"/>'; }
      return { r: s + line(100, 181, f.date, 15, 1.5), d: '<use href="#s-bust-d"/>' };
    },
    laureate: function (f) {
      return { r: '<g transform="translate(200 0) scale(-1 1)"><use href="#s-bust"/><use href="#s-laurel"/></g>' + arcText("arc-t2", f.leg, 13, 2), d: '<g transform="translate(200 0) scale(-1 1)"><use href="#s-bust-d"/></g>' };
    },
    eagle: function (f) { return { r: '<use href="#s-eagle"/>' + arcText("arc-t", f.leg) + arcText("arc-b", f.den, 11.5, 2), d: '<use href="#s-eagle-d"/>' }; },
    wreath: function (f) {
      return { r: '<use href="#s-wreath"/>' + line(100, 114, f.num[0], f.num[0].length > 2 ? 30 : 44, 1, ' font-family="Palatino Linotype,Book Antiqua,Palatino,Georgia,serif" font-weight="700"') + line(100, 134, f.num[1], 11, 2.5) + line(100, 72, f.date, 11, 2) };
    },
    shield: function (f) { return { r: '<use href="#s-shield"/>' + arcText("arc-t", f.leg) + arcText("arc-b", String(f.date), 13, 3), d: '<use href="#s-shield-d"/>' }; },
    sun: function (f) { return { r: '<use href="#s-rays"/>' + arcText("arc-t", f.leg) + arcText("arc-b", String(f.date), 13, 3), d: '<use href="#s-rays-d"/>' }; },
    crown: function (f) { return { r: '<use href="#s-crown"/>' + arcText("arc-t", f.leg) + line(100, 146, f.den, 13, 2) + line(100, 168, f.date, 13, 2), d: '<use href="#s-crown-d"/>' }; },
    owl: function () { return { r: '<use href="#s-owl"/>', d: '<use href="#s-owl-d"/>' }; }
  };

  function flan(r) {
    var p1 = r() * 6, p2 = r() * 6, p3 = r() * 6, pts = [];
    for (var i = 0; i < 64; i++) { var t = i / 64 * Math.PI * 2, k = Math.min(99, 93 + 2.6 * Math.sin(3 * t + p1) + 1.8 * Math.sin(5 * t + p2) + 1.2 * Math.sin(7 * t + p3)); pts.push(f1(100 + Math.cos(t) * k) + " " + f1(100 + Math.sin(t) * k)); }
    return "M" + pts.join("L") + "Z";
  }
  function relief(f, inner) {
    var c = M[f.m];
    return '<g fill="' + c[4] + '" opacity="' + (f.anc ? 0.45 : 0.6) + '" transform="translate(1.2 1.6)">' + inner + "</g>" +
      '<g fill="' + c[0] + '" opacity="' + (f.anc ? 0.5 : 0.9) + '" transform="translate(-.8 -.9)">' + inner + "</g>" +
      '<g fill="url(#' + (f.proof ? "q-" : "v-") + f.m + ')">' + inner + "</g>";
  }

  function svg(f) {
    var c = M[f.m], k = f.m, rr = rng(f.seed), s = '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">', fl = "";
    if (f.anc) {
      fl = flan(rr);
      s += '<path d="' + fl + '" fill="' + c[4] + '"/><path d="' + fl + '" fill="url(#r-' + k + ')" transform="translate(100 100) scale(.985) translate(-100 -100)"/><path d="' + fl + '" fill="url(#f-' + k + ')" transform="translate(100 100) scale(.93) translate(-100 -100)"/>';
      if (k === "bronze" || rr() < 0.4) for (var i = 0; i < 3; i++) s += '<circle cx="' + f1(50 + rr() * 100) + '" cy="' + f1(50 + rr() * 100) + '" r="' + f1(14 + rr() * 22) + '" fill="url(#patina)"/>';
    } else {
      s += '<circle cx="100" cy="100" r="99.5" fill="' + c[4] + '"/><circle cx="100" cy="100" r="98" fill="none" stroke="url(#r-' + k + ')" stroke-width="3" stroke-dasharray="1.2 1.3"/><circle cx="100" cy="100" r="95" fill="url(#r-' + k + ')"/>' +
        '<circle cx="100" cy="100" r="86" fill="url(#' + (f.proof ? "p-" : "f-") + k + ')"/><circle cx="100" cy="100" r="86" fill="none" stroke="' + c[4] + '" stroke-opacity=".55" stroke-width="1.2"/>' +
        '<circle cx="100" cy="100" r="90" fill="none" stroke="' + c[3] + '" stroke-width="3.4" stroke-dasharray="1.4 2.1" opacity=".85"/>';
    }
    var d = DESIGN[f.t](f);
    var tr = "rotate(" + f1(f.rot) + " 100 100)" + (f.anc ? " translate(" + f1(f.off[0]) + " " + f1(f.off[1]) + ")" : "");
    s += '<g transform="' + tr + '">' + relief(f, d.r) + (d.d ? '<g fill="none" stroke="' + c[3] + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9">' + d.d + "</g>" : "") + "</g>";
    s += f.anc ? '<path d="' + fl + '" fill="url(#sheen)"/>' : '<circle cx="100" cy="100" r="95" fill="url(#sheen)"/>';
    return s + "</svg>";
  }

  var FID = 0;
  function spec(seedOrRng, type, metal) {
    var r = typeof seedOrRng === "function" ? seedOrRng : rng(seedOrRng || 1);
    type = type || pick(r, TYPES);
    var anc = type === "laureate" || type === "owl";
    metal = metal || (anc ? pick(r, ["silver", "silver", "bronze", "toned"]) : type === "wreath" ? pick(r, ["copper", "nickel", "silver", "gold", "copper"]) : pick(r, ["gold", "gold", "silver", "silver", "toned", "rose", "copper", "nickel"]));
    var date = 1795 + Math.floor(r() * 170), proof = !anc && r() < 0.18;
    function face(t) { return { t: t, m: metal, anc: anc, date: date, proof: proof, leg: anc ? pick(r, LAT) : pick(r, LEG), den: pick(r, DEN), num: pick(r, NUM), rot: anc ? r() * 40 - 20 : r() * 24 - 12, off: [r() * 10 - 5, r() * 10 - 5], seed: Math.floor(r() * 1e6) + 1, id: "f" + (++FID) }; }
    return { m: metal, anc: anc, front: face(type), back: face(pick(r, PAIR[type])) };
  }


  // =====================================================================================
  // 3. SPRITES: each coin face is drawn once (SVG -> canvas, with its shadow and any
  //    dimming or blur baked in) and reused by every <img> and every canvas that shows it.
  //    Drawing happens in a queue, one sprite per task, most urgent first, so the page keeps
  //    painting while coins are prepared. Priority 0 = needed now (a hover, the intro),
  //    1 = on screen (hero rivers), 2 = further down the page, 3 = only when the browser is idle.
  // =====================================================================================
  var PAD = 0.12;                      // shadow margin around the coin, as a fraction of its diameter
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var spriteCache = {}, jobs = [], pumping = false;
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 60); };
  function bucket(px) { var s = Math.ceil(px * DPR / 64) * 64; return Math.max(64, Math.min(1024, s)); }
  function svgDoc(f, S) {
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + S + '" height="' + S + '" viewBox="0 0 200 200"><defs>' + DEFS + "</defs>" + svg(f).replace(/^<svg[^>]*>/, "");
  }
  function pump() {
    if (pumping || !jobs.length) return;
    jobs.sort(function (a, b) { return a.pri - b.pri; });
    var j = jobs.shift(); pumping = true;
    var next = function () { pumping = false; setTimeout(pump, 0); };
    if (j.pri >= 3) idle(function () { j.run(next); }, { timeout: 3000 }); else j.run(next);
  }
  // sprite(face, cssPx, {dim, blur, shadow, priority}) -> Promise<{url, canvas, S, C}>
  // Cached by face, size bucket and look; asking again with a higher priority moves it up the queue.
  function sprite(f, px, o) {
    o = o || {};
    var S = bucket(px), pri = o.priority == null ? 1 : o.priority;
    var key = f.id + "|" + S + "|" + (o.dim || 0) + "|" + (o.blur || 0) + "|" + (o.shadow === false ? 0 : 1);
    var hit = spriteCache[key];
    if (hit) { if (hit.job && pri < hit.job.pri) hit.job.pri = pri; return hit.p; }
    var job = { pri: pri }, entry = { job: job };
    entry.p = new Promise(function (res) {
      job.run = function (next) {
        entry.job = null;
        var img = new Image(), src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgDoc(f, S));
        img.onload = function () {
          var C = Math.round(S * (1 + 2 * PAD)), pad = (C - S) / 2, cv = document.createElement("canvas");
          cv.width = cv.height = C;
          var x = cv.getContext("2d");
          if (o.blur && "filter" in x) x.filter = "blur(" + (o.blur * DPR) + "px)";
          if (o.shadow !== false) { x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = S * 0.07; x.shadowOffsetY = S * 0.05; }
          x.drawImage(img, pad, pad, S, S);
          x.filter = "none"; x.shadowColor = "transparent";
          if (o.dim) { x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(7,8,11," + o.dim + ")"; x.fillRect(0, 0, C, C); }
          var done = function (url) { res({ url: url, canvas: cv, S: S, C: C }); next(); };
          // screenshots encode synchronously (headless virtual time does not wait for toBlob)
          try { if (shot) done(cv.toDataURL("image/png")); else cv.toBlob(function (b) { done(b ? URL.createObjectURL(b) : src); }, "image/png"); } catch (e) { done(src); }
        };
        img.onerror = function () { res({ url: src, canvas: null, S: S, C: S }); next(); };
        img.src = src;
      };
    });
    spriteCache[key] = entry; jobs.push(job);
    if (!pumping) setTimeout(pump, 0);
    return entry.p;
  }

  // =====================================================================================
  // 4. COIN ELEMENTS: a coin is a <div class="coin"> holding one <img> (its sprite).
  //    A flip is a 2D turn (scaleX through zero, composited) with a reeded edge band showing
//    mid-turn: no 3D layers, so it stays cheap inside a moving row.
  //    coin(spec, sizePx, {px, priority, dim, blur, noflip, direct}); px = sprite size, if not sizePx
  // =====================================================================================
  function coin(sp, d, o) {
    o = o || {};
    if (!sp || !sp.front) sp = spec(sp && sp.seed || 1, sp && sp.type, sp && sp.metal);
    var e = document.createElement("div");
    e.className = "coin" + (sp.anc ? " anc" : "");
    e.style.setProperty("--d", d + "px");
    e.innerHTML = '<div class="coin-in"><img class="face front" alt="" draggable="false" decoding="async"></div>';
    e._o = sp; e._d = d; e._px = o.px || d; e._so = { dim: o.dim, blur: o.blur, priority: o.priority == null ? 2 : o.priority };
    // direct: show the SVG straight away (for a single coin needed at first paint, such as an intro); the sprite follows
    if (o.direct) { e.firstChild.firstChild.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgDoc(sp.front, bucket(e._px))); e.classList.add("ready"); }
    sprite(sp.front, e._px, e._so).then(function (s) { if (!o.direct) e.firstChild.firstChild.src = s.url; e._fs = s; e.classList.add("ready"); });
    if (o.noflip) e.setAttribute("data-noflip", "");
    return e;
  }
  function ensureBack(e) {
    if (!e || e._b || !e._o) return;
    e._b = 1;
    var M3 = M[e._o.m];
    e.style.setProperty("--e", M3[3]); e.style.setProperty("--e2", M3[2]);
    e.insertAdjacentHTML("beforeend", '<i class="edge"></i>');
    e.firstChild.insertAdjacentHTML("beforeend", '<img class="face back" alt="" draggable="false" decoding="async">');
    sprite(e._o.back, e._px, { dim: e._so.dim, blur: e._so.blur, priority: 0 }).then(function (s) { e.querySelector(".back").src = s.url; e._bs = s; });
  }
  // flip(el, on): turn a coin over (true) or back (false)
  function flip(e, on) {
    if (!e || reduce || e.classList.contains("flip") === on) return;
    if (on) ensureBack(e);
    e.classList.toggle("flip", on);
    e.classList.remove("turning");
    e._ft = performance.now(); e._fon = on;
    clearTimeout(e._ftm); clearTimeout(e._fsw);
    e._fsw = setTimeout(function () { e.classList.toggle("showback", on); }, 370); // faces swap at the midpoint of the turn
    requestAnimationFrame(function () { e.classList.add("turning"); e._ftm = setTimeout(function () { e.classList.remove("turning"); }, 760); });
    if (on) shine(e, 380);
  }
  // shine(el, delay): one light sweep across a coin
  function shine(e, delay) {
    if (reduce || shot || !e || e.querySelector(".shine")) return;
    var s = document.createElement("i"); s.className = "shine";
    if (delay) s.style.animationDelay = delay + "ms";
    e.appendChild(s);
    setTimeout(function () { s.remove(); }, 1050 + (delay || 0));
  }
  // Hover (mouse) or tap (touch) flips any .coin in the page, unless it or an ancestor has data-noflip.
  // Hover intent: the pointer must rest on a coin for 70 ms, and nothing flips while the page scrolls
  // (coins moving under a still pointer would otherwise flip one after another).
  var cur = null, pend = null, pendT = 0, lastScroll = -1e9;
  addEventListener("scroll", function () { lastScroll = performance.now(); }, { passive: true });
  function flipTarget(t) { var c = t && t.closest && t.closest(".coin"); return c && !c.closest("[data-noflip]") ? c : null; }
  if (!reduce && !shot) {
    if (fine) {
      document.addEventListener("pointerover", function (ev) {
        var c = flipTarget(ev.target);
        if (c === cur && !pend) return;
        clearTimeout(pendT); pend = c;
        if (cur && cur !== c) { flip(cur, false); cur = null; }
        if (!c) return;
        pendT = setTimeout(function () {
          pend = null;
          if (performance.now() - lastScroll < 250) return;
          cur = c; flip(c, true);
        }, 70);
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", function () { clearTimeout(pendT); pend = null; if (cur) flip(cur, false); cur = null; });
    } else {
      document.addEventListener("click", function (ev) { var c = flipTarget(ev.target); if (c) flip(c, !c.classList.contains("flip")); });
    }
  }

  // =====================================================================================
  // 5. PAUSE OFFSCREEN: anything registered here stops when its host leaves the screen
  //    or the tab is hidden, and starts again when it comes back.
  // =====================================================================================
  var watched = [];
  function watch(host, onChange) {
    var w = { host: host, onChange: onChange, inView: true, state: null };
    watched.push(w);
    var update = function () { var on = w.inView && !document.hidden; if (on !== w.state) { w.state = on; onChange(on); } };
    w.update = update;
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { w.inView = es[es.length - 1].isIntersecting; update(); }, { rootMargin: "100px" }).observe(host);
    update();
    return w;
  }
  document.addEventListener("visibilitychange", function () { watched.forEach(function (w) { w.update(); }); });

  // =====================================================================================
  // 6. RIVER: endless rows of coins. Each row is one track of <img> coins, laid out twice,
  //    moved by a single compositor animation (transform only). See README for options.
  // =====================================================================================
  var rivers = [];
  // depth presets: far rows are fainter and lean less. Fading is row opacity (free on the compositor),
  // so every row can share one sprite per design.
  var DEPTH = { far: { op: 0.42, lean: 0.25 }, mid: { op: 0.7, lean: 0.55 }, near: { op: 1, lean: 1 } };
  function river(host, o) {
    o = o || {};
    var api = { host: host, rows: [], playing: false, options: o };
    rivers.push(api);
    var k = o.scale || 1, specs = o.rows || [{ d: 140, dir: -1, speed: 30 }];
    var tilt = o.tilt || 0, rot = o.rotate || 0, P = o.perspective || 800;
    var po = o.perspectiveOrigin || [0.5, 0.2], org = o.origin || [0.5, 0.5];
    var rowGap = o.rowGap == null ? 24 : o.rowGap, bx = (o.bleed || [0, 0])[0], by = (o.bleed || [0, 0])[1];
    // the design pool: a handful of coins reused across rows (each drawn once per size)
    var pr = rng(o.seed || 11), pool = [];
    for (var i = 0; i < (o.pool || 16); i++) pool.push(spec(pr));
    api.pool = pool;

    // build (and rebuild on resize): everything that depends on the host's size
    function build() {
      var r = rng((o.seed || 11) * 7 + 3), W = host.clientWidth, H = host.clientHeight;
      api.W = W; api.H = H;
      if (api.stage) api.stage.remove();
      var rect = { x: -bx * W, y: -by * H, w: W * (1 + 2 * bx), h: H * (1 + 2 * by) };
      var stage = document.createElement("div"); stage.className = "cr-stage";
      if (tilt) { stage.style.perspective = P + "px"; stage.style.perspectiveOrigin = (po[0] * W) + "px " + (po[1] * H) + "px"; }
      var plane = document.createElement("div"); plane.className = "cr-plane";
      plane.style.cssText = "left:" + rect.x + "px;top:" + rect.y + "px;width:" + rect.w + "px;height:" + rect.h + "px;transform-origin:" + (org[0] * rect.w) + "px " + (org[1] * rect.h) + "px;" + ((rot || tilt) ? "transform:rotate(" + rot + "deg) rotateX(" + tilt + "deg)" : "");
      stage.appendChild(plane);

      var rows = [], total = 0, ri = 0, list = [];
      do {
        var sp = specs[ri % specs.length], d = Math.round(sp.d * k), gap = Math.round(d * (sp.gap == null ? 0.24 : sp.gap));
        list.push({ sp: sp, d: d, gap: gap }); total += d + (list.length > 1 ? rowGap : 0); ri++;
      } while (ri < specs.length || (o.fill && total < rect.h && ri < 16));
      var y = o.align === "bottom" ? rect.h - total : o.align === "top" ? 0 : (rect.h - total) / 2;
      var visW = Math.max(W, rect.w) + 2 * (o.lean ? o.lean[0] : 0);
      var maxD = list.reduce(function (m, L) { return Math.max(m, L.d); }, 0); // one sprite size for the whole river
      list.forEach(function (L, idx) {
        var sp = L.sp, d = L.d, step = d + L.gap, dep = DEPTH[sp.depth] || DEPTH.near;
        var n = Math.max(2, Math.ceil((visW + step) / step)), setW = n * step; // coins per set: just enough to cover the plane
        var row = document.createElement("div"); row.className = "cr-row " + (sp.depth || "");
        row.style.cssText = (o.lean && fine && !reduce ? "will-change:transform;" : "") + "top:" + y + "px;height:" + d + "px;--o:" + (sp.opacity != null ? sp.opacity : dep.op);
        var track = document.createElement("div"); track.className = "cr-track";
        track.style.width = 2 * setW + "px";
        var picks = [], last = -1;
        for (var j = 0; j < n; j++) { var p; do { p = Math.floor(r() * pool.length); } while (p === last && pool.length > 1); picks.push(p); last = p; }
        var so = { dim: sp.dim, blur: sp.blur, px: maxD, priority: o.priority == null ? 1 : o.priority };
        var coins = [];
        for (var c = 0; c < 2 * n; c++) { // the set, twice: translating by one set width loops seamlessly
          var ce = coin(pool[picks[c % n]], d, so), yo = Math.round(Math.sin((c % n) * 1.7 + idx) * d * 0.08);
          ce.style.left = (c * step) + "px"; ce.style.top = yo + "px";
          ce._u = c * step + d / 2; ce._v = yo + d / 2;
          track.appendChild(ce); coins.push(ce);
        }
        row.appendChild(track); plane.appendChild(row);
        var R = { so: so, el: row, track: track, coins: coins, d: d, step: step, n: n, setW: setW, dir: sp.dir || -1, top: y, ox: 0, oy: 0, lean: sp.lean != null ? sp.lean : dep.lean, target: 1, cur: 1, anim: null, phase: r() };
        R.dur = setW / ((sp.speed || 30) * k) * 1000;
        R.frames = R.dir < 0 ? [{ transform: "translateX(0)" }, { transform: "translateX(" + (-setW) + "px)" }] : [{ transform: "translateX(" + (-setW) + "px)" }, { transform: "translateX(0)" }];
        if (!reduce && track.animate) {
          R.anim = track.animate(R.frames, { duration: R.dur, iterations: Infinity });
          R.anim.currentTime = R.dur * R.phase;
          if (shot || !api.playing) R.anim.pause();
        } else { R.staticX = -Math.round(R.phase * setW); track.style.transform = "translateX(" + R.staticX + "px)"; }
        Promise.all(coins.slice(0, n).map(function (ce) { return sprite(ce._o.front, maxD, so); })).then(function () { row.classList.add("in"); });
        if (!reduce && !shot) {
          row.addEventListener("pointerenter", function () { R.target = hoverRate; kick(); });
          row.addEventListener("pointerleave", function () { R.target = 1; kick(); });
        }
        rows.push(R);
        y += d + rowGap;
      });
      host.appendChild(stage);

      // geometry: plane coordinates -> host pixels (the same transform the CSS applies; used by the loupe)
      var Mx = new DOMMatrix().translate(rect.x, rect.y).translate(org[0] * rect.w, org[1] * rect.h).rotateAxisAngle(0, 0, 1, rot).rotateAxisAngle(1, 0, 0, tilt).translate(-org[0] * rect.w, -org[1] * rect.h);
      if (tilt) { var pm = new DOMMatrix(); pm.m34 = -1 / P; Mx = new DOMMatrix().translate(po[0] * W, po[1] * H).multiply(pm).translate(-po[0] * W, -po[1] * H).multiply(Mx); }
      api.project = function (u, v) { var w = Mx.m14 * u + Mx.m24 * v + Mx.m44; return [(Mx.m11 * u + Mx.m21 * v + Mx.m41) / w, (Mx.m12 * u + Mx.m22 * v + Mx.m42) / w]; };
      api.stage = stage; api.plane = plane; api.rows = rows; api.rect = rect;
      if (api.onbuild) api.onbuild();
    }
    // where a row's track is right now (from its animation clock; no layout read)
    api.trackX = function (R) {
      if (!R.anim) return R.staticX || 0;
      var f = ((R.anim.currentTime % R.dur) + R.dur) % R.dur / R.dur;
      return R.dir < 0 ? -f * R.setW : -R.setW + f * R.setW;
    };
    api.play = function () { api.playing = true; api.rows.forEach(function (R) { if (R.anim && !shot) R.anim.play(); }); };
    api.pause = function () { api.playing = false; api.rows.forEach(function (R) { if (R.anim) R.anim.pause(); }); };

    // speed: rows ease to hoverRate under the pointer; scrolling adds a brief boost.
    // One rAF loop that runs only while a rate is changing; rates are quantized so the
    // compositor animations are not restarted every frame.
    var hoverRate = o.hoverRate == null ? 0.16 : o.hoverRate, boost = 0, running = false;
    function tick() {
      boost *= 0.9; if (boost < 0.02) boost = 0;
      var busy = boost > 0;
      api.rows.forEach(function (R) {
        var want = R.target * (1 + boost);
        R.cur += (want - R.cur) * 0.12;
        if (Math.abs(want - R.cur) < 0.01) R.cur = want; else busy = true;
        var q = Math.round(R.cur * 20) / 20 || 0.05;
        if (R.anim && api.playing && R.anim.playbackRate !== q) { if (R.anim.updatePlaybackRate) R.anim.updatePlaybackRate(q); else R.anim.playbackRate = q; }
      });
      running = busy;
      if (busy) requestAnimationFrame(tick);
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }
    api.slow = function (on) { api.rows.forEach(function (R) { R.target = on ? hoverRate : 1; }); kick(); };

    build();
    if (reduce || shot) {
      if (!shot) addEventListener("resize", debounce(function () { if (Math.abs(host.clientWidth - api.W) > 40 || Math.abs(host.clientHeight - api.H) > 80) build(); }, 250));
      return api;
    }
    // rebuild only when the host size really changes (not for a phone's address bar)
    addEventListener("resize", debounce(function () { if (Math.abs(host.clientWidth - api.W) > 40 || Math.abs(host.clientHeight - api.H) > 80) { build(); if (api.playing) api.play(); } }, 250));
    watch(host, function (on) { on ? api.play() : api.pause(); });

    if (o.scrollBoost) { // off by default: changing playback rates during a scroll costs main-thread frames
      var lastY = scrollY;
      addEventListener("scroll", function () { if (!api.playing) { lastY = scrollY; return; } boost = Math.min(4, boost + Math.abs(scrollY - lastY) / 40); lastY = scrollY; kick(); }, { passive: true });
    }

    // lean: rows drift with the pointer (by depth), transform only; the loop stops when settled
    if (o.lean && fine) {
      var tx = 0, ty = 0, cx = 0, cy = 0, leaning = false;
      var lean = function () {
        cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
        var settled = Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001;
        api.rows.forEach(function (R) { R.ox = -cx * o.lean[0] * R.lean; R.oy = -cy * o.lean[1] * R.lean; R.el.style.transform = "translate(" + R.ox.toFixed(1) + "px," + R.oy.toFixed(1) + "px)"; });
        leaning = !settled && api.playing;
        if (leaning) requestAnimationFrame(lean);
      };
      addEventListener("pointermove", function (e) {
        tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5;
        if (!leaning && api.playing) { leaning = true; requestAnimationFrame(lean); }
      }, { passive: true });
    }

    // glints: every so often one visible coin catches the light (one animated element at a time)
    if (o.glint !== false) setInterval(function () {
      if (!api.playing) return;
      var cand = api.rows.filter(function (R) { return R.lean > 0.3; }); if (!cand.length) cand = api.rows;
      var R = cand[Math.floor(Math.random() * cand.length)], x0 = -api.trackX(R) - api.rect.x - R.ox;
      var j0 = Math.max(0, Math.floor(x0 / R.step)), jn = Math.min(R.coins.length - 1, Math.floor((x0 + api.W) / R.step));
      shine(R.coins[j0 + Math.floor(Math.random() * Math.max(1, jn - j0))]);
    }, o.glintEvery || 1400);

    // backs: drawn ahead of time, when the browser is idle, for the rows people hover most
    idle(function () { pool.forEach(function (p) { api.rows.forEach(function (R) { if (R.lean > 0.3) sprite(p.back, R.so.px, { dim: R.so.dim, blur: R.so.blur, priority: 3 }); }); }); });
    return api;
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  // =====================================================================================
  // 7. GRID: a static, flippable grid of coins.
  // =====================================================================================
  function grid(host, o) {
    o = o || {};
    var r = rng(o.seed || 5), out = [];
    host.classList.add("cr-grid");
    if (o.gap != null) host.style.gap = o.gap + "px";
    for (var i = 0; i < (o.count || 12); i++) { var c = coin(spec(r, o.type, o.metal), o.size || 96); host.appendChild(c); out.push(c); }
    return out;
  }

  // =====================================================================================
  // 8. LOUPE: a magnifier over a river. It is one small canvas: each frame it redraws the
  //    few coins under it from cached sprites (no second copy of the DOM). It is moved by
  //    transform only, follows the pointer, and wanders by itself when the pointer rests.
  // =====================================================================================
  function loupe(host, rv, o) {
    o = o || {};
    if (reduce) return null;
    var R0 = o.radius || 120, Z = o.zoom || 2.3, bg = o.background || "#0c0b09";
    var wrap = document.createElement("div"); wrap.className = "cl-loupe"; wrap.setAttribute("aria-hidden", "true");
    wrap.style.setProperty("--lr", R0 + "px");
    wrap.innerHTML = '<canvas></canvas><span class="cl-glass"></span><span class="cl-ring"></span>' + (o.label ? '<span class="cl-tag"></span>' : "");
    if (o.label) wrap.querySelector(".cl-tag").textContent = o.label;
    host.appendChild(wrap);
    var cv = wrap.firstChild, cx = cv.getContext("2d"), CS = Math.round(2 * R0 * DPR);
    cv.width = cv.height = CS;
    var W = rv.W, H = rv.H, minY = (o.minY || 0) * H;
    rv.onbuild = function () { W = rv.W; H = rv.H; minY = (o.minY || 0) * H; };
    var x = W * (o.start ? o.start[0] : 0.6), y = H * (o.start ? o.start[1] : 0.75), tx = x, ty = y, last = -1e9;
    var zoomSprites = {};
    function zs(R, coinEl, back) {
      var f = back ? coinEl._o.back : coinEl._o.front, key = f.id;
      if (zoomSprites[key]) return zoomSprites[key];
      zoomSprites[key] = null;
      sprite(f, Math.min(512 / DPR, R.d * Z), { priority: 0 }).then(function (s) { zoomSprites[key] = s.canvas; });
      return null;
    }
    function draw() {
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.fillStyle = bg; cx.fillRect(0, 0, CS, CS);
      var reach = R0 / Z, now = performance.now();
      rv.rows.forEach(function (R) {
        var tX = rv.trackX(R), half = R.d / 2, vRow = R.top + R.oy + half;
        // cull: skip rows far from the loupe; along a row, screen x is linear in u, so solve for the coins under it
        var p0 = rv.project(0, vRow), p1 = rv.project(1000, vRow), sc = (p1[0] - p0[0]) / 1000;
        if (!sc) return;
        var yAt = p0[1] + (p1[1] - p0[1]) / 1000 * ((x - p0[0]) / sc);
        if (Math.abs(yAt - y) > reach + R.d * Math.abs(sc) * 1.2) return;
        var uA = (x - reach - p0[0]) / sc, uB = (x + reach - p0[0]) / sc, base = R.ox + tX + half;
        var j0 = Math.max(0, Math.floor((Math.min(uA, uB) - base) / R.step) - 1), j1 = Math.min(R.coins.length - 1, Math.ceil((Math.max(uA, uB) - base) / R.step) + 1);
        for (var j = j0; j <= j1; j++) {
          var ce = R.coins[j], u = R.ox + tX + ce._u, v = R.top + R.oy + ce._v;
          var c = rv.project(u, v);
          if (Math.abs(c[0] - x) > reach + R.d || Math.abs(c[1] - y) > reach + R.d) continue;
          var ex = rv.project(u + half, v), ey = rv.project(u, v + half);
          var ang = 0;
          if (ce._ft) { var p = Math.min(1, (now - ce._ft) / 750); p = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; ang = ce._fon ? p * Math.PI : (1 - p) * Math.PI; }
          var back = ang > Math.PI / 2, sx = Math.abs(Math.cos(ang)) || 0.001;
          var img = zs(R, ce, back) || (back ? ce._bs && ce._bs.canvas : ce._fs && ce._fs.canvas);
          if (!img) continue;
          var kk = Z * DPR / half;
          cx.setTransform((ex[0] - c[0]) * kk * sx, (ex[1] - c[1]) * kk * sx, (ey[0] - c[0]) * kk, (ey[1] - c[1]) * kk, (c[0] - x) * Z * DPR + CS / 2, (c[1] - y) * Z * DPR + CS / 2);
          var full = half * (1 + 2 * PAD);
          cx.drawImage(img, -full, -full, 2 * full, 2 * full);
        }
      });
    }
    var on = false;
    if (shot) { x = tx; y = ty; }
    function frame(t) {
      if (!on) return;
      if (!shot && t - last > 2500 && o.wander !== false) {
        var s = t / 1000;
        tx = W * (0.5 + 0.34 * Math.sin(s * 0.33)); ty = minY + (H - minY) * (0.45 + 0.3 * Math.sin(s * 0.51 + 1));
      }
      x += (tx - x) * 0.09; y += (ty - y) * 0.09;
      wrap.style.transform = "translate3d(" + (x - R0).toFixed(1) + "px," + (y - R0).toFixed(1) + "px,0)";
      draw();
      if (!shot) requestAnimationFrame(frame);
    }
    // the host's page position is measured once (and on resize), so pointer moves never read layout
    var hx = 0, hy = 0, place = function () { var b = host.getBoundingClientRect(); hx = b.left + scrollX; hy = b.top + scrollY; };
    place(); addEventListener("resize", debounce(place, 200)); addEventListener("load", place);
    if (fine) host.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      tx = e.pageX - hx; ty = Math.max(minY, e.pageY - hy); last = performance.now();
    }, { passive: true });
    watch(host, function (v) { var was = on; on = v; if (on && !was) requestAnimationFrame(frame); });
    // screenshots: centre the loupe on the coin nearest its start, a little up and left, so it shows detail
    function snap() {
      var best = null, bd = 1e9;
      rv.rows.forEach(function (R) { var tX = rv.trackX(R); R.coins.forEach(function (ce) { var c = rv.project(R.ox + tX + ce._u, R.top + R.oy + ce._v), dd = Math.hypot(c[0] - x, c[1] - y); if (dd < bd && c[1] > minY + R0) { bd = dd; best = [c, R]; } }); });
      if (best) { x = tx = best[0][0] - best[1].d * 0.12; y = ty = best[0][1]; }
    }
    if (shot) { snap(); on = true; Promise.all(rv.rows.map(function (R) { return sprite(R.coins[0]._o.front, R.d, {}); })).then(function () { setTimeout(function () { frame(0); }, 50); setTimeout(function () { frame(0); }, 400); }); }
    return { el: wrap, moveTo: function (px, py) { tx = px; ty = py; last = performance.now(); } };
  }

  // =====================================================================================
  // 9. PLACEHOLDERS: <span data-coin="type:metal:seed" data-d="64"> becomes a coin.
  //    Optional attributes: data-glint (a shine now and then), data-noflip.
  // =====================================================================================
  function fillPlaceholders(root) {
    [].slice.call((root || document).querySelectorAll("[data-coin]")).forEach(function (ph) {
      var a = ph.getAttribute("data-coin").split(":"), c = coin(spec(parseInt(a[2] || "5", 10), a[0] || null, a[1] || null), parseInt(ph.getAttribute("data-d") || "80", 10));
      if (ph.className) c.className += " " + ph.className;
      if (ph.hasAttribute("data-noflip")) c.setAttribute("data-noflip", "");
      if (ph.hasAttribute("data-glint") && !reduce && !shot) { var tm = setInterval(function () { if (document.hidden) return; shine(c); }, 6000 + Math.random() * 3000); c._glint = tm; }
      if (ph.id) c.id = ph.id;
      ph.parentNode.replaceChild(c, ph);
    });
  }
  fillPlaceholders();

  window.CoinEngine = { version: 2, flags: { shot: shot, reduce: reduce, fine: fine }, rng: rng, spec: spec, svg: svg, sprite: sprite, coin: coin, flip: flip, shine: shine, ensureBack: ensureBack, river: river, rivers: rivers, grid: grid, loupe: loupe, watch: watch, fillPlaceholders: fillPlaceholders, PAD: PAD };
  window.Coins = window.CoinEngine; // old name, kept for the existing pages
})();
