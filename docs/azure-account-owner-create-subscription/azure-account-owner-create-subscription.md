# Azure Account Owner 是什么，以及如何在界面上创建订阅

## 目录

- [一、先理清计费层级](#一先理清计费层级)
- [二、Account Owner 是什么](#二account-owner-是什么)
- [三、Account Owner 和其他角色的区别](#三account-owner-和其他角色的区别)
- [四、Account Owner 的权限边界](#四account-owner-的权限边界)
- [五、创建订阅前的前置条件](#五创建订阅前的前置条件)
- [六、在门户中创建订阅（EA）](#六在门户中创建订阅ea)
- [七、常见报错与排查](#七常见报错与排查)
- [八、什么时候不该新建订阅](#八什么时候不该新建订阅)

---

## 一、理清计费层级

Azure 的计费不是扁平的，EA 下是一棵四层的树：

```
Enterprise Agreement (Billing Account / 注册号 Enrollment)
└── Department（部门，可选）
    └── Account（账户）        ← Account Owner 管这一层
        └── Subscription（订阅）
            └── Resource Group → 资源
```

几个容易混的点：

- **Enrollment（注册）**：跟微软签的那份企业协议，一个企业通常只有一个。
- **Department（部门）**：纯粹的成本归集单元，可以设预算，**不影响权限**。不是必须的。
- **Account（账户）**：订阅的**归属容器**。每个订阅必须属于且只属于一个 Account。
- **Subscription（订阅）**：真正的资源边界和计费单元。

---

## 二、Account Owner 是什么

**Account Owner 是 EA 注册下某个 Account 的负责人，核心职责只有一个：在这个 Account 下创建和管理订阅。**

具体来说：

| 能力 | 说明 |
|---|---|
| 创建订阅 | 在自己的 Account 下开新订阅，数量通常无上限（受注册配额约束） |
| 重命名订阅 | 改订阅显示名 |
| 转让订阅 | 把订阅转给同一注册下的其他 Account Owner |
| 取消 / 删除订阅 | 停用自己 Account 下的订阅 |
| 查看用量与成本 | 仅限自己 Account 范围内（前提是 EA Admin 打开了 DA/AO view charges） |

Account Owner 由 **EA Administrator（企业管理员）**在注册中添加，添加时需要提供：

- 一个 **Entra ID / Microsoft 账户的邮箱地址**
- 该 Account 的显示名称
- 可选的所属 Department

被添加后，此人会收到一封激活邮件，**必须点击接受**，Account 才变为 Active 状态，之后才能创建订阅。

---

## 三、Account Owner 和其他角色的区别

这是最容易搞错的地方 —— **计费角色 ≠ RBAC 角色**，两套系统互不继承。

| 角色 | 所属体系 | 作用范围 | 能不能创建订阅 | 能不能看资源里的数据 |
|---|---|---|---|---|
| **Enterprise Administrator** | 计费 | 整个注册 | ✅（可管理所有 Account） | ❌ |
| **Department Administrator** | 计费 | 单个部门 | ❌（只能管 Account Owner 名单） | ❌ |
| **Account Owner** | 计费 | 单个 Account | ✅ | ❌ |
| **Service Administrator** | 经典 | 单个订阅 | ❌ | ✅ |
| **Owner (RBAC)** | Azure RBAC | 订阅 / RG / 资源 | ❌ | ✅ |
| **User Access Administrator** | Azure RBAC | 任意作用域 | ❌ | ⚠️ 只能授权，不能读数据 |

必须记住的两条：

1. **Account Owner 本身对订阅里的资源没有任何 RBAC 权限。**
   新建订阅时系统会默认把创建者加为 Owner，但如果之后被移除，Account Owner 在计费上仍能删除这个订阅，却看不到里面的一台虚拟机。
2. **Enterprise Administrator 也看不到资源。** 想看资源要另外给自己授 RBAC。

---

## 四、Account Owner 的权限边界

能做的：

- 在**自己的** Account 下创建订阅
- 管理自己 Account 下订阅的生命周期（改名、转移、取消）
- 查看自己 Account 的成本（需 EA Admin 开启 `AO view charges`）

不能做的：

- ❌ 看别的 Account 的订阅
- ❌ 添加或删除其他 Account Owner（这是 EA Admin / Department Admin 的活）
- ❌ 修改注册级别的设置（比如 DA/AO view charges 开关）
- ❌ 直接访问订阅内的资源（除非另有 RBAC 授权）
- ❌ 跨注册转移订阅（需要微软支持介入）

---

## 五、创建订阅前的前置条件

动手前逐条确认，能省掉 90% 的"按钮是灰的"问题：

1. **Account 状态是 Active**
   邀请邮件点过了吗？没点过，Account 状态是 Pending，创建入口不会出现。

2. **登录的是正确的身份**
   Account Owner 绑定的是**具体某个邮箱**。用别的账号登门户是找不到该 Account 的。
   工作账号 / 个人账号混用时尤其容易踩坑，建议开无痕窗口登录。

3. **登录的是正确的租户**
   门户右上角切换目录，确认在 EA 注册所关联的那个租户下。

4. **注册未过期、未欠费**
   注册到期或被暂停时，创建订阅会直接被拒。

5. **订阅配额未满**
   EA 注册对订阅数量有软上限，接近上限时需要联系微软提额。

---

## 六、在门户中创建订阅（EA）

### 步骤

1. 打开 [https://portal.azure.com](https://portal.azure.com)，用 Account Owner 身份登录。

2. 顶部搜索栏输入 **Subscriptions（订阅）**，进入订阅列表页。

3. 点击工具栏上的 **+ Add（+ 添加）**。

4. 在 **Create a subscription（创建订阅）** 页面填写 **Basics** 选项卡：

   | 字段 | 填法 |
   |---|---|
   | **Billing account** | 选择你的 EA 注册号（Enrollment Number） |
   | **Enrollment account** | 选择你作为 Account Owner 的那个 Account |
   | **Offer type / 优惠类型** | 一般选 `Microsoft Azure Enterprise`；开发测试场景可选 `Enterprise Dev/Test`（需 EA Admin 事先允许） |
   | **Subscription name** | 订阅显示名，**强烈建议带上环境和用途**，例如 `contoso-prod-payment-eastasia` |

5. 切到 **Advanced（高级）** 选项卡（可选）：

   - **Directory / 目录**：订阅要落在哪个 Entra ID 租户下。默认是当前租户。
   - **Management group / 管理组**：直接放进目标管理组，可以让策略和 RBAC 立刻继承下来，**建议在这里就选好**，比事后搬迁省事。

6. 切到 **Tags（标签）** 选项卡：

   打上成本归属标签，例如 `CostCenter`、`Owner`、`Environment`、`Project`。
   订阅级标签**不会自动继承**到资源，但对账单分摊非常有用。

7. 点 **Review + create** → 检查无误 → **Create**。

### 等待与验证

- 创建通常在 **几秒到几分钟** 内完成，右上角通知会提示成功。
- 回到订阅列表，能看到新订阅，状态为 **Active**。
- 打开该订阅 → **Access control (IAM)** → **Role assignments**，确认自己已经是 **Owner**

---

## 七、常见报错与排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 订阅列表里没有 **+ Add** 按钮 | 当前身份不是 Account Owner，或未接受邀请 | 确认登录邮箱；重新走一遍激活邮件 |
| 下拉框里找不到 Billing account | 登错了租户 | 门户右上角切换目录 |
| Enrollment account 是灰的 | Account 状态为 Pending / Disabled | 找 EA Admin 检查 Account 状态 |
| 提示 `SubscriptionCreationFailed` | 注册欠费、过期或达到订阅上限 | 找 EA Admin 或开支持工单 |
| 看不到成本数据 | EA Admin 没开 `AO view charges` | 让 EA Admin 在注册策略里打开 |
| 建完订阅看不到资源 | 计费角色不等于 RBAC 角色 | 在订阅 IAM 里给自己加 RBAC 角色 |

---

## 八、什么时候不该新建订阅

订阅不是越多越好。以下情况优先考虑用**资源组 + 管理组 + 标签**解决，而不是开新订阅：

- 只是想做成本区分 → 用 **标签 + Cost Management 视图**
- 只是想隔离一个小项目的权限 → 用 **资源组级 RBAC**
- 只是想换个区域部署 → 订阅本身不绑区域，直接在同订阅里换区域即可

真正**需要**新订阅的场景：

- 触到了订阅级配额上限（vCPU、VNet 数、存储账户数等）
- 生产 / 非生产必须硬隔离（合规要求）
- 需要独立的计费出口、独立的发票分节
- 需要不同的 Entra ID 租户归属
- 需要完全独立的 Policy / 安全基线，且管理组层面无法覆盖

---
