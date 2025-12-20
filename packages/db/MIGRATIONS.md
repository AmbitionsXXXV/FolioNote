# Database Migration Workflow

本文档说明 FolioNote 项目的数据库迁移策略和工作流程。

## 迁移策略：Push vs Migrations

### 开发环境（Development）：使用 `db:push`

```bash
bun run db:push
```

- 直接将 schema 变更推送到数据库
- 快速迭代，无需生成迁移文件
- **注意**：可能会导致数据丢失，仅用于开发

### 生产环境（Production）：使用 Migrations

```bash
# 1. 生成迁移文件
bun run db:generate

# 2. 检查生成的迁移文件（在 src/migrations 目录）

# 3. 应用迁移
bun run db:migrate
```

## 工作流程

### 日常开发

1. 修改 `src/schema/*.ts` 文件
2. 运行 `bun run db:push` 同步到本地数据库
3. 使用 `bun run db:studio` 查看数据

### 准备发布

1. 确保所有 schema 变更已完成
2. 运行 `bun run db:generate` 生成迁移文件
3. Review 生成的 SQL 文件
4. 提交迁移文件到 Git
5. 在生产环境运行 `bun run db:migrate`

## 命令参考

| 命令 | 用途 |
|------|------|
| `bun run db:push` | 开发环境快速同步 schema |
| `bun run db:generate` | 生成迁移文件 |
| `bun run db:migrate` | 应用迁移文件 |
| `bun run db:studio` | 打开 Drizzle Studio 可视化工具 |

## 本地数据库管理

```bash
# Docker 方式
bun run db:start:docker   # 启动
bun run db:stop:docker    # 停止

# 本地 PostgreSQL
bun run db:init:local     # 初始化
bun run db:start:local    # 启动
bun run db:stop:local     # 停止
```

## 最佳实践

1. **永远不要**在生产环境使用 `db:push`
2. 迁移文件一旦提交，**不要修改**
3. 在 PR 中包含迁移文件的 review
4. 保持迁移文件的原子性（一个功能一个迁移）
5. 为破坏性变更（删除列/表）添加警告注释
