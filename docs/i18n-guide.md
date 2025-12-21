# 国际化（i18n）指南

本文档描述 FolioNote 项目的国际化基础设施和使用方法。

## 架构概览

```text
packages/locales/          # 共享语言资源包
├── src/
│   ├── index.ts          # 导出配置和工具函数
│   └── resources/
│       ├── en-US.json    # 英文资源
│       └── zh-CN.json    # 中文资源

apps/web/src/lib/i18n.ts   # Web 端 i18n 初始化
apps/native/lib/i18n.ts    # Native 端 i18n 初始化
apps/server/src/i18n.ts    # Server 端 i18n 初始化
```

## 支持的语言

- `en-US` - 英文（默认）
- `zh-CN` - 简体中文

## 使用方法

### Web 端

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  
  return (
    <div>
      <h1>{t('auth.signIn')}</h1>
      <p>{t('common.loading')}</p>
    </div>
  )
}
```

### Native 端（Expo）

```tsx
import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

function MyScreen() {
  const { t } = useTranslation()
  
  return <Text>{t('auth.welcome')}</Text>
}
```

Native 端会自动检测设备语言并设置对应的 locale。

### Server 端

Context 会自动解析请求头中的语言偏好：

1. `X-Locale` 头（优先）
2. `Accept-Language` 头

```ts
// 在 API 处理中使用 context.locale
const requireAuth = o.middleware(({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError('UNAUTHORIZED', {
      message: getLocalizedErrorMessage('unauthorized', context.locale),
    })
  }
  // ...
})
```

## 语言资源 Key 规范

语言资源按命名空间组织：

| 命名空间 | 用途 |
|---------|------|
| `common` | 通用 UI 文案（保存、取消、加载等） |
| `auth` | 认证相关（登录、注册、密码等） |
| `entry` | 条目相关（标题、内容、收件箱等） |
| `tag` | 标签相关 |
| `source` | 来源相关 |
| `review` | 复习相关 |
| `error` | 错误信息 |

### Key 命名规范

- 使用 camelCase
- 保持简洁明确
- 示例：`auth.signIn`、`entry.emptyInbox`、`error.unauthorized`

## 添加新的翻译

1. 在 `packages/locales/src/resources/en-US.json` 添加英文文案
2. 在 `packages/locales/src/resources/zh-CN.json` 添加对应的中文翻译
3. 确保两个文件的 key 保持一致

## 切换语言

### Web 端

```ts
import { i18n } from '@/lib/i18n'

// 切换到中文
i18n.changeLanguage('zh-CN')

// 切换到英文
i18n.changeLanguage('en-US')
```

### Native 端

```ts
import { i18n } from '@/lib/i18n'

i18n.changeLanguage('zh-CN')
```

## 客户端请求设置语言

在发送 API 请求时，可以通过 `X-Locale` 或 `Accept-Language` 头指定语言：

```ts
fetch('/rpc/someEndpoint', {
  headers: {
    'X-Locale': 'zh-CN',
    // 或
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  },
})
```

