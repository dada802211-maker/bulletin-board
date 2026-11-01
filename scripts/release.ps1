param(
    [string]$Date = '',
    [switch]$PackageOnly
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
# 配布フォルダの日時は実行環境によらず日本時間を使う。
$now = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'Tokyo Standard Time')
if (!$Date) { $Date = $now.ToString('yyyy-MM-dd') }
if ($Date -notmatch '^\d{4}-\d{2}-\d{2}$') { throw 'Date must be YYYY-MM-DD' }
[void][DateTime]::ParseExact($Date, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)

# npmのpostbuildからは梱包だけ行う。直接実行時はassetsのみビルドし、再帰呼び出しを避ける。
if (!$PackageOnly) {
    Push-Location "$root/front"
    try {
        & npm.cmd run build:assets
        if ($LASTEXITCODE -ne 0) { throw 'Build failed; no release was created.' }
    } finally { Pop-Location }
}
# 必須ファイルが揃っていることを確認してから配布先を作成する。
foreach ($file in @('front/dist/index.html', 'php/index.php', 'deploy.htaccess', 'DEPLOY.md')) {
    if (!(Test-Path -LiteralPath (Join-Path $root $file))) { throw "Missing release input: $file" }
}

# 日付とミリ秒付き時刻で毎回別の配布先を作る。既存名と重なった場合は連番を付ける。
$stamp = $now.ToString('HHmmss-fff')
$base = Join-Path $root "release/$Date/$stamp"
$output = $base
$suffix = 0
while (Test-Path -LiteralPath $output) {
    $suffix++
    $output = "$base-$suffix"
}
New-Item -ItemType Directory -Path $output | Out-Null
$release = $output
New-Item -ItemType Directory -Path "$release/php", "$release/storage" -Force | Out-Null
# ビルド済み画面とPHPだけを梱包し、運用中のSQLiteファイルはコピーしない。
Copy-Item "$root/front/dist/*" $release -Recurse
Copy-Item "$root/php/index.php" "$release/php/index.php"
Copy-Item "$root/deploy.htaccess" "$release/.htaccess"
# 公開領域内にstorageを置く構成では、Apacheからの直接アクセスを禁止する。
Set-Content -Encoding ascii "$release/storage/.htaccess" 'Require all denied'
Copy-Item "$root/DEPLOY.md" "$output/DEPLOY.md"
Add-Type -AssemblyName System.IO.Compression.FileSystem
# ZIPは梱包対象の外側へ置き、アーカイブ自体が含まれることを防ぐ。
[IO.Compression.ZipFile]::CreateFromDirectory($release, "$output.zip")
Write-Output "Release: $release"
Write-Output "ZIP: $output.zip"
