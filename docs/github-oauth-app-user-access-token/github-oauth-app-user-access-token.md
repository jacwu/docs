# 通过 GitHub OAuth App 获取用户访问令牌

当后端服务需要代表用户调用 GitHub API 时，让用户自行生成并粘贴个人访问令牌（PAT）并不是合适的做法：应用无法控制权限范围，用户也难以区分是谁在使用这个令牌。

GitHub OAuth App 提供了标准的解决方式。应用把用户导向 GitHub 的授权页面，用户确认后，GitHub 为**这个应用和这个用户的组合**签发一个独立的访问令牌。该令牌以 `Bearer` 形式附加在请求头中调用 GitHub API，权限由应用声明的 scope 限定，用户随时可以撤销。

本文说明从创建 OAuth App 到获取、验证访问令牌的完整流程，以及令牌的权限边界和生命周期。

## 目录

- [一、适用场景与前置条件](#一适用场景与前置条件)
- [二、OAuth App 与个人访问令牌的区别](#二oauth-app-与个人访问令牌的区别)
- [三、创建 OAuth App](#三创建-oauth-app)
- [四、发起授权请求](#四发起授权请求)
- [五、接收回调并换取访问令牌](#五接收回调并换取访问令牌)
- [六、验证令牌身份与实际权限](#六验证令牌身份与实际权限)
- [七、scope 的权限边界](#七scope-的权限边界)
- [八、组织与企业的应用访问限制](#八组织与企业的应用访问限制)
- [九、令牌生命周期与撤销](#九令牌生命周期与撤销)
- [十、安全边界](#十安全边界)

---

## 一、适用场景与前置条件

以下场景适合使用 OAuth App：

- Web 应用需要代表已登录用户读取或操作 GitHub 数据
- 本地工具或 CLI 需要用户授权后调用 GitHub API
- 多用户后端需要为每个用户持有独立的、可单独撤销的凭据

开始前，请确认：

1. 拥有一个可以创建 OAuth App 的 GitHub 账号。
2. 已确定回调地址。Web 应用使用自己的 HTTPS 地址，本地工具使用 `127.0.0.1` 加固定端口。
3. 具备安全保存 client secret 的方式，例如密钥管理服务或环境变量，而不是代码仓库。
4. 已明确应用真正需要哪些 scope。scope 决定令牌的权限上限，应按最小权限选择。

> **重要：** scope 只能限制令牌的权限，不会给用户带来其本身没有的权限。如果用户对某个仓库没有访问权，即使令牌带有 `repo` scope 也无法访问该仓库。

---

## 二、OAuth App 与个人访问令牌的区别

| 对比项 | OAuth App | 个人访问令牌（PAT） |
|---|---|---|
| 令牌归属 | 每个授权用户各自一个令牌 | 创建令牌的用户本人 |
| 授权方式 | 用户在 GitHub 授权页面确认 | 用户自行生成并交给应用 |
| 权限声明 | 应用在授权请求中声明 scope | 用户在生成页面自行勾选 |
| 多用户支持 | 天然支持，可区分每个用户 | 不适用，无法区分调用者 |
| 撤销方式 | 用户在已授权应用列表中撤销 | 用户删除该令牌 |
| 审计 | GitHub 记录是哪个应用代表哪个用户 | 只能看到是该用户的操作 |
| 典型用途 | 多用户后端、Web 应用、需要用户授权的工具 | 个人脚本、CI 流水线 |

需要代表多个用户操作时，应使用 OAuth App。PAT 更适合只代表自己的自动化任务。

---

## 三、创建 OAuth App

### 3.1 打开创建页面

登录 GitHub 后依次进入：

```text
头像菜单
  -> Settings
  -> Developer settings
  -> OAuth Apps
  -> New OAuth App
```

也可以直接访问：

```text
https://github.com/settings/applications/new
```

### 3.2 填写应用信息

| 字段 | 说明 | 示例 |
|---|---|---|
| Application name | 展示在授权页面上的应用名称 | `example-integration` |
| Homepage URL | 应用主页，展示给用户 | `https://example.com` |
| Application description | 可选，展示在授权页面 | `Read user profile for sign-in` |
| Redirect URI | 授权完成后 GitHub 跳转的地址 | 见下方说明 |

回调地址按部署形态选择：

```text
Web 应用：      https://example.com/auth/callback
本地工具/CLI：  http://127.0.0.1:8765/callback
```

> **重要：** 本地工具应把实际监听的端口一并登记。如果只登记 `http://127.0.0.1/callback`，授权完成后浏览器可能被跳转到 80 端口，本地监听在其他端口的服务收不到授权码，表现为回调页面连接被拒绝。

其余选项建议：

- **Allow wildcard matching**：不勾选。开启后子域名和子路径都会被接受，会扩大授权码被发往非预期地址的风险。
- **Expire user access tokens**：按需选择。勾选后令牌 8 小时过期并附带 refresh token，应用必须实现刷新逻辑；不勾选则签发长期令牌。

### 3.3 注册并生成 Client Secret

点击 **Register application** 后：

1. 记录 **Client ID**。它用于标识应用，不是机密信息，可以出现在前端和配置文件中。
2. 点击 **Generate a new client secret** 生成密钥。
3. 立即把 Client Secret 保存到密钥管理服务或环境变量。页面刷新后无法再次查看。

```bash
export GITHUB_OAUTH_CLIENT_ID='Iv1.xxxxxxxxxxxx'
export GITHUB_OAUTH_CLIENT_SECRET='xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

Client Secret 只在服务端交换授权码时使用，不能出现在浏览器、移动端、日志或版本库中。

> **注意：** scope 不在这个页面配置。应用在每次发起授权请求时动态声明所需 scope，因此同一个 OAuth App 可以针对不同场景请求不同权限。

---

## 四、发起授权请求

### 4.1 生成 state 与 PKCE 参数

`state` 用于防止跨站请求伪造，PKCE 用于防止授权码被截获后被他人使用。两者都应在每次授权前重新生成。

```bash
# 防 CSRF 的随机值
state=$(openssl rand -hex 16)

# PKCE code_verifier：随机字符串
code_verifier=$(openssl rand -base64 96 | tr -d '\n=+/' | cut -c1-64)

# PKCE code_challenge：verifier 的 SHA-256，base64url 编码
code_challenge=$(printf '%s' "$code_verifier" \
  | openssl dgst -binary -sha256 \
  | openssl base64 \
  | tr '+/' '-_' \
  | tr -d '=')
```

`state` 和 `code_verifier` 需要与用户会话绑定保存，回调时要用来校验和换取令牌。

### 4.2 构造授权 URL

```http
GET https://github.com/login/oauth/authorize
```

| 参数 | 必需 | 说明 |
|---|---|---|
| `client_id` | 是 | OAuth App 的 Client ID |
| `redirect_uri` | 强烈建议 | 授权后跳转地址，须与登记的回调地址一致 |
| `scope` | 视需求 | 空格分隔的权限列表，省略则只获得公开信息读取权限 |
| `state` | 强烈建议 | 上一步生成的随机值 |
| `code_challenge` | 强烈建议 | PKCE challenge |
| `code_challenge_method` | 使用 PKCE 时必需 | 固定为 `S256` |
| `login` | 否 | 建议使用哪个账号登录 |
| `prompt` | 否 | 设为 `select_account` 时强制显示账号选择 |
| `allow_signup` | 否 | 是否允许未注册用户在流程中注册，默认 `true` |

完整示例：

```text
https://github.com/login/oauth/authorize
  ?client_id=Iv1.xxxxxxxxxxxx
  &redirect_uri=http%3A%2F%2F127.0.0.1%3A8765%2Fcallback
  &scope=read%3Auser
  &state=8f14e45fceea167a5a36dedd4bea2543
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
  &allow_signup=false
```

用户打开这个地址后，GitHub 会展示授权页面，列出应用名称、开发者信息和所请求的权限。用户点击授权后流程继续，点击取消则返回错误。

---

## 五、接收回调并换取访问令牌

### 5.1 接收回调

用户同意授权后，GitHub 跳转到回调地址：

```text
http://127.0.0.1:8765/callback?code=abc123...&state=8f14e45fceea167a5a36dedd4bea2543
```

用户拒绝授权时返回：

```text
http://127.0.0.1:8765/callback?error=access_denied&error_description=The+user+has+denied+your+application+access.&state=...
```

回调处理必须做到：

1. 校验 `state` 与本次授权发起时保存的值一致，不一致立即终止。
2. 检查是否存在 `error` 参数，存在则按失败处理。
3. 授权码只使用一次，用完即作废。

> **重要：** 授权码有效期为 10 分钟，且只能兑换一次。不要把它写入日志或缓存。

### 5.2 换取访问令牌

授权码必须在服务端换取令牌，因为这一步需要 Client Secret。

```http
POST https://github.com/login/oauth/access_token
```

```bash
curl -X POST https://github.com/login/oauth/access_token \
  -H "Accept: application/json" \
  -d "client_id=${GITHUB_OAUTH_CLIENT_ID}" \
  -d "client_secret=${GITHUB_OAUTH_CLIENT_SECRET}" \
  -d "code=${AUTHORIZATION_CODE}" \
  -d "redirect_uri=http://127.0.0.1:8765/callback" \
  -d "code_verifier=${CODE_VERIFIER}"
```

成功响应：

```json
{
  "access_token": "gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "token_type": "bearer",
  "scope": "read:user"
}
```

如果 OAuth App 启用了令牌过期，或请求中包含 `offline_access` scope，响应会额外包含刷新信息：

```json
{
  "access_token": "gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expires_in": 28800,
  "refresh_token": "ghr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "refresh_token_expires_in": 15897600,
  "token_type": "bearer",
  "scope": "read:user"
}
```

失败时返回 HTTP 200 但响应体包含错误：

```json
{
  "error": "bad_verification_code",
  "error_description": "The code passed is incorrect or expired."
}
```

因此不能只根据 HTTP 状态码判断成功，必须检查响应体中是否存在 `error` 字段。

---

## 六、验证令牌身份与实际权限

拿到令牌后不要直接投入使用，先确认它属于谁、实际拥有哪些权限。

### 6.1 确认令牌所属账号

```bash
curl -sS https://api.github.com/user \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Accept: application/vnd.github+json"
```

响应中的 `login` 和 `id` 是该令牌真实对应的账号。应用应当以这个结果作为用户身份的依据，而不是流程开始前的假设值。用户可以在授权过程中切换账号，如果不校验，就可能把令牌关联到错误的用户上。

### 6.2 确认实际授予的 scope

用户可以在授权时减少权限，因此实际 scope 可能少于请求的 scope。GitHub 在响应头中返回真实结果：

```bash
curl -sS -D - -o /dev/null https://api.github.com/user \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Accept: application/vnd.github+json"
```

关注两个响应头：

```text
X-OAuth-Scopes: read:user
X-Accepted-OAuth-Scopes: user
```

- `X-OAuth-Scopes`：该令牌实际拥有的 scope
- `X-Accepted-OAuth-Scopes`：当前这个 API 端点接受的 scope

应用应当在权限不足时给出明确提示，或引导用户重新授权，而不是让后续调用报出难以理解的 403。

---

## 七、scope 的权限边界

### 7.1 常用 scope

| Scope | 权限 |
|---|---|
| 不指定 | 读取公开信息，包括公开的用户资料、仓库信息和 Gist |
| `read:user` | 读取用户资料数据 |
| `user:email` | 读取用户的邮箱地址 |
| `user:follow` | 关注或取消关注其他用户 |
| `user` | 读写用户资料，包含 `user:email` 与 `user:follow` |
| `read:org` | 读取组织成员关系、组织项目和团队成员关系 |
| `write:org` | 读写组织成员关系与组织项目 |
| `admin:org` | 完整管理组织、团队、项目和成员 |
| `public_repo` | 读写公开仓库 |
| `repo` | 读写公开和私有仓库，包含代码、提交状态、协作者等 |
| `notifications` | 读取通知、标记已读、管理订阅 |
| `gist` | 创建和修改 Gist |
| `read:packages` | 下载 GitHub Packages |
| `write:packages` | 发布 GitHub Packages |
| `workflow` | 新增和修改 Actions 工作流文件 |
| `offline_access` | 请求有期限令牌与 refresh token |

### 7.2 以 `read:user` 为例

仅请求 `read:user` 时，令牌可以：

- 调用 `GET /user` 获取当前用户身份
- 读取用户名、ID、头像、显示名、公司、位置、简介等资料字段
- 读取部分账号统计信息
- 以已认证身份调用公开数据接口，享受更高的 API 速率限制

不能：

- 读取私有仓库或代码，需要 `repo`
- 列出用户所属的私有组织，需要 `read:org`
- 获取用户的全部邮箱地址，需要 `user:email`
- 修改用户资料，需要 `user`
- 管理组织、仓库、Actions 或 Packages

### 7.3 关于 scope 的两个细节

**规范化**：请求多个 scope 时，被包含的 scope 会被合并。例如请求 `user,gist,user:email`，最终令牌只会显示 `user` 和 `gist`，因为 `user:email` 已被 `user` 覆盖。

**增量授权**：应用可以在需要时引导用户再次走一遍授权流程以获取更多 scope，但用户有权拒绝。因此设计上应允许应用在低权限下降级运行，而不是启动即要求全部权限。

---

## 八、组织与企业的应用访问限制

用户个人授权成功，不等于应用可以访问该用户所属组织的资源。

如果组织启用了 OAuth App 访问限制：

- 应用未获批准时，只能访问该组织的公开资源
- 用户在授权页面可以向组织所有者发起使用申请
- 组织所有者批准后，应用才能访问该组织的非公开资源

如果组织或企业启用了单点登录：

- 用户需要先在浏览器中建立有效的登录会话，再授权应用
- 会话过期后重新访问受保护资源时，需要重新完成一次登录

常见的管理入口为：

```text
Organization Settings
  -> Third-party access
  -> OAuth App access restrictions
```

具体菜单名称会随账号类型和界面版本变化。判断标准应以授权流程能否正常完成、以及目标 API 是否返回预期数据为准。

---

## 九、令牌生命周期与撤销

### 9.1 有效期

OAuth App 默认签发长期令牌，不设固定过期时间。在应用设置中启用 **Expire user access tokens** 后：

- access token 8 小时后过期
- refresh token 在 6 个月未使用后过期
- 使用 refresh token 可以换取新的 access token 和新的 refresh token
- 旧的 refresh token 在使用后立即失效

也可以在单次授权请求中加入 `offline_access` scope，在应用未全局启用过期的情况下测试刷新流程。

刷新请求：

```bash
curl -X POST https://github.com/login/oauth/access_token \
  -H "Accept: application/json" \
  -d "client_id=${GITHUB_OAUTH_CLIENT_ID}" \
  -d "client_secret=${GITHUB_OAUTH_CLIENT_SECRET}" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=${REFRESH_TOKEN}"
```

### 9.2 令牌失效的常见原因

即使是长期令牌，也可能因为以下原因失效：

- 用户主动撤销了对应用的授权
- 组织或企业管理员撤销了应用的访问权限
- 用户账号被停用
- 令牌长期未使用或被 GitHub 的安全机制吊销
- 同一用户、应用、scope 组合签发的令牌超过 10 个，最早的令牌被自动吊销

因此应用必须能处理令牌失效：检测到 401 后清除本地凭据，并引导用户重新授权。

### 9.3 撤销

用户可以在以下页面查看和撤销已授权的应用：

```text
https://github.com/settings/applications
```

应用也可以给出直达链接，方便用户管理授权：

```text
https://github.com/settings/connections/applications/<CLIENT_ID>
```

---

## 十、安全边界

实现这一流程时，以下几点应当作为硬性要求：

**凭据管理**

- Client Secret 只保存在服务端，通过密钥管理服务或环境变量注入
- 访问令牌加密存储，文件形式保存时限制为仅属主可读
- 令牌、授权码、`code_verifier`、Client Secret 都不写入日志和错误信息

**流程校验**

- 每次授权生成新的 `state`，回调时严格比对，不一致立即终止
- 使用 PKCE，并在换取令牌时提交对应的 `code_verifier`
- 授权码只使用一次，处理完成后立即作废
- 换取令牌必须在服务端完成，不能把 Client Secret 下发到客户端

**回调地址**

- 不开启通配符匹配，登记精确的回调地址
- 本地工具的回调服务只监听 `127.0.0.1`，不监听 `0.0.0.0`
- 校验回调请求的方法和路径，只接受预期的一次请求，处理完毕后关闭监听

**权限控制**

- 按最小权限请求 scope，不为“以后可能需要”预留权限
- 使用前校验 `X-OAuth-Scopes`，权限不足时明确提示而不是直接失败
- 使用 `GET /user` 确认令牌归属，避免把令牌关联到错误的用户
