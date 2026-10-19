# Japanese NLP & JLPT Data — Research & Recommendation for FolioNote

> **Direction update (2026-07-29):** semantic structure is now part of the proposed core media-learning experience rather than a generic Phase-3 enhancement. Use [`../japanese-media-learning-roadmap.md`](../japanese-media-learning-roadmap.md) for current product sequencing, shared contracts, YouTube boundaries, and Web/Native delivery. This report remains the detailed source for tokenizer, dictionary, JLPT-data, licensing, and offline-fallback research.

> Research brief generated 2026-06-12 via a multi-agent web-research + adversarial-verification workflow (5 dimensions, 13 agents). Every version/date string is deliberately left soft — **re-verify exact package versions, sizes, and license headers at integration time** (see §8). Grounded against this monorepo: Node/Hono server, TanStack Start web, Expo/React Native 0.85.3 (Hermes), oRPC routers in `packages/api/src/routers/*`, Drizzle schema in `packages/db/src/schema/*`.

## 1. Executive Summary

- **Headline free-first recommendation:** Do all Japanese morphological analysis **server-side in the Node/Hono process** and expose it through one oRPC procedure that both web and native consume. Ship a **maintained kuromoji.js fork ([`@patdx/kuromoji`](https://www.npmjs.com/package/@patdx/kuromoji), Apache-2.0, ESM/TS/Promise) for the MVP**, with a clear upgrade lane to **[Lindera](https://github.com/lindera/lindera) (MIT, Rust→WASM, actively maintained into 2026) + UniDic-BSD** when you need better lemma/reading quality. Both are 100% free, permissively licensed, and require no native system dependency on the VPS.
- **Token-level grammar is free and pure-Node; true dependency parsing is not.** POS tags, conjugation type/form, dictionary (base) form, and katakana readings are fully achievable in Node via a MeCab dictionary. **Bunsetsu dependency trees, case/predicate-argument structure, coreference, and robust NER are effectively Python-only** (GiNZA/spaCy, KWJA, KNP) and would require a separate microservice — defer unless the product roadmap demands it.
- **Dictionary content is solved and free:** the **EDRDG family — [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html), [KANJIDIC2](https://www.edrdg.org/kanjidic/kanjidic2_dtdh.html), RADKFILE/KRADFILE — all CC BY-SA 4.0**, consumed cleanly as JSON via [`scriptin/jmdict-simplified`](https://github.com/scriptin/jmdict-simplified) (MIT loader + types) or, for an enriched/ready-to-consume superset, the [`yomidevs/jmdict-yomitan`](https://github.com/yomidevs/jmdict-yomitan) and [Jitendex](https://jitendex.org/) bundles. Seed into your existing Postgres/Drizzle at build time; no runtime third-party API.
- **JLPT levels are NOT official data.** JEES/Japan Foundation discontinued all official word/kanji/grammar lists with the 2010 N5–N1 format change. **Every level tag from every source traces back to one origin — [Jonathan Waller's tanos.co.uk](http://www.tanos.co.uk/jlpt/) (CC BY)** — and is an acknowledged "educated guess" with known misclassifications. Treat levels as a study-grouping heuristic and surface a disclaimer to users.
- **React Native / Hermes is the hard constraint.** Hermes does not natively implement `Intl.Segmenter` and is not a target for WASM/NAPI analyzers. **Native must consume precomputed results via oRPC.** For the narrow on-device case (boundary-only segmentation with zero polyfill), there are now **two** maintained-vs-frozen Hermes-capable options — [BudouX](https://github.com/google/budoux) (Apache-2.0, actively developed into 2026, ML phrase segmenter) and [TinySegmenter](https://www.npmjs.com/package/tiny-segmenter) (frozen but stable) — neither of which provides readings/POS.

---

## 2. Segmentation & Morphological Analysis

| Option | Runtime | License | Maintained | Fit for FolioNote |
| --- | --- | --- | --- | --- |
| [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) (`granularity:'word'`) | Node (full-ICU; Node 18+ ships full-ICU by default), browser (Baseline 2024); **NOT Hermes** | ICU/Unicode (runtime built-in) | Maintained as part of Node/V8/ICU | Boundaries only — **no POS/reading**. Zero-dep word-count / tap-a-word on Node+web; needs polyfill on native. Requires full-ICU (default on modern Node) |
| [`@patdx/kuromoji`](https://www.npmjs.com/package/@patdx/kuromoji) (kuromoji fork) | Node (first-class), browser | Apache-2.0 (IPADIC bundled) | **Liveliest fork** — npm 1.0.4; verify exact publish date and last GH push at integration time | **Best MVP pick** — ESM/TS/Promise matches the server; full IPADIC analysis (POS, base form, reading); ~18MB packed; no native build |
| [`@aiktb/kuromoji`](https://www.npmjs.com/package/@aiktb/kuromoji) (kuromoji fork) | Node, browser | Apache-2.0 (IPADIC bundled) | Notable active fork (cited in `@patdx`'s own README); verify cadence at integration time | Viable alternative to `@patdx` if its TS/ESM ergonomics or maintenance prove stronger; same IPADIC token shape. Evaluate both, pick the livelier |
| [`@sglkc/kuromoji`](https://www.npmjs.com/package/@sglkc/kuromoji?activeTab=readme) (browser fork) | Browser-focused, Node usable | Apache-2.0 | Stale — 1.1.0 (2023-09), repo renamed to miseya, no 2025 activity | Only if you want client-side kuromoji or the `@sglkc/kuroshiro` furigana path on web |
| [`kuromoji`](https://www.npmjs.com/package/kuromoji) (original, takuyaa) | Node, browser | Apache-2.0 | **Dead** — 0.1.2 (2018), no releases ~8 yrs | Avoid for new code; CommonJS + callbacks; ~41MB dict |
| [Lindera](https://github.com/lindera/lindera) (Rust) via [`lindera-wasm`](https://www.npmjs.com/package/lindera-wasm) / `lindera-wasm-unidic` / `lindera-wasm-nodejs-ipadic` | Node (WASM), browser (WASM); **not Hermes** | MIT (dict per upstream) | **Very active** — repo updated into 2026; **verify current version at integration time** (do not hard-code) | **Best modern/maintained full-analysis pick**; picks IPADIC or **UniDic** (better lemma/reading); WASM avoids native compile on VPS; ~13MB packed (ipadic). A NAPI/Node-native path was **not confirmed as a published package** — prefer the confirmed WASM packages |
| [Vibrato](https://github.com/daac-tools/vibrato) (Rust) + `@wangb/vibrato-wasm` | Server (native); JS only via hobby WASM bridge | MIT OR Apache-2.0 | Engine active; **verify versions at integration time**; JS bridge is a hobby project (last touched 2024) | Speed champion, but no first-party JS pkg + separate large dict downloads. Skip unless throughput is a hard requirement |
| [Sudachi](https://github.com/WorksApplications/sudachi.rs) (sudachi.rs + SudachiDict) | Rust binary sidecar / stale WASM; not Hermes | Apache-2.0 (engine **and** dict) | Engine active into 2026; SudachiPy deprecated | **Cleanest license story**, best normalization & A/B/C split modes, but no maintained JS binding → sidecar + ~70MB dict. Heavier than Lindera |
| [BudouX](https://github.com/google/budoux) (`budoux` npm) | **Node, browser, Hermes** | **Apache-2.0** | **Actively developed (commits into 2026)** | **Maintained on-device option.** Pure JS, dependency-free (~15KB), ML phrase segmenter with a bundled `loadDefaultJapaneseParser()` — **runs on Hermes/RN with zero polyfill and no MeCab dictionary**. Phrase-level boundaries only; **no readings/POS** (same limitation class as TinySegmenter, but ML-based and current) |
| [TinySegmenter](https://www.npmjs.com/package/tiny-segmenter) | **Node, browser, Hermes** | Custom BSD-style (Taku Kudo) | Frozen — 0.2.0 (2016), "done" | Frozen on-device fallback; boundaries only, no readings/POS. Prefer **BudouX** for new on-device work (maintained, smaller) |
| [MeCab + node bindings](https://www.npmjs.com/package/mecab-async) | Node spawning system `mecab` | MeCab BSD; glue MIT/unspecified | **Dead glue** (2014–2017) | Poor fit: native system dep, won't run on Vercel/web SSR, per-call subprocess. Skip |
| [Kagome](https://github.com/ikawaha/kagome) (Go) | Go binary/WASM sidecar | MIT | Active; **verify version at integration time** | Excellent engine but introduces a Go service. Only as standalone HTTP sidecar |
| [Janome](https://github.com/mocobeta/janome) (Python) | Python service | Apache-2.0 | Light — 0.5.0 (2023) | **Worst fit** — adds a Python runtime for no accuracy gain over kuromoji/Lindera. Avoid |

> **Note on Node version (ungrounded in the current repo):** the root `package.json` has **no `engines` field** (verified), so no Node minimum is enforced today. Three things depend on Node version: (1) `Intl.Segmenter` needs **full-ICU**, which is the default in Node ≥ 14 official builds and reliably present on Node 18/20/22; (2) Lindera-WASM needs `WebAssembly` + ESM interop, fine on any maintained LTS; (3) there is **no native compile step** if you stay on the WASM packages, so no node-gyp/toolchain constraint. **Recommendation: add `"engines": { "node": ">=20" }`** to pin a full-ICU, WASM-capable baseline for both the server and the seed scripts.

**Prose.** The first decision is _segmentation-only vs. full morphological analysis_. If you only need word boundaries (word count, search tokenizing, tap-a-word), `Intl.Segmenter` costs nothing on Node and web and ships no dictionary. But a learning app needs **readings (for furigana), POS tags (for coloring/grammar), and dictionary/base form (for lookup and SRS)** — that requires a real analyzer.

Among real analyzers, the realistic free picks for a Node/oRPC server are the maintained kuromoji forks and Lindera. **`@patdx/kuromoji`** is the pragmatic MVP: pure JS, no native/WASM build step on the PM2/Caddy VPS, ESM/Promise/TS that match the existing server, and the familiar kuromoji token shape (`surface_form`, `pos`, `pos_detail_1..3`, `conjugated_type/form`, `basic_form`, `reading`, `pronunciation`). **`@aiktb/kuromoji`** is a credible sibling fork (referenced from `@patdx`'s own README) — evaluate both and adopt whichever shows the healthier cadence and cleaner TS types at integration time; they share the IPADIC contract, so switching is low-cost. **Lindera** is the stronger long-term engine: actively maintained into 2026 (MIT), bundles the dictionary per package, and crucially lets you choose **UniDic** for cleaner lemmas, conjugation, and readings — at the cost of a WASM init step and a Vite `optimizeDeps` exclusion on the web build. Vibrato (fastest) and Sudachi (best normalization) are superior engines but lack a maintained first-party Node package, so they cost more integration effort than their marginal benefit here.

> **Note on a stale-but-real number (illustrative, not load-bearing):** the original `kuromoji` is unmaintained yet still pulls roughly six figures of weekly npm downloads — a sign of how entrenched the IPADIC token shape is, which is why the maintained forks keep that exact output contract. Treat any specific download count as illustrative; confirm on [npm](https://www.npmjs.com/package/kuromoji) if it needs to be load-bearing.

---

## 3. POS & Grammatical / Dependency Analysis — Node vs Python

There is a **hard runtime split**, and it determines your architecture more than any single library choice.

**Achievable in pure Node/browser (no Python):** per-token grammar from a MeCab dictionary — coarse POS plus fine sub-POS (e.g. `名詞-固有名詞-人名`, `助詞-格助詞`), **conjugation type (活用型) and form (活用形)**, **base/dictionary form (原形/basic_form)**, **reading (読み, katakana)**, and **pronunciation (発音)**. This is exactly what kuromoji.js and Lindera-ipadic/-unidic expose, and it is enough for furigana, POS coloring, base-form lookup, and SRS.

**Dictionary choice drives token-level quality:**

- **[IPADIC](https://taku910.github.io/mecab/posid.html)** — permissive (custom NAIST/ICOT license), but frozen since ~2007 and coarse; keeps compounds whole (`図書館` as one word). Smallest footprint. The familiar baseline.
- **[UniDic](https://clrd.ninjal.ac.jp/unidic/faq.html)** (NINJAL) — actively maintained, a principled 4-level lemma/form/orthography/pronunciation hierarchy; cleanest lemma and most accurate conjugation/reading — **best for SRS and grammar features**. Trade-offs: short-unit segmentation over-splits (`図書館` → `図書` + `館`), and the full dict is large (**verify the size of the specific build you pick — modern full UniDic is on the order of gigabytes; use a core/small build**). Licensing is a GPL/LGPL/**BSD** triple-choice — **elect BSD** (see §5).
- **[mecab-ipadic-NEologd](https://github.com/neologd/mecab-ipadic-neologd)** — Apache-2.0 build tooling; great for neologisms/proper nouns in user-saved articles, but ~1.5GB+ and frozen (seed v0.0.7, Aug 2020). **Server-side only** (too large for browser/RN) and carries third-party-source provenance (see §5).

**Effectively Python/C++-only (no maintained pure-JS option exists):** true syntactic structure.

- **[GiNZA](https://github.com/megagonlabs/ginza)** (spaCy v3.7, MIT, SudachiDict-based) — UD dependency trees + lemma + NER + a **bunsetsu-phrase API** + experimental clause recognition. `ja_ginza` (CNN) runs on CPU with modest RAM; `ja_ginza_electra` needs ≥16GB. **GiNZA does not publish its own accuracy figures**; the commonly-cited TAG ~97% / DEP LAS ~90% are **borrowed from spaCy's `ja_core_news_lg` and should not be read as GiNZA's measured accuracy** — verify against a held-out set before quoting.
- **[spaCy-ja](https://spacy.io/models/ja)** (`ja_core_news_*`) — overlapping spaCy+Sudachi UD pipeline; pick one, not both.
- **[KWJA](https://github.com/ku-nlp/kwja)** (MIT) — most capable single tool (dependency + PAS + coreference + discourse + typo correction) but heaviest (PyTorch foundation models). Verify the current release at integration time.
- **[KNP + Juman++](https://github.com/ku-nlp/knp)** — deepest classical case/anaphora analysis, highest setup cost.
- **[CaboCha](https://taku910.github.io/cabocha/)** — legacy bunsetsu parser; very low cadence, painful to build; **avoid for new work**.

**Implication:** ship token-level grammar in-process today; only stand up a Python (FastAPI) microservice behind oRPC if and when dependency trees / grammar-explanation features land — and prefer `ja_ginza` (CPU) to keep RAM modest. **This breaks FolioNote's single-runtime simplicity**, so treat it as a deliberate Phase-2+ decision, not an MVP dependency.

---

## 4. JLPT Data Sources

> ### ⚠️ Critical caveat — no official lists exist
>
> The JLPT organizers (JEES / Japan Foundation) **discontinued all official word, kanji, and grammar lists** with the 2010 format change (4 levels → 5 levels N5–N1) and explicitly do **not** publish a Test Content Specification ([jlpt.jp policy](https://www.jlpt.jp/sp/e/policy.html), [KANJIDIC2 DTD](https://www.edrdg.org/kanjidic/kanjidic2_dtdh.html)). **Every JLPT level tag in every source below is community-sourced, unofficial, and approximate** — educated guesses derived from pre-2010 lists plus analysis of past papers. They nearly all trace to **one upstream: [Jonathan Waller's tanos.co.uk](http://www.tanos.co.uk/jlpt/aboutjlpt/)**, so "multiple independent sources" is an illusion — they share one origin and one set of errors. The maintainer of `yomitan-jlpt-vocab` personally reports words from the "N1" list appearing on an actual N2 exam. **Surface this disclaimer to users; treat levels as a study-grouping heuristic, not ground truth.**

| Source | What it provides | License | Maintained | Fit |
| --- | --- | --- | --- | --- |
| [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) (EDRDG) | Core JP↔EN vocabulary (**~214,000 entries**, Dec 2025; JP+multilingual glosses, POS) — **no JLPT levels** | CC BY-SA 4.0 | Active (regenerated daily) | **Authoritative vocab content layer.** Attach Waller levels separately |
| [Jitendex](https://jitendex.org/) (JMdict-derived) | JMdict superset, **enriched** (cleaned glosses, cross-refs, inflection data); Yomitan-ready | **CC BY-SA 4.0** | Active | **Higher-quality JMdict alternative.** Use as the vocab layer if you want enrichment beyond raw JMdict; same ShareAlike obligations |
| [yomidevs/jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) | **Ready-to-consume** bundles of JMdict + KANJIDIC + frequency in Yomitan dictionary format | EDRDG terms (CC BY-SA 4.0) per bundled data | Active (successor to yomichan dicts) | **Alternative ingestion path** to `scriptin/jmdict-simplified` if you prefer pre-packaged JMdict+KANJIDIC+frequency over assembling them yourself |
| [KANJIDIC2](https://www.edrdg.org/kanjidic/kanjidic2_dtdh.html) (EDRDG) | ~13k+ kanji: readings, meanings, grade, stroke, freq. Has a `<jlpt>` field but it's the **OLD pre-2010 1–4 scale** | CC BY-SA 4.0 | Active | **Authoritative kanji content.** Do **not** use the built-in `<jlpt>` as N-levels |
| [JMnedict](https://www.edrdg.org/enamdict/enamdict_doc.html) (EDRDG) | ~740k proper names | CC BY-SA 4.0 | Active | Optional — recognize names in user notes |
| [RADKFILE/KRADFILE](https://www.edrdg.org/krad/kradinf.html) (EDRDG) | Radical↔kanji decomposition for component lookup | CC BY-SA 4.0 | Maintained | Only if you build radical search |
| [KanjiVG](https://github.com/KanjiVG/kanjivg) | Stroke-order SVG (web + RN via react-native-svg) | CC BY-SA 3.0 | Active — r20250816 (2025-08) | **High fit** for a writing feature; renders on web + native |
| [tanos.co.uk (Waller)](http://www.tanos.co.uk/jlpt/) | **The de-facto JLPT level source** — vocab, kanji, **AND grammar** by N5–N1 | CC BY (grant on [/jlpt/sharing/](http://www.tanos.co.uk/jlpt/sharing/), **excludes paid items**) | Static since ~2010 | **Essentially mandatory** for level grouping; **only readily-licensable by-level grammar list** (needs .doc/.pdf parsing) |
| [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data) | Kanji JSON with **both `jlpt_old` and `jlpt_new`** (pre-2010→N-level remap done) | **MIT** (verified) | Active — commits into 2026 | **Convenient kanji-side shortcut.** **Strip `wk_*` (WaniKani) fields** for a product; `jlpt_new` is still Waller-derived |
| [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab) | Vocab→level, **genuinely cross-referenced to JMdict**, spellings normalized | CC BY-SA 4.0 | Active (2025-08) | **Cleanest vocab-side pick** — JMdict-aligned |
| [jamsinclair/open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) | Per-level CSV (expression/reading/meaning) | **MIT code over Waller data** (not JMdict-glossed) | Last commit **2025-08** | Usable; but it's Waller-derived, **not** EDRDG. Prefer yomitan-jlpt-vocab if you need true JMdict attribution |
| [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) | Per-level CSV | MIT | **Stale** (2023-04) | Works; from tanos via chyyran |
| [Tatoeba](https://tatoeba.org/en/downloads) | Example sentences (incl. public-domain Tanaka Corpus) — **no JLPT tags** | CC BY 2.0 FR (text); audio per-contributor | Active | **Easiest sentence source** (attribution only); grade difficulty yourself |
| [Jreibun](https://www.tufs.ac.jp/ts/personal/SUZUKI_Tomomi/jreibun/index-jreibun.html) (TUFS) | ~18,773 learner-oriented sentences w/ EN | CC Open Data | Active; **bulk download "in preparation"** | High-quality future option; **no JLPT tags**; contact jreibun@tufs.ac.jp |
| [wanakana](https://github.com/WaniKani/WanaKana) (WaniKani org) | **Library** — kana↔romaji transliteration, katakana↔hiragana, kana detection | **MIT** | Active | **Use this instead of hand-rolling kana conversion** (see §6). Note the licensing contrast: WaniKani's _API/content_ is proprietary, but its _wanakana library_ is MIT and freely usable |
| [WaniKani API](https://docs.api.wanikani.com/) | Kanji/vocab teaching content | **Proprietary** | Active | **AVOID as bundled data** — copyrighted, paywalled, no commercial/redistribution use. (Distinct from the MIT `wanakana` library above) |
| [jpdb](https://jpdb.io/) / [jlptsensei](https://jlptsensei.com/complete-jlpt-grammar-list/) / japanesetest4you | Grammar/vocab lists by level | **No open license** | Active products | **AVOID bundling** — scraping copyrighted compilations; reference only |

**Best integration path:** pull the EDRDG content as JSON via [`scriptin/jmdict-simplified`](https://github.com/scriptin/jmdict-simplified) (weekly releases; MIT [`@scriptin/jmdict-simplified-types`](https://github.com/scriptin/jmdict-simplified) + `-loader`) — or, if you want pre-packaged enrichment, ingest [Jitendex](https://jitendex.org/) or a [`jmdict-yomitan`](https://github.com/yomidevs/jmdict-yomitan) bundle instead. Join it to Waller-derived level tags (vocab from `yomitan-jlpt-vocab`, kanji from `davidluzgouveia/kanji-data` with `wk_*` stripped) **at build/seed time**, store in your existing Postgres/Drizzle, and expose via oRPC. This keeps everything offline-capable with **no runtime third-party API**. Hosted conveniences like `jlpt-vocab-api.vercel.app` merely re-serve Waller data and add a dependency you don't control — self-host the underlying open data instead.

---

## 5. Licensing Summary — Safe for a Free, Closed-Source Product

**A free SaaS with closed app code is fully compatible with these resources.** The key distinction: **CC BY-SA is a _data/content_ copyleft, not a _software_ copyleft like GPL** — ShareAlike binds the dictionary data and your modifications to it, **never your TypeScript app code**. Your code stays proprietary; you simply cannot relicense the _data_ as proprietary or claim sole copyright over it.

**Safe permissive — ship freely, attribution/NOTICE only, no copyleft:**

- **Engines:** Sudachi (Apache-2.0), [Lindera](https://github.com/lindera/lindera) (MIT), [Vibrato](https://github.com/daac-tools/vibrato) (MIT/Apache), kuromoji forks incl. `@patdx` and `@aiktb` (Apache-2.0), spaCy (MIT).
- **On-device segmenters:** **[BudouX](https://github.com/google/budoux) (Apache-2.0)**, TinySegmenter (BSD-style).
- **Utility libraries:** **[wanakana](https://github.com/WaniKani/WanaKana) (MIT)** for kana transliteration.
- **Dictionaries:** [IPADIC](https://github.com/taku910/mecab/blob/master/mecab-ipadic/COPYING) (custom permissive NAIST/ICOT — keep the notice), SudachiDict (Apache-2.0), and **[UniDic _only when you elect its BSD-3-Clause option_](https://clrd.ninjal.ac.jp/unidic/en/commerce_use_en.html)**.

**Safe but ShareAlike — usable commercially & closed-source, but attribute AND keep any _redistributed data_ under the same CC BY-SA:**

- EDRDG files (JMdict/JMnedict/KANJIDIC2/RADKFILE) = **CC BY-SA 4.0**; **Jitendex = CC BY-SA 4.0**; KanjiVG = **CC BY-SA 3.0**; CC-CEDICT (if you ever use `lindera-cc-cedict`) = CC BY-SA (3.0 per the [canonical wiki](https://cc-cedict.org/wiki/), 4.0 per MDBG). EDRDG also asks web servers to refresh data ~monthly and attribute on the credits/about screen.

**Attribution-only (easiest):** Tatoeba **text** = [CC BY 2.0 FR](https://tatoeba.org/en/terms_of_use) (Tanaka Corpus portion is public domain). Treat Tatoeba **audio separately** (per-contributor licenses).

**Traps to flag:**

- **WaniKani — split license:** the WaniKani **API and content** are **proprietary** (do not bundle), but the org's **`wanakana` library is MIT** and freely usable. Don't lump them together.
- **UniDic trap:** the GPL/LGPL/BSD triple-license covers **only modern versions** (Contemporary Written 2.x+, Contemporary Spoken 2.2.x+). **Elect BSD-3-Clause** and verify the exact build's license header — older/"special" UniDicMA variants require contacting NINJAL before commercial use.
- **GiNZA-models trap (biggest hidden risk):** GiNZA _code and released weights_ are MIT, but the parsing/NER models are **trained on [BCCWJ](https://clrd.ninjal.ac.jp/bccwj/en/)** (UD Japanese BCCWJ / GSK2014-A), a **paid, contract-licensed, non-public corpus** with separate commercial vs. academic agreements. The MIT label on the weights does not erase the restrictive training-data provenance. **Get legal sign-off before relying on GiNZA models commercially; you cannot redistribute BCCWJ.** spaCy with other/your own models is fine.
- **NEologd trap:** Apache-2.0 build tooling, but entries aggregate **many third-party sources** (Hatena Keyword data, Japan Post, etc.) with their own terms. **Use server-side only — query it, never ship the raw dict to clients** — and note it's stale (frozen Aug 2020).
- **WaniKani API / jpdb / jlptsensei:** proprietary, no redistribution — **not usable as bundled data**, reference only.
- **Engine-vs-dictionary rule:** for every tokenizer (Lindera/Vibrato/Sudachi/kuromoji) the engine license is never the problem — your obligations come from **which dictionary you bundle**. Match a permissive dict (IPADIC, SudachiDict, or UniDic-BSD).

**Cleanest end-to-end combination for FolioNote:** tokenizer = kuromoji-IPADIC (MVP) → Lindera + SudachiDict/UniDic-BSD (later); J-E + kanji = JMdict (or Jitendex)/KANJIDIC2/RADKFILE (CC BY-SA 4.0, attribute + keep redistributed data under BY-SA); kana transliteration = wanakana (MIT); stroke order = KanjiVG (CC BY-SA 3.0); on-device boundaries = BudouX (Apache-2.0); sentences = Tatoeba (CC BY 2.0 FR); JLPT tags = Waller-derived (CC BY, credit the site). **Do not bake GiNZA's BCCWJ-trained models or NEologd into any offline/exportable pack without legal review.**

---

## 6. Recommended Architecture for This Monorepo

FolioNote already exposes type-safe procedures from `packages/api/src/routers/*` — verified to include `entries.ts`, `search.ts`, `ai.ts`, **`graph.ts`**, `review.ts`, `shares.ts`, `sources.ts`, `storage.ts`, `tags.ts` — consumed by web and native, with Drizzle schema in `packages/db/src/schema/*` (verified: `ai.ts`, `auth.ts`, `entries.ts`, `graph.ts`). The Japanese feature should follow that exact pattern — **one server-side analysis path, no on-device analysis on native.**

> **Reuse the existing knowledge graph.** `schema/graph.ts` already models a note-to-note knowledge graph (`entry_links`, with `linkType` `ref`/`manual`) powering the Graph View. A vocabulary/kanji-linking feature (word → entries where it appears, kanji → words) is the same shape and should **extend or mirror the existing graph tables/router (`graph.ts`)** rather than inventing a parallel linking system. There is already a `review.ts` router — relevant if you wire vocab into an SRS/review loop. (Note: the web app already ships a `components/review/japanese-typing-practice.tsx` surface — fold any new Japanese study UI into that area rather than starting fresh.)

**Layered design:**

1. **Static reference data (build/seed time).** A new `packages/db` schema module (e.g. `schema/japanese.ts`, joined to the existing `entries`/`graph` schema by foreign key) for vocabulary (JMdict- or Jitendex-derived), kanji (KANJIDIC2 + KanjiVG codepoint→SVG mapping), JLPT level tags (Waller-derived, vocab from `yomitan-jlpt-vocab`, kanji from `davidluzgouveia/kanji-data` minus `wk_*`), and optionally Tatoeba sentences. Loaded once from `scriptin/jmdict-simplified` JSON (or a `jmdict-yomitan` bundle) via its MIT streaming loader and seeded into Postgres. No runtime API calls.

2. **Tokenizer singleton (server only).** Initialize the analyzer **once at server boot** (`@patdx/kuromoji`'s `await builder.build()`, or Lindera's WASM `init()` + `TokenizerBuilder` later) and keep it as a module-level singleton in `apps/server`. This avoids per-request model loading. Use the WASM (not NAPI) build of Lindera if/when you migrate, so there's **no native compilation on the PM2/Caddy VPS** (and note a published NAPI package was not confirmed — stick to the verified WASM packages).

3. **Analysis pipeline → enriched tokens.** Per text: tokenize → for each token emit `{ surface, pos + pos_detail_1..3, conjugatedType, conjugatedForm, baseForm, reading }`. Derive **furigana from the token `reading` field**, converting katakana→hiragana with **[wanakana](https://github.com/WaniKani/WanaKana) (`toHiragana`, MIT)** rather than hand-rolling the mapping or adding [kuroshiro](https://www.npmjs.com/package/kuroshiro) (MIT but low-maintenance, last publish 2021). Then a **JLPT annotation post-step**: look up each token's `baseForm` against the seeded Waller vocab table (and kanji against the kanji table) to attach an approximate N-level + the unofficial-data disclaimer flag.

4. **One oRPC procedure with an explicit failure contract.** Add `japanese.analyze({ text })` to `packages/api/src/routers/` returning the enriched token array (segments + readings/furigana + POS + JLPT level). Per CLAUDE.md ("handle failures explicitly — no silent errors"), the contract must define:
   - **Tokenizer init failure** — if the boot singleton failed/never resolved, the procedure throws a typed oRPC error (e.g. `INTERNAL`/`SERVICE_UNAVAILABLE`) rather than returning empty tokens; a readiness check gates the route.
   - **Empty / oversized input** — reject empty/whitespace-only text and cap input length (return a validation error past a sane limit) to bound per-request work.
   - **Non-Japanese / mixed input** — do not error; return tokens with `null` reading/JLPT for non-Japanese spans so the caller can render plain text. The response should carry a `containsJapanese` flag.
   - **Per-token annotation miss** — a `baseForm` absent from the JLPT table yields `jlptLevel: null` (an expected, non-error state), never a thrown error.

   This is the single source of truth: **web** may optionally also run a client-side WASM tokenizer for offline boundary needs, but the canonical analysis is server-side; **native** _only_ consumes this procedure.

5. **Performance: precompute at ingest.** Because FolioNote captures notes/entries, run analysis **at entry-save time** and persist the enriched tokens alongside the entry (Drizzle), so reads are cheap and native never blocks on analysis.

**RN / Hermes constraints (decisive) — grounded in this repo (RN 0.85.3, Expo ^56.0.9, both verified):**

- Hermes does **not** implement `Intl.Segmenter` (needs `@formatjs/intl-segmenter`, ~300KB iOS) and is **not** a production target for WASM/NAPI MeCab analyzers. _Note:_ RN 0.84 introduced experimental WASM in Hermes, and **this project is already on RN 0.85.3 (past 0.84)** — so the capability may now exist, but its production-readiness on 0.85's Hermes is unverified. **Confirm 0.85's actual Hermes-WASM status before depending on it; do not architect around on-device WASM tokenization yet.**
- For the narrow on-device, boundary-only case (e.g. local tap-to-select before the oRPC round-trip), **[BudouX](https://github.com/google/budoux) is the recommended choice**: Apache-2.0, actively developed into 2026, pure-JS/dependency-free (~15KB), runs on Hermes with **zero polyfill and zero MeCab dictionary** via `loadDefaultJapaneseParser()`. TinySegmenter remains a frozen fallback. **Neither provides readings/POS/JLPT** — everything with linguistic enrichment comes from the server.
- **Offline dictionary lookup on native (tap-a-word → definition while offline, when the token wasn't precomputed):** the architecture's "native only consumes oRPC" rule covers the _online_ path but leaves offline lookup unaddressed. For a learning app this is a real gap. **Recommended option: bundle an on-device JMdict subset as a read-only SQLite asset** (e.g. via `expo-sqlite`), scoped to common entries (or the user's saved-vocabulary set) to bound size, queried locally for instant offline definitions. Boundaries for the tap come from BudouX; the lookup hits the bundled SQLite; full/rare entries still fall back to `japanese.analyze` when online. This is a deliberate Phase-2+ addition, not an MVP requirement — but it should be a planned path, not an omission.
- KanjiVG SVGs render on native via `react-native-svg`, so the stroke-order feature is genuinely cross-platform without server involvement.

---

## 7. Phased Integration Plan

**Phase 1 — MVP (token-level, pure Node, free):**

- Add `"engines": { "node": ">=20" }` to the root `package.json` (no engines field exists today) to pin a full-ICU, WASM-capable baseline.
- Seed JMdict + KANJIDIC2 (via `scriptin/jmdict-simplified`, or a `jmdict-yomitan` bundle) and KanjiVG into Postgres/Drizzle (`schema/japanese.ts`, FK'd to `entries`).
- Add `@patdx/kuromoji` (evaluate `@aiktb/kuromoji` as the alternative) as a server-boot singleton; build the `japanese.analyze` oRPC procedure with the explicit failure contract (§6.4), returning segments + furigana (from `reading`, converted via wanakana) + POS + base form.
- Precompute and persist enriched tokens at entry ingest. Native + web consume the procedure.
- Add a **Credits/Licenses screen** (web + native) attributing EDRDG/JMdict (and Jitendex if used), KanjiVG/Ulrich Apel, Tatoeba (if used), the tokenizer + its dictionary, wanakana, BudouX (if used on-device), and Jonathan Waller.

**Phase 2 — JLPT level mapping, vocab graph, richer dictionary quality:**

- Seed Waller-derived JLPT tags (vocab via `yomitan-jlpt-vocab`, kanji via `davidluzgouveia/kanji-data` with `wk_*` stripped); add the JLPT post-step to `analyze`. **Ship the "levels are unofficial/approximate" disclaimer in the UI.**
- Wire vocab/kanji ↔ entry links by **extending the existing `graph.ts` schema/router** (reuse `entry_links`-style topology), and optionally feed vocab into the existing `review.ts` SRS loop.
- Add **on-device offline lookup**: bundle a scoped JMdict SQLite subset for native (`expo-sqlite`), with BudouX for on-device tap boundaries.
- Optionally migrate the tokenizer to **Lindera (WASM) + UniDic-BSD** for better lemma/conjugation/reading quality (pick a core/small UniDic build; confirm the BSD license header). Keep the same oRPC contract so clients don't change.
- Add Tatoeba example sentences (attribution-only) linked to vocab.

**Phase 3 — Richer grammar (only if the roadmap needs it):**

- Stand up a Python (FastAPI) microservice running **GiNZA `ja_ginza`** (CPU) for UD dependency trees, bunsetsu structure, and NER; the Node server calls it and re-exposes via oRPC (`japanese.parse`). **Requires legal sign-off on BCCWJ-trained-model provenance first.** Reserve KWJA for PAS/coreference/discourse and KNP for research-grade case analysis. Accept the added Python runtime + RAM as a deliberate cost.

---

## 8. Open Questions / Risks

- **JLPT level accuracy is unfixable for free.** All level data is one un-curated 2010-era source with known errors (N1 words seen on N2). Risk: users trust the labels as official. Mitigation: prominent disclaimer + framing as "study grouping." Open question: is editorially curating your own grammar/level list (using jlptsensei/jpdb only as human reference, never scraped) worth the effort for a premium tier?
- **Single-maintainer / staleness risk** on the kuromoji forks (`@patdx` and `@aiktb` are each small efforts; `@sglkc` and IPADIC are effectively frozen). Lindera mitigates this but adds a WASM build step. Decide the migration trigger (UniDic accuracy need vs. fork bit-rot).
- **Verify all version/date strings at integration time.** This report deliberately avoids hard-coding exact tokenizer versions/dates (Lindera, Vibrato, Kagome, KWJA, UniDic, and the `@patdx`/`@aiktb` publish dates), because point-in-time version strings go stale and are easy to misquote. **Pin actual versions from npm/crates/GitHub when you wire each library in**, and re-confirm Lindera's current package names (`lindera-wasm`, `lindera-wasm-ipadic`, `lindera-wasm-unidic`, `lindera-wasm-nodejs-ipadic` are confirmed; a `lindera-nodejs` NAPI package was **not** confirmed).
- **GiNZA/BCCWJ legal ambiguity** blocks any dependency-parsing feature until legal review, and GiNZA's accuracy is **not self-published** (the cited numbers are proxied from spaCy). Open question: is the bunsetsu/dependency feature even on the roadmap, given it forces a second runtime?
- **UniDic licensing + size diligence:** must verify the exact version's BSD header before shipping; the full dict is large (verify the specific build's size — gigabyte-scale for full UniDic) — confirm a core/small build covers your vocabulary needs and bundle size.
- **Hermes WASM is moving and this project is already on RN 0.85.3.** RN 0.84 added experimental WASM in Hermes; 0.85 is past that. Re-evaluate whether on-device Lindera-WASM is viable on 0.85's Hermes (would remove the oRPC round-trip for offline analysis) — but **verify 0.85's actual Hermes-WASM production status first; do not architect around it yet.** In the meantime, BudouX covers the on-device boundary-only need with zero polyfill.
- **Native offline dictionary lookup** is an explicit design decision, not a default: decide whether to bundle a JMdict SQLite subset for offline tap-a-word (recommended for a learning app) and how to scope it (common entries vs. user's saved vocab) to bound app size.
- **CC BY-SA refresh + offline packs:** EDRDG asks for ~monthly data refresh on web; if you ship an _exportable/offline_ pack (including a bundled JMdict SQLite), the embedded CC BY-SA data (JMdict/Jitendex/KanjiVG) must itself be released under CC BY-SA and not claimed as proprietary — design the export with that in mind.
- **Jreibun** (highest-quality learner sentences) is blocked on its bulk download still being "in preparation" — track it; it could upgrade Phase-2 example sentences but is untagged for JLPT.
- **Minor data-freshness nits to verify at implementation time:** `jamsinclair` is Waller-derived (not JMdict-glossed) and last updated Aug 2025; `elzup` is stale (2023); JMdict is **~214k** entries as of Dec 2025 (not the often-quoted ~170k); KANJIDIC2's built-in `<jlpt>` is the wrong (pre-2010) scale. None change the recommendation.
