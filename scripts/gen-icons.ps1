# Génère les icônes PNG de l'app (192, 512, apple-touch-icon 180) à partir de la même silhouette
# d'hirondelle que public/favicon.svg (2026-08-23, pour l'installation "Ajouter à l'écran
# d'accueil"). Pas d'outil de rasterisation SVG disponible dans cet environnement (pas de Node,
# pas d'ImageMagick/Inkscape/Python) — on redessine le même path via GDI+ (System.Drawing, déjà
# présent sur Windows sans installation) plutôt que d'improviser une icône différente.
# Usage : powershell -File scripts/gen-icons.ps1 (script jetable, pas exécuté en prod/CI)
Add-Type -AssemblyName System.Drawing

function New-ChefupIcon {
    param([int]$Size, [string]$OutPath, [bool]$RoundedBg)

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#16130F")
    $bgBrush = New-Object System.Drawing.SolidBrush $bgColor
    if ($RoundedBg) {
        $radius = $Size * 0.22
        $d = $radius * 2
        $path0 = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path0.AddArc(0, 0, $d, $d, 180, 90)
        $path0.AddArc($Size - $d, 0, $d, $d, 270, 90)
        $path0.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
        $path0.AddArc(0, $Size - $d, $d, $d, 90, 90)
        $path0.CloseFigure()
        $g.FillPath($bgBrush, $path0)
    } else {
        $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    }

    # viewBox source 0..100 (voir public/favicon.svg), marge pour rester dans la zone sûre des
    # icônes "maskable" (Android peut recadrer en cercle/squircle).
    $margin = $Size * 0.16
    $scale = ($Size - 2 * $margin) / 100.0
    $P = { param($x, $y) New-Object System.Drawing.PointF (($margin + $x * $scale), ($margin + $y * $scale)) }.GetNewClosure()

    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $cur = & $P 76 28

    $curves1 = @(
        @(71,27, 65,29, 60,33),
        @(55,23, 44,16, 32,15),
        @(39,24, 46,30, 53,36),
        @(47,39, 39,40, 31,39),
        @(36,45, 45,47, 53,45),
        @(50,50, 46,54, 41,57)
    )
    foreach ($c in $curves1) {
        $cp1 = & $P $c[0] $c[1]
        $cp2 = & $P $c[2] $c[3]
        $end = & $P $c[4] $c[5]
        $gp.AddBezier($cur, $cp1, $cp2, $end)
        $cur = $end
    }

    $lines = @(@(34,58), @(8,66), @(28,64), @(14,90), @(39,66))
    foreach ($l in $lines) {
        $target = & $P $l[0] $l[1]
        $gp.AddLine($cur, $target)
        $cur = $target
    }

    $curves2 = @(
        @(44,68, 50,67, 54,63),
        @(57,66, 61,68, 66,69),
        @(63,60, 62,51, 64,43),
        @(70,43, 75,39, 78,34),
        @(80,31, 79,29, 76,28)
    )
    foreach ($c in $curves2) {
        $cp1 = & $P $c[0] $c[1]
        $cp2 = & $P $c[2] $c[3]
        $end = & $P $c[4] $c[5]
        $gp.AddBezier($cur, $cp1, $cp2, $end)
        $cur = $end
    }
    $gp.CloseFigure()

    # Dégradé violet -> cyan, bas-gauche vers haut-droit (même orientation que le SVG source).
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#C9793B")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#E0A050")
    $ptA = New-Object System.Drawing.PointF $margin, ($Size - $margin)
    $ptB = New-Object System.Drawing.PointF ($Size - $margin), $margin
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($ptA, $ptB, $c1, $c2)
    $g.FillPath($brush, $gp)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $brush.Dispose(); $gp.Dispose(); $g.Dispose(); $bmp.Dispose(); $bgBrush.Dispose()
    Write-Output "OK: $OutPath ($Size x $Size)"
}

New-ChefupIcon -Size 512 -OutPath "public/icons/icon-512.png" -RoundedBg $true
New-ChefupIcon -Size 192 -OutPath "public/icons/icon-192.png" -RoundedBg $true
New-ChefupIcon -Size 180 -OutPath "public/icons/apple-touch-icon.png" -RoundedBg $false
