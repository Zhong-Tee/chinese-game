Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$pngPath = Join-Path $root 'game\icon\icon.png'
if (-not (Test-Path $pngPath)) {
  throw "Missing source icon: $pngPath"
}

$loaded = [System.Drawing.Image]::FromFile($pngPath)
$bmp = New-Object System.Drawing.Bitmap($loaded)
$loaded.Dispose()

$outDir = Join-Path $root 'public\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Save-IconSize {
  param([int]$Size, [string]$Name)
  $resized = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($resized)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::FromArgb(255, 10, 14, 26))
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

$bmp.Dispose()
Write-Output "Source: $pngPath"
