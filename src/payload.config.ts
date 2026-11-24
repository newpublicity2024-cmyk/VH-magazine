import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { fr } from '@payloadcms/translations/languages/fr'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Articles } from './collections/Articles'
import { Banners } from './collections/Banners'
import { Categories } from './collections/Categories'
import { ContactMessages } from './collections/ContactMessages'
import { MagazineIssues } from './collections/MagazineIssues'
import { Media } from './collections/Media'
import { NewsletterSubscribers } from './collections/NewsletterSubscribers'
import { Redirects } from './collections/Redirects'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { Homepage } from './globals/Homepage'
import { SiteSettings } from './globals/SiteSettings'
import { articleFeatures } from './lib/editor-config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Neon requires SSL, and `pg-connection-string` warns that sslmode=require|prefer|
 * verify-ca are aliased to `verify-full` with different semantics coming in pg v9.
 * Make it explicit: same behaviour today, no deprecation noise, future-proof.
 * Only the sslmode value is rewritten, so credentials in the URI are untouched.
 * Local Homebrew Postgres has no sslmode parameter, so this is a no-op in dev.
 */
const explicitSslMode = (uri: string): string =>
  uri.replace(/([?&]sslmode=)(?:require|prefer|verify-ca)(?=&|$)/i, '$1verify-full')

/**
 * Media storage. Local disk in dev (./media); Vercel Blob once the token is set.
 * The DB only ever holds the reference.
 */
const blobEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

const storagePlugins = blobEnabled
  ? [
      vercelBlobStorage({
        collections: {
          media: {
            // Hand out the public Blob URL, not Payload's proxy path /api/media/file/<name>
            // (LAUNCH.md step 5, gate GATES-LAUNCH L6). Through the proxy every image the
            // optimizer missed, every og:image fetch and every byte of the 229 migrated videos
            // and audio files (2.5 GB, up to 81 MB each) ran through a Vercel Function that
            // also called Blob head() first. Media read access is `anyone` already, so the
            // proxy's access check protected nothing; Blob serves byte ranges itself. With
            // this on, Payload no longer serves /api/media/file/* (except to finish a client
            // upload), so nothing may build that path while the adapter is on (media-url.ts).
            disablePayloadAccessControl: true,
          },
        },
        token: process.env.BLOB_READ_WRITE_TOKEN as string,
        // Browser uploads straight to Blob. Without this the file rides inside
        // the POST to /api/media and Vercel kills any body over 4.5 MB at the
        // edge — a normal phone photo — leaving the admin stuck on "loading".
        clientUploads: true,
      }),
    ]
  : []

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: ' — VH Magazine',
    },
    /**
     * Light only. The back-office theme (src/backoffice/styles/admin.scss) defines one palette;
     * letting Payload switch to dark would mix its dark tokens into ours — on the sister site
     * that put form text at 1.19:1 contrast. Pinning also removes the theme selector, so no
     * stored preference can bring the mix back.
     */
    theme: 'light',
    dateFormat: 'dd/MM/yyyy HH:mm',
    components: {
      graphics: {
        Logo: '/backoffice/graphics#Logo',
        Icon: '/backoffice/graphics#Icon',
      },
    },
    /**
     * The landing page, by role (GATES-BACKOFFICE.md). Payload 3.85's modular dashboard: each
     * widget is a server component in src/backoffice/dashboard, and `defaultLayout` decides
     * who sees what first. A journalist gets their own work and the way to publish it; an
     * editor or admin gets the review queue, the newsroom's numbers and a door to every part of
     * the site. Anyone can still rearrange their own dashboard from its menu.
     */
    dashboard: {
      widgets: [
        { slug: 'vh-welcome', label: 'Bienvenue', Component: '/backoffice/dashboard/Welcome#default', minWidth: 'medium' },
        { slug: 'vh-stats', label: 'Chiffres', Component: '/backoffice/dashboard/Stats#default', minWidth: 'medium' },
        { slug: 'vh-site', label: 'Gérer le site', Component: '/backoffice/dashboard/SitePanel#default', minWidth: 'medium' },
        { slug: 'vh-review', label: 'À relire', Component: '/backoffice/dashboard/ReviewQueue#default', minWidth: 'small' },
        { slug: 'vh-drafts', label: 'Brouillons', Component: '/backoffice/dashboard/Drafts#default', minWidth: 'small' },
        { slug: 'vh-published', label: 'Publiés récemment', Component: '/backoffice/dashboard/Published#default', minWidth: 'small' },
        { slug: 'vh-activity', label: 'Publications — 30 jours', Component: '/backoffice/dashboard/Activity#default', minWidth: 'medium' },
        { slug: 'vh-popular', label: 'Les plus lus', Component: '/backoffice/dashboard/Popular#default', minWidth: 'small' },
        { slug: 'vh-readers', label: 'Lecteurs', Component: '/backoffice/dashboard/Readers#default', minWidth: 'small' },
        { slug: 'vh-guide', label: 'Comment publier', Component: '/backoffice/dashboard/Guide#default', minWidth: 'small' },
      ],
      defaultLayout: ({ req }) => {
        const role = (req.user as { role?: string } | null)?.role
        return role === 'admin' || role === 'editor'
          ? [
              { widgetSlug: 'vh-welcome', width: 'full' },
              { widgetSlug: 'vh-stats', width: 'full' },
              { widgetSlug: 'vh-review', width: 'medium' },
              { widgetSlug: 'vh-activity', width: 'medium' },
              { widgetSlug: 'vh-site', width: 'full' },
              { widgetSlug: 'vh-published', width: 'medium' },
              { widgetSlug: 'vh-popular', width: 'medium' },
              { widgetSlug: 'vh-drafts', width: 'medium' },
              { widgetSlug: 'vh-readers', width: 'medium' },
            ]
          : [
              { widgetSlug: 'vh-welcome', width: 'full' },
              { widgetSlug: 'vh-stats', width: 'full' },
              { widgetSlug: 'vh-drafts', width: 'medium' },
              { widgetSlug: 'vh-review', width: 'medium' },
              { widgetSlug: 'vh-published', width: 'medium' },
              { widgetSlug: 'vh-guide', width: 'medium' },
            ]
      },
    },
  },
  // Order is the nav's order (Payload groups by first appearance): Rédaction, Classement,
  // Mise en page, Lecteurs, Réglages — WordPress's menu, in the newsroom's words.
  collections: [
    Articles,
    Media,
    MagazineIssues,
    Categories,
    Tags,
    Banners,
    ContactMessages,
    NewsletterSubscribers,
    Redirects,
    Users,
  ],
  globals: [Homepage, SiteSettings],
  // The journalist toolset lives in lib/editor-config.ts so it can be inspected without
  // booting Payload (gate BO-G6); every node it can produce renders in RichTextBody (BO-G7).
  editor: lexicalEditor({
    features: () => articleFeatures(),
  }),
  // French-only admin for the editorial team (spec §1).
  i18n: {
    supportedLanguages: { fr },
    fallbackLanguage: 'fr',
    // Payload's French says « Créer un(e) nouveau ou nouvelle » and « Choisir parmi les
    // existant(e)s ». WordPress says « Ajouter », and so does the newsroom.
    translations: {
      fr: {
        general: {
          createNew: 'Ajouter',
          createNewLabel: 'Ajouter : {{label}}',
          creatingNewLabel: 'Nouveau : {{label}}',
        },
        fields: {
          addNew: 'Ajouter',
          addNewLabel: 'Ajouter : {{label}}',
          chooseFromExisting: 'Choisir dans la médiathèque',
          chooseLabel: 'Choisir : {{label}}',
          uploadNewLabel: 'Téléverser : {{label}}',
        },
      },
    },
  },
  secret: process.env.PAYLOAD_SECRET || '',
  cookiePrefix: 'vh',
  upload: {
    limits: { fileSize: 41_943_040 }, // 40 MB
    abortOnLimit: true,
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Migration-driven, ALWAYS — including dev.
    //
    // `push` was previously enabled in dev, and it tried to DROP the
    // `search_vector` generated column and its GIN index, because they are
    // created by SQL migration and are therefore absent from the schema Payload
    // derives from the collections. It asked "Accept warnings and push schema?"
    // on stdin, which hung every non-interactive seed run until the process was
    // killed — and had anyone answered yes, full-text search would have been
    // silently deleted.
    //
    // Schema changes now go through `payload migrate:create` + `payload migrate`
    // like the sister sites, which is where they belonged anyway.
    // exists without a hand-written migration; production goes through
    // `payload migrate:create` + `payload migrate`.
    push: false,
    pool: {
      connectionString: explicitSslMode(process.env.DATABASE_URL || ''),
      // A suspended Neon compute takes several seconds to wake, and node-postgres
      // defaults to a short connect timeout — observed live: three probes right
      // after an idle period returned in 3533ms, 2225ms, then 415ms, and the
      // first request had already failed with ETIMEDOUT. On Vercel the same
      // cold start happens after any quiet spell, so allow for the wake-up
      // rather than serving a 500 to whoever arrives first.
      connectionTimeoutMillis: 30_000,
      // Serverless invocations are short-lived and each holds a slot; a small
      // pool with a brisk idle timeout avoids exhausting Neon's connection
      // limit across concurrent lambdas.
      max: 10,
      idleTimeoutMillis: 30_000,
    },
  }),
  sharp,
  plugins: [...storagePlugins],
})
