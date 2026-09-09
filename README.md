# 面積が正しい世界地図 — 正積図法（Equal-Area Projection）のはなし

正積図法とは何か、どのように生まれたか、そして 2026 年 9 月に話題になった理由をまとめた
静的シングルページサイトです。ファーストビューには Equal Earth 図法の世界地図を置き、
左右にドラッグして経度方向にだけ動かせます。

仕様の詳細は [SPEC.md](./SPEC.md) を参照してください。

---

## 開発

```bash
npm run preview     # http://localhost:4173/ で public/ を配信（依存関係なし）
```

Vercel CLI を使う場合（初回のみ `npm i -g vercel` と `vercel login` が必要）:

```bash
npm run dev         # vercel dev
```

## デプロイ（Vercel）

ビルド工程はありません。`public/` をそのまま配信します。

### CLI から

```bash
npm i -g vercel
vercel login
vercel link          # プロジェクトを作成／既存プロジェクトに紐付け
npm run deploy       # プレビュー環境へ
npm run deploy:prod  # 本番環境へ
```

### GitHub 連携から

1. このリポジトリを GitHub に push する
2. Vercel のダッシュボードで **Add New → Project** からリポジトリを import する
3. 設定はすべて `vercel.json` に書いてあるため、そのまま **Deploy** を押す
   - Framework Preset: `Other`
   - Build Command: なし
   - Output Directory: `public`

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
  "sources": ["un-news-2026"]
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
├── assets/vendor/              d3-geo, d3-array, topojson-client（同梱）
└── data/
    ├── countries-110m.json     Natural Earth 1:110m（TopoJSON）
    ├── timeline.json           年表データ
    └── sources.json            出典データ
scripts/serve.mjs               依存関係なしのプレビューサーバ
vercel.json                     Vercel の設定（静的配信）
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
