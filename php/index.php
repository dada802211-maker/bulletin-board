<?php
declare(strict_types=1);
// 全APIの応答をJSONに統一し、認証情報を含む応答をキャッシュさせない。
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
ini_set('display_errors', '0');
// セッションIDをJavaScriptから隠し、HTTPSではSecure属性を付ける。
session_start(['use_strict_mode'=>1, 'cookie_httponly'=>true, 'cookie_samesite'=>'Lax', 'cookie_secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
// HTTPステータスとJSONを返して終了し、後続の処理が実行されるのを防ぐ。
function respond(array $data, int $status=200): never { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $message, int $status=400): never { respond(['error'=>$message], $status); }
try {
    // 環境変数があれば優先。既定値は公開フォルダの外側のstorageを想定する。
    $dir = getenv('BOARD_DATA_DIR') ?: dirname(__DIR__, 2).'/storage';
    if (!is_dir($dir) && !mkdir($dir, 0700, true)) throw new RuntimeException('storage');
    $db = new PDO('sqlite:'.$dir.'/board.sqlite', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    // 外部キー制約を有効にし、書き込み競合時には最大5秒待機する。
    $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    // 初回アクセスでテーブルを作成する。既存ユーザー・投稿はそのまま保持する。
    $db->exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, category TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, started INTEGER NOT NULL);');
    // 投稿の削除時には関連コメントも削除する。投稿ごとの検索用インデックスも用意する。
    $db->exec('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS comments_post_id ON comments(post_id,id);');
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    $action = $_GET['action'] ?? 'session';
    $method = $_SERVER['REQUEST_METHOD'];
    // データ変更を伴うリクエストは、セッションに対応するCSRFトークンを必須にする。
    if ($method === 'POST') {
        if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail('ページを再読み込みしてください。',403);
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 24000) fail('入力が長すぎます。',413);
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) fail('不正なリクエストです。');
    } elseif ($method !== 'GET') fail('許可されていない操作です。',405);
    $uid = $_SESSION['uid'] ?? null;
    // 初期表示用。公開してよいユーザー情報と、そのセッションのCSRFトークンを返す。
    if ($action === 'session' && $method === 'GET') {
        $q=$db->prepare('SELECT id,name FROM users WHERE id=?'); $q->execute([$uid]);
        respond(['user'=>$q->fetch() ?: null,'csrf'=>$_SESSION['csrf']]);
    }
    // 未ログインでも最新200件を閲覧できる。コメント数を合わせて返す。
    if ($action === 'posts' && $method === 'GET') {
        $q=$db->query('SELECT p.*,u.name,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 200'); respond(['posts'=>$q->fetchAll()]);
    }
    // 指定投稿のコメントを古い順で返す。削除済みの投稿は404にする。
    if ($action === 'comments' && $method === 'GET') {
        $postId=filter_var($_GET['post_id'] ?? null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        if (!$postId) fail('投稿IDが不正です。');
        $q=$db->prepare('SELECT id FROM posts WHERE id=?'); $q->execute([$postId]);
        if (!$q->fetch()) fail('投稿が見つかりません。',404);
        $q=$db->prepare('SELECT c.*,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id ASC'); $q->execute([$postId]); respond(['comments'=>$q->fetchAll()]);
    }
    // 登録・ログインの試行回数をIP単位で制限する。パスワードはハッシュで保存・照合する。
    if (in_array($action,['register','login'],true) && $method === 'POST') {
        $ip=hash('sha256',$_SERVER['REMOTE_ADDR'] ?? 'unknown');
        $q=$db->prepare('SELECT * FROM attempts WHERE ip=?'); $q->execute([$ip]); $attempt=$q->fetch();
        if ($attempt && time()-(int)$attempt['started']<900 && (int)$attempt['count']>=15) fail('しばらく待ってから再度お試しください。',429);
        $db->prepare('INSERT INTO attempts(ip,count,started) VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN started<? THEN 1 ELSE count+1 END, started=CASE WHEN started<? THEN excluded.started ELSE started END')->execute([$ip,time(),time()-900,time()-900]);
        $email=strtolower(trim((string)($input['email'] ?? ''))); $password=(string)($input['password'] ?? '');
        if (!filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($email)>254) fail('メールアドレスを確認してください。');
        if (strlen($password)<8 || strlen($password)>72) fail('パスワードは8〜72バイトで入力してください。');
        if ($action==='register') {
            $name=trim((string)($input['name'] ?? '')); if (mb_strlen($name)<1 || mb_strlen($name)>30) fail('表示名は1〜30文字で入力してください。');
            try { $db->prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)')->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT)]); }
            catch (PDOException $e) { if ($e->getCode()==='23000') fail('このメールアドレスは登録できません。',409); throw $e; }
            $uid=(int)$db->lastInsertId();
        } else {
            $q=$db->prepare('SELECT * FROM users WHERE email=?'); $q->execute([$email]); $user=$q->fetch();
            if (!$user || !password_verify($password,$user['password'])) fail('メールアドレスまたはパスワードが違います。',401);
            $uid=(int)$user['id'];
        }
        // 認証成功時にセッションIDを更新し、セッション固定攻撃を防ぐ。
        session_regenerate_id(true); $_SESSION['uid']=$uid;
        $q=$db->prepare('SELECT id,name FROM users WHERE id=?'); $q->execute([$uid]); respond(['user'=>$q->fetch()]);
    }
    if ($action==='logout' && $method==='POST') { $_SESSION=[]; session_regenerate_id(true); $_SESSION['csrf']=bin2hex(random_bytes(32)); respond(['csrf'=>$_SESSION['csrf']]); }
    // ここから下の投稿・コメント操作にはログインが必要。ユーザーIDは入力値を信用しない。
    if (!$uid) fail('ログインしてください。',401);
    // 存在する投稿へのみ挿入する。本文の文字数はサーバー側でも検証する。
    if ($action==='comment_create' && $method==='POST') {
        $postId=filter_var($input['post_id'] ?? null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        $body=is_string($input['body'] ?? null) ? trim($input['body']) : '';
        if (!$postId || mb_strlen($body)<1 || mb_strlen($body)>2000) fail('コメントは1〜2000文字で入力してください。');
        $q=$db->prepare('INSERT INTO comments(post_id,user_id,body,created_at) SELECT id,?,?,? FROM posts WHERE id=?');
        $q->execute([$uid,$body,gmdate('Y-m-d\TH:i:s\Z'),$postId]);
        if (!$q->rowCount()) fail('投稿が見つかりません。',404);
        respond(['ok'=>true],201);
    }
    // WHERE条件に本人のIDを含め、他人のコメントへの更新を拒否する。日時と投稿先は変えない。
    if ($action==='comment_update' && $method==='POST') {
        $id=filter_var($input['id'] ?? null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        $body=is_string($input['body'] ?? null) ? trim($input['body']) : '';
        if (!$id) fail('コメントIDが不正です。');
        if (mb_strlen($body)<1 || mb_strlen($body)>2000) fail('コメントは1〜2000文字で入力してください。');
        $q=$db->prepare('UPDATE comments SET body=? WHERE id=? AND user_id=?');
        $q->execute([$body,$id,$uid]);
        if (!$q->rowCount()) fail('コメントが見つからないか、編集する権限がありません。',403);
        respond(['ok'=>true]);
    }
    // コメントの削除権限はコメントを書いた本人だけに与える。
    if ($action==='comment_delete' && $method==='POST') {
        $q=$db->prepare('DELETE FROM comments WHERE id=? AND user_id=?'); $q->execute([(int)($input['id'] ?? 0),$uid]);
        if (!$q->rowCount()) fail('コメントが見つからないか、削除する権限がありません。',403);
        respond(['ok'=>true]);
    }
    // 投稿の編集は本人のみ可能。投稿ID・作成日時を保持するため、関連コメントも残る。
    if ($action==='update' && $method==='POST') {
        $id=filter_var($input['id'] ?? null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        $title=is_string($input['title'] ?? null) ? trim($input['title']) : '';
        $body=is_string($input['body'] ?? null) ? trim($input['body']) : '';
        $category=$input['category'] ?? '';
        if (!$id) fail('投稿IDが不正です。');
        if (mb_strlen($title)<1 || mb_strlen($title)>100 || mb_strlen($body)<1 || mb_strlen($body)>5000) fail('タイトルは1〜100文字、本文は1〜5000文字で入力してください。');
        if (!in_array($category,['雑談','質問','お知らせ'],true)) fail('カテゴリを選んでください。');
        $q=$db->prepare('UPDATE posts SET title=?,body=?,category=? WHERE id=? AND user_id=?');
        $q->execute([$title,$body,$category,$id,$uid]);
        if (!$q->rowCount()) fail('投稿が見つからないか、編集する権限がありません。',403);
        respond(['ok'=>true]);
    }
    // SQLの値はプレースホルダーで渡す。作成日時はUTCで保存し、表示時に変換する。
    if ($action==='create' && $method==='POST') {
        $title=trim((string)($input['title'] ?? '')); $body=trim((string)($input['body'] ?? '')); $category=$input['category'] ?? '';
        if (mb_strlen($title)<1 || mb_strlen($title)>100 || mb_strlen($body)<1 || mb_strlen($body)>5000) fail('タイトルは1〜100文字、本文は1〜5000文字で入力してください。');
        if (!in_array($category,['雑談','質問','お知らせ'],true)) fail('カテゴリを選んでください。');
        $db->prepare('INSERT INTO posts(user_id,title,body,category,created_at) VALUES(?,?,?,?,?)')->execute([$uid,$title,$body,$category,gmdate('Y-m-d\TH:i:s\Z')]); respond(['ok'=>true],201);
    }
    // 本人の投稿のみ削除する。関連コメントの削除は外部キー制約に任せる。
    if ($action==='delete' && $method==='POST') {
        $q=$db->prepare('DELETE FROM posts WHERE id=? AND user_id=?'); $q->execute([(int)($input['id'] ?? 0),$uid]); if (!$q->rowCount()) fail('投稿が見つからないか、削除する権限がありません。',403); respond(['ok'=>true]);
    }
    fail('ページが見つかりません。',404);
// 詳細な例外はサーバーログに記録し、DBパスなどをクライアントへ公開しない。
} catch (Throwable $e) { error_log((string)$e); fail('サーバーエラーが発生しました。',500); }
