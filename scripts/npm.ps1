$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$nodeDirectory = Join-Path $projectRoot '.tools/node-v24.21.0-win-x64'
if (Test-Path -LiteralPath (Join-Path $nodeDirectory 'node.exe')) {
    $env:PATH = "$nodeDirectory;$env:PATH"
    & (Join-Path $nodeDirectory 'npm.cmd') @args
} else { & npm @args }
exit $LASTEXITCODE
