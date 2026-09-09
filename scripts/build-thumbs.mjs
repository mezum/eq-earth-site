#!/usr/bin/env node
/**
 * 年表に添える図法の外形サムネイル（SVG）を生成する。
 *
 *   node scripts/build-thumbs.mjs
 *
 * 同梱の d3-geo と Natural Earth のデータからその場で描くので、
 * 外部の画像を持ち込まずに済み、本文の地図と同じ配色・同じ投影計算になる。
 * 生成物は public/assets/img/ に出力する（再生成可能）。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const vendor = (name) => resolve(root, "public/assets/vendor", name);

/** 同梱の UMD ビルドを、依存を差し替えながら読み込む */
function loadUMD(file, deps = {}) {
  const module = { exports: {} };
  const require = (name) => {
    if (name in deps) return deps[name];
    throw new Error(`未解決の依存: ${name}`);
  };
  new Function("exports", "require", "module", readFileSync(file, "utf8"))(
    module.exports,
    require,
    module
  );
  return module.exports;
}

const d3Array = loadUMD(vendor("d3-array.min.js"));
const d3 = loadUMD(vendor("d3-geo.min.js"), { "d3-array": d3Array });
const topojson = loadUMD(vendor("topojson-client.min.js"));

const topo = JSON.parse(
  readFileSync(resolve(root, "public/data/countries-110m.json"), "utf8")
);
const land = topojson.merge(topo, topo.objects.countries.geometries);
const graticule = d3.geoGraticule().step([30, 30])();

/**
 * geoPath が出力する "M x,y L x,y ... Z" を、表示に必要な精度まで間引く。
 * サムネイル専用の処理で、幅 200px では見た目が変わらない範囲に留める。
 */
function simplifyPath(d, tol = 0.6) {
  if (!d) return "";
  return d
    .split("M")
    .filter(Boolean)
    .map((sub) => {
      const closed = sub.trimEnd().endsWith("Z");
      const points = sub
        .replace(/Z\s*$/, "")
        .split("L")
        .map((pair) => pair.split(",").map(Number));

      const kept = [points[0]];
      for (let i = 1; i < points.length; i++) {
        const [x, y] = points[i];
        const [px, py] = kept[kept.length - 1];
        if (Math.hypot(x - px, y - py) >= tol) kept.push(points[i]);
      }
      // 面として見えない小片は落とす
      const xs = kept.map((pt) => pt[0]);
      const ys = kept.map((pt) => pt[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      if (closed && kept.length < 3) return "";
      if (closed && w < tol && h < tol) return "";

      return "M" + kept.map((pt) => pt.join(",")).join("L") + (closed ? "Z" : "");
    })
    .join("");
}

const W = 200;
const H = 120;
const PAD = 2;

const COLOR = {
  ocean: "#ffffff",
  land: "#e0ceaa",
  graticule: "rgba(60, 60, 67, 0.14)",
  outline: "#d8d8d9"
};

const PROJECTIONS = [
  {
    file: "proj-mercator.svg",
    title: "メルカトル図法の外形",
    make: () => d3.geoMercator()
  },
  {
    file: "proj-gall-peters.svg",
    title: "ゴール＝ペータース図法の外形",
    // 標準緯線 ±45 度の正積円筒図法。d3-geo の円錐正積図法は
    // 2 本の標準緯線が打ち消し合うとき円筒正積図法に退化する。
    make: () => d3.geoConicEqualArea().parallels([45, -45]).center([0, 0]).rotate([0, 0])
  },
  {
    file: "proj-equal-earth.svg",
    title: "Equal Earth 図法の外形",
    make: () => d3.geoEqualEarth()
  }
];

mkdirSync(resolve(root, "public/assets/img"), { recursive: true });

for (const spec of PROJECTIONS) {
  const projection = spec.make().precision(0.4);
  projection.fitExtent(
    [[PAD, PAD], [W - PAD, H - PAD]],
    { type: "Sphere" }
  );

  // 200px 幅のサムネイルなので、座標は小数第 1 位まであれば十分
  const path = d3.geoPath(projection).digits(1);
  const sphere = path({ type: "Sphere" });
  const grid = path(graticule);
  const shape = simplifyPath(path(land));

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${spec.title}">`,
    `<title>${spec.title}</title>`,
    `<path d="${sphere}" fill="${COLOR.ocean}"/>`,
    `<path d="${grid}" fill="none" stroke="${COLOR.graticule}" stroke-width="0.5"/>`,
    `<path d="${shape}" fill="${COLOR.land}"/>`,
    `<path d="${sphere}" fill="none" stroke="${COLOR.outline}" stroke-width="1"/>`,
    `</svg>`,
    ``
  ].join("\n");

  const out = resolve(root, "public/assets/img", spec.file);
  writeFileSync(out, svg, "utf8");
  const b = path.bounds({ type: "Sphere" });
  console.log(
    `${spec.file}  ${svg.length} bytes  外形 ${(b[1][0] - b[0][0]).toFixed(1)} x ${(b[1][1] - b[0][1]).toFixed(1)}`
  );
}
