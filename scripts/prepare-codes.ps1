$src = 'C:\Users\Admin\Downloads\Delta_Force_Garena_Danh_sach_gop.txt'
$dst = 'C:\Users\Admin\Downloads\delta-force-automatic-reward-exchange\extension\codes\redeem-codes.txt'

New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null

$lines = Get-Content $src
$out = New-Object System.Collections.Generic.List[string]
foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t -eq '') { continue }
    $t = $t -replace '^\d+\|', ''
    $t = $t.Trim()
    if ($t -ne '') { $out.Add($t) }
}

$out | Set-Content -Path $dst -Encoding UTF8
Write-Host ("Wrote {0} codes" -f $out.Count)
