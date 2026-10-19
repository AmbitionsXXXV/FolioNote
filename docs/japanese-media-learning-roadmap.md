# Japanese Media Learning — Product & Technical Roadmap

> Status: proposed strategic direction  
> Recorded: 2026-07-29  
> Code baseline: `42bc08b`  
> Japanese prototype baseline: `122d9c9`  
> Scope: Web + Native product direction and implementation route

## 1. Decision summary

FolioNote should contract from a broad note/knowledge workspace into a focused Japanese media-learning product:

> Turn a video, audio file, subtitle file, or text into a lesson that users can listen to, understand, shadow, save, and review.

The target combines:

- Miraa's source selection, transcription, synchronized playback, translation, explanation, and shadowing loop.
- Oyomi's Japanese token, reading, part-of-speech, bunsetsu, and dependency structure presentation.
- FolioNote's existing source model, review scheduling, cross-platform API, and Native offline data layer.

This is a product and domain-model refactor, not a framework rewrite. Existing infrastructure should be extended where it already represents the right concept.

## 2. Research conclusions that affect the roadmap

### 2.1 Miraa and Oyomi

Miraa and Oyomi share the same support identity and appear to belong to the same developer/product family. Their similar semantic-structure UI is therefore more likely to be shared private technology than a public renderer library.

Oyomi's developer describes its semantic structure as a tree whose orange element is the core predicate and whose other elements progressively explain or modify that predicate:

- [Oyomi App Store](https://apps.apple.com/us/app/oyomi-ai-japanese-reader/id1474251984)
- [Oyomi development notes](https://kevinzhow.medium.com/behind-the-scenes-of-developing-a-new-app-oyomi-japanese-grammar-learning-and-analysis-956a939b1fa8)

Miraa's privacy policy states that media is uploaded for server-side subtitle recognition and deleted after recognition. This supports a client media shell plus server-side transcription/translation architecture:

- [Miraa](https://miraa.app/)
- [Miraa privacy policy](https://miraa.app/terms/privacy-policy)

Static inspection of the official Miraa Android package found Flutter InAppWebView, cookie, caption, FFmpeg, and Firebase-related components. Together with observed product behavior, this supports the conclusion that Miraa uses an in-app browsing/media layer. It does not prove whether Miraa captures only a YouTube URL, reads page captions, reuses cookies, or extracts media streams.

### 2.2 No turnkey semantic-structure library

The reference UI requires four separate layers:

1. Morphology: surface form, lemma, reading, POS, and inflection.
2. Syntax: bunsetsu, dependency head/relation, clause, and root predicate.
3. Presentation transformation: ruby alignment, romaji, grouping, and dependency depth.
4. A custom Web and Native renderer.

[GiNZA](https://github.com/megagonlabs/ginza) is the closest technical fit for the canonical server analysis because it combines Sudachi-based morphology, dependency parsing, bunsetsu APIs, and experimental clause recognition. [WanaKana](https://wanakana.com/docs/) is appropriate for small kana/romaji conversion tasks. [KWJA](https://github.com/ku-nlp/kwja) is a later option for predicate-argument structure, coreference, and discourse analysis.

Kuromoji and Lindera remain useful as a cheaper token-level fallback, but they do not produce the semantic tree shown in the reference UI. The existing [Japanese NLP research](./research/japanese-nlp-jlpt.md) remains the source for dictionary, JLPT-data, license, and fallback-tokenizer details.

GiNZA model/data provenance requires legal review before a production release. The analyzer must therefore sit behind a stable internal contract so the engine can be replaced without changing Web or Native clients.

### 2.3 YouTube selection, login, playback, and transcript acquisition

The Miraa interaction is worth adopting at the product level:

- Let a Native user browse to a YouTube video.
- Detect a canonical `watch`, `youtu.be`, or `shorts` URL.
- Show an explicit "Import current video" action.
- Create a FolioNote material from the video ID.

The implementation must separate video selection from content acquisition.

Google disallows OAuth authorization in embedded user agents that can access cookies, inject scripts, or alter navigation. Authentication must use the system browser or supported Google authentication libraries:

- [Google OAuth policy](https://developers.google.com/identity/protocols/oauth2/policies)
- [OAuth for native apps](https://developers.google.com/identity/protocols/oauth2/native-app)

YouTube permits an official player inside an OS WebView when the app supplies the required identity/Referer, but its developer policies prohibit scraping YouTube applications and downloading, importing, caching, or separating YouTube audiovisual content without approval:

- [YouTube embedded-player requirements](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies)

Therefore:

- Native may provide an in-app source browser, but must not read or upload Google/YouTube cookies or inject scripts into login pages.
- Web cannot reproduce the exact full-site browser behavior because YouTube framing and browser same-origin restrictions prevent inspecting an embedded YouTube site. Web uses URL paste, search, OAuth-authorized collections, or a share target.
- Playback uses the official YouTube embedded player on both clients.
- Public transcript extraction is an isolated, feature-flagged experiment, not a core availability promise.

## 3. Product route

### 3.1 Product promise

Primary job:

> When I find Japanese content I care about, help me turn it into a short, understandable practice session without manually rebuilding the material.

The product loop is:

```text
Find or import → Prepare → Understand → Shadow → Save → Review → Continue
```

Every core screen must advance the user to the next step in this loop. A feature that cannot be connected to this loop should not remain primary navigation.

### 3.2 Target information architecture

#### Web

- **Today** — continue unfinished material and complete today's review.
- **Library** — imported materials, import queue, search, source filters, and tags.
- **Review** — saved words, grammar points, and sentences.
- **Settings** — account, language, playback, and model preferences; accessed from the user menu.

#### Native

- **Today**
- **Library**
- **Review**
- **Me**
- A prominent import action for URL, share sheet, file, photo/OCR, and text.

The learning session is a destination opened from Today or Library, not another permanent navigation item.

### 3.3 Current-feature disposition

| Current surface | Target disposition |
| --- | --- |
| Activity | Merge into Today |
| Inbox | Convert to Library import queue |
| Library | Retain as the material home |
| Sources | Convert to Library metadata and filters |
| Tags | Convert to Library/Review filters |
| Search | Keep globally; route results into materials and learning items |
| Review | Retain and specialize for word/grammar/sentence items |
| Knowledge / AI chat | Move into contextual "Explain this segment" actions |
| Graph | Remove from primary navigation; archive or keep experimental |
| Generic entry editor | Retain as notes/annotations attached to a material |
| `/jp-reading` (now `/japanese/read`; old URL redirects) | Merge into the unified learning session |
| `/jp-typing` (now `/japanese/practice/typing`; old URL redirects) | Become a session practice mode |
| `/jp-exam` (now `/japanese/practice/exam`; old URL redirects) | Archive until the media-learning loop proves demand |

Do not delete old routes before saved data and deep links have a migration or redirect path.

### 3.4 Unified learning session

Target route:

```text
/learn/$materialId?segment=$segmentId&mode=understand|shadow|review
```

Core surfaces:

- Official player or owned-media player.
- Time-synchronized transcript.
- Active sentence focus.
- Toggles for ruby, romaji, POS, semantic structure, and translation.
- Tap a token/bunsetsu for dictionary and grammar details.
- Contextual read-aloud, translation, and explanation.
- Loop sentence, change playback rate, record, compare, and continue.
- Save word, grammar, or sentence into Review.

Web should use a player/transcript split layout. Native should use a focused full-screen session with sheets for word, grammar, translation, and explanation details. The two clients share the domain state and commands, not DOM/RN view components.

### 3.5 Product principles

- One material, one session, one review loop.
- Import must always expose status, failure reason, retry, and a usable fallback.
- AI explanation is contextual, not a separate destination.
- POS and dependency meaning must not rely on color alone.
- Use system design tokens rather than hardcoded reference-app colors.
- Preserve YouTube player identity, branding, controls, ads, and playback integrity.
- Clearly label transcript provenance and confidence.
- Do not market unofficial public-transcript extraction as guaranteed support.

### 3.6 Product success gates

Track:

- Import-to-first-play success rate.
- Median time from import to first usable segment.
- Percentage of prepared materials that start a learning session.
- Session completion and next-session continuation rates.
- Shadowing attempts per active learner.
- Saved learning items per completed session.
- Review completion and seven-day return rate.
- Failure rate by import/transcript adapter.

Do not expand the JLPT question bank, graph, generic AI chat, OCR, EPUB, or advanced discourse analysis until the import → session → review loop clears its agreed adoption gates.

## 4. Technical implementation route

### 4.1 Domain model

#### Material

Represents the thing being learned:

```ts
type Material = {
  id: string
  userId: string
  sourceId: string | null
  kind: "text" | "subtitle" | "youtube" | "audio" | "video" | "web"
  externalId: string | null
  canonicalUrl: string | null
  title: string
  thumbnailUrl: string | null
  durationMs: number | null
  language: string
  ingestStatus: "draft" | "queued" | "processing" | "ready" | "failed"
  transcriptSource:
    | "pasted"
    | "uploaded_subtitle"
    | "owner_caption"
    | "owned_media_asr"
    | "experimental_public"
  rightsBasis: "user_provided" | "owned" | "licensed" | "unknown"
}
```

#### Segment

Represents a sentence or time-aligned learning unit:

```ts
type Segment = {
  id: string
  materialId: string
  sequence: number
  startMs: number | null
  endMs: number | null
  text: string
  translation: string | null
  analysisVersion: string | null
  analysis: JapaneseAnalysis | null
}
```

#### Learning item

Represents something the user chose to retain:

```ts
type LearningItem = {
  id: string
  userId: string
  materialId: string
  segmentId: string | null
  kind: "word" | "grammar" | "sentence"
  prompt: string
  answer: string
  reviewEntryId: string | null
}
```

Phase 1 may bridge learning items into the existing entry-based review scheduler. A later migration can make review targets polymorphic if real usage justifies the added schema complexity.

### 4.2 Stable Japanese analysis contract

The canonical response must be engine-independent:

```ts
type JapaneseAnalysis = {
  schemaVersion: string
  engine: string
  engineVersion: string
  tokens: Array<{
    id: string
    surface: string
    lemma: string | null
    reading: string | null
    pronunciation: string | null
    romaji: string | null
    upos: string | null
    xpos: string | null
    inflectionType: string | null
    inflectionForm: string | null
    bunsetsuId: string | null
    headTokenId: string | null
    dependencyLabel: string | null
    clauseId: string | null
    isRoot: boolean
    ruby: Array<{
      base: string
      reading: string | null
    }>
  }>
}
```

The renderer derives:

- POS underline token.
- Bunsetsu box boundaries.
- Dependency depth and grouping.
- Root-predicate emphasis.
- Ruby and romaji display.

The API returns linguistic facts; clients own responsive presentation.

### 4.3 Ingestion pipeline

```text
Source adapter
  → Material creation
  → durable idempotent ingest job
  → transcript/caption normalization
  → sentence and timestamp segmentation
  → Japanese analysis
  → versioned persistence
  → Web/Native cache
  → learning-item extraction
  → Review
```

Required source adapters:

- Plain text.
- SRT/VTT.
- Curated public-domain literature fixtures for a realistic, reproducible preview before arbitrary document import is complete.
- User-owned audio/video upload.
- YouTube URL.
- Native YouTube source browser.
- Web URL paste/search.

Long-running transcription and analysis must not use the existing in-memory RAG queue. Add a durable job record with idempotency key, attempts, lease/heartbeat, progress, typed failure reason, and retry policy. Select the concrete worker or queue runtime when deployment requirements and expected volume are known.

Large media must upload directly to object storage using an upload intent. Do not send audio/video as base64 through the current attachment API.

### 4.4 YouTube adapter boundaries

#### Native source browser

`YouTubeSourceBrowser` may:

- Load YouTube in an OS WebView for browsing.
- Detect supported video-navigation URLs.
- Normalize and display the selected video ID.
- Ask the user to confirm "Import current video".
- Open unsupported authentication in the system browser.

It must not:

- Read, export, or synchronize YouTube session cookies.
- Inject scripts into Google authentication pages.
- Intercept media manifests or audio/video requests.
- send authenticated page HTML to the server.

The source browser is a convenience selector, not the transcript engine.

#### Web selection

Web supports:

- Pasted YouTube URL.
- YouTube Data API search when configured.
- OAuth-authorized playlists/collections when configured.
- Browser/PWA share target as a later convenience.

#### Playback

Define a client player adapter:

```ts
type LearningPlayer = {
  getCurrentTimeMs: () => number
  play: () => Promise<void>
  pause: () => Promise<void>
  seekToMs: (timeMs: number) => Promise<void>
  playRange: (startMs: number, endMs: number) => Promise<void>
  setPlaybackRate: (rate: number) => Promise<void>
}
```

Implement it with the official IFrame Player API on Web and the official embed inside the OS WebView on Native. Supply the required origin/Referer and retain the complete YouTube player experience.

#### Transcript strategies

Order by reliability:

1. User-provided text or SRT/VTT.
2. Captions for videos the authenticated user is authorized to manage.
3. ASR for media the user owns and uploads directly.
4. Experimental public-transcript adapter behind a server-side feature flag.

The experimental adapter must have isolated code, rate limits, observability, and an immediate kill switch. Its failure must offer paste/upload alternatives.

### 4.5 Repository placement

- `packages/db`: `study_materials`, `study_segments`, `learning_items`, and durable `ingest_jobs`.
- `packages/api`: type-safe material, ingestion, segment, analysis, and learning-item procedures.
- `packages/learning` (new): framework-independent contracts, source URL normalization, transcript normalization, session state, and player commands.
- `apps/server`: ingestion worker, transcription adapters, Japanese analyzer adapter, and job orchestration.
- `apps/web`: target information architecture, material library, Web player, transcript, and semantic renderer.
- `apps/native`: source browser/share intake, Native player, semantic renderer, recording, and offline cache.

Do not put React DOM or React Native components into `packages/learning`.

### 4.6 API surface

Initial oRPC procedures:

```text
materials.createFromText
materials.createFromSubtitle
materials.createFromUrl
materials.get
materials.list
materials.retryIngest
segments.list
japanese.analyze
learningItems.create
learningItems.delete
learningItems.list
```

Every mutation must be user-scoped and idempotent where retry is expected. Clients should receive typed ingest progress and failure reasons rather than polling a generic error string.

### 4.7 Offline and synchronization

Native caches:

- Material metadata.
- Prepared segments.
- Versioned Japanese analysis.
- Saved learning items and pending review actions.

Native does not need to run the canonical dependency parser. It renders cached server analysis and queues user actions offline. A small local tokenizer or dictionary may later support immediate fallback selection, but must never silently replace canonical analysis.

## 5. Combined delivery route

| Stage | Product outcome | Technical deliverables | Exit gate |
| --- | --- | --- | --- |
| 0. Architecture spike | Confirm the core lesson experience | Stable contracts; GiNZA/KWJA legal and accuracy spike; schema migration plan; renderer prototype | One representative sentence renders correct tokens, bunsetsu, dependency direction, and root predicate on Web and Native |
| 1. Text lesson vertical slice | Read a real public-domain excerpt or paste text and start learning | Curated Aozora Bunko fixtures with provenance; Material/segment schema; durable job skeleton; `japanese.analyze`; Web/Native semantic renderer | Same authentic material opens consistently on both clients without invented demo copy |
| 2. Subtitle and media session | Learn from timed material | SRT/VTT normalization; official players; segment synchronization; user-owned media upload path | Import → first playable segment is observable, retryable, and reliable |
| 3. YouTube selection | Select YouTube content with low friction | Native source browser; share intake; Web URL/search; official embeds; authorized-caption adapter | Selected video creates one canonical material and plays on both clients |
| 4. Shadow and retain | Practice and save learning items | Loop/rate controls; recording; contextual explain/translate; learning-item bridge to Review | A user can complete understand → shadow → save → review without leaving the learning loop |
| 5. Product contraction | Make the focused product the default | Today/Library/Review IA; redirects and migrations; archive old standalone Japanese/graph/chat surfaces | No saved data or deep link is stranded; primary navigation contains only the focused loop |
| 6. Advanced language features | Improve depth after adoption | OCR/EPUB; KWJA/PAS; richer offline dictionary; experimental public transcript adapter | Added complexity improves measured learning behavior and stays within legal/operational gates |

## 6. Explicit decisions

### Accepted

- Focus FolioNote on Japanese media learning.
- Share domain contracts and session behavior across Web and Native.
- Keep platform-specific renderers.
- Adopt Miraa's browse-and-select interaction on Native.
- Use official YouTube playback.
- Make semantic structure a canonical server capability rather than a visual mock.
- Reuse existing `sources`, Review, oRPC, and Native offline seams.

### Proposed, pending validation

- GiNZA as the first canonical dependency analyzer.
- A new framework-independent `packages/learning`.
- A DB-backed durable ingestion-job implementation.
- Recording comparison and pronunciation feedback scope.

### Deferred

- OCR and EPUB.
- Full JLPT exam bank.
- KWJA-level PAS/coreference/discourse.
- A broad offline Japanese dictionary.
- Public transcript extraction as a supported guarantee.

### Rejected as a foundation

- Reading or uploading YouTube login cookies.
- JavaScript injection into Google login pages.
- Downloading YouTube media for background transcription.
- Treating public transcript scraping as a stable platform API.
- Maintaining separate Web-only Japanese demo products.
- Rewriting the existing app stack before validating the learning loop.

## 7. Open decisions before Stage 1

- Complete commercial/legal review for the selected Japanese model and training data provenance.
- Select the transcription provider/runtime after measuring expected media duration, latency, language accuracy, privacy, and cost.
- Define material retention/deletion behavior for uploaded media.
- Define the minimum shadowing comparison: recording and replay only, or pronunciation/timing scoring.
- Agree on the measurable adoption gates for archiving Graph, standalone Knowledge chat, and the JLPT exam route.
- Decide whether the product keeps the FolioNote name after the learning focus is validated.
