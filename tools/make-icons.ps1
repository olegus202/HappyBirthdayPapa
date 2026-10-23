$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$icons = Join-Path $root 'icons'
if (-not (Test-Path $icons)) { New-Item -ItemType Directory -Path $icons | Out-Null }

function New-Icon([string]$path, [int]$size) {
    $bmp = [System.Drawing.Bitmap]::new($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $rect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
    $br = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 26, 12, 58),
        [System.Drawing.Color]::FromArgb(255, 92, 40, 140),
        [single]55.0)
    $g.FillRectangle($br, 0, 0, $size, $size)
    $g.FillEllipse($br, [int](-$size * 0.3), [int](-$size * 0.4), [int]($size * 1.6), [int]($size * 1.6))

    $gold = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 244, 200, 106))
    $pad = [single]($size * 0.15)
    $g.FillEllipse($gold, [single]$pad, [single]$pad, [single]($size - 2 * $pad), [single]($size - 2 * $pad))

    $pad2 = [single]($size * 0.21)
    $inner = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 40, 20, 80))
    $g.FillEllipse($inner, [single]$pad2, [single]$pad2, [single]($size - 2 * $pad2), [single]($size - 2 * $pad2))

    $font = [System.Drawing.Font]::new('Arial Black', [single]($size * 0.5), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = [System.Drawing.StringFormat]::new()
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $tr = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 241, 205))
    $trect = [System.Drawing.RectangleF]::new([single]0, [single]($size * 0.06), [single]$size, [single]($size * 0.88))
    $g.DrawString('71', $font, $tr, $trect, $fmt)

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host ("OK " + [System.IO.Path]::GetFileName($path) + " " + $size + "px")
}

New-Icon (Join-Path $icons 'icon-192.png') 192
New-Icon (Join-Path $icons 'icon-512.png') 512
New-Icon (Join-Path $icons 'icon-180.png') 180
New-Icon (Join-Path $icons 'icon-maskable-512.png') 512
