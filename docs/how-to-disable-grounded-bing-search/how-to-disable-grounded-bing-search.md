# 关闭 Grounding with Bing Search

## 目录

- [一、Web Search Tool 是什么](#一web-search-tool-是什么)
- [二、Grounding with Bing Search 是什么](#二grounding-with-bing-search-是什么)
- [三、Web Search Tool 有什么用](#三web-search-tool-有什么用)
- [四、为什么不需要搜索时应该关闭](#四为什么不需要搜索时应该关闭)
- [五、Python 调用示例](#五python-调用示例)
- [六、使用 Azure CLI 关闭 Web Search](#六使用-azure-cli-关闭-web-search)
- [七、验证是否已经关闭](#七验证是否已经关闭)
- [八、重新启用 Web Search](#八重新启用-web-search)

---

## 一、Web Search Tool 是什么

Web Search Tool 是 Microsoft Foundry Agent Service 提供的内置工具，用于让模型在回答问题前检索公共互联网，并根据检索结果生成带引用的回答。

普通大模型主要依赖训练时获得的知识，可能不知道最近发生的事件。启用 Web Search Tool 后，模型可以在需要时搜索网页，读取相关结果，并在输出中附带 URL 引用。

典型执行过程如下：

```text
用户提出问题
    ↓
模型判断是否需要 Web Search
    ↓
通过 Bing 检索公共网页
    ↓
模型根据搜索结果生成回答
    ↓
返回正文和 URL Citation
```

Web Search Tool 是否真的执行，可以通过流式事件和引用判断：

```text
response.web_search_call.in_progress
response.web_search_call.searching
response.web_search_call.completed
```

回答中的正式引用通常位于 `output_text.annotations`，类型为 `url_citation`。

---

## 二、Grounding with Bing Search 是什么

**Grounding with Bing Search 是 Web Search Tool 背后的网页检索和事实依据服务。**模型并不是直接浏览整个互联网，而是使用 Bing 的检索能力获取公开网页结果，再将这些结果作为回答依据。

Microsoft Foundry 中相关的两种能力如下：

| 能力 | 用途 |
|---|---|
| **Grounding with Bing Search** | 搜索公共互联网，适合新闻、天气、市场动态和最新技术信息 |
| **Grounding with Bing Custom Search** | 将搜索限制在指定的公开域名或网页范围内 |

Grounding 的目标是减少模型仅凭训练知识回答最新问题时产生的错误，并让用户能够通过引用追溯信息来源。但它不能保证搜索结果一定最新、完整或正确，最终结果仍受 Bing 索引时间、网页质量和模型判断影响。

---

## 三、Web Search Tool 有什么用

适合使用 Web Search Tool 的场景：

- 查询当天或最近发生的新闻
- 查询天气、赛事结果、产品发布等实时信息
- 查询近期更新的官方文档、政策或公告
- 要求回答附带可核验的网页引用
- 使用多个公开来源交叉验证一项说法
- 使用 Bing Custom Search 将检索范围限制在指定网站

通常不需要 Web Search Tool 的场景：

- 翻译、改写、摘要已经提供的文本
- 仅依据企业内部知识库回答
- 处理完全由请求内容提供的数据
- 编写不依赖最新资料的通用代码
- 涉及不应发送给外部检索服务的敏感数据

---

## 四、为什么不需要搜索时应该关闭

在 Agent 定义的 `tools` 中声明 `WebSearchTool`，就表示允许模型使用 Web Search。即使没有设置 `tool_choice="required"`，模型仍可能根据问题自行决定调用该工具。

需要特别注意：

1. **Web Search 会产生额外费用。**
   Grounding with Bing Search 和 Grounding with Bing Custom Search 都是收费服务。

2. **声明工具不等于每次都会调用，但代表它随时可以被调用。**
   如果业务根本不需要公网搜索，最直接的做法是不要把 `WebSearchTool` 放进 Agent 的工具列表。

3. **`tool_choice="required"` 会强制调用工具。**
   当 Agent 只有 Web Search Tool 时，这通常意味着请求一定会执行网页搜索并可能产生费用。

4. **订阅级关闭可以防止误用。**
   如果整个 Azure 订阅都不应使用 Web Search，可以通过 Azure CLI 注册阻止功能，从服务端统一禁用。

推荐按以下层次控制：

| 控制层次 | 做法 | 适用场景 |
|---|---|---|
| 应用层 | 不在 `tools` 中声明 `WebSearchTool` | 个别 Agent 不需要搜索 |
| 请求层 | 不使用 `tool_choice="required"` | 允许模型按需搜索，但不强制 |
| 订阅层 | 注册 `OpenAI.BlockedTools.web_search` | 整个订阅禁止使用 Web Search |

---

## 五、Python 调用示例

### 安装依赖

```bash
pip install openai
```

### 配置 API Key

```bash
export AZURE_AI_PROJECT_KEY="<api-key>"
```

如果不设置环境变量，脚本会在运行时隐藏输入 API Key，不会把密钥打印到终端。

### 使用 Responses API 测试 Web Search

下面的代码就是实际用于测试 Web Search 的脚本，只将 endpoint 改成了占位符，不包含测试环境地址或凭据：

```python
import getpass
import json
import os
import sys

from openai import OpenAI


ENDPOINT = "https://<resource-name>.services.ai.azure.com/api/projects/<project-name>"
MODEL = "gpt-5.6-terra"


def main() -> int:
    api_key = os.environ.get("AZURE_AI_PROJECT_KEY") or getpass.getpass("Azure API key: ")
    query = (
        " ".join(sys.argv[1:])
        if len(sys.argv) > 1
        else "What are the latest news and public updates about Google's Jeff Dean? "
        "Prioritize recent dated sources, summarize the key developments, and cite every claim."
    )
    client = OpenAI(
        api_key=api_key,
        base_url=f"{ENDPOINT}/openai/v1/",
        timeout=120.0,
    )

    saw_web_search = False
    citations = []
    completed_text = ""

    try:
        stream = client.responses.create(
            model=MODEL,
            stream=True,
            tool_choice="required",
            tools=[
                {
                    "type": "web_search",
                    "user_location": {
                        "type": "approximate",
                        "country": "CN",
                        "city": "Shanghai",
                        "region": "Shanghai",
                    },
                }
            ],
            input=query,
        )

        for event in stream:
            event_type = getattr(event, "type", "")
            if "web_search" in event_type:
                saw_web_search = True
                print(f"EVENT {event_type}")
            elif event_type == "response.created":
                print(f"RESPONSE_ID {event.response.id}")
            elif event_type == "response.output_item.done":
                item = event.item
                if getattr(item, "type", None) == "web_search_call":
                    saw_web_search = True
                    print("TOOL_ITEM web_search_call")
                if getattr(item, "type", None) == "message":
                    for content in getattr(item, "content", []):
                        if getattr(content, "type", None) != "output_text":
                            continue
                        for annotation in getattr(content, "annotations", []):
                            if getattr(annotation, "type", None) == "url_citation":
                                url = getattr(annotation, "url", None)
                                if url and url not in citations:
                                    citations.append(url)
            elif event_type == "response.completed":
                completed_text = event.response.output_text

        print("WEB_SEARCH_CALLED", saw_web_search)
        print("CITATION_COUNT", len(citations))
        for url in citations:
            print("CITATION", url)
        print("OUTPUT_BEGIN")
        print(completed_text)
        print("OUTPUT_END")
        return 0 if saw_web_search and completed_text else 2
    except Exception as exc:
        print(f"ERROR_TYPE {type(exc).__name__}")
        print(f"ERROR {exc}")
        response = getattr(exc, "response", None)
        if response is not None:
            print("HTTP_STATUS", getattr(response, "status_code", "unknown"))
            try:
                print("HTTP_BODY", json.dumps(response.json(), ensure_ascii=False))
            except Exception:
                pass
        return 1


if __name__ == "__main__":
    sys.exit(main())
```

运行脚本时可以把查询作为命令行参数传入：

```bash
python test_foundry_web_search.py "搜索最新的 AI 新闻，并给出引用地址"
```

成功调用 Web Search 时，可以在输出中看到：

```text
EVENT response.web_search_call.in_progress
EVENT response.web_search_call.searching
EVENT response.web_search_call.completed
TOOL_ITEM web_search_call
WEB_SEARCH_CALLED True
CITATION_COUNT 3
CITATION https://example.com/article
```

### 不需要搜索时的 Responses API 调用

如果业务不需要公网信息，不要传入 `tools` 和 `tool_choice`：

```python
response = client.responses.create(
    model=MODEL,
    input="Summarize the text supplied by the user.",
)
```

这可以避免当前请求在应用层触发 Web Search，但不能阻止订阅中的其他应用或 Agent 使用该工具。若要统一禁止，需要使用下一节的订阅级控制。

---

## 六、使用 Azure CLI 关闭 Web Search

Microsoft Foundry 支持通过 Azure CLI 在**订阅级别**关闭 Web Search Tool。该设置会影响指定订阅中的所有 Foundry 账户和项目。

### 前置条件

执行前确认：

1. 已安装 Azure CLI。
2. 已执行 `az login`。
3. 当前身份对目标订阅拥有 **Owner（所有者）**或 **Contributor（参与者）**权限。
4. 已确认目标订阅 ID，避免误操作其他订阅。

查看当前账号可访问的订阅：

```bash
az account list \
  --query "[].{Name:name, SubscriptionId:id, IsDefault:isDefault}" \
  --output table
```

确认当前订阅：

```bash
az account show \
  --query "{Name:name, SubscriptionId:id, TenantId:tenantId}" \
  --output table
```

### 关闭命令

```bash
az feature register \
  --name OpenAI.BlockedTools.web_search \
  --namespace Microsoft.CognitiveServices \
  --subscription "<subscription-id>"
```

这里的 `register` 容易引起误解：它注册的是名为 `OpenAI.BlockedTools.web_search` 的**阻止功能**，因此注册成功后，Web Search 会被禁用。

---

## 七、验证是否已经关闭

功能注册可能需要一些时间传播。可以查询状态：

```bash
az feature show \
  --name OpenAI.BlockedTools.web_search \
  --namespace Microsoft.CognitiveServices \
  --subscription "<subscription-id>" \
  --query "properties.state" \
  --output tsv
```

常见状态：

| 状态 | 含义 |
|---|---|
| `Registering` | 正在注册阻止功能，等待传播 |
| `Registered` | 阻止功能已注册，Web Search 已关闭 |
| `Unregistering` | 正在移除阻止功能 |
| `Unregistered` | 阻止功能已移除，Web Search 可以使用 |

注册完成后，如果 Agent 仍声明并尝试调用 Web Search，请求可能返回类似错误：

```text
Tool 'web_search_preview' disabled for this organization.
```

错误文字可能因 API 版本而不同。判断是否关闭时，应以 Azure Feature 的注册状态和实际请求结果为准。

---

## 八、重新启用 Web Search

若要重新启用 Web Search，需要注销阻止功能：

```bash
az feature unregister \
  --name OpenAI.BlockedTools.web_search \
  --namespace Microsoft.CognitiveServices \
  --subscription "<subscription-id>"
```

等待状态变为 `Unregistered`：

```bash
az feature show \
  --name OpenAI.BlockedTools.web_search \
  --namespace Microsoft.CognitiveServices \
  --subscription "<subscription-id>" \
  --query "properties.state" \
  --output tsv
```

注意，重新启用只是恢复订阅使用该工具的能力。Agent 仍需要在 `tools` 中声明 `WebSearchTool`，才可以实际调用 Web Search。

---