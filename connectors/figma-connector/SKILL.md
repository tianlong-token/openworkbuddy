---
name: figma-connector
description: Figma API 连接器 - 用于获取设计数据、导出图片、生成代码。支持 Design-to-Code 工作流。
version: "2.1.0"
author: "CodeBuddy AI"
created: "2026-02-01"
updated: "2026-02-05"
---

# Figma Connector

获取设计数据、导出图片、生成 React/Tailwind 代码。

## 安全警告

**绝对禁止以下行为:**

1. **禁止输出 Token**: 不要执行 `echo $FIGMA_TOKEN` 或任何会打印 token 值的命令
2. **禁止明文 Token**: curl 命令中必须使用 `$FIGMA_TOKEN` 环境变量引用，禁止将 token 值直接写入命令

```bash
# 正确 - 使用环境变量引用
curl -H "Authorization: Bearer $FIGMA_TOKEN" "https://api.figma.com/v1/..."

# 错误 - 禁止明文 token
curl -H "Authorization: Bearer figu_xxxxx" "https://api.figma.com/v1/..."
```

Token 泄露会导致严重的安全问题。

## 路径说明

> `<skill-directory>` 指的是**本 Skill 所在目录**，而非用户项目目录。

## 快速开始

> **重要**: Token 获取和 API 调用必须在**同一条命令**中完成，确保 token 正确传递到 curl 中。

```bash
# 正确方式 - 一条命令完成 token 获取和 API 调用
source <skill-directory>/scripts/get_token.sh figma && export FIGMA_TOKEN && curl -H "Authorization: Bearer ${FIGMA_TOKEN}" "https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}"

# 错误方式 - 分开执行可能导致 token 未正确传递
# source <skill-directory>/scripts/get_token.sh figma
# curl -H "Authorization: Bearer $FIGMA_TOKEN" ...  # token 可能为空！
```

**为什么必须一条命令？** 在某些 shell 环境中，分步执行时环境变量可能不会正确传递到后续命令。使用 `&&` 链接确保 token 在同一 shell 会话中被正确设置和使用。

**错误处理**：
- **偶发 403 错误**: Figma API 偶尔会返回 403 错误，这通常是临时性问题。如果遇到 403，请重试 2-3 次。
- **持续 401/403 错误**: 如果多次重试仍然失败，请提示用户：**"您的 Figma OAuth 授权可能已失效或过期，请在 CodeBuddy 设置页面的「连接器」处重新授权 Figma。"**

## 认证方式

本 Skill 使用 **OAuth Token**，需要 `Authorization: Bearer` header：

```bash
curl -H "Authorization: Bearer $FIGMA_TOKEN" "https://api.figma.com/v1/..."
```

| 认证方式 | Header |
|---------|--------|
| Personal Access Token | `X-Figma-Token: token` |
| **OAuth Token (本 Skill)** | `Authorization: Bearer token` |

## URL 解析

```
https://www.figma.com/design/JcHJusqhdcLvTpayC8MwXq/文件名?node-id=1348-168
                             ↑ file_key                      ↑ node_id
```

---

## 核心 API

### 获取节点数据

```bash
# 一条命令：获取 token + 调用 API
source <skill-directory>/scripts/get_token.sh figma && export FIGMA_TOKEN && \
  curl -H "Authorization: Bearer ${FIGMA_TOKEN}" \
  "https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}" > figma-data.json
```

### 导出图片/SVG

```bash
# 一条命令：获取 token + 获取图片 URL
source <skill-directory>/scripts/get_token.sh figma && export FIGMA_TOKEN && \
  curl -H "Authorization: Bearer ${FIGMA_TOKEN}" \
  "https://api.figma.com/v1/images/{file_key}?ids={node_id}&format=svg"

# 响应示例
{
  "images": {
    "1348:172": "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/xxx"
  }
}

# 下载 SVG（无需 token）
curl -o icon.svg "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/xxx"
```

### 获取样式

```bash
curl -H "Authorization: Bearer $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/{file_key}/styles"
```

---

## 重要提示

### 1. JSON 数据量大

Figma 返回的 JSON 非常详细，单个组件可能有 **5000+ 行**。建议保存到文件：

```bash
curl -H "Authorization: Bearer $FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/{file_key}/nodes?ids={node_id}" > figma-data.json
```

### 2. 图标必须单独下载

**VECTOR 类型节点不包含 SVG 路径数据**，必须通过 Images API 导出：

```bash
# 1. 找到图标节点 ID（type 为 VECTOR）
# 2. 调用 Images API
curl -H "Authorization: Bearer $FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/{file_key}?ids=1348-172&format=svg"
# 3. 下载返回的 URL
```

### 3. 颜色值转换

Figma 颜色是 0-1 浮点数，需转换为 hex：

```javascript
// { r: 0.772549, g: 0.772549, b: 0.772549 } => #C5C5C5
function rgbaToHex({ r, g, b }) {
  const toHex = n => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
```

### 4. Auto Layout → Flexbox

| Figma | CSS |
|-------|-----|
| `layoutMode: "HORIZONTAL"` | `flex-direction: row` |
| `layoutMode: "VERTICAL"` | `flex-direction: column` |
| `itemSpacing` | `gap` |
| `primaryAxisAlignItems: "CENTER"` | `justify-content: center` |
| `counterAxisAlignItems: "CENTER"` | `align-items: center` |

---

## Design-to-Code 流程

```
1. 解析 URL → file_key + node_id
2. 调用 Nodes API → 获取 JSON
3. 保存 JSON → 分析结构
4. 找 VECTOR 节点 → 收集图标 ID
5. 调用 Images API → 下载 SVG
6. 生成代码 → HTML/CSS/React
```

---

## 常用 API

| 操作 | API |
|------|-----|
| 获取文件 | `GET /v1/files/{file_key}` |
| 获取节点 | `GET /v1/files/{file_key}/nodes?ids={ids}` |
| 导出图片 | `GET /v1/images/{file_key}?ids={ids}&format=svg` |
| 获取样式 | `GET /v1/files/{file_key}/styles` |
| 获取组件 | `GET /v1/files/{file_key}/components` |
| 获取变量 | `GET /v1/files/{file_key}/variables/local` |

---

## 代码生成示例

### Figma → React

```typescript
function extractStyles(node) {
  const styles = {};
  
  if (node.absoluteBoundingBox) {
    styles.width = node.absoluteBoundingBox.width;
    styles.height = node.absoluteBoundingBox.height;
  }
  
  if (node.fills?.length) {
    const fill = node.fills.find(f => f.visible !== false && f.type === 'SOLID');
    if (fill?.color) styles.backgroundColor = rgbaToHex(fill.color);
  }
  
  if (node.cornerRadius) styles.borderRadius = node.cornerRadius;
  
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    styles.display = 'flex';
    styles.flexDirection = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
    if (node.itemSpacing) styles.gap = node.itemSpacing;
  }
  
  return styles;
}
```

### Figma → Tailwind

```typescript
function figmaToTailwind(node) {
  const classes = [];
  
  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    classes.push(`w-[${Math.round(width)}px]`, `h-[${Math.round(height)}px]`);
  }
  
  if (node.fills?.length) {
    const fill = node.fills.find(f => f.visible !== false && f.type === 'SOLID');
    if (fill?.color) classes.push(`bg-[${rgbaToHex(fill.color)}]`);
  }
  
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    classes.push('flex');
    classes.push(node.layoutMode === 'HORIZONTAL' ? 'flex-row' : 'flex-col');
    if (node.itemSpacing) classes.push(`gap-[${node.itemSpacing}px]`);
  }
  
  return classes.join(' ');
}
```

---

## 资源

- [Figma API Docs](https://www.figma.com/developers/api)
- [Plugin API](https://www.figma.com/plugin-docs/)
