// 必要なモジュールをexpressと@badgateway/oauth2-clientからインポート
import express from 'express';
import { generateCodeVerifier, OAuth2Client } from '@badgateway/oauth2-client';
import crypto from 'crypto';
// Expressアプリケーションを初期化
const app = express();
const PORT = 12345; // サーバーがリッスンするポートを定義
// OAuth2設定の定数
const CLIENT_ID = 'YOUR CLIENT_ID'; // OAuth2クライアントのクライアントID
const CLIENT_SECRET = 'YOUR CLIENT_SECRET'; // OAuth2クライアントのクライアントシークレット
const REDIRECT_URI = 'http://localhost:12345/callback'; // 認可サーバーからのコールバックを処理するリダイレクトURI
const AUTHORIZATION_SERVER = 'https://api.biz.moneyforward.com'; // OAuth2認可サーバーの基本URL
// トークンと状態情報を管理するグローバル変数
let tokenResponse = null; // トークンレスポンスを保存
let codeVerifier = null; // PKCEのコードバリファイア
let state = null; // CSRF攻撃を防ぐためのユニークな状態値
// OAuth2クライアントを設定でインスタンス化
const client = new OAuth2Client({
  server: AUTHORIZATION_SERVER,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  authorizationEndpoint: '/authorize',
  tokenEndpoint: '/token',
  authenticationMethod: 'client_secret_post', // クライアント認証の方法
  // authenticationMethod: 'client_secret_basic', // クライアント認証の方法 CLIENT_SECRET_BASIC を選択した場合
});
// ホームページにボタンを生成するヘルパー関数
function createButton(action, label) {
  return `
    <form action="${action}" method="get" style="display:inline;">
      <button type="submit">${label}</button>
    </form>
  `;
}
// ホームページにトークン情報と操作ボタンを表示
function displayHomePage(req, res) {
  const tokenInfo = tokenResponse
    ? JSON.stringify(tokenResponse, null, 2) // トークンが存在する場合はその詳細を表示
    : '保持しているトークンはありません / No token available'; // トークンがない場合はプレースホルダーメッセージを表示
  res.send(`
    <h1>OAuth2 Client Demo</h1>
    <h2>トークン情報 / Token Info</h2>
    <pre>${tokenInfo}</pre>
    ${createButton('/start_authorization', '認可開始 / Start Authorize')}
    ${createButton('/revoke', 'トークンを取り消し / Revoke Tokens')}
    <br /><br />
    ${createButton('/office', 'APIを呼び出し、保護されたリソースを取得 / Call API to fetch protected resource')}
  `); // HTMLで各操作のボタンを含むレスポンスを送信
}
// PKCEを使用してOAuth2の認可フローを開始
async function startAuthorization(req, res) {
  codeVerifier = await generateCodeVerifier(); // PKCE用のコードバリファイアを生成
  state = crypto.randomBytes(16).toString('hex'); // CSRF防止のためにランダムな状態値を生成、state値についてはセキュリティ要件に応じて必要な強度のものを生成するようにしてください。
  // 認可URLを生成
  const authorizeUrl = await client.authorizationCode.getAuthorizeUri({
    redirectUri: REDIRECT_URI,
    codeVerifier,
    state,
    scope: ['mfc/admin/office.read'], // 認可のアクセス範囲
  });
  console.info('Redirecting to', authorizeUrl); // デバッグ用にURLをログ出力
  res.redirect(authorizeUrl); // 認可URLにユーザーをリダイレクト
}
// 認可サーバーからのコールバックを処理しトークンを取得
async function handleAuthorizationCallback(req, res) {
  try {
    const { code, state: returnedState } = req.query; // クエリパラメータからコードと状態を抽出
    // 返された状態が初期の状態と一致することを確認してセキュリティを保護
    if (
      !crypto.timingSafeEqual(
        Buffer.from(String(returnedState)),
        Buffer.from(String(state)),
      )
    )
      throw new Error('State does not match');
    if (!codeVerifier) throw new Error('Code verifier is missing'); // PKCE用のコードバリファイアが存在するか確認
    // トークン交換用のリクエストペイロードを作成
    const authorizationCodeRequest = {
      grant_type: 'authorization_code', // 認可コードのグラントタイプ
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier, // PKCE用のコードバリファイアを送信
    };
    // 認可コードを使用してアクセストークンとリフレッシュトークンを交換
    tokenResponse = await client.request(
      'tokenEndpoint',
      authorizationCodeRequest,
    );
    console.info('Access Token Response:', tokenResponse); // トークンレスポンスをログ出力
    res.redirect('/'); // ホームページにリダイレクト
  } catch (error) {
    console.error('Error during callback processing:', error); // エラーがあればログ出力
    res
      .status(500)
      .send(
        'アクセストークン取得に失敗しました / Failed to obtain access token.',
      );
  }
}
// リフレッシュトークンを使用してアクセストークンを更新
async function refreshAccessToken(req, res) {
  // リフレッシュトークンが存在するか確認
  if (!tokenResponse?.refresh_token) {
    console.error('Refresh token is missing.'); // リフレッシュトークンがない場合エラーをログ出力
    return false; // リフレッシュトークンがない場合falseを返す
  }
  try {
    // リフレッシュトークンのリクエストペイロードを作成
    const refreshRequest = {
      grant_type: 'refresh_token', // リフレッシュトークンのグラントタイプ
      refresh_token: tokenResponse.refresh_token,
    };
    console.info('Refreshing token with request:', refreshRequest); // リクエストペイロードをログ出力
    // リフレッシュトークンを使用して新しいアクセストークンをリクエスト
    tokenResponse = await client.request('tokenEndpoint', refreshRequest);
    console.info('New Refreshed Token Response:', tokenResponse); // 更新されたトークンをログ出力
    return true; // リフレッシュ成功の場合trueを返す
  } catch (error) {
    console.error('Error refreshing token:', error); // エラーがあればログ出力
    return false; // リフレッシュ失敗の場合falseを返す
  }
}
// API連携を終了する場合に安全のために現在のアクセストークンおよびリフレッシュトークンを取り消す（オプション）
async function revokeAccessToken(req, res) {
  if (!tokenResponse || !tokenResponse.access_token) {
    res
      .status(400)
      .send('アクセストークンがありません / Access token is missing'); // アクセストークンが存在するか確認
    return;
  }
  try {
    // トークンを取り消すためにリクエストを送信
    await client.request('revocationEndpoint', {
      token: tokenResponse.access_token,
    });
    tokenResponse = null; // 取り消し後にトークンレスポンスをクリア
    console.info('Token revoked successfully'); // 成功メッセージをログ出力
    res.redirect('/'); // ホームページにリダイレクト
  } catch (error) {
    console.error('Error revoking token:', error); // エラーがあればログ出力
    res
      .status(500)
      .send('トークンの取り消しに失敗しました / Failed to revoke token.');
  }
}
// アクセストークンを使用してAPIを実行し、保護されたリソースを取得
async function fetchProtectedResource(req, res) {
  if (!tokenResponse) {
    res
      .status(401)
      .send(
        'アクセストークンがありません。再度認可からやり直してください。 / Access token is missing. Please start authorize again.',
      ); // アクセストークンが存在するか確認
    return;
  }
  try {
    // リソースの初回取得を試行
    let response = await fetch(
      'https://bizapis.moneyforward.com/admin/office',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`, // アクセストークンを送信
        },
      },
    );
    // トークンが期限切れの場合、リフレッシュしてリソース取得を再試行
    if (response.status === 401) {
      console.info('Token expired. Refreshing token...');
      const refreshStatus = await refreshAccessToken(req, res);
      if (!refreshStatus) {
        // リフレッシュが成功したことを確認
        res
          .status(401)
          .send(
            'アクセストークンが期限切れですが、リフレッシュに失敗しました。再度認可からやり直してください。 / Token expired and refresh failed. Please start authorize again.',
          );
        return;
      }
      // リフレッシュしたトークンでリソース取得を再試行
      response = await fetch('https://bizapis.moneyforward.com/admin/office', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`, // リフレッシュしたアクセストークンを送信
        },
      });
    }
    // 最終的なリソース取得の応答を処理
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${response.statusText}`); // 応答エラーを処理
    }
    const data = await response.json(); // 応答JSONを解析
    console.info('Protected Resource Response:', data); // 応答データをログ出力
    res.json(data); // クライアントにデータを送信
  } catch (error) {
    console.error('Error fetching protected resource:', error); // エラーがあればログ出力
    res
      .status(500)
      .send(
        '保護されたリソースの取得に失敗しました。 / Failed to fetch protected resource.',
      );
  }
}
// アプリケーションのルートを定義
app.get('/', displayHomePage); // ホームルート
app.get('/start_authorization', startAuthorization); // 認可を開始
app.get('/callback', handleAuthorizationCallback); // コールバックを処理してトークンを取得
app.get('/revoke', revokeAccessToken); // トークンを取り消す
app.get('/office', fetchProtectedResource); // 保護されたリソースにアクセス
// サーバーを開始
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`); // サーバー開始メッセージをログ出力
});
