# Run from this PR worktree. The masked password exists only in this PowerShell process/child.
param([switch]$Browser)
$ErrorActionPreference = 'Stop'
$variableNames = @('VALRYDE_E2E_API_URL', 'VALRYDE_E2E_PASSWORD')
$previous = @{}
foreach ($name in $variableNames) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$secret = $null
$pointer = [IntPtr]::Zero
try {
    $env:VALRYDE_E2E_API_URL = 'http://127.0.0.1:3000'
    $secret = Read-Host 'Seeded development fixture password' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $env:VALRYDE_E2E_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    & node (Join-Path $PSScriptRoot 'admin-directory-acceptance.mjs')
    $acceptanceExitCode = $LASTEXITCODE
    if ($acceptanceExitCode -eq 0 -and $Browser) {
        & node (Join-Path $PSScriptRoot 'admin-directory-browser.cjs')
        $acceptanceExitCode = $LASTEXITCODE
    }
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($null -ne $secret) { $secret.Dispose() }
    foreach ($name in $variableNames) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
exit $acceptanceExitCode
