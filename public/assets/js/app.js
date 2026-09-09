/* ============================================================
   面積が正しい世界地図 — アプリケーションスクリプト
   ------------------------------------------------------------
   1. 地図（Equal Earth 図法・経度方向のみドラッグ可能）
   ============================================================ */
(function () {
  "use strict";

  /* --------------------------------------------------------
     1. 地図
     -------------------------------------------------------- */
  var MAP = {
    dataUrl: "./data/countries-110m.json",
    pad: 2, // 外周の線が切れないための余白(px)
    color: {
      ocean: "#ffffff",
      land: "#e0ceaa",
      border: "#ffffff",
      graticule: "rgba(60, 60, 67, 0.10)",
      meridian: "rgba(60, 60, 67, 0.32)",
      outline: "#d8d8d9"
    }
  };

  var canvas = document.getElementById("map");
  var readout = document.getElementById("lonReadout");
  var latReadout = document.getElementById("latReadout");
  var resetBtn = document.getElementById("resetBtn");
  var lockLat = document.getElementById("lockLat");
  var hint = document.getElementById("mapHint");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var graticule = d3.geoGraticule10();
  var land = null;
  var borders = null;

  var rotation = 0; // projection.rotate()[0]。中央経線は -rotation
  var pitch = 0; // projection.rotate()[1]。中央緯線は -pitch
  var latLocked = lockLat ? lockLat.checked : true;
  var projection = null;
  var cssWidth = 0;
  var cssHeight = 0;
  var frame = null;

  /** 経度を -180〜180 に正規化する */
  function normalizeLon(lon) {
    var v = ((lon + 180) % 360 + 360) % 360 - 180;
    // -180 は 180 と同じ位置なので 180 に寄せる
    return v === -180 ? 180 : v;
  }

  /** 緯度方向の回転は ±90 度に収める（それを超えると南北が反転する） */
  function clampLat(lat) {
    return Math.max(-90, Math.min(90, lat));
  }

  /** 中央経線（地理座標系での経度） */
  function centralMeridian() {
    return normalizeLon(-rotation);
  }

  /** 中央緯線（地理座標系での緯度） */
  function centralParallel() {
    return -pitch;
  }

  /** 幅に合わせて投影と canvas の寸法を決める */
  function layout() {
    var box = canvas.parentNode;
    var w = Math.max(280, Math.floor(box.getBoundingClientRect().width));

    var p = d3.geoEqualEarth().precision(0.35);
    p.fitWidth(w - MAP.pad * 2, { type: "Sphere" });

    var bounds = d3.geoPath(p).bounds({ type: "Sphere" });
    var h = Math.ceil(bounds[1][1] - bounds[0][1]) + MAP.pad * 2;

    var t = p.translate();
    p.translate([t[0] + MAP.pad, t[1] - bounds[0][1] + MAP.pad]);

    projection = p;
    cssWidth = w;
    cssHeight = h;

    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    frame = null;
    if (!projection) return;

    // 傾き（3 番目の値）は常に 0。緯度方向は「緯度方向を固定」が外れている間だけ動く
    projection.rotate([rotation, pitch, 0]);
    var path = d3.geoPath(projection, ctx);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // 海（球の内側）
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = MAP.color.ocean;
    ctx.fill();

    // 経緯線網
    ctx.beginPath();
    path(graticule);
    ctx.lineWidth = 1;
    ctx.strokeStyle = MAP.color.graticule;
    ctx.stroke();

    // 陸地
    if (land) {
      ctx.beginPath();
      path(land);
      ctx.fillStyle = MAP.color.land;
      ctx.fill();
    }

    // 国境
    if (borders) {
      ctx.beginPath();
      path(borders);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = MAP.color.border;
      ctx.stroke();
    }

    // 中央経線の目印
    var cm = centralMeridian();
    ctx.beginPath();
    path({
      type: "LineString",
      coordinates: [[cm, -89.9], [cm, -45], [cm, 0], [cm, 45], [cm, 89.9]]
    });
    ctx.lineWidth = 1;
    ctx.strokeStyle = MAP.color.meridian;
    ctx.stroke();

    // 中央緯線の目印（緯度方向を動かせるときだけ描く）
    var cp = centralParallel();
    if (!latLocked && Math.abs(cp) < 89.5) {
      var parallel = [];
      for (var lon = -180; lon <= 180; lon += 2) parallel.push([lon, cp]);
      ctx.beginPath();
      path({ type: "LineString", coordinates: parallel });
      ctx.lineWidth = 1;
      ctx.strokeStyle = MAP.color.meridian;
      ctx.stroke();
    }

    // 外周
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.lineWidth = 1;
    ctx.strokeStyle = MAP.color.outline;
    ctx.stroke();
  }

  function requestDraw() {
    if (frame === null) frame = window.requestAnimationFrame(draw);
  }

  /** 経度・緯度は常に小数第 1 位まで表示する */
  function formatDegree(value, positive, negative) {
    var v = Math.round(value * 10) / 10;
    var abs = Math.abs(v).toFixed(1);
    if (abs === "0.0") return "0.0°";
    return (v > 0 ? positive : negative) + " " + abs + "°";
  }

  function updateReadout() {
    if (!readout) return;
    var lonLabel = formatDegree(centralMeridian(), "東経", "西経");
    var latLabel = formatDegree(centralParallel(), "北緯", "南緯");

    readout.textContent = lonLabel;
    if (latReadout) latReadout.textContent = latLabel;

    canvas.setAttribute(
      "aria-label",
      "Equal Earth 図法で描かれた世界地図。中央の経線は " + lonLabel +
        "、中央の緯線は " + latLabel + "。" +
        (latLocked
          ? "左右にドラッグ、または左右の矢印キーで動かせます。"
          : "ドラッグ、または矢印キーで上下左右に動かせます。")
    );
  }

  function updateHint() {
    if (!hint) return;
    hint.textContent = latLocked
      ? "左右にドラッグ／矢印キーで移動（動くのは経度方向だけです）"
      : "ドラッグ／矢印キーで移動（上下にも動きます）";
  }

  function setView(nextRotation, nextPitch) {
    rotation = normalizeLon(nextRotation);
    pitch = latLocked ? 0 : clampLat(nextPitch);
    updateReadout();
    requestDraw();
  }

  /* ---- ドラッグ（経度方向のみ） ---- */
  var dragging = false;
  var startX = 0;
  var startY = 0;
  var startRotation = 0;
  var startPitch = 0;
  var moved = false;

  canvas.addEventListener("pointerdown", function (e) {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startRotation = rotation;
    startPitch = pitch;
    canvas.classList.add("is-dragging");
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    // 画面上の移動量を、地図幅 = 360 度・地図高さ = 180 度として角度に換算する
    setView(
      startRotation + (dx / cssWidth) * 360,
      startPitch - (dy / cssHeight) * 180
    );
    if (moved && e.cancelable) e.preventDefault();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove("is-dragging");
    if (canvas.releasePointerCapture && e && e.pointerId !== undefined) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", endDrag);

  /* ---- キーボード ---- */
  canvas.addEventListener("keydown", function (e) {
    var step = e.shiftKey ? 30 : 5;
    if (e.key === "ArrowRight") {
      // 視点を東へ動かす = 中央経線を増やす = rotation を減らす
      setView(rotation - step, pitch);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      setView(rotation + step, pitch);
      e.preventDefault();
    } else if (!latLocked && e.key === "ArrowUp") {
      // 視点を北へ動かす = 中央緯線を増やす = pitch を減らす
      setView(rotation, pitch - step);
      e.preventDefault();
    } else if (!latLocked && e.key === "ArrowDown") {
      setView(rotation, pitch + step);
      e.preventDefault();
    } else if (e.key === "Home") {
      setView(0, 0);
      e.preventDefault();
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      setView(0, 0);
    });
  }

  /* ---- 緯度方向の固定 ---- */
  if (lockLat) {
    lockLat.addEventListener("change", function () {
      latLocked = lockLat.checked;
      canvas.classList.toggle("map__canvas--free", !latLocked);
      updateHint();
      // 固定に戻したときは中央の緯線を 0 度へ戻す
      setView(rotation, latLocked ? 0 : pitch);
    });
  }

  /* ---- リサイズ ---- */
  function relayout() {
    layout();
    requestDraw();
  }

  if (window.ResizeObserver) {
    new ResizeObserver(relayout).observe(canvas.parentNode);
  } else {
    window.addEventListener("resize", relayout);
  }

  /* ---- データ読み込み ---- */
  layout();
  canvas.classList.toggle("map__canvas--free", !latLocked);
  updateHint();
  updateReadout();
  requestDraw();

  fetch(MAP.dataUrl)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (topo) {
      var countries = topo.objects.countries;
      land = topojson.merge(topo, countries.geometries);
      borders = topojson.mesh(topo, countries, function (a, b) {
        return a !== b;
      });
      requestDraw();
    })
    .catch(function (err) {
      console.error("地図データの読み込みに失敗しました:", err);
      var msg = document.createElement("p");
      msg.className = "map__noscript";
      msg.textContent =
        "地図データを読み込めませんでした。ページを再読み込みしてください。";
      canvas.parentNode.insertBefore(msg, canvas.nextSibling);
    });
})();

/* ============================================================
   2. 出典（注釈番号の自動採番と一覧の描画）
   ------------------------------------------------------------
   本文中の <a class="fn" data-src="ID"> に、sources.json の
   配列順にもとづく番号 [n] を入れ、末尾の一覧へのリンクにする。
   出典を足すときは sources.json に 1 件追加するだけでよい。
   ============================================================ */
(function () {
  "use strict";

  var App = window.App || (window.App = {});
  var listEl = document.getElementById("sourcesList");
  var index = Object.create(null); // id -> { number, source }

  /** 指定範囲の未処理の注釈に番号を入れる */
  function numberFootnotes(root) {
    var nodes = (root || document).querySelectorAll("a.fn[data-src]");
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.dataset.numbered === "1") return;
      var entry = index[el.getAttribute("data-src")];
      if (!entry) {
        console.warn("未知の出典 id:", el.getAttribute("data-src"));
        return;
      }
      el.textContent = "[" + entry.number + "]";
      el.setAttribute("href", "#src-" + entry.source.id);
      el.setAttribute("title", entry.source.title);
      el.setAttribute("aria-label", "出典 " + entry.number + "：" + entry.source.title);
      el.dataset.numbered = "1";
    });
  }

  function renderSources(sources) {
    if (!listEl) return;
    var frag = document.createDocumentFragment();

    sources.forEach(function (src, i) {
      var li = document.createElement("li");
      li.className = "sources__item";
      li.id = "src-" + src.id;

      var num = document.createElement("span");
      num.className = "sources__num";
      num.textContent = "[" + (i + 1) + "]";
      li.appendChild(num);

      var body = document.createElement("div");

      var a = document.createElement("a");
      a.className = "sources__title";
      a.href = src.url;
      a.textContent = src.title;
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      body.appendChild(a);

      var meta = document.createElement("div");
      meta.className = "sources__meta";
      meta.textContent =
        src.publisher + "　" + src.url + (src.accessed ? "　（" + src.accessed + " 閲覧）" : "");
      body.appendChild(meta);

      if (src.note) {
        var note = document.createElement("div");
        note.className = "sources__note";
        note.textContent = src.note;
        body.appendChild(note);
      }

      li.appendChild(body);
      frag.appendChild(li);
    });

    listEl.textContent = "";
    listEl.appendChild(frag);
  }

  var ready = fetch("./data/sources.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      var sources = data.sources || [];
      sources.forEach(function (src, i) {
        index[src.id] = { number: i + 1, source: src };
      });
      renderSources(sources);
      numberFootnotes(document);
      return index;
    })
    .catch(function (err) {
      console.error("出典データの読み込みに失敗しました:", err);
    });

  App.refs = {
    ready: ready,
    number: numberFootnotes
  };
})();

/* ============================================================
   3. 年表
   ------------------------------------------------------------
   timeline.json の entries を sort（ISO 8601 の日付文字列）の
   昇順に並べて描画する。年表に項目を足すときは entries に
   1 件追加するだけでよく、配列内の位置は問わない。
   ============================================================ */
(function () {
  "use strict";

  var App = window.App || (window.App = {});
  var listEl = document.getElementById("timelineList");
  if (!listEl) return;

  var RECENT_YEARS = 2; // 直近何年ぶんを強調するか

  function isRecent(sort) {
    var year = parseInt(String(sort).slice(0, 4), 10);
    if (isNaN(year)) return false;
    return year >= new Date().getFullYear() - RECENT_YEARS;
  }

  function renderEntry(entry) {
    var li = document.createElement("li");
    li.className = "timeline__item" + (isRecent(entry.sort) ? " timeline__item--recent" : "");
    if (entry.id) li.id = "tl-" + entry.id;

    var date = document.createElement("p");
    date.className = "timeline__date";
    date.textContent = entry.date;
    li.appendChild(date);

    var title = document.createElement("h3");
    title.className = "timeline__title";
    title.textContent = entry.title;
    li.appendChild(title);

    var body = document.createElement("p");
    body.className = "timeline__body";
    body.textContent = entry.body;

    // 出典の注釈番号は App.refs が sources.json をもとに埋める
    (entry.sources || []).forEach(function (id) {
      var fn = document.createElement("a");
      fn.className = "fn";
      fn.setAttribute("data-src", id);
      body.appendChild(fn);
    });

    // figure がある項（＝図法の項）は、外形の図を詳細文の左側に置く
    var detail = document.createElement("div");
    detail.className = "timeline__detail" + (entry.figure ? " timeline__detail--figured" : "");

    if (entry.figure) {
      var img = document.createElement("img");
      img.className = "timeline__figure";
      img.src = entry.figure.src;
      img.alt = entry.figure.alt || "";
      img.width = 200;
      img.height = 120;
      img.loading = "lazy";
      img.decoding = "async";
      detail.appendChild(img);
    }

    detail.appendChild(body);
    li.appendChild(detail);
    return li;
  }

  function render(entries) {
    var sorted = entries.slice().sort(function (a, b) {
      // 同じ sort の項目は JSON に書かれた順を保つ（Array#sort は安定）
      return String(a.sort) < String(b.sort) ? -1 : String(a.sort) > String(b.sort) ? 1 : 0;
    });

    var frag = document.createDocumentFragment();
    sorted.forEach(function (entry) {
      frag.appendChild(renderEntry(entry));
    });

    listEl.textContent = "";
    listEl.appendChild(frag);
  }

  fetch("./data/timeline.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      render(data.entries || []);
      // 注釈の採番は出典データの読み込み完了後に行う
      var refs = App.refs;
      if (refs && refs.ready) {
        refs.ready.then(function () {
          refs.number(listEl);
        });
      }
    })
    .catch(function (err) {
      console.error("年表データの読み込みに失敗しました:", err);
      listEl.innerHTML =
        '<li class="timeline__item"><p class="timeline__body">年表を読み込めませんでした。ページを再読み込みしてください。</p></li>';
    });
})();
