# やりたいことやろう（仮）

健康寿命をきっかけに、やりたいことを次の一歩につなげる、スマートフォン優先のアプリ。

## 仕様

[docs/product.md](docs/product.md) を仕様・決定事項の正本とします。変更が決まったら本文と決定履歴を更新します。

開発時のIssue・ブランチ・PRの運用は [docs/development.md](docs/development.md) にまとめています。

## 開発の最初の範囲

1. Vite + React + TypeScript + Tailwindで開発環境を用意する。
2. 初回の年齢入力、時間の目安、やりたいことの追加・編集、次の一歩、達成までを端末内保存で試作する。
3. 時期は「今月／今年／未定」、初期値は未定。リストは1つ・非公開。
4. スマートフォンで操作を検証してから、Cloudflare Workers + D1とGoogle連携を実装する。

複数リスト・匿名公開・公開URL・やりたくないことリストは初期版に含めません。

## ローカルで試す

```sh
npm install
npm run dev
```

テストは `npm test`、本番ビルドは `npm run build` で実行できます。

## デプロイ

Cloudflare Workers Static Assetsを使い、`workers.dev`へ手動で公開します。

初回のみ、Cloudflareアカウントへログインします。

```sh
npx wrangler login
```

設定とビルド結果を、公開せずに確認できます。

```sh
npm run deploy:dry-run
```

初回公開と以後の更新は、同じコマンドで行います。

```sh
npm run deploy
```

公開URL: 初回デプロイ後に、Wranglerが表示した `https://yaritaikoto-yaro.<サブドメイン>.workers.dev` をここへ記入します。

現在、入力した年齢ややりたいことはサーバーへ送信せず、利用中のブラウザ内にだけ保存されます。別のブラウザや端末には引き継がれず、ブラウザの保存データを消すと失われます。

## 現在の状態

端末内保存の試作を実装済みです。初回の年齢入力、時間の目安、やりたいことの追加、カード内編集、次の一歩、時期、達成と取り消しを試せます。
