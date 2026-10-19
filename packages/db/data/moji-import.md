# MOJi N5 词汇导入

源代码基线：`0d94f17`。输入为用户提供的 `data/N5/1.json` 至 `8.json`，对应「第1週」词单的完整 211 条；上级合集标称 552 条，不代表这次提供了全部合集。

## 本地导入结果（2026-10-18）

已应用迁移 `0018_moji_vocab_metadata` 并提交导入到 `127.0.0.1:54322/postgres`。

| 检查 | 结果 |
| --- | --- |
| 原始页数 / 记录数 / 去重后记录数 | 8 / 211 / 211 |
| 新增 / 补充已有记录 | 40 / 171 |
| 新增词等级 | N5：38；N4：1（専門）；N3：1（半年） |
| 异体写法匹配 | 3（大変、この間、お先に） |
| 中文释义 / 日文释义 / 有音调的记录 | 207 / 4 / 207 |
| 词库总数 | 7,811 → 7,851 |
| 重复执行实际结果 | `inserted: 0, updated: 0, unchanged: 211` |
| 原有 OpenJLPT 核心字段 | 导入前后校验值一致 |
| 原有例句 | 13,718 条，数量和全字段校验值一致 |

18 条记录存在来源等级与库中等级差异，均保留库中等级。清洗变化在 `moji-n5.cleaned.json` 的 `issues` 中；本地审计和等级冲突明细在仓库 `.cache/moji-import/2026-10-18/` 下的 `import.json`、`repeat.json`、`verification.json` 中。

回归验证：`vp test packages/db/__tests__/import-moji.test.ts packages/db/__tests__/seed-openjlpt.test.ts` 输出 `26 passed`；`vp check` 通过。脚本单独类型检查及 db、API、server、web、native 的类型检查用于确认字段扩展兼容现有代码。

## 清洗与字段

- 只允许词汇、词单元数据进入输出，剔除账户、认证、联系方式和互动统计。原始 JSON 留在本地并由 `.gitignore` 排除。
- 按来源 ID 去重，冲突重复项中止；同一词形不同读音保留。缺页、空文件、页数或总数不符均中止。
- 假名做 NFKC 规范化、去空格；复用 `@folionote/japanese` 的 `kanaToRomaji` 从读音生成罗马字。原始读音、罗马字和释义保留在来源证据中。
- 从摘要提取词性，按分号拆分、去重释义，不凭空翻译英文。新增词的 `meanings_en` 为 `[]`。
- 已人工核对的「店／てん」「三つ目」「一つ目」「南口」使用日文释义，写入新增的 `meanings_ja`。含日文引用的中文释义仍归入中文，不通过“含假名”粗略判定语言。该语言判定目前针对这份数据，扩展其他词单前需要再次核对。
- 「三つ目」原释义为“有三只眼”，保留原文并标注待核对，不擅自改成“第三个”。
- 新增 `pitch_accents` 保存去重的数值音调，如 `⓪③ → [0, 3]`；缺失音调为 `[]`，不能当作平板型 `0`。
- 新增 `source_details` 保存 MOJi 词条 ID、更新时间、词单、页内顺序、标签、词性和原始词汇摘要。MOJi ID 不写入 `jmdict_id`，其词性标签也不冒充 JMdict 编码。

## 合并规则

优先匹配稳定来源 ID，然后匹配词形＋读音，最后匹配相同读音的唯一 `other_forms` 异体写法。多候选匹配中止，避免选错词条。

已有记录保留 ID、等级、英文、罗马字、JMdict 信息、例句、创建时间和原始 `source/source_version`；只补充空的中文、日文、音调字段，附加 MOJi 来源证据。新记录使用 `moji:<objectId>` 主键及整个清洗结果的 SHA-256 版本。

新词有多个 JLPT 标签时取最低难度（N5 优先），无等级标签才按用户提供的 N5 词单归类。该等级不代表官方 JLPT 认定。已有词的等级冲突保留原等级，并记录在导入审计中。

不同读音不能合并音调。「毎月／まいつき」「毎年／まいとし」虽然出现在已有词的 `other_readings` 中，仍作为读音不同的记录保留；「何時／なんじ」不与「いつ」合并。

## 执行

以下命令从仓库根目录执行；参数路径由 `packages/db` 解析。脚本默认只清洗，不连接数据库。

```sh
vp run --filter @folionote/db db:import:moji --input ../../data/N5 --output data/moji-n5.cleaned.json

vp run --filter @folionote/db db:import:moji --input ../../data/N5 --output data/moji-n5.cleaned.json --preview --database-env ../../apps/server/.env --audit /tmp/folio-moji-preview.json

# 先核对迁移历史，确保待执行内容只有已审阅的迁移。
vp run --filter @folionote/db db:migrate

vp run --filter @folionote/db db:import:moji --input ../../data/N5 --output data/moji-n5.cleaned.json --apply --database-env ../../apps/server/.env --audit /tmp/folio-moji-import.json
```

数据库操作必须显式指定环境文件，不读取其他环境或回退到生产配置。审计文件必须不存在，重复执行请换一个文件名，以免覆盖首次导入前的数据。`--preview` 使用只读事务；`--apply` 在事务内加写锁、保存变更前镜像、写入并读取核对，失败自动回滚。再次导入应为 `inserted: 0, updated: 0, unchanged: 211`。

审计文件的 `prepared` 状态表示已保存计划；以命令输出的 `Committed` 和后续数据库核对为提交证据，不能仅凭文件存在认定导入成功。

## 回退与审计

每次执行的 `--audit` 文件包含 `changes[].before`、`after` 和来源版本。SQL 失败自动回滚，不需要人工恢复。

若需要撤销已提交的数据，先停止相关写入并比较数据库当前内容与审计的 `after`：仅对仍与导入后状态一致的 `update` 项恢复 `before` 中的 `meanings_zh`、`meanings_ja`、`pitch_accents`、`source_details`、`updated_at`；对 `insert` 项，在确认没有新增例句、词单引用或后续编辑后按记录 ID 删除。遇到差异先人工处理，不能覆盖后续编辑或触发关联数据级联删除。恢复过程必须在单个事务内完成。

应用代码回退可保留三个新增列，它们向后兼容；只有确认相关数据不再需要、代码不再依赖后才删除列。不要重跑旧 OpenJLPT 导入脚本作为回退方式。

## detail 来源映射

`moji-detail.sample.json` 是 `detail-19891051.json` 的字段白名单样本，词条为「お父さん」，不参与本次列表导入。

| 原始字段 | 后续映射与约束 |
| --- | --- |
| `word.objectId` | 与 `source_details.moji.entryId` 关联，不能当作 JMdict ID |
| `details[].objectId` | 词性分组来源 ID；`partOfSpeech/jita/katuyou` 是提供方数字编码，未取得定义前不可猜测含义 |
| `subdetails[].relaId` + `lang` | 同一义项的不同语言；样本为 2 个义项、2 条中文和 1 条日文释义 |
| `examples[].relaId` + `lang` | 同一例句的翻译配对；样本为 5 组日中例句，共 10 条语言记录 |
| `examples[].subdetailsId` | 关联义项；`index` 只在义项内排序，不是全词条唯一序号 |
| `notationTitle` | 提供方 HTML 注音；只能当作不可信文本保存，不能直接渲染 HTML，也不能直接当作现有 furigana 格式 |

迁移 `0019_moji_example_details` 已增加 `zh`、`source`、`source_id`、`source_details`，并将 `en` 改为可空。唯一键为 `(vocab_id, source, source_id)`；中文不写入英文列，缺少英文时保留 NULL。旧例句的字段值和位置保持不变，新例句追加到各词条原有例句之后。

结构化义项和提供方词性编码保存在 `jp_vocab.source_details.moji.detail`；例句的 `source_details.moji.senseId` 指向同一词条中的义项来源 ID。保留原词条摘要释义、等级、英文、音调和 JMdict 数据，不用 detail 覆盖已有内容。基础列表导入再次运行也会保留已导入的嵌套 detail。

## detail 双库导入（2026-10-18）

输入为 `.cache/moji-details/n5-week1-prepared-2026-10-18-v2/prepared-details.json`，同时核对同目录报告的文件哈希及基础词单哈希。只有整理后的 `senses`、`examples` 参与导入；3 条异常义项记录和 6 组待核对例句未入库。

| 项目                              | 本地           | 线上           |
| --------------------------------- | -------------- | -------------- |
| 新增词条 / 补充词条               | 0 / 211        | 40 / 171       |
| detail 词条 / 义项组              | 211 / 604      | 211 / 604      |
| 新增 MOJi 例句                    | 1,608          | 1,608          |
| 带振假名 / 带中文译文的 MOJi 例句 | 1,599 / 1,602  | 1,599 / 1,602  |
| 词库 / 例句总数                   | 7,851 / 15,326 | 7,851 / 15,326 |
| 再次实际执行导入                  | 零新增、零更新 | 零新增、零更新 |

两端通过独立连接核对，211 个词的来源详情和 1,608 条例句内容哈希一致。原有 13,718 条 OpenJLPT 例句的完整行哈希保持不变；事务内同时逐字段确认原有词汇核心字段未被修改。

审计位于 `.cache/moji-import-sync/`：`local-apply.json` / `production-apply.json` 保存变更前数据与计划；对应 `.verified.json` 保存写入后行和新增例句主键；`.committed.json` 记录事务提交。`*-repeat.json` 是重复执行证据，`verification.json` 是独立读回结果。审计文件仅保存在本地，不包含连接凭据。最初健康探测误用了本地 env 中的 localhost；随后使用前端生产配置的 `https://api.folionote.xyz/ready` 实测返回 `ready`、`db: true`。

导入脚本为 `packages/db/scripts/import-moji-details.ts`。从 `packages/db` 执行：

```sh
vp node --import tsx scripts/import-moji-details.ts \
  --input ../../.cache/moji-details/n5-week1-prepared-2026-10-18-v2 \
  --list data/moji-n5.cleaned.json \
  --database-env ../../apps/server/.env \
  --expected-target 251da17dc5f2d47c \
  --audit ../../.cache/moji-import-sync/local-new-preview.json
```

默认只读预演，写入需要 `--apply`。线上使用 `.env.production`，已核对的目标指纹为 `13ff589c653535b1`。指纹来自主机、端口、数据库和用户名，不包含密码；连接配置变化后必须重新核对，不能直接忽略指纹校验。审计路径必须是新文件。连接数为 1，批量写入在单个事务内完成，锁超时 5 秒、语句超时 30 秒；读回不一致自动回滚。已存在的 MOJi 例句若与来源不同，导入中止，不覆盖人工修改。

回退时使用首次 `*-apply.json` 和对应 `.verified.json`，不要使用零变更的 repeat 审计。锁定相关表后，先逐字段比较当前受影响行与 verified 的 `afterRows`、`insertedExamples`；任何差异都中止。只删除审计列出的新增例句主键，恢复已有词条的 `meanings_zh`、`meanings_ja`、`pitch_accents`、`source_details`、`updated_at`。线上新增的 40 个词必须先确认没有后续例句、词单或其他引用，才能按审计主键删除。全部回退在一个事务内执行，并核对原例句哈希；保留兼容的新列，无需删除迁移记录或重跑旧词库种子。

这里完成的是数据库同步。API 和 Web/Native 的中文例句、结构化义项展示尚未随此导入发布。
