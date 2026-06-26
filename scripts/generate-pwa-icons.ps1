Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$icoPath = Join-Path $root 'game\icon\icon.ico'
$icon = [System.Drawing.Icon]::new($icoPath)
$bmp = $icon.ToBitmap()
$outDir = Join-Path $root 'public\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Save-IconSize {
  param([int]$Size, [string]$Name)
  $resized = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($resized)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($bmp, 0, 0, $Size, $Size)
  $g.Dispose()
  $path = Join-Path $outDir $Name
  $resized.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $resized.Dispose()
  Write-Output "Wrote $path"
}

Save-IconSize -Size 512 -Name 'icon-512.png'
Save-IconSize -Size 192 -Name 'icon-192.png'
Save-IconSize -Size 180 -Name 'apple-touch-icon.png'
Save-IconSize -Size 32 -Name 'favicon-32.png'

$gamePng = Join-Path $root 'game\icon\icon.png'
$bmp.Save($gamePng, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Wrote $gamePng"

$icon.Dispose()
$bmp.Dispose()
