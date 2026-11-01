param(
    [string]$Date = '',
    [switch]$PackageOnly
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$now = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'Tokyo Standard Time')
if (!$Date) { $Date = $now.ToString('yyyy-MM-dd') }
if ($Date -notmatch '^\d{4}-\d{2}-\d{2}$') { throw 'Date must be YYYY-MM-DD' }
[void][DateTime]::ParseExact($Date, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)

if (!$PackageOnly) {
    Push-Location "$root/front"
    try {
        & npm.cmd run build:assets
        if ($LASTEXITCODE -ne 0) { throw 'Build failed; no release was created.' }
    } finally { Pop-Location }
}
foreach ($file in @('front/dist/index.html', 'php/index.php', 'deploy.htaccess', 'DEPLOY.md')) {
    if (!(Test-Path -LiteralPath (Join-Path $root $file))) { throw "Missing release input: $file" }
}

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
Copy-Item "$root/front/dist/*" $release -Recurse
Copy-Item "$root/php/index.php" "$release/php/index.php"
Copy-Item "$root/deploy.htaccess" "$release/.htaccess"
Set-Content -Encoding ascii "$release/storage/.htaccess" 'Require all denied'
Copy-Item "$root/DEPLOY.md" "$output/DEPLOY.md"
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($release, "$output.zip")
Write-Output "Release: $release"
Write-Output "ZIP: $output.zip"
