$ErrorActionPreference='Stop'
try {
  $repairDir = $PSScriptRoot
  $projectDir = $repairDir
  if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'package.json'))) {
    $projectDir = Split-Path -Parent $repairDir
  }
  if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'package.json'))) {
    throw 'Project folder not found. Extract the ZIP inside the folder containing package.json, then run the BAT file.'
  }
  $package = Get-Content -LiteralPath (Join-Path $projectDir 'package.json') -Raw | ConvertFrom-Json
  if ($package.name -ne 'the-box-studio' -or $package.version -ne '10.1.0') {
    throw 'This repair is only for The BOX Studio v10.1.0.'
  }
  Write-Host ('Repairing: ' + $projectDir)
  $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup=Join-Path $projectDir ('backup-before-gemini-repair-' + $stamp)
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  $serverSource=Join-Path $repairDir 'restore-files\server'
  if (-not (Test-Path -LiteralPath $serverSource)) { throw 'Repair package is incomplete: restore-files/server was not found.' }
  $files = @(Get-ChildItem -LiteralPath $serverSource -Recurse -File)
  $restored=0
  foreach ($file in $files) {
    $relative=$file.FullName.Substring($serverSource.Length).TrimStart('\','/')
    $dest=Join-Path (Join-Path $projectDir 'server') $relative
    if (-not (Test-Path -LiteralPath $dest)) {
      New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
      Copy-Item -LiteralPath $file.FullName -Destination $dest
      Write-Host ('RESTORED: server\'+ $relative)
      $restored++
    }
  }
  $testSource=Join-Path $repairDir 'restore-files\tests\ai.test.mjs'
  $testDest=Join-Path $projectDir 'tests\ai.test.mjs'
  New-Item -ItemType Directory -Path (Split-Path -Parent $testDest) -Force | Out-Null
  if (Test-Path -LiteralPath $testDest) {
    Copy-Item -LiteralPath $testDest -Destination (Join-Path $backup 'ai.test.mjs')
  }
  Copy-Item -LiteralPath $testSource -Destination $testDest -Force
  Write-Host ('Restored missing server files: ' + $restored)
  Write-Host 'Updated tests\ai.test.mjs for Windows. Previous test saved in backup folder.'
  Write-Host 'Your .env, data and current server/ai.mjs were not modified.'
  Write-Host ''
  Write-Host 'NEXT, run these commands from the project folder:'
  Write-Host ('  cd "' + $projectDir + '"')
  Write-Host '  node --test tests/ai.test.mjs'
  Write-Host '  npm run ai:check'
  Write-Host '  npm start'
} catch {
  Write-Host ('REPAIR FAILED: ' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
