param([string]$PhpPath = 'C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe')
# Laragon同梱PHPの明示パスで起動し、PATH上の別のPHPが選ばれることを防ぐ。
$ErrorActionPreference='Stop'
if (!(Test-Path -LiteralPath $PhpPath)) { throw "Laragon PHP not found: $PhpPath. Specify -PhpPath." }
$root=Split-Path $PSScriptRoot -Parent
& $PhpPath -S 127.0.0.1:8080 -t $root
exit $LASTEXITCODE