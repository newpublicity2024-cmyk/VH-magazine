/**
 * Seed content for VH Magazine.
 *
 * The titles and dates are the REAL ones from spec §5, not lorem ipsum, so the
 * layout is exercised against realistic French string lengths — accented
 * capitals, guillemets, long compound headlines that must clamp to two lines.
 *
 * Two entries are load-bearing beyond their content:
 *   - "Porsche, l'icône sous pression" must slugify to
 *     `porsche-licone-sous-pression` and sit under moteur/vh-moteur, reproducing
 *     the live URL /moteur/vh-moteur/porsche-licone-sous-pression/.
 *   - "FIFM – Jour 2 …" must slugify to
 *     `fifm-jour-2-les-maitres-du-cinema-se-confient` under video/vh-tv-people.
 * Both are 3-segment URLs, which is what gives gate G11's nested-case clause
 * something real to find.
 */

export type SeedCategory = {
  name: string
  slug: string
  parent?: string
  description?: string
}

export type SeedArticle = {
  title: string
  /** Category slug. */
  category: string
  /** DD/MM/YYYY as published on the live site. */
  date: string
  excerpt: string
  isVideo?: boolean
  videoUrl?: string
  /** Higher = more read; drives "Les plus lus". */
  views: number
  /** Force a slug where the live URL is known and must be reproduced exactly. */
  slug?: string
}

export const CATEGORIES: SeedCategory[] = [
  { name: 'Actu', slug: 'actualite-news-express-maroc', description: 'L’actualité en bref.' },
  { name: 'Lifestyle', slug: 'lifestyle-homme-maroc', description: 'Art de vivre au masculin.' },
  { name: 'Culture', slug: 'culture' },
  { name: 'Moteur', slug: 'moteur' },
  { name: 'VH Moteur', slug: 'vh-moteur', parent: 'moteur' },
  { name: 'Sport', slug: 'sport' },
  { name: 'Vidéos', slug: 'video' },
  { name: 'VH TV People', slug: 'vh-tv-people', parent: 'video' },
  { name: 'People', slug: 'people-celebrites' },
  { name: 'La Couv’', slug: 'la-couv' },
  { name: 'Vitoles & Volutes', slug: 'vitoles-volutes', parent: 'culture' },
  // The live site's Grand Angle tree (WP category 606) and its Société dossier
  // child — articles at /grand-angle/{slug}/ and /grand-angle/societe/{slug}/.
  {
    name: 'Grand Angle',
    slug: 'grand-angle',
    description: 'Enquêtes, dossiers et grands entretiens.',
  },
  { name: 'Société', slug: 'societe', parent: 'grand-angle' },
]

export const ARTICLES: SeedArticle[] = [
  // ── Actu (spec §5.1) ──
  {
    title: 'Le ballon de la « Main de Dieu » mis aux enchères à Londres',
    category: 'actualite-news-express-maroc',
    date: '22/08/2026',
    views: 4820,
    excerpt:
      'Le ballon du quart de finale Argentine-Angleterre de 1986 quitte les vitrines pour la salle des ventes.',
  },
  {
    title: 'Le Wydad perd l’un de ses présidents historiques',
    category: 'actualite-news-express-maroc',
    date: '22/08/2026',
    views: 3110,
    excerpt: 'Le club casablancais salue la mémoire d’un dirigeant qui aura marqué deux décennies.',
  },
  {
    title: 'Le Maroc brille parmi les finalistes du Prix du design de l’IMA 2026',
    category: 'actualite-news-express-maroc',
    date: '20/08/2026',
    views: 2740,
    excerpt:
      'Trois studios marocains figurent dans la sélection finale du prix décerné par l’Institut du monde arabe.',
  },
  {
    title: 'Starlink prêt à embarquer avec Royal Air Maroc ?',
    category: 'actualite-news-express-maroc',
    date: '20/08/2026',
    views: 5390,
    excerpt: 'La compagnie nationale étudie l’équipement de sa flotte en connectivité satellitaire.',
  },

  // ── Lifestyle (spec §5.2) ──
  {
    title: 'Royal Mansour Tamuda Bay, le nouveau refuge du Nord',
    category: 'lifestyle-homme-maroc',
    date: '19/08/2026',
    views: 3980,
    excerpt: 'Entre Méditerranée et Rif, une adresse qui redéfinit le luxe balnéaire marocain.',
  },
  {
    title: 'Charles Leclerc s’offre un yacht signé Riva',
    category: 'lifestyle-homme-maroc',
    date: '18/08/2026',
    views: 6120,
    excerpt: 'Le pilote Ferrari ajoute une pièce d’exception à son garage flottant.',
  },
  {
    title: 'Kimpton Marrakech, l’hôtel qui bouscule la médina',
    category: 'lifestyle-homme-maroc',
    date: '17/08/2026',
    views: 2260,
    excerpt: 'Design contemporain et artisanat local pour la première adresse Kimpton du royaume.',
  },
  {
    title: 'Four Seasons se lance dans la croisière de luxe',
    category: 'lifestyle-homme-maroc',
    date: '15/08/2026',
    views: 1890,
    excerpt: 'Le groupe hôtelier prend la mer avec un yacht de quatre-vingt-quinze suites.',
  },

  // ── Moteur (spec §5.3). The Porsche piece carries a known live URL. ──
  {
    title: 'Porsche, l’icône sous pression',
    slug: 'porsche-licone-sous-pression',
    category: 'vh-moteur',
    date: '21/08/2026',
    views: 7450,
    excerpt:
      'Entre électrification forcée et marché chinois en berne, Stuttgart traverse sa zone de turbulences.',
  },
  {
    title: 'Ford Territory, l’outsider qui vise le marché marocain',
    category: 'moteur',
    date: '19/08/2026',
    views: 2010,
    excerpt: 'Un SUV familial bien équipé et agressivement tarifé pour bousculer les références.',
  },
  {
    title: '40 millions de dollars pour une Ferrari électrique',
    category: 'moteur',
    date: '18/08/2026',
    views: 4630,
    excerpt: 'La première monoplace électrique de Maranello s’arrache aux enchères de Monterey.',
  },
  {
    title: 'Jaguar Type 01, le pari du renouveau',
    category: 'vh-moteur',
    date: '16/08/2026',
    views: 3320,
    excerpt: 'La marque britannique assume une rupture stylistique radicale pour sa renaissance.',
  },

  // ── Vidéos (spec §5.9). FIFM carries a known live URL. ──
  {
    title: 'Asif El Mal, quand le football rallume les rêves des enfants',
    category: 'video',
    date: '15/01/2026',
    views: 8900,
    isVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaa1',
    excerpt: 'Dans l’Atlas, un terrain de fortune devient le centre du village.',
  },
  {
    title: 'Virginie Efira parle cinéma, liberté et passion',
    category: 'vh-tv-people',
    date: '12/01/2026',
    views: 6700,
    isVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaa2',
    excerpt: 'Rencontre avec l’actrice, entre deux tournages, au Festival de Marrakech.',
  },
  {
    title: 'Carmen Maura, une vie de cinéma',
    category: 'vh-tv-people',
    date: '10/01/2026',
    views: 4400,
    isVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaa3',
    excerpt: 'L’égérie d’Almodóvar revient sur cinquante ans de carrière.',
  },
  {
    title: 'FIFM – Jour 2 : les maîtres du cinéma se confient',
    slug: 'fifm-jour-2-les-maitres-du-cinema-se-confient',
    category: 'vh-tv-people',
    date: '08/01/2026',
    views: 5150,
    isVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaa4',
    excerpt: 'Deuxième journée du Festival international du film de Marrakech.',
  },
  {
    title: '22e édition du Festival de Marrakech : le grand retour',
    category: 'video',
    date: '05/01/2026',
    views: 3600,
    isVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaa5',
    excerpt: 'Tapis rouge, hommages et découvertes pour cette nouvelle édition.',
  },
  {
    title: 'Rallye de la Marche Verte, l’aventure au féminin',
    category: 'video',
    date: '20/12/2025',
    views: 2980,
    isVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaa6',
    excerpt: 'Des équipages 100 % féminins traversent le Sud marocain.',
  },

  // ── People (spec §5.11) ──
  {
    title: 'Le Musée de la Mémoire de Casablanca ouvre ses portes',
    category: 'people-celebrites',
    date: '14/08/2026',
    views: 3050,
    excerpt: 'Un lieu de mémoire pour raconter un siècle d’histoire casablancaise.',
  },
  {
    title: 'Arsène Wenger en vedette du Challenge Leadership Show',
    category: 'people-celebrites',
    date: '13/08/2026',
    views: 4210,
    excerpt: 'L’ancien manager d’Arsenal partage sa vision du leadership à Casablanca.',
  },
  {
    title: '« Élévations Silencieuses » investit le Mandarin Oriental',
    category: 'people-celebrites',
    date: '12/08/2026',
    views: 1740,
    excerpt: 'Une exposition intimiste au cœur du palace marrakchi.',
  },
  {
    title: 'Mohamed Mourabiti, l’atelier comme territoire',
    category: 'people-celebrites',
    date: '11/08/2026',
    views: 1520,
    excerpt: 'Le peintre reçoit dans son atelier de Tahanaout, entre oliviers et toiles.',
  },
  {
    title: 'Mahi Binebine, peindre et écrire le Maroc',
    category: 'people-celebrites',
    date: '10/08/2026',
    views: 2670,
    excerpt: 'L’artiste et romancier revient sur quarante ans de création.',
  },

  // ── Chroniques cigare (spec §5.6) ──
  {
    title: 'La théorie du complot',
    category: 'vitoles-volutes',
    date: '09/08/2026',
    views: 980,
    excerpt: 'Chronique cigare : ce que révèle vraiment une bague de Havane.',
  },
  {
    title: 'Vitoles & Volutes : le Robusto, roi discret',
    category: 'vitoles-volutes',
    date: '02/08/2026',
    views: 860,
    excerpt: 'Format court, plaisir long : éloge du module le plus équilibré.',
  },
  {
    title: 'Vitoles & Volutes : l’art du Corona',
    category: 'vitoles-volutes',
    date: '26/07/2026',
    views: 740,
    excerpt: 'Le format que les torcedores gardent pour eux.',
  },
  {
    title: 'Vitoles & Volutes : accords et cigares',
    category: 'vitoles-volutes',
    date: '19/07/2026',
    views: 690,
    excerpt: 'Rhum, whisky ou café : ce qui fonctionne vraiment.',
  },
  {
    title: 'Vitoles & Volutes : conserver sans trahir',
    category: 'vitoles-volutes',
    date: '12/07/2026',
    views: 620,
    excerpt: 'Hygrométrie, cave et patience : le b.a.-ba de la conservation.',
  },

  // ── Sport & Culture: targets for the dossier strips and the collector banner ──
  {
    title: 'Un Maroc épatant, dans un mondial éclatant',
    slug: 'un-maroc-epatant-dans-un-mondial-eclatant',
    category: 'sport',
    date: '08/08/2026',
    views: 9400,
    excerpt:
      'Les Lions de l’Atlas ont transformé un tournoi en récit national. Retour sur une épopée.',
  },
  {
    title: 'Un collector à ne pas manquer',
    slug: 'collector-a-ne-pas-manquer',
    category: 'sport',
    date: '07/08/2026',
    views: 5600,
    excerpt: 'Le numéro anniversaire de VH, à conserver précieusement.',
  },
  {
    title: 'Ce que pensent les hommes…',
    slug: 'ce-que-pensent-les-hommes',
    // Spec §5.12 calls it "the Grand Angle psy article"; the live site files it there.
    category: 'grand-angle',
    date: '06/08/2026',
    views: 7100,
    excerpt:
      'Amour, désir, silence : enquête sur ce que les hommes disent — et taisent — de leurs sentiments.',
  },
  // ── Grand Angle / Société: live titles, slugs and dates, so the hub at
  // /vh-grand-angle-2/ has a nested (3-segment) article to list. Old dates and
  // low views keep them out of the homepage's latest and most-read widgets.
  {
    title: 'Passion et travail, mythe ou réalité ?',
    slug: 'passion-et-travail-mythe-ou-realite',
    category: 'societe',
    date: '26/04/2021',
    views: 640,
    excerpt: 'Trouver le job de ses rêves ou vivre de sa passion : promesse tenable ou mythe moderne ?',
  },
  {
    title: 'Relais Prison–Sociétés : le plaidoyer de Walid Cherqaoui',
    slug: 'relais-prison-societes-le-plaidoyer-de-walid-cherqaoui',
    category: 'societe',
    date: '23/12/2020',
    views: 410,
    excerpt: 'L’association Relais Prison-Sociétés œuvre chaque jour à la réinsertion des détenus.',
  },
  {
    title: 'Who’s Who, les interviews de VH',
    slug: 'who-s-who-les-interviews-de-vh',
    category: 'culture',
    date: '05/08/2026',
    views: 4100,
    excerpt: 'Le rendez-vous des portraits qui comptent.',
  },
  {
    title: 'Le Luxe, saison des maisons',
    slug: 'le-luxe',
    category: 'culture',
    date: '04/08/2026',
    views: 2300,
    excerpt: 'Horlogerie, joaillerie, maroquinerie : la sélection VH.',
  },
]

export type SeedIssue = {
  number: number
  title: string
  date: string
  summary: string
}

/** spec §5.13 — "Toutes nos unes". */
export const ISSUES: SeedIssue[] = [
  {
    number: 201,
    title: 'VH N°201 — Collector Marche Verte',
    date: '01/08/2026',
    summary: 'Numéro collector consacré au cinquantenaire de la Marche Verte.',
  },
  {
    number: 200,
    title: 'VH N°200 — Le numéro anniversaire',
    date: '01/07/2026',
    summary: 'Deux cents numéros d’art de vivre au masculin.',
  },
  {
    number: 199,
    title: 'VH N°199 — Salon du Cheval',
    date: '01/06/2026',
    summary: 'El Jadida, la passion équestre marocaine.',
  },
  {
    number: 198,
    title: 'VH N°198 — Le goût de l’été',
    date: '01/05/2026',
    summary: 'Escales, moteurs et tables de saison.',
  },
]

export type SeedBanner = {
  key: string
  title: string
  linkUrl: string
  body?: string
}

/** spec §5 — every promo slot, keyed so nothing is hardcoded in page.tsx. */
export const BANNERS: SeedBanner[] = [
  { key: 'collector', title: 'Numéro collector', linkUrl: '/sport/collector-a-ne-pas-manquer/' },
  {
    key: 'podcast',
    title: 'The Shift Podcast',
    linkUrl: 'https://www.youtube.com/@VHMagazine',
  },
  {
    key: 'whos-who',
    title: 'Who’s Who — les interviews de VH',
    linkUrl: '/culture/who-s-who-les-interviews-de-vh/',
  },
  {
    key: 'collector-sport',
    title: 'Un collector à ne pas manquer !',
    linkUrl: '/sport/collector-a-ne-pas-manquer/',
  },
  {
    key: 'cool-drives',
    title: 'Cool Drives By Rafik Lahlou',
    linkUrl: 'https://www.instagram.com/cooldrives/',
    body:
      'Rafik Lahlou, grand passionné de l’automobile, lanceur de projets et d’idées, fondateur de VH et de RM Automobiles, co-fondateur de MajicCasa.',
  },
  { key: 'le-luxe', title: 'Le Luxe', linkUrl: '/culture/le-luxe/' },
  { key: 'unes', title: 'Toutes les unes de VH', linkUrl: '/magazine-maroc/' },
]

/** spec §5.12 — the two stacked dossier strips. */
export const DOSSIERS = [
  {
    title: 'Un Maroc épatant, dans un mondial éclatant',
    body:
      'Des tribunes de Doha aux cafés de Casablanca, les Lions de l’Atlas ont fait basculer un pays dans une même émotion. Retour sur une campagne qui a dépassé le terrain.',
    linkUrl: '/sport/un-maroc-epatant-dans-un-mondial-eclatant/',
    linkLabel: 'Retrouvez ici l’intégralité du dossier',
  },
  {
    title: 'Ce que pensent les hommes…',
    body:
      'Ils parlent peu de sentiments, beaucoup de silence. Psychologues et lecteurs racontent ce qui se joue vraiment derrière la pudeur masculine.',
    linkUrl: '/grand-angle/ce-que-pensent-les-hommes/',
    linkLabel: 'Retrouvez ici l’intégralité du dossier',
  },
]
