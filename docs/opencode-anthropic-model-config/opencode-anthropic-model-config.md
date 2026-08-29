# 为 OpenCode 配置自定义 Anthropic 端点

OpenCode 是一个终端里的 AI 编码代理，它本身不绑定任何模型厂商，所有可用模型都来自配置文件中声明的 provider。要让它使用 Claude 系列模型，需要解决两件事：凭据从哪里来，以及模型的能力参数如何声明。

对多数用户来说，直接使用内置的 `anthropic` provider 即可，模型清单和上下文长度会自动从 Models.dev 拉取。但如果请求需要经过自建网关、企业代理，或者要接入一个 Anthropic 兼容但不在官方目录中的端点，就必须手工声明 provider 和每个模型的参数，这时理解配置文件中每个字段的含义就成了必需。

本文说明两种配置方式，并逐项解释 JSON 中各字段的作用、取值来源和填错后的表现。

## 目录

- [一、适用场景与前置条件](#一适用场景与前置条件)
- [二、配置文件位置与优先级](#二配置文件位置与优先级)
- [三、方式一：使用内置 anthropic provider](#三方式一使用内置-anthropic-provider)
- [四、方式二：自定义 provider 接入兼容端点](#四方式二自定义-provider-接入兼容端点)
- [五、配置字段逐项说明](#五配置字段逐项说明)
- [六、限制可选模型范围](#六限制可选模型范围)
- [七、验证配置是否生效](#七验证配置是否生效)

---

## 一、适用场景与前置条件

以下场景需要手工编辑配置文件：

- 请求需要经过自建网关或企业代理，不能直连 `api.anthropic.com`
- 需要固定默认模型，避免每次启动后手动切换
- 需要为轻量任务指定一个更便宜的小模型
- 接入的端点不在 OpenCode 内置目录中，模型的上下文长度等参数无法自动获取

开始前，请确认：

1. 已安装 OpenCode，且可以正常启动 TUI。
2. 已持有一个可用的 API key，或已确定网关地址与认证方式。
3. 明确要使用的模型 ID。模型 ID 与展示名称不是一回事，请求中使用的是 ID。

> **注意：** OpenCode 官方文档明确说明，通过插件把 Claude Pro / Max 订阅接入 OpenCode 的做法被 Anthropic 禁止，1.3.0 版本起相关插件已不再随发行版捆绑。本文只讨论 API key 与自建端点这两种合规方式。

---

## 二、配置文件位置与优先级

OpenCode 支持 `JSON` 与 `JSONC`（带注释的 JSON）两种格式，后者允许写 `//` 注释和尾随逗号，适合需要长期维护的配置。

常用的两个位置：

| 位置 | 路径 | 用途 |
|---|---|---|
| 全局配置 | `~/.config/opencode/opencode.json`（或 `.jsonc`） | 用户级偏好，如 provider、默认模型 |
| 项目配置 | 项目根目录下的 `opencode.json` | 项目专属设置，可提交到 Git |

完整的加载顺序为（后者覆盖前者）：

```text
远端配置(.well-known/opencode)
  -> 全局配置(~/.config/opencode/)
  -> 自定义路径(OPENCODE_CONFIG 环境变量)
  -> 项目配置(项目根目录 opencode.json)
  -> .opencode 目录
  -> 内联配置(OPENCODE_CONFIG_CONTENT 环境变量)
  -> 系统托管配置
```

> **重要：** 各层配置是**合并**而非替换。只有键名冲突时才会被后加载的配置覆盖，不冲突的设置全部保留。因此在项目配置里只写 `model` 一项，全局配置中的 provider 声明依然有效。

Provider 与模型属于用户级设置，建议放在全局配置中。本文后续示例均以 `~/.config/opencode/opencode.jsonc` 为例。

---

## 三、方式一：使用内置 anthropic provider

这是最简单的方式，适合直连官方 API 的场景。

### 3.1 添加凭据

在 TUI 中运行 `/connect`，选择 Anthropic，然后选择手工输入 API key：

```text
/connect

┌ Select auth method
│
│ Manually enter API Key
└
```

凭据会保存到 `~/.local/share/opencode/auth.json`，不写入配置文件。因此配置文件可以安全地提交到版本库。

### 3.2 指定默认模型

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5"
}
```

这两行就是全部所需。模型清单、上下文长度、是否支持图片等参数由 OpenCode 自动获取，不需要手写 `models` 段。

### 3.3 仅修改请求地址

如果只是需要把请求转发到一个代理，但模型清单仍沿用官方目录，可以只覆盖 `baseURL`：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "options": {
        "baseURL": "https://gateway.example.com/v1"
      }
    }
  }
}
```

由于配置是合并的，这里只声明 `options`，provider 的其余定义仍来自内置目录。

---

## 四、方式二：自定义 provider 接入兼容端点

当端点不在内置目录中时，需要完整声明一个 provider。这种情况下 OpenCode 无从知道有哪些模型、每个模型的能力如何，所有信息都必须由配置文件提供。

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "my-anthropic/claude-sonnet-4-5",
  "small_model": "my-anthropic/claude-haiku-4-5",
  "provider": {
    "my-anthropic": {
      "npm": "@ai-sdk/anthropic",
      "name": "My Anthropic Gateway",
      "options": {
        "baseURL": "https://gateway.example.com/v1",
        "apiKey": "{env:ANTHROPIC_API_KEY}",
        "timeout": 600000
      },
      "models": {
        "claude-sonnet-4-5": {
          "name": "Claude Sonnet 4.5",
          "attachment": true,
          "modalities": {
            "input": ["text", "image", "pdf"],
            "output": ["text"]
          },
          "limit": {
            "context": 200000,
            "output": 65536
          }
        },
        "claude-haiku-4-5": {
          "name": "Claude Haiku 4.5",
          "attachment": true,
          "limit": {
            "context": 200000,
            "output": 65536
          }
        }
      }
    }
  }
}
```

下一节逐项说明这些字段。

---

## 五、配置字段逐项说明

### 5.1 顶层字段

| 字段 | 必需 | 说明 |
|---|---|---|
| `$schema` | 否 | 指向 `https://opencode.ai/config.json`。编辑器据此提供补全和校验，写错字段名会立刻标红，强烈建议保留 |
| `model` | 否 | 默认模型，格式为 `<provider-id>/<model-id>`，两段分别对应 `provider` 下的键和 `models` 下的键 |
| `small_model` | 否 | 用于会话标题生成等轻量任务的模型。不设置时 OpenCode 会尝试使用该 provider 中更便宜的模型，都没有则回退到主模型 |
| `provider` | 否 | Provider 定义表。键是 provider ID，可以是任意字符串，但必须与 `model` 中引用的前缀一致 |

> **注意：** `model` 的两段是纯字符串匹配。provider ID 拼错时，OpenCode 找不到对应定义，模型不会出现在选择列表中。

### 5.2 Provider 层字段

| 字段 | 必需 | 说明 |
|---|---|---|
| `npm` | 自定义 provider 必需 | 使用哪个 AI SDK 包发起请求。Anthropic 原生 Messages API 用 `@ai-sdk/anthropic`；OpenAI 兼容的 `/v1/chat/completions` 端点用 `@ai-sdk/openai-compatible` |
| `name` | 否 | 在模型选择列表中展示的 provider 名称，仅影响界面 |
| `options` | 否 | 传给 SDK 的连接参数，见下一小节 |
| `models` | 自定义 provider 必需 | 模型表。键是**请求中真正发送的模型 ID**，值是该模型的参数 |

`npm` 选错是最常见的失败原因。包决定了请求体的结构：`@ai-sdk/anthropic` 按 Anthropic Messages API 格式构造请求，`@ai-sdk/openai-compatible` 按 OpenAI Chat Completions 格式构造。端点期望的格式与所选包不一致时，通常表现为 400 错误或响应无法解析，而不是认证失败。

### 5.3 options 字段

| 字段 | 说明 |
|---|---|
| `baseURL` | API 端点地址。留空则使用该 provider 的默认地址 |
| `apiKey` | API key。不填则使用 `/connect` 存入 `auth.json` 的凭据 |
| `headers` | 附加到每个请求上的自定义请求头，例如网关要求的路由标识 |
| `timeout` | 单次请求超时，单位毫秒，默认 `300000`。设为 `false` 可关闭 |
| `chunkTimeout` | 流式响应中两个数据块之间的最大间隔，单位毫秒。超时则中断请求 |
| `setCacheKey` | 确保为该 provider 始终设置缓存键 |

`apiKey` 支持变量替换，避免明文写入配置文件：

```jsonc
{
  "options": {
    // 从环境变量读取
    "apiKey": "{env:ANTHROPIC_API_KEY}"
  }
}
```

也可以从文件读取，路径可以是相对于配置文件的相对路径，或以 `/`、`~` 开头的绝对路径：

```jsonc
{
  "options": {
    "apiKey": "{file:~/.secrets/anthropic-key}"
  }
}
```

> **重要：** `{env:VAR}` 在环境变量未设置时会被替换成**空字符串**，而不是报错。表现为请求返回 401，而配置文件本身看起来完全正常。排查认证问题时应先确认环境变量确实存在于 OpenCode 的运行环境中。

长任务建议把 `timeout` 调大。默认 5 分钟对于长上下文加长输出的请求可能不够，超时后会中断整轮对话。

### 5.4 单个模型的字段

`models` 下每个键即模型 ID，值为一个对象：

| 字段 | 说明 |
|---|---|
| `name` | 展示名称，仅影响模型选择列表的显示，不参与请求 |
| `id` | 实际发送给端点的模型标识。仅在希望键名与真实 ID 不同时使用，省略时以键名为准 |
| `attachment` | 是否允许向该模型发送附件。为 `false` 时界面不接受附件 |
| `modalities.input` | 支持的输入类型，如 `["text", "image", "pdf"]` |
| `modalities.output` | 支持的输出类型，通常为 `["text"]` |
| `limit.context` | 模型能接受的最大输入 token 数 |
| `limit.output` | 模型单次能生成的最大 token 数 |

`limit` 决定了 OpenCode 对剩余上下文的计算，进而影响自动压缩（compaction）的触发时机。内置 provider 会从 Models.dev 自动获取这些值，自定义 provider 必须手工填写。

> **重要：** `limit` 是**声明值**而非实际约束，OpenCode 不会去验证。填得比真实上限大，超限时会在请求阶段由服务端返回错误，而不是被提前压缩；填得比真实上限小，则会过早触发压缩，白白损失可用上下文。这两个数字应以端点文档为准，不要照抄他人配置。

`modalities` 同理：声明支持 `image` 但端点实际不支持时，附带图片的请求会失败。

---

## 六、限制可选模型范围

Provider 暴露的模型可能远多于实际需要，可以用 `blacklist` 或 `whitelist` 收敛模型选择列表：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      // 只保留列出的模型
      "whitelist": ["claude-sonnet-4-5", "claude-haiku-4-5"]
    }
  }
}
```

- `blacklist`：从列表中移除指定模型
- `whitelist`：只保留指定模型，其余全部隐藏
- 两者可以组合：先由 `whitelist` 收窄范围，再由 `blacklist` 剔除其中的条目

两个选项都接受模型 ID 数组，ID 与 `/models` 中显示的一致。

如果需要在更大范围上控制，可以用 `enabled_providers` 与 `disabled_providers` 直接约束 provider：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "enabled_providers": ["anthropic"]
}
```

被 `disabled_providers` 禁用的 provider，即使环境变量已设置、凭据已通过 `/connect` 配置，也不会被加载。两者同时出现时，`disabled_providers` 优先。

---

## 七、验证配置是否生效

### 7.1 查看合并后的配置

```bash
opencode debug config
```

这条命令输出的是所有配置层合并后的最终结果，包括变量替换的结果。配置改了但没生效时，应先看这里，确认自己修改的是实际被加载的那个文件。

### 7.2 确认凭据已保存

```bash
opencode auth list
```

依赖环境变量认证的 provider 不会出现在这个列表中，这属于正常情况。

### 7.3 确认模型可选

在 TUI 中运行：

```text
/models
```

模型没有出现在列表中，通常是以下原因之一：

- provider ID 与 `model` 中引用的前缀不一致
- 自定义 provider 缺少 `models` 段，OpenCode 不知道有哪些模型可用
- 该模型被 `blacklist` 移除，或被 `whitelist` 排除在外
- 整个 provider 被 `disabled_providers` 禁用

### 7.4 发起一次真实请求

```bash
opencode run "回复 ok"
```

选中模型只说明配置解析成功，不代表端点可达。必须实际发一次请求才能验证网络、认证和请求格式。
