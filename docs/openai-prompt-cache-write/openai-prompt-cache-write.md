# OpenAI Prompt Cache Write：机制、术语与禁用方法

## 目录

- [一、结论](#一结论)
- [二、Prompt Caching 是什么](#二prompt-caching-是什么)
- [三、专业术语](#三专业术语)
- [四、Implicit 模式](#四implicit-模式)
- [五、Explicit 模式](#五explicit-模式)
- [六、禁用 Cache Write 的示例代码](#六禁用-cache-write-的示例代码)
- [七、如何确认缓存已经禁用](#七如何确认缓存已经禁用)
- [八、能否只关闭 Cache Write、保留 Cache Read](#八能否只关闭-cache-write保留-cache-read)
- [九、什么时候应该禁用](#九什么时候应该禁用)
- [十、常见误区](#十常见误区)

---

## 一、结论

OpenAI 在 GPT-5.6 及后续模型中提供了更明确的 Prompt Caching 控制，包括显式缓存断点（explicit cache breakpoints）、30 分钟最低缓存生命周期，以及独立统计的 Cache Write tokens。

对 GPT-5.6 及后续模型，缓存行为可以在每次 API 请求中控制，但没有 `cache_write: false` 这样的独立布尔开关。

完全禁用一次请求的 Prompt Caching，需要同时满足两个条件：

1. 将 `prompt_cache_options.mode` 设置为 `explicit`
2. 请求的所有内容中都不包含 `prompt_cache_breakpoint`

最小配置如下：

```json
{
  "prompt_cache_options": {
    "mode": "explicit"
  }
}
```

此时该请求既不执行 Cache Write，也不执行 Cache Read。OpenAI 当前没有公开的“允许 Cache Read、禁止 Cache Write”只读缓存模式。

| 请求配置 | Cache Read | Cache Write |
| --- | :---: | :---: |
| 不传 `prompt_cache_options` | 是 | 未命中时写入 |
| `mode: "implicit"` | 是 | 未命中时写入 |
| `mode: "explicit"`，存在显式断点 | 是 | 未命中时写入 |
| `mode: "explicit"`，不存在显式断点 | 否 | 否 |

> 本文讨论 OpenAI API 的 GPT-5.6 及后续模型。Azure OpenAI、Azure AI Foundry、Amazon Bedrock 或其他兼容 API 是否支持相同字段，应以对应服务的 API 文档和模型版本为准。

---

## 二、Prompt Caching 是什么

Prompt Caching（提示缓存）用于复用模型已经处理过的输入前缀。它缓存的是处理输入过程中产生的中间状态，不是模型最终生成的回答。

例如，一个应用反复发送以下输入：

```text
[系统指令][工具定义][产品文档][历史对话][本轮问题]
```

如果前面的系统指令、工具定义和产品文档保持不变，后续请求可以复用这部分前缀的计算结果。这样能够降低输入处理延迟，并让命中的 tokens 按 Cached Input 价格计费。

OpenAI 将这个过程分成两个可观测阶段：

- Cache Write：将可复用的输入前缀写入缓存
- Cache Read：后续请求从缓存读取匹配的输入前缀

GPT-5.6 的官方发布说明将其称为“more predictable prompt caching”，并引入显式缓存断点和 30 分钟最低缓存生命周期。

---

## 三、专业术语

### 3.1 Prompt（提示或模型输入）

Prompt 是一次模型请求的输入。它不只包括用户消息，还可能包括：

- system 或 developer 指令
- user 和 assistant 历史消息
- 工具定义及其参数 Schema
- 文件、图片和其他内容块
- Responses API 中通过上下文带入的其他输入项

Prompt Caching 匹配的是这些内容序列构成的前缀，而不是只匹配某一条用户消息。

### 3.2 Prompt Prefix（提示前缀）

Prompt Prefix 是从请求输入开头到某个位置的一段连续内容。

缓存按前缀匹配，因此稳定内容应放在前面，变化内容应放在后面：

```text
推荐：[固定指令][固定工具][固定资料][动态问题]
不推荐：[动态用户 ID][固定指令][固定工具][固定资料]
```

如果前缀中的内容、顺序、工具定义或其他参与匹配的数据发生变化，就可能无法命中原缓存。

### 3.3 Cache Breakpoint（缓存断点）

Cache Breakpoint 标记一个可复用前缀的结束位置。换句话说，从 Prompt 开头到断点之间的内容可以作为一个缓存单元进行读取或写入。

GPT-5.6 及后续模型支持两类断点：

- Implicit breakpoint：由 OpenAI 自动选择
- Explicit breakpoint：由调用方在具体内容块上明确标记

每个请求最多写入 4 个断点。显式断点标记如下：

```json
{
  "type": "input_text",
  "text": "需要重复使用的长上下文",
  "prompt_cache_breakpoint": {
    "mode": "explicit"
  }
}
```

### 3.4 Cache Write（缓存写入）

当请求使用 Prompt Caching，但指定前缀没有可用缓存时，OpenAI 需要正常处理该前缀，并将其写入缓存。这部分输入在使用量中记为 Cache Write tokens。

GPT-5.6 及后续模型的 Cache Write 按对应模型未缓存输入价格的 1.25 倍计费。

第一次发送某个新前缀时通常会发生 Cache Write，但是否实际写入以及写入多少，应以响应中的使用量字段为准。

### 3.5 Cache Read（缓存读取）

当后续请求找到匹配的缓存前缀时，OpenAI 可以直接复用缓存。这部分输入记为 Cached Input tokens，也就是通常所说的 Cache Read tokens。

GPT-5.6 的 Cache Read 继续享受相对未缓存输入 90% 的折扣，即按未缓存输入价格的 10% 计费。

### 3.6 Cache Hit（缓存命中）

Cache Hit 表示请求找到可复用的缓存前缀。响应中的 `cached_tokens` 大于 0，说明至少有一部分输入命中了缓存。

缓存命中不是一个简单的请求级 true/false 状态。一次请求可能只有部分输入命中，因此更有意义的指标是：

```text
缓存覆盖率 = cached_tokens / input_tokens
```

### 3.7 Cache Miss（缓存未命中）

Cache Miss 表示请求没有找到匹配的缓存前缀。常见原因包括：

- 第一次发送该前缀
- 前缀内容或顺序发生变化
- 使用了不同模型或不兼容的模型版本
- 缓存已过期或被后端清理
- 请求被划分到不同的缓存范围

在启用缓存的情况下，Cache Miss 通常会导致模型重新处理输入，并产生 Cache Write。

### 3.8 TTL（Time to Live）

TTL 表示缓存断点的生命周期配置。GPT-5.6 当前支持：

```json
{
  "prompt_cache_options": {
    "ttl": "30m"
  }
}
```

`30m` 表示每个断点的最低缓存生命周期为 30 分钟。OpenAI 官方 SDK 同时说明，后端可能将缓存保留更久，因此它不表示缓存一定会在第 30 分钟立即删除。

### 3.9 `cache_write_tokens`

`cache_write_tokens` 表示本次请求写入缓存的输入 token 数。Responses API 中可通过以下字段观察：

```text
usage.input_tokens_details.cache_write_tokens
```

示例：

```json
{
  "usage": {
    "input_tokens": 5200,
    "input_tokens_details": {
      "cache_write_tokens": 4096,
      "cached_tokens": 0
    }
  }
}
```

### 3.10 `cached_tokens`

`cached_tokens` 表示本次请求从 Prompt Cache 读取的 token 数。Responses API 中的字段为：

```text
usage.input_tokens_details.cached_tokens
```

示例：

```json
{
  "usage": {
    "input_tokens": 5300,
    "input_tokens_details": {
      "cache_write_tokens": 0,
      "cached_tokens": 4096
    }
  }
}
```

### 3.11 `prompt_cache_key`

`prompt_cache_key` 是调用方提供的缓存路由键，用于帮助 OpenAI 对相似请求进行缓存分组，从而提高命中率。

```json
{
  "prompt_cache_key": "product-docs-v3"
}
```

需要注意：

- 它不是缓存内容本身
- 它不是 Cache Write 开关
- 不传该字段不等于禁用缓存
- 每次使用随机值也不是官方定义的禁用方式
- 不应在 key 中直接放入邮箱、姓名等敏感信息

### 3.12 `prompt_cache_retention`

`prompt_cache_retention` 是较早的缓存保留策略参数，常见值包括 `in_memory` 和 `24h`。

```json
{
  "prompt_cache_retention": "24h"
}
```

OpenAI 当前官方 SDK 已将该参数标记为 deprecated，并建议使用 `prompt_cache_options.ttl`。迁移新代码时，不应继续把 `prompt_cache_retention` 作为 GPT-5.6 缓存控制的主要参数。

---

## 四、Implicit 模式

Implicit 表示“隐式”或“自动”缓存断点模式：

```json
{
  "prompt_cache_options": {
    "mode": "implicit",
    "ttl": "30m"
  }
}
```

OpenAI 在该模式下自动选择一个隐式断点。请求执行过程可以理解为：

1. OpenAI 根据输入前缀查找缓存
2. 找到匹配前缀时执行 Cache Read
3. 没找到时正常处理输入
4. 将自动断点对应的前缀执行 Cache Write

`implicit` 是默认模式。以下两种写法在是否允许自动缓存断点方面等价：

```javascript
await client.responses.create({
  model: "gpt-5.6-terra",
  input: "分析这份报告"
});
```

```javascript
await client.responses.create({
  model: "gpt-5.6-terra",
  prompt_cache_options: {
    mode: "implicit",
    ttl: "30m"
  },
  input: "分析这份报告"
});
```

因此，不传 `prompt_cache_options` 并不是禁用缓存。

在 `implicit` 模式下仍然可以添加显式断点。OpenAI 会创建 1 个隐式断点，并最多写入请求中最后 3 个显式断点，总数不超过 4 个。

---

## 五、Explicit 模式

Explicit 表示“只使用调用方明确标记的缓存断点”：

```json
{
  "prompt_cache_options": {
    "mode": "explicit",
    "ttl": "30m"
  }
}
```

设置 `mode: "explicit"` 后，OpenAI 不会自动创建隐式断点，但请求中已有的 `prompt_cache_breakpoint` 仍然有效。

### 5.1 Explicit 模式并不必然禁用缓存

下面的请求仍然会使用 Prompt Caching，因为内容中存在显式断点：

```javascript
const response = await client.responses.create({
  model: "gpt-5.6-terra",
  prompt_cache_options: {
    mode: "explicit",
    ttl: "30m"
  },
  input: [
    {
      role: "developer",
      content: [
        {
          type: "input_text",
          text: largeStableContext,
          prompt_cache_breakpoint: {
            mode: "explicit"
          }
        }
      ]
    },
    {
      role: "user",
      content: "根据上述内容生成摘要"
    }
  ]
});
```

该断点对应的缓存存在时执行 Cache Read；不存在时执行 Cache Write。

### 5.2 Explicit 模式加无断点才是完全禁用

OpenAI 官方 SDK 对该行为的说明是：在 `explicit` 模式下，如果请求中没有显式断点，则该请求不使用 Prompt Caching。

所以完整禁用条件是：

```text
mode = explicit
并且
显式断点数量 = 0
```

仅设置 `mode: "explicit"`，但忘记删除某个嵌套内容块中的 `prompt_cache_breakpoint`，仍然可能产生 Cache Write 费用。

---

## 六、禁用 Cache Write 的示例代码

### 6.1 JavaScript：Responses API

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const response = await client.responses.create({
  model: "gpt-5.6-terra",
  prompt_cache_options: {
    mode: "explicit"
  },
  input: [
    {
      role: "developer",
      content: [
        {
          type: "input_text",
          text: "你是一名技术文档审阅助手。"
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "请检查这段文档。"
        }
      ]
    }
  ]
});

console.log(response.usage?.input_tokens_details);
```

关键点是两个输入内容块都没有 `prompt_cache_breakpoint`。

### 6.2 JavaScript：Chat Completions API

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const completion = await client.chat.completions.create({
  model: "gpt-5.6-terra",
  prompt_cache_options: {
    mode: "explicit"
  },
  messages: [
    {
      role: "developer",
      content: "你是一名技术文档审阅助手。"
    },
    {
      role: "user",
      content: "请检查这段文档。"
    }
  ]
});

console.log(completion.usage?.prompt_tokens_details);
```

### 6.3 Python：Responses API

```python
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-5.6-terra",
    prompt_cache_options={
        "mode": "explicit",
    },
    input=[
        {
            "role": "developer",
            "content": [
                {
                    "type": "input_text",
                    "text": "你是一名技术文档审阅助手。",
                }
            ],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": "请检查这段文档。",
                }
            ],
        },
    ],
)

print(response.usage.input_tokens_details)
```

### 6.4 Python：Chat Completions API

```python
from openai import OpenAI

client = OpenAI()

completion = client.chat.completions.create(
    model="gpt-5.6-terra",
    prompt_cache_options={
        "mode": "explicit",
    },
    messages=[
        {
            "role": "developer",
            "content": "你是一名技术文档审阅助手。",
        },
        {
            "role": "user",
            "content": "请检查这段文档。",
        },
    ],
)

print(completion.usage.prompt_tokens_details)
```

### 6.5 cURL：Responses API

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.6-terra",
    "prompt_cache_options": {
      "mode": "explicit"
    },
    "input": "请检查这段技术文档。"
  }'
```

这个请求使用字符串作为输入，没有可以携带 `prompt_cache_breakpoint` 的内容块，因此不会出现遗漏断点的问题。

---

## 七、如何确认缓存已经禁用

不要只检查请求参数，还应检查 API 返回的使用量。

对于 Responses API，重点观察：

```javascript
const details = response.usage?.input_tokens_details;

console.log({
  cacheWriteTokens: details?.cache_write_tokens ?? 0,
  cachedTokens: details?.cached_tokens ?? 0
});
```

完全禁用时，应观察到：

```json
{
  "cacheWriteTokens": 0,
  "cachedTokens": 0
}
```

建议至少连续执行两次完全相同的请求：

1. 第一次请求验证 `cache_write_tokens` 为 0
2. 第二次请求验证 `cached_tokens` 仍为 0

如果 `cache_write_tokens` 大于 0，说明请求仍然启用了某种缓存断点。如果 `cached_tokens` 大于 0，说明请求使用了已有缓存。

不同 API 或 SDK 版本可能省略值为 0 的字段，应用代码应将缺失值按 0 处理。

---

## 八、能否只关闭 Cache Write、保留 Cache Read

不能。OpenAI 当前公开的 GPT-5.6 Prompt Caching API 没有提供以下独立控制：

```json
{
  "cache_read": true,
  "cache_write": false
}
```

现有缓存断点采用 read-through 行为：

1. 先尝试读取对应前缀
2. 命中时执行 Cache Read
3. 未命中时处理输入并执行 Cache Write

如果完全移除缓存断点，请求就没有可用于查找缓存的边界，因此 Cache Read 和 Cache Write 会一起关闭。

这意味着应用不能将请求分为“预热请求负责写，业务请求只允许读”。如果业务要求绝对不能写缓存，就必须接受该请求也不能读取 Prompt Cache。

---

## 九、什么时候应该禁用

是否禁用应根据成本、延迟和数据治理需求决定。

适合禁用的情况包括：

- 输入几乎不会重复，Cache Write 成本无法通过后续读取摊薄
- 每次请求前缀都变化，命中概率极低
- 内部成本规则不允许产生 1.25 倍的 Cache Write 费用
- 需要用无缓存基线测试模型延迟或成本
- 业务的数据处理规则要求不使用 Prompt Cache

不建议禁用的情况包括：

- 长 system/developer 指令被频繁复用
- 工具定义较大且长期稳定
- 多轮对话持续携带相同历史前缀
- 同一份长文档会被连续查询多次
- 后续 Cache Read 数量足以摊薄首次写入成本

只考虑输入 token 价格时，一次写入加一次读取的相对成本为：

$$
1.25 + 0.10 = 1.35
$$

而两次都不使用缓存的成本为：

$$
1 + 1 = 2
$$

因此，一个已写入的前缀只要至少成功读取一次，总输入价格通常就低于两次都按未缓存输入计费。实际收益还会受到前缀覆盖率、缓存命中率、模型选择和请求数量影响。

---

## 十、常见误区

### 10.1 不传缓存参数就是禁用

错误。GPT-5.6 默认使用 `implicit` 模式，OpenAI 会自动选择一个隐式断点。

### 10.2 `mode: "explicit"` 一定会禁用缓存

错误。它只关闭隐式断点。如果任意内容块仍包含 `prompt_cache_breakpoint`，请求仍然会读写缓存。

### 10.3 设置随机 `prompt_cache_key` 可以禁用写入

错误。随机 key 可能降低命中率，却不能关闭 Cache Write；它反而可能让每次请求都未命中并重新写入。

### 10.4 Cache Write 缓存的是最终回答

错误。Prompt Caching 复用的是输入前缀的处理结果，模型仍然需要生成新的输出。

### 10.5 `ttl: "30m"` 表示 30 分钟后必定删除

错误。该字段定义最低生命周期，OpenAI 后端可能保留更久。

### 10.6 关闭 Store 就会关闭 Prompt Cache

错误。Responses API 的 `store` 与 Prompt Caching 是不同机制。`store: false` 不能代替 `prompt_cache_options.mode: "explicit"` 加无断点的配置。