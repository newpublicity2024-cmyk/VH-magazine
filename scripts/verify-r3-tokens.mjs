/**
 * R3-G1 — only spec tokens compile, and the source rules hold (DESIGN-SPEC-R3 §3, §10).
 *
 * Part A reads the CSS the homepage ACTUALLY links (fetched from a fresh server, not
 * globbed from .next, which can hold stale chunks). Tailwind 4 emits a theme variable
 * only when something uses it, so every variable declared in a cleared namespace must
 * be a spec token — a stray `bg-red-500` or `rounded-lg` shows up here as an unknown
 * `--color-red-500` / `--radius-lg`, or (because the namespace is cleared) as a class
 * that compiles to nothing, which Part B catches in source.
 *
 * Part B scans the frontend TSX and styles.css. Every rule is first run against a
 * known-bad fixture (must fire) and a known-good fixture (must stay silent), so a rule
 * whose regex has rotted cannot pass the real source vacuously.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { assert, fail, ok, ROOT, withServer } from './lib/harness.mjs'

// ── Part A: shipped CSS ─────────────────────────────────────────────────────
const ALLOWED = {
  color: [
    'band', 'ink', 'ink-2', 'meta', 'ink-4', 'canvas', 'canvas-2', 'canvas-3', 'hairline',
    'night-2', 'night-ink', 'night-ink-2', 'accent', 'accent-600', 'accent-50', 'accent-on-dark', 'white',
  ],
  radius: ['panel', 'input', 'button'],
  shadow: ['1', '2', '3'],
  ease: ['standard', 'out-soft'],
  text: [],
  tracking: [],
  leading: [],
  blur: [],
  animate: [],
  'inset-shadow': [],
  'drop-shadow': [],
}
const REQUIRED_VALUES = {
  '--color-accent': '#166fc1',
  '--color-meta': '#757575',
  '--duration-press': '120ms',
  '--duration-hover': '200ms',
  '--duration-menu': '320ms',
  '--duration-sheet': '450ms',
  '--duration-zoom': '600ms',
  '--duration-image-fade': '300ms',
  '--ease-standard': 'cubic-bezier(.25,.1,.25,1)',
  '--ease-out-soft': 'cubic-bezier(.32,.72,0,1)',
}

const norm = (v) => {
  let s = v.trim().toLowerCase().replace(/\s+/g, '').replace(/(^|[^\d])0\.(\d)/g, '$1.$2')
  const m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)
  if (m) s = `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`
  // The minifier writes 120ms as .12s: compare times as milliseconds.
  const t = s.match(/^(\d*\.?\d+)(ms|s)$/)
  if (t) s = `${Math.round(Number(t[1]) * (t[2] === 's' ? 1000 : 1))}ms`
  return s
}

function themeFindings(css) {
  const found = []
  const decls = [...css.matchAll(/(--[a-z][a-z0-9-]*)\s*:\s*([^;}]*)/g)].map((m) => [m[1], m[2]])
  const namespaces = Object.keys(ALLOWED).sort((a, b) => b.length - a.length)
  for (const [name] of decls) {
    if (name.startsWith('--tw-')) continue
    for (const ns of namespaces) {
      const prefix = `--${ns}-`
      if (!name.startsWith(prefix)) continue
      const rest = name.slice(prefix.length)
      // --text-foo--line-height and friends belong to their base token.
      const base = rest.split('--')[0]
      if (!ALLOWED[ns].includes(base)) found.push(`off-spec theme variable ${name}`)
      break
    }
  }
  if (/vh-red|#e31e24/i.test(css)) found.push('a red token (vh-red / #e31e24) is still in the shipped CSS')
  return { found, decls: new Map(decls) }
}

// ── Part B: source rules ────────────────────────────────────────────────────
const stripComments = (code) =>
  code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** Candidate class tokens: anything between quotes/backticks/whitespace, variant prefix removed. */
function classTokens(code) {
  const out = []
  for (const raw of code.split(/[\s"'`{}(),;<>=]+/)) {
    if (!raw) continue
    let t = raw.replace(/^!/, '')
    // Drop variant prefixes (sm:, hover:, group-hover:, [&>p]:) — the last ':' outside brackets.
    let depth = 0
    let cut = -1
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] === '[') depth += 1
      else if (t[i] === ']') depth -= 1
      else if (t[i] === ':' && depth === 0) cut = i
    }
    if (cut >= 0) t = t.slice(cut + 1)
    out.push(t.replace(/^!/, ''))
  }
  return out
}

const SPACE_SCALE = new Set(['0', '1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24', 'auto'])
const SPACING = /^-?(gap-x|gap-y|space-x|space-y|gap|px|py|pt|pr|pb|pl|ps|pe|p|mx|my|mt|mr|mb|ml|ms|me|m)-(.+)$/

const TSX_RULES = {
  'raw hex colour': (code) => [...code.matchAll(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/g)].map((m) => m[0]),
  'red token': (code) => [...code.matchAll(/vh-red|#e31e24|\b(?:bg|text|border|ring|fill|stroke)-red-\d{2,3}\b/gi)].map((m) => m[0]),
  'uppercase utility (use a type-* role)': (code) => classTokens(code).filter((t) => t === 'uppercase'),
  'literal transition timing': (code) => [
    ...classTokens(code).filter((t) => /^(duration|delay)-/.test(t) || /^ease-(linear|in|out|in-out|\[)/.test(t)),
    ...[...code.matchAll(/\b\d+(?:\.\d+)?ms\b/g)].map((m) => m[0]),
  ],
  'off-scale spacing': (code) =>
    classTokens(code).filter((t) => {
      const m = t.match(SPACING)
      return m && !SPACE_SCALE.has(m[2])
    }),
  'default type utility (use a type-* role)': (code) =>
    classTokens(code).filter((t) => /^text-(xs|sm|base|lg|xl|[2-9]xl)$/.test(t) || /^text-\[\d/.test(t) || /^(tracking|leading)-/.test(t)),
  'off-spec radius or shadow': (code) =>
    classTokens(code).filter(
      (t) =>
        (/^rounded(-[a-z0-9]+)*(-\[.*\])?$/.test(t) && !/^rounded(-[setblr]{1,2})?-(full|none|panel|input|button)$/.test(t)) ||
        (/^shadow(-.+)?$/.test(t) && !/^shadow-(1|2|3|none)$/.test(t)),
    ),
}

function cssFindings(css) {
  const found = []
  const code = stripComments(css)
  if (/vh-red|#e31e24/i.test(code)) found.push('red token in styles.css')
  // Uppercase only inside the label roles.
  for (const m of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    const body = m[2]
    if (/text-transform\s*:\s*uppercase/.test(body)) {
      const sels = selector.split(',').map((s) => s.trim())
      if (!sels.every((s) => /^\.type-(band|label|nav|kicker|button|micro)$/.test(s))) {
        found.push(`uppercase outside a label role: "${selector}"`)
      }
    }
    // Time literals only in --duration-* / --stagger declarations (0s is not a duration).
    for (const decl of body.split(';')) {
      if (/^\s*--(duration|stagger)[\w-]*\s*:/.test(decl)) continue
      for (const t of decl.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)) {
        if (Number(t[1]) === 0) continue
        found.push(`literal time ${t[0]} in "${selector}" — use a --duration-* token`)
      }
    }
  }
  return found
}

// ── Self-test: every rule must fire on bad input and stay silent on good ──────
const BAD_TSX = {
  'raw hex colour': '<div className="text-[#ff0000]" />',
  'red token': '<b className="bg-vh-red text-red-500" />',
  'uppercase utility (use a type-* role)': '<b className="uppercase tracking-x" />',
  'literal transition timing': '<b className="transition duration-300 ease-in-out" style={{ transition: "opacity 300ms" }} />',
  'off-scale spacing': '<b className="mt-1.5 px-7 gap-[18px]" />',
  'default type utility (use a type-* role)': '<b className="text-sm leading-snug" />',
  'off-spec radius or shadow': '<b className="rounded-lg shadow-md" />',
}
const GOOD_TSX =
  '<a href="#main" className="type-label mt-4 px-6 gap-x-3 sm:py-2 rounded-panel rounded-full shadow-2 text-ink hover:text-accent" />'
for (const [name, rule] of Object.entries(TSX_RULES)) {
  assert(rule(BAD_TSX[name]).length > 0, `self-test: rule "${name}" did not fire on its bad fixture`)
  assert(rule(GOOD_TSX).length === 0, `self-test: rule "${name}" fired on the good fixture: ${rule(GOOD_TSX)}`)
}
assert(cssFindings('.card { text-transform: uppercase; transition: opacity 300ms; }').length === 2, 'self-test: CSS rules did not fire')
assert(cssFindings(':root { --duration-hover: 200ms; } .type-band { text-transform: uppercase; transition: opacity var(--duration-hover); }').length === 0, 'self-test: CSS rules fired on good CSS')
assert(themeFindings('--color-red-500: #f00; --radius-lg: 8px; --color-accent: #166fc1').found.length === 2, 'self-test: theme check did not flag off-spec variables')

// ── Run ──────────────────────────────────────────────────────────────────────
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx$/.test(entry)) out.push(p)
  }
  return out
}

const files = [...walk(path.join(ROOT, 'src', 'components')), ...walk(path.join(ROOT, 'src', 'app', '(frontend)'))]
assert(files.length > 25, `only ${files.length} TSX files found — wrong source root?`)

const findings = []
for (const file of files) {
  const code = stripComments(readFileSync(file, 'utf8'))
  for (const [name, rule] of Object.entries(TSX_RULES)) {
    const hits = rule(code)
    if (hits.length) findings.push(`${path.relative(ROOT, file)}: ${name}: ${[...new Set(hits)].slice(0, 6).join(' ')}`)
  }
}
const stylesPath = path.join(ROOT, 'src', 'app', '(frontend)', 'styles.css')
for (const f of cssFindings(readFileSync(stylesPath, 'utf8'))) findings.push(`styles.css: ${f}`)

const shipped = await withServer(async (baseUrl) => {
  const html = await (await fetch(`${baseUrl}/`)).text()
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1])
  assert(hrefs.length > 0, 'the homepage links no stylesheet')
  let css = ''
  for (const h of hrefs) css += await (await fetch(new URL(h, baseUrl))).text()
  return css
})
assert(/\.vh-container/.test(shipped), 'the linked CSS does not contain the frontend stylesheet (.vh-container)')

const { found: themeFound, decls } = themeFindings(shipped)
findings.push(...themeFound.map((f) => `shipped CSS: ${f}`))
for (const [name, value] of Object.entries(REQUIRED_VALUES)) {
  const got = decls.get(name)
  if (!got) findings.push(`shipped CSS: required token ${name} is not declared`)
  else if (norm(got) !== norm(value)) findings.push(`shipped CSS: ${name} is ${got.trim()}, spec says ${value}`)
}

if (findings.length) fail(`${findings.length} token/source-rule finding(s):\n  ${findings.join('\n  ')}`)
console.error(`  ${files.length} TSX files + styles.css clean; shipped CSS declares only spec tokens`)
ok('R3_TOKENS_OK')
