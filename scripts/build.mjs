// Regenerates the shared <head> boilerplate, <header>, and <footer> markup
// across every page from the single template below, so a font/favicon/nav/
// footer edit only has to happen here instead of being hand-copied into
// every page (that copy-paste is what produced the paddle-quiz.html
// aria-current bug fixed alongside this script — see audit/html-duplication.md).
//
// Per-page content (title, description, canonical, OG/Twitter overrides,
// extra <head> links, body content, footer overrides, script tags) is left
// exactly where it already lives — inside each page's own HTML file — and
// is extracted from that file at build time, so editing a page's content is
// unchanged from today: edit the file directly. Only the boilerplate
// surrounding it is generated.
//
// Requires Node 18+. No npm install needed (same as fetch-google-ratings.mjs).
//
// Usage:
//   node scripts/build.mjs           regenerate all pages in place
//   node scripts/build.mjs --check   dry run; exits 1 if any page would change

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ROOT_PAGES = [
  'index.html', 'about.html', 'corrections.html', 'directory.html',
  'learn.html', 'map.html', 'paddles.html',
  'privacy.html', 'rankings.html', 'affiliate-disclosure.html', '404.html',
];
const CITY_PAGES = fs.readdirSync(path.join(ROOT, 'cities'))
  .filter((f) => f.endsWith('.html'))
  .sort()
  .map((f) => path.join('cities', f));

// Phase 1 is the integrator's branch (merged last), so it declares pages that
// sibling phases create — paddles.html (Phase 5) and, at Integration,
// affiliate-disclosure.html (Phase 7). Until those branches land, the files
// won't exist yet; skip (with a warning) any declared page that's missing on
// disk instead of crashing the build. The authoritative full run happens at
// Integration once every branch is merged and every declared page exists.
const DECLARED_FILES = [...ROOT_PAGES, ...CITY_PAGES];
const FILES = DECLARED_FILES.filter((relPath) => {
  const exists = fs.existsSync(path.join(ROOT, relPath));
  if (!exists) console.warn(`skipping (not yet on disk): ${relPath}`);
  return exists;
});

const HEAD_BOILERPLATE = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="icon" href="/assets/logo/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/logo/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/logo/favicon-16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="/assets/logo/apple-touch-icon-180.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<meta name="theme-color" content="#ffffff">`;

// Confirmed nav shape (plan §6, locked 2026-07-12): Find courts · Cities ·
// Directory · Rankings · Paddles & Gear · More(Learn, Corrections) · About.
// The brand logo is the way Home; "Find courts" is /map renamed; "Gear &
// rentals" + "Find your paddle" fold into the single /paddles hub (Phase 5).
const NAV_ITEMS = [
  { href: '/map', label: 'Find courts' },
  { href: '/cities/', label: 'Cities' },
  { href: '/directory', label: 'Directory' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/paddles', label: 'Paddles &amp; Gear' },
];
const DROPDOWN_ITEMS = [
  { href: '/learn', label: 'Learn to play' },
  { href: '/corrections', label: 'Report a correction' },
];

// Which nav item is "current" is derived from the file path, not read back
// out of the page — that's what keeps this from ever regressing into the
// paddle-quiz.html bug (one page's aria-current silently drifting from its
// siblings).
function activeHrefFor(relPath) {
  if (relPath === 'index.html') return '/';
  if (relPath === '404.html' || relPath === 'privacy.html') return null;
  if (relPath.startsWith('cities' + path.sep)) return '/cities/';
  return '/' + relPath.replace(/\.html$/, '');
}

function renderHead(data) {
  const { title, description, socialTitle, socialDescription, canonical, noIndex, extraHeadBefore, extraHeadAfter } = data;
  const lines = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
  ];
  if (noIndex) lines.push('<meta name="robots" content="noindex">');
  lines.push(HEAD_BOILERPLATE);
  if (!noIndex) {
    lines.push(
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Pickleball Bay Area">',
      `<meta property="og:title" content="${socialTitle}">`,
      `<meta property="og:description" content="${socialDescription}">`,
      `<meta property="og:url" content="${canonical}">`,
      '<meta name="twitter:card" content="summary">',
      `<meta name="twitter:title" content="${socialTitle}">`,
      `<meta name="twitter:description" content="${socialDescription}">`,
      `<link rel="canonical" href="${canonical}">`,
    );
  }
  if (extraHeadBefore) lines.push(extraHeadBefore);
  lines.push('<link rel="stylesheet" href="/assets/style.css">');
  if (extraHeadAfter) lines.push(extraHeadAfter);
  lines.push('</head>');
  return lines.join('\n');
}

function renderHeader(activeHref) {
  const navLines = NAV_ITEMS.map(({ href, label }) =>
    `      <a href="${href}"${href === activeHref ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('\n');
  const dropdownActive = DROPDOWN_ITEMS.some(({ href }) => href === activeHref);
  const dropdownLines = DROPDOWN_ITEMS.map(({ href, label }) =>
    `          <a href="${href}"${href === activeHref ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('\n');
  const aboutActive = activeHref === '/about' ? ' aria-current="page"' : '';

  return `<header class="site-header">
  <div class="container">
    <a class="brand" href="/"><img src="/assets/logo/mark.svg" width="28" height="28" alt="Pickleball Bay Area">Pickleball Bay Area</a>
    <nav class="main-nav">
${navLines}
      <details class="nav-dropdown">
        <summary${dropdownActive ? ' aria-current="page"' : ''}>More</summary>
        <div class="nav-dropdown-menu">
${dropdownLines}
        </div>
      </details>
      <a href="/about"${aboutActive}>About</a>
    </nav>
  </div>
</header>`;
}

function renderFooter({ popularLines, footerNote }) {
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <h4>Regions</h4>
        <ul>
          <li><a href="/cities/#san-francisco">San Francisco</a></li>
          <li><a href="/cities/#peninsula">Peninsula</a></li>
          <li><a href="/cities/#south-bay">South Bay</a></li>
          <li><a href="/cities/#east-bay">East Bay</a></li>
          <li><a href="/cities/#north-bay">North Bay</a></li>
        </ul>
      </div>
      <div>
        <h4>Site</h4>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/cities/">All cities</a></li>
          <li><a href="/about">About this guide</a></li>
          <li><a href="/map">Find courts</a></li>
          <li><a href="/rankings">Rankings</a></li>
          <li><a href="/learn">Learn to play</a></li>
          <li><a href="/paddles">Paddles &amp; Gear</a></li>
          <li><a href="/corrections">Report a correction</a></li>
          <li><a href="/privacy">Privacy Policy</a></li>
        </ul>
      </div>
      <div>
        <h4>Popular</h4>
        <ul>
${popularLines}
        </ul>
      </div>
    </div>
    <div class="footer-note">
      <span>Independent court data — no ads, no pay-to-list, no sponsored listings. Some paddle &amp; gear links are <a href="/affiliate-disclosure">affiliate links</a>.</span>
      <span>${footerNote}</span>
    </div>
  </div>
</footer>`;
}

function extractField(raw, re, file, label, required) {
  const m = raw.match(re);
  if (!m) {
    if (required) throw new Error(`could not find ${label}`);
    return null;
  }
  return m[1];
}

export function extractPage(relPath, raw) {
  const noIndex = /<meta name="robots" content="noindex">/.test(raw);

  const title = extractField(raw, /<title>([\s\S]*?)<\/title>/, relPath, 'title', true);
  const description = extractField(raw, /<meta name="description" content="([\s\S]*?)">/, relPath, 'description', true);
  const socialTitle = extractField(raw, /<meta property="og:title" content="([\s\S]*?)">/, relPath, 'og:title', !noIndex);
  const socialDescription = extractField(raw, /<meta property="og:description" content="([\s\S]*?)">/, relPath, 'og:description', !noIndex);
  const canonical = extractField(raw, /<link rel="canonical" href="([\s\S]*?)">/, relPath, 'canonical', !noIndex);

  const styleLine = '<link rel="stylesheet" href="/assets/style.css">\n';
  const styleIdx = raw.indexOf(styleLine);
  if (styleIdx === -1) throw new Error('could not find style.css link');
  const headEndIdx = raw.indexOf('\n</head>\n', styleIdx);
  if (headEndIdx === -1) throw new Error('could not find </head>');
  const extraHeadAfter = raw.slice(styleIdx + styleLine.length, headEndIdx + 1).replace(/\n$/, '');

  // Extra <head> links can also appear BEFORE style.css (map.html loads
  // Leaflet's CSS ahead of it) — capture that slot too, bounded by the end
  // of the canonical link (or the theme-color meta on noIndex pages, which
  // have no canonical) and the start of the style.css line.
  let preStyleBoundaryEnd;
  if (noIndex) {
    const themeColorLine = '<meta name="theme-color" content="#ffffff">\n';
    const idx = raw.indexOf(themeColorLine);
    if (idx === -1) throw new Error('could not find theme-color meta');
    preStyleBoundaryEnd = idx + themeColorLine.length;
  } else {
    const canonicalLineMatch = raw.match(/<link rel="canonical" href="[\s\S]*?">\n/);
    if (!canonicalLineMatch) throw new Error('could not find canonical link line');
    preStyleBoundaryEnd = canonicalLineMatch.index + canonicalLineMatch[0].length;
  }
  const extraHeadBefore = raw.slice(preStyleBoundaryEnd, styleIdx).replace(/\n$/, '');

  const headerCloseMarker = '</header>\n\n';
  const headerCloseIdx = raw.indexOf(headerCloseMarker);
  if (headerCloseIdx === -1) throw new Error('could not find </header> boundary');
  const bodyStart = headerCloseIdx + headerCloseMarker.length;

  const footerOpenMarker = '\n\n<footer class="site-footer">';
  const footerOpenIdx = raw.indexOf(footerOpenMarker, bodyStart);
  if (footerOpenIdx === -1) throw new Error('could not find <footer> boundary');
  const bodyContent = raw.slice(bodyStart, footerOpenIdx);

  const footerCloseMarker = '</footer>\n\n';
  const footerCloseIdx = raw.indexOf(footerCloseMarker, footerOpenIdx);
  if (footerCloseIdx === -1) throw new Error('could not find </footer> boundary');
  const scriptsStart = footerCloseIdx + footerCloseMarker.length;

  const bodyCloseMarker = '\n</body>\n</html>\n';
  if (!raw.endsWith(bodyCloseMarker)) throw new Error('unexpected file ending (expected </body>\\n</html>\\n)');
  const scriptsBlock = raw.slice(scriptsStart, raw.length - bodyCloseMarker.length);

  const popularMatch = raw.match(/<h4>Popular<\/h4>\n {8}<ul>\n([\s\S]*?)\n {8}<\/ul>/);
  if (!popularMatch) throw new Error('could not find Popular list');
  const popularLines = popularMatch[1];

  // The first span is the generated trust/affiliate tagline (owned by
  // renderFooter); match it loosely so this stays idempotent when the tagline
  // wording changes (Phase 1 rewrote it for affiliate honesty — plan §3.6).
  // Only the second span (the per-page footer note) is extracted.
  const noteMatch = raw.match(
    /<div class="footer-note">\n {6}<span>[\s\S]*?<\/span>\n {6}<span>([\s\S]*?)<\/span>/
  );
  if (!noteMatch) throw new Error('could not find footer note');
  const footerNote = noteMatch[1];

  return {
    title, description, socialTitle, socialDescription, canonical, noIndex,
    extraHeadBefore, extraHeadAfter, bodyContent, scriptsBlock, popularLines, footerNote,
  };
}

export function assemblePage(relPath, data) {
  const head = renderHead(data);
  const header = renderHeader(activeHrefFor(relPath));
  const footer = renderFooter(data);
  return `${head}\n<body>\n\n${header}\n\n${data.bodyContent}\n\n${footer}\n\n${data.scriptsBlock}\n</body>\n</html>\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  let changed = 0;
  let errors = 0;

  for (const relPath of FILES) {
    const abs = path.join(ROOT, relPath);
    const raw = fs.readFileSync(abs, 'utf-8');
    let data;
    try {
      data = extractPage(relPath, raw);
    } catch (err) {
      console.error(`ERROR extracting ${relPath}: ${err.message}`);
      errors++;
      continue;
    }
    const rebuilt = assemblePage(relPath, data);
    if (rebuilt !== raw) {
      changed++;
      console.log(`${checkOnly ? 'would change' : 'updated'}: ${relPath}`);
      if (!checkOnly) fs.writeFileSync(abs, rebuilt, 'utf-8');
    }
  }

  if (errors > 0) {
    console.error(`\n${errors} file(s) failed extraction — nothing written for those.`);
    process.exit(1);
  }
  console.log(`\n${changed} of ${FILES.length} file(s) ${checkOnly ? 'would change' : 'changed'}.`);
  if (checkOnly && changed > 0) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
