param(
  [int]$MaxAgeDays = 45
)

$ErrorActionPreference = 'Stop'

Write-Output '=== SEO Guardrails ==='

$landingPagesPath = 'src/lib/landingPages.js'
$sitemapPath = 'public/sitemap.xml'

$landingPages = Get-Content $landingPagesPath -Raw
$sitemap = Get-Content $sitemapPath -Raw

$ok = $true

$sitemapLocMatches = [regex]::Matches($sitemap, '<loc>(?<u>[^<]+)</loc>')
$sitemapUrls = @{}
foreach ($m in $sitemapLocMatches) {
  $url = $m.Groups['u'].Value.Trim()
  if ($url) { $sitemapUrls[$url] = $true }
}

$requiredPublicUrls = @(
  'https://www.jwordenasphaltpaving.com/',
  'https://www.jwordenasphaltpaving.com/locations',
  'https://www.jwordenasphaltpaving.com/blog',
  'https://www.jwordenasphaltpaving.com/commercial/richmond-va',
  'https://www.jwordenasphaltpaving.com/residential'
)

$canonicalMatches = [regex]::Matches($landingPages, "canonicalPath:\s*'(?<p>/[^']+)'")
$landingCanonicalPaths = @()
foreach ($m in $canonicalMatches) {
  $landingCanonicalPaths += $m.Groups['p'].Value
}
$landingCanonicalPaths = $landingCanonicalPaths | Select-Object -Unique

$missingFromSitemap = @()
foreach ($url in $requiredPublicUrls) {
  if (-not $sitemapUrls.ContainsKey($url)) {
    $missingFromSitemap += $url
  }
}
foreach ($path in $landingCanonicalPaths) {
  $url = "https://www.jwordenasphaltpaving.com$path"
  if (-not $sitemapUrls.ContainsKey($url)) {
    $missingFromSitemap += $url
  }
}

if ($missingFromSitemap.Count -gt 0) {
  Write-Output 'FAIL: Sitemap is missing required public URLs:'
  $missingFromSitemap | ForEach-Object { Write-Output "  - $_" }
  $ok = $false
}

function Get-LastmodForUrl {
  param(
    [string]$xml,
    [string]$url
  )
  $escaped = [regex]::Escape($url)
  $pattern = "<url>\s*<loc>$escaped</loc>\s*<lastmod>(?<d>[^<]+)</lastmod>"
  $m = [regex]::Match($xml, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($m.Success) { return $m.Groups['d'].Value.Trim() }
  return $null
}

$now = Get-Date
$staleEntries = @()
foreach ($path in $landingCanonicalPaths) {
  $url = "https://www.jwordenasphaltpaving.com$path"
  $lastmod = Get-LastmodForUrl -xml $sitemap -url $url
  if (-not $lastmod) {
    $staleEntries += "$url (missing <lastmod>)"
    continue
  }
  try {
    $age = ($now - (Get-Date $lastmod)).TotalDays
    if ($age -gt $MaxAgeDays) {
      $staleEntries += "$url ($([math]::Round($age, 1)) days old)"
    }
  } catch {
    $staleEntries += "$url (invalid <lastmod>: $lastmod)"
  }
}

if ($staleEntries.Count -gt 0) {
  Write-Output "FAIL: Sitemap freshness guard failed for landing pages (> $MaxAgeDays days):"
  $staleEntries | ForEach-Object { Write-Output "  - $_" }
  $ok = $false
}

$hasFaqSchema = $landingPages -match "'@type': 'FAQPage'"
$hasHowToSchema = $landingPages -match "'@type': 'HowTo'"
$hasBreadcrumbSchema = $landingPages -match "'@type': 'BreadcrumbList'"
$hasCrumbTitle = $landingPages -match 'name: page.title'
$hasCrumbCanonical = $landingPages -match 'item: url'

if (-not $hasFaqSchema) {
  Write-Output 'FAIL: Landing schema is missing FAQPage graph node.'
  $ok = $false
}
if (-not $hasHowToSchema) {
  Write-Output 'FAIL: Landing schema is missing HowTo graph node.'
  $ok = $false
}
if (-not $hasBreadcrumbSchema) {
  Write-Output 'FAIL: Landing schema is missing BreadcrumbList graph node.'
  $ok = $false
}
if (-not $hasCrumbTitle -or -not $hasCrumbCanonical) {
  Write-Output 'FAIL: Breadcrumb schema consistency check failed (missing page.title and canonical item url bindings).'
  $ok = $false
}

if ($ok) {
  Write-Output 'PASS: Public SEO guardrails passed (schema + sitemap coverage + freshness).'
  exit 0
}

Write-Output 'FAIL: Public SEO guardrails found issues.'
exit 4
