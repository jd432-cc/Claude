# Builds the Cloudflare Pages deploy directory from _source/.
# Re-run after re-exporting the design from claude.ai/design -- all fixes below
# are applied here, not in _source/, so a re-export never loses them.
#
#   Homepage.dc.html -> public/index.html     (Pages needs index.html for "/")
#   Services.dc.html -> public/services.html  (served at /services)
#   NotFound.dc.html -> public/404.html       (Pages serves this for any miss)
#
# Applied on top of the raw design export:
#   - rewrites the two cross-page links to clean URLs
#   - adds <title>, meta description and Open Graph tags (the export has none)
#   - adds lang="en" to <html> (the export has none; default language is English)
#   - links a favicon
#   - copies static/ verbatim, directories included (_headers, favicon, tools/)

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
    },
    # Cloudflare Pages serves a top-level 404.html for any unmatched path, with
    # a 404 status and no configuration. Its presence also tells Pages this is a
    # multi-page site: without it, Pages treats unmatched paths as an SPA and
    # serves index.html instead.
    @{
        From  = 'NotFound.dc.html'
        To    = '404.html'
        Path  = '/404'
        Title = "Page not found - $siteName"
        Desc  = 'The page you requested does not resolve. It may have moved, or it may never have existed.'
        NoIndex = $true
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

    # An error page is reachable at every wrong URL; keep it out of the index.
    if ($p.NoIndex) { $meta += "<meta name=\"robots\" content=\"noindex\">`n" }

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

# Copied wholesale, directories included. public/ is deleted at the top of this
# script, so anything not reproduced here does not survive a build -- which is
# how public/tools/ used to get wiped on every run.
Get-ChildItem (Join-Path $root 'static') -Force | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $out $_.Name) -Recurse -Force
    $label = if ($_.PSIsContainer) { $_.Name + '/' } else { $_.Name }
    Write-Host ("  static  {0}" -f $label)
}

$n = (Get-ChildItem $out -File -Force -Recurse).Count
Write-Host "`nBuilt $out ($n files)" -ForegroundColor Green
