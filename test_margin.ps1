$wc = New-Object System.Net.WebClient
$bytes = $wc.DownloadData("https://ocean.weather.gov/UA/OPC_PAC.gif")
$ms = New-Object System.IO.MemoryStream(,$bytes)
[System.Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null
$img = [System.Drawing.Image]::FromStream($ms)
$bmp = new-object System.Drawing.Bitmap($img)
$w = $bmp.Width
$h = $bmp.Height

$top = 0
for ($y=0; $y -lt $h; $y++) {
    $isWhite = $true
    for ($x=$w/2; $x -lt $w/2+10; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -ne 255 -or $p.G -ne 255 -or $p.B -ne 255) {
            $isWhite = $false
            break
        }
    }
    if (-not $isWhite) { $top = $y; break }
}

$bottom = $h - 1
for ($y=$h-1; $y -ge 0; $y--) {
    $isWhite = $true
    for ($x=$w/2; $x -lt $w/2+10; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -ne 255 -or $p.G -ne 255 -or $p.B -ne 255) {
            $isWhite = $false
            break
        }
    }
    if (-not $isWhite) { $bottom = $y; break }
}
Write-Host "OPC_PAC: Top=$top, Bottom=$($h - $bottom - 1)"

$bytes = $wc.DownloadData("https://ocean.weather.gov/UA/Pac_Tropics.gif")
$ms = New-Object System.IO.MemoryStream(,$bytes)
$img = [System.Drawing.Image]::FromStream($ms)
$bmp = new-object System.Drawing.Bitmap($img)
$bottom2 = $h - 1
for ($y=$h-1; $y -ge 0; $y--) {
    $isWhite = $true
    for ($x=$w/2; $x -lt $w/2+10; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -ne 255 -or $p.G -ne 255 -or $p.B -ne 255) {
            $isWhite = $false
            break
        }
    }
    if (-not $isWhite) { $bottom2 = $y; break }
}
$top2 = 0
for ($y=0; $y -lt $h; $y++) {
    $isWhite = $true
    for ($x=$w/2; $x -lt $w/2+10; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.R -ne 255 -or $p.G -ne 255 -or $p.B -ne 255) {
            $isWhite = $false
            break
        }
    }
    if (-not $isWhite) { $top2 = $y; break }
}
Write-Host "Pac_Tropics: Top=$top2, Bottom=$($h - $bottom2 - 1)"
