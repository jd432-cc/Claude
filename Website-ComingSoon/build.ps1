# Builds the Cloudflare Pages deploy directory from _source/.
# Re-run after re-exporting the design from claude.ai/design -- all fixes below
# are applied here, not in _source/, so a re-export never loses them.
#
#   Homepage.dc.html -> public/index.html     (Pages needs index.html for "/")
#   Services.dc.html -> public/services.html  (served at /services)
#
# Applied on top of the raw design export:
#   - rewrites the two cross-page links to clean URLs
#   - adds <title>, meta description and Open Graph tags (the export has none)
#   - adds lang="en" to <html> (the export has none; default language is English)
#   - links a favicon
#   - copies static/ verbatim (_headers, favicon, empty image-slot sidecar)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web   # HttpUtility::HtmlEncode
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root '_source'
$out  = Join-Path $root 'public'

# UTF-8 *without* BOM. A BOM before <!DOCTYPE drops browsers into quirks mode,
# and the pages contain accented FR/ES copy that must round-trip intact.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$siteName = 'TheRacingData'
$origin   = 'https://theracingdata.com'

# --- Stats -------------------------------------------------------------------
# The four hero figures live in data/stats.json so the season count recomputes
# on every build instead of going stale in the markup. Rendered between the
# <!--stats:start--> / <!--stats:end--> markers in Homepage.dc.html.

$statsFile = Join-Path (Join-Path $root 'data') 'stats.json'
if (-not (Test-Path $statsFile)) { throw "missing data file: $statsFile" }
$stats = [System.IO.File]::ReadAllText($statsFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$statsStart = '<!--stats:start-->'
$statsEnd   = '<!--stats:end-->'

# Minimal escaping only. HtmlEncode would turn the FR/ES accents into numeric
# entities; the rest of the document carries them as raw UTF-8.
function Enc($t) {
    ([string]$t).Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
}

# A season is not a calendar year. Before the opening date we are still in the
# previous season, so the count does not tick over on 1 January.
function Get-SeasonYear($season) {
    $now   = Get-Date
    $parts = ([string]$season.opensOn) -split '-'
    $opens = [datetime]::new($now.Year, [int]$parts[0], [int]$parts[1])
    if ($now -ge $opens) { return $now.Year } else { return $now.Year - 1 }
}

function Format-Stats($data) {
    $seasonYear = Get-SeasonYear $data.season
    $cells = foreach ($s in $data.stats) {
        if ($s.compute) {
            if ($s.compute -ne 'seasonsOperating') { throw "unknown compute: $($s.compute)" }
            $value = [string]($seasonYear - [int]$data.season.firstYear + 1)
        } else {
            $value = [string]$s.value
        }

        $suffix = ''
        if ($s.suffix) {
            $cls = if ($s.suffixStyle) { $s.suffixStyle } else { 'unit' }
            $suffix = '<span class="' + (Enc $cls) + '">' + (Enc $s.suffix) + '</span>'
        }

        $attrs = ''
        foreach ($p in $s.label.PSObject.Properties) {
            if ($p.Name -eq 'en') { continue }
            $attrs += ' data-' + $p.Name + '="' + (Enc $p.Value) + '"'
        }

        '      <div class="stat">' + "`n" +
        '        <div class="stat-value">' + (Enc $value) + $suffix + '</div>' + "`n" +
        '        <div class="stat-label"' + $attrs + '>' + (Enc $s.label.en) + '</div>' + "`n" +
        '      </div>'
    }
    return ($cells -join "`n")
}

$pages = @(
    @{
        From  = 'Homepage.dc.html'
        To    = 'index.html'
        Path  = '/'
        Title = "$siteName - Race Engineering and Operations"
        Desc  = 'Development, calibration and race-day operations for rally, GT and historic crews - from the data room to the service park.'
    },
    @{
        From  = 'Services.dc.html'
        To    = 'services.html'
        Path  = '/services'
        Title = "Engineering - $siteName"
        Desc  = 'Data and telemetry, ECU calibration and race weekend support. We do not guess: we measure, change, and measure again.'
    }
)

# Cross-page link rewrites: .dc.html filenames -> extensionless Pages URLs.
$linkMap = @{
    'href="Homepage.dc.html"' = 'href="/"'
    'href="Services.dc.html"' = 'href="/services"'
}

foreach ($p in $pages) {
    $inPath = Join-Path $src $p.From
    if (-not (Test-Path $inPath)) { throw "missing source page: $inPath" }

    $html = [System.IO.File]::ReadAllText($inPath, [System.Text.Encoding]::UTF8)

    foreach ($k in $linkMap.Keys) { $html = $html.Replace($k, $linkMap[$k]) }

    # Fill the stats band from data/stats.json (homepage only).
    if ($html.Contains($statsStart)) {
        $a = $html.IndexOf($statsStart)
        $b = $html.IndexOf($statsEnd)
        if ($b -lt $a) { throw "stats markers out of order in $($p.From)" }
        $html = $html.Substring(0, $a + $statsStart.Length) + "`n" +
                (Format-Stats $stats) + "`n" + $html.Substring($b)
        Write-Host ("  stats   {0} figures, season {1}" -f $stats.stats.Count, (Get-SeasonYear $stats.season))
    } elseif ($p.To -eq 'index.html') {
        throw "stats markers not found in $($p.From) -- re-add <!--stats:start--> / <!--stats:end-->"
    }

    # The export emits a bare <html>. Declare the document's default language.
    if ($html -notmatch '<html[^>]*\slang=') {
        $html = $html -replace '(?i)<html>', '<html lang="en">'
    }

    $esc  = [System.Web.HttpUtility]::HtmlEncode($p.Desc)
    $tEsc = [System.Web.HttpUtility]::HtmlEncode($p.Title)
    $url  = $origin + $p.Path

    # Injected immediately after <meta name="viewport" ...> so it lands inside
    # <head> regardless of what else the exporter puts there.
    $meta = @"

<title>$tEsc</title>
<meta name="description" content="$esc">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="$siteName">
<meta property="og:title" content="$tEsc">
<meta property="og:description" content="$esc">
<meta property="og:url" content="$url">
<meta name="twitter:card" content="summary_large_image">
"@

    $anchor = '<meta name="viewport" content="width=device-width, initial-scale=1">'
    if ($html -notlike "*$anchor*") { throw "viewport meta not found in $($p.From); cannot anchor head injection" }
    $html = $html.Replace($anchor, $anchor + $meta)

    [System.IO.File]::WriteAllText((Join-Path $out $p.To), $html, $utf8NoBom)
    Write-Host ("  page    {0,-16} -> {1,-14} ({2})" -f $p.From, $p.To, $p.Path)
}

# Runtime files are copied byte-for-byte. Do not edit them: they are regenerated
# by the design tool and any local change is lost on the next export.
foreach ($f in @('support.js', 'image-slot.js')) {
    Copy-Item (Join-Path $src $f) (Join-Path $out $f) -Force
    Write-Host ("  runtime {0}" -f $f)
}

Get-ChildItem (Join-Path $root 'static') -File -Force | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $out $_.Name) -Force
    Write-Host ("  static  {0}" -f $_.Name)
}

# --- Tools ---------------------------------------------------------------
# Standalone tool pages, copied whole from _tools/ to public/tools/.
#
# This step used to be missing. Because the build deletes public/ and
# rebuilds it, anything under public/tools/ that was not re-copied here
# vanished on every run -- the loom planner survived only because the
# script had not been re-run since it was added. Tools now live in
# _tools/ and are reproduced from source like everything else.
#
# Copied recursively and verbatim: each tool owns its own css/, js/,
# assets/ and templates/. Nothing here rewrites their contents.

$toolsSrc = Join-Path $root '_tools'
if (Test-Path $toolsSrc) {
    $toolsOut = Join-Path $out 'tools'
    New-Item -ItemType Directory -Path $toolsOut -Force | Out-Null

    Get-ChildItem $toolsSrc -Directory | ForEach-Object {
        $dest = Join-Path $toolsOut $_.Name
        Copy-Item $_.FullName $dest -Recurse -Force
        $n = (Get-ChildItem $dest -File -Recurse -Force).Count
        Write-Host ("  tool    {0,-16} -> /tools/{1}/ ({2} files)" -f $_.Name, $_.Name, $n)
    }

    # The /tools/ landing page is a page, not a tool directory, but the same
    # rule applies: anything not reproduced here is deleted by the next run.
    Get-ChildItem $toolsSrc -File -Force | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $toolsOut $_.Name) -Force
        Write-Host ("  tool    {0,-16} -> /tools/{0}" -f $_.Name)
    }
}

$n = (Get-ChildItem $out -File -Force).Count
Write-Host "`nBuilt $out ($n files)" -ForegroundColor Green
