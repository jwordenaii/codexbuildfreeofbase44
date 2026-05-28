$ErrorActionPreference = 'Stop'

Write-Output '=== Repo Preflight ==='

$root = git rev-parse --show-toplevel
$remote = git remote get-url origin
$branch = git branch --show-current
$localHead = git rev-parse HEAD
$originHead = git rev-parse origin/main
$status = git status --short

Write-Output "Root: $root"
Write-Output "Remote: $remote"
Write-Output "Branch: $branch"
Write-Output "Local HEAD: $localHead"
Write-Output "Origin/main HEAD: $originHead"

if ([string]::IsNullOrWhiteSpace($status)) {
  Write-Output 'Working tree: clean'
} else {
  Write-Output 'Working tree: dirty'
  Write-Output $status
}

$ok = $true
# Expected origin can be overridden via $Env:EXPECTED_GIT_REMOTE so the repo is
# portable to GitLab / Codeberg / self-hosted Forgejo without code changes.
$expectedRemote = if ($Env:EXPECTED_GIT_REMOTE) { $Env:EXPECTED_GIT_REMOTE } else { 'https://github.com/jwordenaii/codexbuildfreeofbase44.git' }
if ($remote -ne $expectedRemote) {
  Write-Output "FAIL: Unexpected origin remote. Expected: $expectedRemote"
  $ok = $false
}
# Expected primary branch can be overridden via $Env:EXPECTED_GIT_BRANCH (defaults to main).
$expectedBranch = if ($Env:EXPECTED_GIT_BRANCH) { $Env:EXPECTED_GIT_BRANCH } else { 'main' }
if ($branch -ne $expectedBranch) {
  Write-Output "FAIL: You are not on $expectedBranch."
  $ok = $false
}
if ($localHead -ne $originHead) {
  Write-Output 'WARN: Local HEAD does not match origin/main.'
}

if ($ok) {
  Write-Output 'PASS: Repo identity is correct for this project.'
} else {
  Write-Output 'FAIL: Fix repo/branch before making edits or deploy changes.'
  exit 2
}

Write-Output ''
Write-Output '=== Logic Coverage Preflight ==='

$stateJsPath = 'src/lib/states50.js'
$statePyPath = 'app/services/state_data.py'
$stateCompliancePath = 'app/services/ai_brain.py'
$contractLawPath = 'src/data/legal/contractLaw.js'
$utilitiesPath = 'src/data/legal/utilitiesOneCall.js'
$takeoffPath = 'app/routers/takeoff.py'
$quotePath = 'src/pages/Quote.jsx'
$kbPath = 'app/services/knowledge_base.py'
$landingPagesPath = 'src/lib/landingPages.js'
$sitemapPath = 'public/sitemap.xml'

$stateJs = Get-Content $stateJsPath -Raw
$statePy = Get-Content $statePyPath -Raw
$stateCompliance = Get-Content $stateCompliancePath -Raw
$contractLaw = Get-Content $contractLawPath -Raw
$utilities = Get-Content $utilitiesPath -Raw
$takeoff = Get-Content $takeoffPath -Raw
$quote = Get-Content $quotePath -Raw
$kb = Get-Content $kbPath -Raw
$landingPages = Get-Content $landingPagesPath -Raw
$sitemap = Get-Content $sitemapPath -Raw

$jsRows = ([regex]::Matches($stateJs, "abbr:'[A-Z]{2}'")).Count
$pyRows = ([regex]::Matches($statePy, '^\s*\("[A-Z]{2}",', [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count
$complianceRows = ([regex]::Matches($stateCompliance, '"[A-Z]{2}"\s*:\s*\(')).Count
$contractRows = ([regex]::Matches($contractLaw, 'abbr:\s*''[A-Z]{2}''')).Count
$utilitiesRows = ([regex]::Matches($utilities, 'abbr:\s*''[A-Z]{2}''')).Count

Write-Output "states50.js rows: $jsRows"
Write-Output "state_data.py rows: $pyRows"
Write-Output "SupremeCourtAI compliance rows: $complianceRows"
Write-Output "contractLaw.js rows: $contractRows"
Write-Output "utilitiesOneCall.js rows: $utilitiesRows"

if ($jsRows -ne 51) {
  Write-Output 'FAIL: states50.js does not contain 51 jurisdictions (50 + DC).'
  $ok = $false
}
if ($pyRows -ne 51) {
  Write-Output 'FAIL: state_data.py does not contain 51 jurisdictions (50 + DC).'
  $ok = $false
}
if ($complianceRows -ne 51) {
  Write-Output 'FAIL: SupremeCourtAI _STATE_COMPLIANCE does not contain 51 jurisdictions (50 + DC).'
  $ok = $false
}
if ($contractRows -ne 51) {
  Write-Output 'FAIL: contractLaw.js does not contain 51 jurisdictions (50 + DC).'
  $ok = $false
}
if ($utilitiesRows -ne 51) {
  Write-Output 'FAIL: utilitiesOneCall.js does not contain 51 jurisdictions (50 + DC).'
  $ok = $false
}

# Spot-check cross-table parity for known drift-prone records.
$alJsLine = (Select-String -Path $stateJsPath -Pattern "abbr:'AL'" | Select-Object -First 1).Line
$alPyLine = (Select-String -Path $statePyPath -Pattern '^\s*\("AL",' | Select-Object -First 1).Line

$alJsMaterial = [regex]::Match($alJsLine, 'materialPremium:(?<v>[0-9.]+)').Groups['v'].Value
$alPyMaterial = [regex]::Match($alPyLine, '0\.82,(?<v>[0-9.]+),9').Groups['v'].Value

if ($alJsMaterial -and $alPyMaterial) {
  if ($alJsMaterial -ne $alPyMaterial) {
    Write-Output "FAIL: Alabama materialPremium mismatch (JS=$alJsMaterial PY=$alPyMaterial)."
    $ok = $false
  }
}

# GC / Civil / Whole-construction coverage checks.
$hasPremiumCivilStack = $takeoff -match '/premium-civil-stack'
$hasCivilSiteWorkInQuote = $quote -match 'civil_site_work'
$hasGcKnowledge = $kb -match 'GENERAL CONTRACTING \(GC\) KNOWLEDGE'
$hasProcessPhases = $kb -match 'GC PROCESS:' -and $kb -match 'Close-Out:'

if (-not $hasPremiumCivilStack) {
  Write-Output 'FAIL: premium civil stack endpoint missing from takeoff router.'
  $ok = $false
}
if (-not $hasCivilSiteWorkInQuote) {
  Write-Output 'FAIL: civil_site_work option missing from quote flow.'
  $ok = $false
}
if (-not $hasGcKnowledge) {
  Write-Output 'FAIL: GC knowledge base block missing.'
  $ok = $false
}
if (-not $hasProcessPhases) {
  Write-Output 'FAIL: GC process lifecycle coverage appears incomplete in knowledge base.'
  $ok = $false
}

if ($ok) {
  Write-Output 'PASS: 50-state + GC/civil/whole-construction logic checks passed.'
} else {
  Write-Output 'FAIL: Logic preflight found coverage or parity gaps.'
  exit 3
}

Write-Output ''
Write-Output '=== Public SEO Guardrails ==='

if ($env:SEO_AUTO_HEAL -eq '1') {
  Write-Output 'SEO_AUTO_HEAL=1 detected — running sitemap self-heal first.'
  powershell -ExecutionPolicy Bypass -File scripts/seo-self-heal.ps1 -UpdateCoreRoutes
  $landingPages = Get-Content $landingPagesPath -Raw
  $sitemap = Get-Content $sitemapPath -Raw
}

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

$maxAgeDays = 45
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
    if ($age -gt $maxAgeDays) {
      $staleEntries += "$url ($([math]::Round($age, 1)) days old)"
    }
  } catch {
    $staleEntries += "$url (invalid <lastmod>: $lastmod)"
  }
}

if ($staleEntries.Count -gt 0) {
  Write-Output "FAIL: Sitemap freshness guard failed for landing pages (> $maxAgeDays days):"
  $staleEntries | ForEach-Object { Write-Output "  - $_" }
  $ok = $false
}

$hasFaqSchema = $landingPages -match "'@type': 'FAQPage'"
$hasHowToSchema = $landingPages -match "'@type': 'HowTo'"
$hasBreadcrumbSchema = $landingPages -match "'@type': 'BreadcrumbList'"
$hasCrumbTitle = $landingPages -match "name: page.title"
$hasCrumbCanonical = $landingPages -match "item: url"

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
} else {
  Write-Output 'FAIL: Public SEO guardrails found issues.'
  exit 4
}
