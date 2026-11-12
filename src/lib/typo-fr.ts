/**
 * French typographic spacing — ported verbatim from Challenge (challenge.ma src/lib/typo-fr.ts)
 * for DESIGN-SPEC-R3 §3.2. Applied at render time to titles, excerpts and rich-text text
 * nodes; never to URLs or times. Gate R3-G15 runs it over every migrated title (idempotent,
 * no space left beside a narrow no-break space) before trusting it on real content.
 *
 * French typographic spacing (spec §2.2), applied at render time to titles, excerpts and
 * rich-text text nodes:
 *
 * - a narrow no-break space (U+202F) before `; : ! ?` and inside `« »`;
 * - a no-break space between a number and its unit: U+00A0 before word units (`690 DH`,
 *   `470,1 MMDH`) and U+202F before `%` and `‰` (`8,6 %`), which is also what Intl emits;
 * - a narrow no-break space as the thousands separator (`12 319`) and after `N°`.
 *
 * URLs, e-mail addresses and times (`12:24`) are never touched. The function is idempotent:
 * running it on its own output changes nothing.
 */

const NNBSP = ' '
const NBSP = ' '

/** Any space the rules may replace: regular, no-break, thin and narrow no-break. */
const SP = '[ \\u00A0\\u2009\\u202F]'

// Segments the rules must leave alone. URL matches stop before trailing punctuation.
const PROTECTED =
  /(?:https?:\/\/|www\.)[^\s<>"«»]*[^\s<>"«».,;:!?)]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b\d{1,2}:\d{2}(?::\d{2})?\b/g

// Word units, longest first. A unit must end the word: `(?![\p{L}\p{N}'’])`.
const WORD_UNITS = [
  'MMDHS',
  'MMDH',
  'MDHS',
  'MDH',
  'DHS',
  'Dhs',
  'DH',
  'Dh',
  'MAD',
  'dirhams',
  'milliards',
  'milliard',
  'millions',
  'million',
  'Mrds',
  'Mrd',
  'Mds',
  'Md',
  'M€',
  '€',
  '$',
  'USD',
  'EUR',
  'km²',
  'km',
  'm²',
  'm³',
  'kg',
  'kWh',
  'MWh',
  'GWh',
  'kW',
  'MW',
  'GW',
  'ha',
  '°C',
  'points',
  'pts',
  'min',
  'px',
  'h',
  'm',
  't',
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const WORD_UNIT_RULE = new RegExp(
  `(\\d)${SP}+(${WORD_UNITS.map(escape).join('|')})(?![\\p{L}\\p{N}'’])`,
  'gu',
)

const RULES: [RegExp, string][] = [
  // Existing space(s) before ; : ! ? become one narrow no-break space.
  [new RegExp(`${SP}+([;:!?])`, 'g'), `${NNBSP}$1`],
  // Missing space before ; ! ? after a word, closing quote or bracket, when the mark ends
  // the clause (so `?!` gets one space, and `a?b` is left alone).
  [/([\p{L}\p{N}»)\]%…])([;!?])(?=[\s»)\]"'’.,;:!?…]|$)/gu, `$1${NNBSP}$2`],
  // Missing space before `:` only when a space or the end follows it ("PLF 2027: …"), so
  // times, scores and ratios (`12:24`, `3:1`) stay as they are.
  [/([\p{L}\p{N}»)\]])(:)(?=\s|$)/gu, `$1${NNBSP}$2`],
  // Guillemets.
  [new RegExp(`«${SP}*`, 'g'), `«${NNBSP}`],
  [new RegExp(`${SP}*»`, 'g'), `${NNBSP}»`],
  // Percent and per mille: narrow no-break space, inserted when missing.
  [new RegExp(`(\\d)${SP}?([%‰])`, 'g'), `$1${NNBSP}$2`],
  // Word units: an existing space becomes a no-break space (never inserted: `4G`, `A320`).
  [WORD_UNIT_RULE, `$1${NBSP}$2`],
  // Thousands separator between digit groups.
  [new RegExp(`(?<=\\d)[ \\u00A0](?=\\d{3}(?!\\d))`, 'g'), NNBSP],
  // N° 1032
  [new RegExp(`(N°|n°)${SP}`, 'g'), `$1${NBSP}`],
]

function applyRules(text: string): string {
  let out = text
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement)
  return out
}

export function typoFr(text: string): string {
  if (!text) return text
  let result = ''
  let last = 0
  for (const match of text.matchAll(PROTECTED)) {
    const start = match.index ?? 0
    result += applyRules(text.slice(last, start)) + match[0]
    last = start + match[0].length
  }
  return result + applyRules(text.slice(last))
}
