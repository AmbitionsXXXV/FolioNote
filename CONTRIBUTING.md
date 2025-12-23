# Contributing to FolioNote

感谢你对 FolioNote 项目的兴趣！本文档将帮助你快速上手开发环境。

## 前置要求

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10.26.0
- [Docker](https://www.docker.com/) (用于本地数据库)
- [PostgreSQL](https://www.postgresql.org/) 客户端 (可选，用于直接访问数据库)

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/folio.git
cd folio
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 环境配置

复制环境变量模板并根据需要修改：

```bash
cp .env.example .env
```

### 4. 启动数据库

使用 Docker 启动本地 PostgreSQL：

```bash
pnpm run db:start:docker
```

或使用本地 PostgreSQL：

```bash
pnpm run db:init:local
pnpm run db:start:local
```

### 5. 推送数据库 Schema

```bash
pnpm run db:push
```

### 6. 启动开发服务器

启动所有服务：

```bash
pnpm run dev
```

或分别启动：

```bash
# API 服务器
pnpm run dev:server

# Web 应用
pnpm run dev:web

# 移动应用
pnpm run dev:native
```

## 项目结构

```text
folio/
├── apps/
│   ├── native/     # Expo 移动应用
│   ├── server/     # Hono API 服务器
│   └── web/        # TanStack Start Web 应用
├── packages/
│   ├── api/        # oRPC API 路由定义
│   ├── auth/       # Better Auth 配置
│   ├── config/     # 共享 TypeScript 配置
│   └── db/         # Drizzle ORM Schema 和数据库配置
└── docs/           # 项目文档
```

## 开发工作流

### 代码格式化与检查

项目使用 [Ultracite](https://github.com/haydenbleasel/ultracite)（基于 Biome）进行代码格式化和 lint：

```bash
# 检查并自动修复
pnpm run check

# 或直接使用 ultracite
pnpm exec ultracite fix
```

### 数据库操作

```bash
# 推送 Schema 变更到数据库
pnpm run db:push

# 生成迁移文件
pnpm run db:generate

# 运行迁移
pnpm run db:migrate

# 打开 Drizzle Studio
pnpm run db:studio
```

### 类型检查

```bash
pnpm run check-types
```

## 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 提交格式

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 类型 (Type)

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `style`: 代码格式（不影响代码运行的变更）
- `refactor`: 重构（既不是新功能也不是 Bug 修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变更

### 示例

```bash
feat(entries): add markdown editor support
fix(auth): resolve session persistence issue on mobile
docs(readme): update installation instructions
```

### 使用交互式提交

```bash
pnpm run commit
```

## Git Hooks

项目使用 [Lefthook](https://github.com/evilmartians/lefthook) 管理 Git hooks：

- **pre-commit**: 运行 lint 和格式化检查
- **commit-msg**: 验证提交信息格式

## 分支策略

- `main`: 稳定分支，用于发布
- `develop`: 开发分支，功能合并目标
- `feat/*`: 功能分支
- `fix/*`: Bug 修复分支

## Pull Request

1. 从 `develop` 创建功能分支
2. 完成开发并确保所有检查通过
3. 提交 PR 到 `develop` 分支
4. 等待代码审查
5. 合并后删除功能分支

## 问题反馈

如果你发现 Bug 或有功能建议，请创建 Issue。

## 许可证

请查看 [LICENSE](./LICENSE) 文件了解许可证信息。
