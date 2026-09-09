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
  var resetBtn = document.getElementById("resetBtn");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var graticule = d3.geoGraticule10();
  var land = null;
  var borders = null;

  var rotation = 0; // projection.rotate()[0]。中央経線は -rotation
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

  /** 中央経線（地理座標系での経度） */
  function centralMeridian() {
    return normalizeLon(-rotation);
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

    // 経度方向のみ回転させる。緯度・傾きは常に 0 に固定する
    projection.rotate([rotation, 0, 0]);
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

  function updateReadout() {
    if (!readout) return;
    var cm = centralMeridian();
    var v = Math.round(cm * 10) / 10;
    var label;
    if (v === 0) label = "0°";
    else if (v > 0) label = "東経 " + v + "°";
    else label = "西経 " + Math.abs(v) + "°";
    readout.textContent = label;
    canvas.setAttribute(
      "aria-valuetext",
      "中央の経線は " + label + " です"
    );
  }

  function setRotation(value) {
    rotation = normalizeLon(value);
    updateReadout();
    requestDraw();
  }

  /* ---- ドラッグ（経度方向のみ） ---- */
  var dragging = false;
  var startX = 0;
  var startRotation = 0;
  var moved = false;

  canvas.addEventListener("pointerdown", function (e) {
    dragging = true;
    moved = false;
    startX = e.clientX;
    startRotation = rotation;
    canvas.classList.add("is-dragging");
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > 2) moved = true;
    // 画面上の横移動量を、地図幅 = 360 度として経度に換算する
    setRotation(startRotation + (dx / cssWidth) * 360);
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
      setRotation(rotation - step);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      setRotation(rotation + step);
      e.preventDefault();
    } else if (e.key === "Home") {
      setRotation(0);
      e.preventDefault();
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      setRotation(0);
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
