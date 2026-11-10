param(
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [string]$Instance = "chatz"
)

$headers = @{ apikey = $ApiKey }
$r = $null

for ($i = 0; $i -lt 10; $i++) {
    $r = Invoke-RestMethod -Uri "http://localhost:8080/instance/connect/$Instance" -Headers $headers
    if ($r.base64) { break }
    Start-Sleep -Seconds 3
}

if (-not $r.base64) {
    $r | ConvertTo-Json
    exit 1
}

$html = "<html><body style=""background:#fff;text-align:center""><img src=""$($r.base64)"" width=""400""></body></html>"
$path = Join-Path $PWD "qr.html"
Set-Content -Path $path -Value $html -Encoding UTF8
Start-Process $path