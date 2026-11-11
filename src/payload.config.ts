import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  BlockquoteFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
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
        collections: { media: true },
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
  },
  collections: [
    Articles,
    Categories,
    Tags,
    MagazineIssues,
    Banners,
    NewsletterSubscribers,
    ContactMessages,
    Redirects,
    Media,
    Users,
  ],
  globals: [Homepage, SiteSettings],
  // Trimmed to what a non-technical journalist actually uses. h2/h3 only —
  // the page's single h1 is the article title, and letting an editor drop
  // another h1 into the body would break the document outline (spec §9).
  editor: lexicalEditor({
    features: () => [
      ParagraphFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
      BoldFeature(),
      ItalicFeature(),
      UnderlineFeature(),
      LinkFeature(),
      UnorderedListFeature(),
      OrderedListFeature(),
      BlockquoteFeature(),
      UploadFeature(),
      HorizontalRuleFeature(),
      FixedToolbarFeature(),
      InlineToolbarFeature(),
    ],
  }),
  // French-only admin for the editorial team (spec §1).
  i18n: {
    supportedLanguages: { fr },
    fallbackLanguage: 'fr',
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
