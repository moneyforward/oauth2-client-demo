# oauth-client-demo

**For the English README, please refer to [こちら](./README-en.md).**

このプロジェクトは、Node.jsを使用してMoneyForwardの認可サーバーとやり取りするOAuth2クライアントの実装方法を示しています。OAuth2を用いた認可、トークンの取得、トークンのリフレッシュ、保護されたリソースへのアクセスまでの一連のフローを紹介します。

## 前提条件

- **Node.js**: この例はNode.js v22.9.0を基にしていますので、お使いのシステムにNode.jsがインストールされていることを確認してください。[Node.js](https://nodejs.org/)からダウンロードできます。
- **OAuth2 クライアントライブラリ**: OAuth2フローを簡素化するために、`@badgateway/oauth2-client`ライブラリを使用します。

## 設定

アプリケーションを実行する前に、OAuth2のクレデンシャルを設定する必要があります。`src/index.ts`のプレースホルダーを実際の値に置き換えてください。

```javascript
const CLIENT_ID = 'YOUR_CLIENT_ID'; // OAuth2のクライアントIDに置き換えてください
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET'; // OAuth2のクライアントシークレットに置き換えてください
const REDIRECT_URI = 'http://localhost:12345/callback'; // リダイレクトURIに置き換えてください
```

`CLIENT_ID`、`CLIENT_SECRET`、および`REDIRECT_URI`を設定に合わせて適切に設定してください。

## 依存パッケージ

このプロジェクトでは以下の依存パッケージが必要です。

- `@badgateway/oauth2-client`: OAuth2クライアントライブラリ
- `express`: ルートやHTTPリクエストを処理するWebフレームワーク

これらの依存パッケージは`package.json`に指定されており、以下のコマンドでインストールできます。

## インストール

必要な依存パッケージをインストールするには、以下を実行してください。

```bash
npm install
```

## ビルド

TypeScriptファイルをJavaScriptにコンパイルするには、以下のコマンドを実行します。

```bash
npm run build
```

## 実行

ビルド後、アプリケーションを開始するには以下を実行します。

```bash
npm start
```

または、`dev`スクリプトを使用してビルドと開始を一度に行うこともできます。

```bash
npm run dev
```

## プロジェクト構成

- **src/index.ts**: OAuth2クライアントの設定およびルートが定義されているメインファイル
- **package.json**: 依存パッケージ、スクリプト、およびその他の設定が定義されています

## フォーマット

すべてのプロジェクトファイルをフォーマットするには、次のコマンドを使用します。

```bash
npm run format
```
