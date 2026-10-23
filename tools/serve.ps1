param([int]$Port = 8731)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
}

while ($true) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    continue
  }
  try {
    $req = $ctx.Request
    $res = $ctx.Response
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
    $rel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $file = Join-Path $root $rel
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $res.ContentType = 'text/plain; charset=utf-8'
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
      continue
    }
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $res.ContentType = $type
    $res.ContentLength64 = $bytes.Length
    # при разработке файлы не кэшируем, чтобы правки были видны сразу
    try { $res.Headers.Add('Cache-Control', 'no-store, must-revalidate') } catch {}
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
  } catch {
    try { $ctx.Response.Close() } catch {}
  }
}
