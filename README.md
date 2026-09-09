# 面積が正しい世界地図 — 正積図法（Equal-Area Projection）のはなし

正積図法とは何か、どのように生まれたか、そして 2026 年 9 月に話題になった理由をまとめた
静的シングルページサイトです。ファーストビューには Equal Earth 図法の世界地図を置き、
左右にドラッグして経度方向に動かせます。「緯度方向を固定」のチェックを外すと、
上下にも動かせます（斜軸の見え方になります）。

仕様の詳細は [SPEC.md](./SPEC.md) を参照してください。

---

## 開発

```bash
npm run preview      # http://localhost:4173/ で public/ を配信（依存関係なし）
npm run build:thumbs # 年表に添える図法の外形図（SVG）を再生成する
```

## デプロイ（GitHub Pages）

ビルド工程はありません。`main` に push すると
[`.github/workflows/pages.yml`](./.github/workflows/pages.yml) が `public/` を
そのまま GitHub Pages の成果物としてアップロードし、公開します。

- 公開 URL: <https://gh.mezum.jp/eq-earth>
- 手動で流すときは Actions タブの **Deploy to GitHub Pages** から
  **Run workflow**（`workflow_dispatch`）
- リポジトリ設定の **Settings → Pages → Source** は **GitHub Actions**

`gh.mezum.jp` はこのリポジトリ専用のカスタムドメインです。ドメイン直下ではなく
`/eq-earth` で配信するため、ワークフローが `public/` を `_site/eq-earth/` に置いてから
アップロードし、あわせて `_site/CNAME` を書き出します。

ページ内の参照はすべて相対パスなので、配信されるパスが変わってもそのまま動きます。
GitHub Pages ではキャッシュヘッダを指定できないため、配信の設定ファイルはありません。

DNS は `gh.mezum.jp` の CNAME を `mezum.github.io.` に向けます。

---

## 内容を継ぎ足す

### 年表に項目を追加する

`public/data/timeline.json` の `entries` に 1 件追加するだけです。
`sort`（ISO 8601 の日付文字列）の昇順に自動で並ぶため、配列内のどこに書いても構いません。

```json
{
  "id": "2027-example",
  "date": "2027年1月10日",
  "sort": "2027-01-10",
  "title": "見出しを 1 行で",
  "body": "起きたことだけを淡々と書く。",
  "sources": ["un-news-2026"],
  "figure": {
    "src": "./assets/img/proj-mercator.svg",
    "alt": "図の説明"
  }
}
```

| フィールド | 必須 | 内容 |
|-----------|------|------|
| `id` | ✓ | 一意な識別子（`#tl-<id>` のアンカーになる） |
| `date` | ✓ | 画面に出す日付の表記（自由文字列） |
| `sort` | ✓ | 並べ替え用の日付。日が不明なら `01` で埋める |
| `title` | ✓ | 見出し |
| `body` | ✓ | 本文 |
| `sources` | | `sources.json` の `id` の配列。注釈番号が自動で付く |
| `figure` | | `{ src, alt }`。書くと詳細文の左側に画像が並ぶ |

**図を付ける／付けない**

`figure` は図法の外形を示す項にだけ付けます。政治的な経緯を書いた項には付けません。
外形図は `npm run build:thumbs` が、同梱の d3-geo と Natural Earth のデータから
`public/assets/img/` に SVG を生成します。図法を増やすときは
`scripts/build-thumbs.mjs` の `PROJECTIONS` に 1 件足して再生成してください。

**記述方針**（公平性を保つため）

- 起きた事実、日付、主体、数値のみを書く
- 「画期的」「ようやく」などの評価語を使わない
- 賛否が分かれる事柄は、双方の事実を同じ粒度で書く
- 決議や声明は「何を求めたか」と「何を求めていないか」を併記する

### 出典を追加する

`public/data/sources.json` の `sources` に 1 件追加します。
注釈番号は配列順に 1 から自動採番されます。

```json
{
  "id": "example-2027",
  "title": "記事のタイトル",
  "publisher": "発行元",
  "url": "https://example.com/article",
  "accessed": "2027-01-10",
  "note": "補足（任意）"
}
```

本文で使うときは、該当箇所に次のタグを置きます。番号はスクリプトが埋めます。

```html
<a class="fn" data-src="example-2027"></a>
```

---

## 構成

```
public/
├── index.html                  本文（注釈は data-src で出典を参照する）
├── assets/css/style.css        デザイントークンとスタイル
├── assets/js/app.js            1. 地図 / 2. 出典の採番 / 3. 年表
├── assets/img/                 年表の外形図（build:thumbs が生成）
├── assets/vendor/              d3-geo, d3-array, topojson-client（同梱）
└── data/
    ├── countries-110m.json     Natural Earth 1:110m（TopoJSON）
    ├── timeline.json           年表データ
    └── sources.json            出典データ
scripts/serve.mjs               依存関係なしのプレビューサーバ
scripts/build-thumbs.mjs        年表の外形図（SVG）の生成
.github/workflows/pages.yml     GitHub Pages へのデプロイ
SPEC.md                         仕様書
```

外部 CDN へのリクエストとトラッキングは行いません。

---

## データとライセンス

| 名称 | 用途 | ライセンス |
|------|------|-----------|
| [Natural Earth](https://www.naturalearthdata.com/) 1:110m Cultural Vectors | 国境・海岸線 | パブリックドメイン |
| [world-atlas](https://github.com/topojson/world-atlas) `countries-110m.json` | 上記の TopoJSON 版 | ISC |
| [d3-geo](https://github.com/d3/d3-geo) 3.1.1 / [d3-array](https://github.com/d3/d3-array) 3.2.4 | Equal Earth 図法の投影と描画 | ISC |
| [topojson-client](https://github.com/topojson/topojson-client) 3.1.0 | TopoJSON → GeoJSON 変換 | ISC |

デザインは
[無印良品ネットストア デザインシステム概要](https://kzhrknt.github.io/awesome-design-md-jp/design-md/muji/DESIGN.md)
を参照しています。

本文で参照した資料はすべてページ末尾の「出典」に列挙しています。
