# ひろば — React / PHP / SQLite 掲示板

機能: ユーザー登録、ログイン・ログアウト、投稿、本人による削除、カテゴリ、キーワード検索、レスポンシブ表示。

## 開発

PHP 8.1以上（pdo_sqlite・mbstring）、Node.js 22.12以上を使用します。

Laragonで「Start All」を押してWebサーバー（ポート80）を起動し、`cd front` → `npm ci` → `npm run dev` を実行します。表示されたVite URLを開きます。APIは `http://127.0.0.1/bulletin-board/php/` へプロキシされます。PHP単独サーバーの起動は不要です。Laragonのポートを変更している場合はfront/vite.config.tsのtargetも変更してください。

## 配布

frontフォルダで `npm run build` を実行すると、ビルド成功後に `release/日付/時分秒-ミリ秒/` と、同じ日付フォルダ内の `時分秒-ミリ秒.zip` を毎回新規作成します（日本時間）。例: `release/2026-11-01/153045-123/`。既存の配布版は上書きせず、同時刻の場合は連番を付けます。SQLiteの実データは配布物に含めません。ビルド失敗時は配布版を作成しません。`npm run build:assets` はfront/distのみ更新します。プロジェクト直下の `powershell -ExecutionPolicy Bypass -File scripts/release.ps1` でもビルドと新規配布版作成ができます。詳しくはDEPLOY.mdを参照してください。

認証はPHPセッション、パスワードハッシュ、CSRFトークンを使用。SQLはプリペアドステートメントを使用し、投稿本文はReactのテキストとして表示します。

### LaragonのPHP

補助スクリプトscripts/serve-php.ps1は `C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe` を明示的に使用します（PATH上のPHPには依存しません）。pdo_sqlite・mbstringの有効化を確認済みです。別のLaragon PHPに切り替える場合は起動スクリプトに `-PhpPath "C:\laragon\bin\php\対象バージョン\php.exe"` を渡してください。

LaragonのApacheで配布版を確認する場合は「Start All」で起動し、 `http://localhost/bulletin-board/release/日付/時分秒-ミリ秒/` を開いてください（Apacheが標準ポート80の場合）。この場合はPHP単独サーバーとViteの起動は不要です。Laragonのメニューで選択したPHPが使用されます。

コメント機能: 閲覧は公開、送信はログイン必須（1〜2000文字）、削除はコメント本人のみ可能です。投稿を削除すると付属コメントも削除されます。既存SQLiteにはアクセス時にcommentsテーブルが自動追加され、既存ユーザー・投稿は保持されます。

