# 如何在 Azure 中跨租户创建 MCA 订阅

在 Microsoft Customer Agreement（MCA）环境中，Azure 订阅的**计费归属**和 **Microsoft Entra 租户归属**可以不同。例如，使用租户 A 中的 MCA Billing Account 付费，同时把新订阅创建到租户 B，由租户 B 承载用户、管理组、Azure RBAC 和 Azure Policy。

本文介绍如何在租户 A 中选择 MCA Billing Account、Billing Profile 和 Invoice Section，并在租户 B 中创建 Azure 订阅。

## 目录

- [一、跨租户创建后的关系](#一跨租户创建后的关系)
- [二、MCA 与 EA 创建流程的主要区别](#二mca-与-ea-创建流程的主要区别)
- [三、前置条件](#三前置条件)
- [四、配置租户 B](#四配置租户-b)
- [五、在 Azure 门户创建订阅](#五在-azure-门户创建订阅)

---

## 一、跨租户创建后的关系

假设：

- MCA Billing Account、Billing Profile 和 Invoice Section 位于租户 A。
- 新订阅需要使用租户 B 作为 Microsoft Entra 目录。

创建完成后的关系如下：

```text
租户 A 的 MCA Billing Account
└── Billing Profile
    └── Invoice Section
        └── 新订阅的费用和用量

租户 B（Microsoft Entra tenant）
└── Tenant Root Group
    └── 新订阅
        └── Resource Group
            └── Azure 资源
```

两侧分别负责不同的事情：

| 范围 | 作用 |
|---|---|
| 租户 A 的 MCA Invoice Section | 决定订阅的计费归属，并在对应 Billing Profile 的发票中归集费用 |
| 租户 B | 保存用户、组和应用身份，并承载订阅的管理组、Azure RBAC 和 Azure Policy |

因此，MCA 计费权限不等于租户 B 中的资源权限。能够使用 Invoice Section 创建订阅，只代表拥有计费侧的创建权限；订阅进入租户 B 后，资源访问仍由租户 B 的 Azure RBAC 决定。

---

## 二、MCA 与 EA 创建流程的主要区别

EA 和 MCA 都能形成“租户 A 计费、租户 B 治理”的跨租户订阅，但门户中的操作入口不同：

| 合同类型 | 创建方式 |
|---|---|
| EA | 可以切换到租户 B，再选择租户 A 的 EA Billing Account 和 Enrollment Account |
| MCA | 保持在 MCA 所属的租户 A，先选择 Billing Account、Billing Profile 和 Invoice Section，再在 **Advanced** 中选择租户 B |

如果先切换到租户 B，通常看不到租户 A 的 MCA Billing Account。这是因为 MCA Billing Account 默认在其 Primary Billing Tenant 中显示，租户 B 中的 B2B Guest 身份不会自动继承租户 A 的 MCA 计费权限。

---

## 三、前置条件

### 1. MCA 计费权限

创建者需要拥有以下任一 MCA Billing Role：

- Billing Account Owner 或 Billing Account Contributor；
- Billing Profile Owner 或 Billing Profile Contributor；
- Invoice Section Owner 或 Invoice Section Contributor；或
- 目标 Invoice Section 上的 Azure Subscription Creator。

这些是 `Microsoft.Billing` 的计费角色，不是订阅或管理组上的 Azure RBAC 角色。

### 2. 创建者能够进入租户 B

租户 A 中用于创建订阅的账号需要先被邀请到租户 B，并接受 B2B 邀请。完成后，该账号应当能够在 Azure 门户的 **Directories + subscriptions（目录和订阅）**中看到租户 B。

创建者在租户 B 中通常显示为 `Guest`。Guest 身份只表示租户 B 可以识别该外部账号，不会自动授予管理组、订阅或资源权限。

### 3. 租户 B 允许订阅进入

租户 B 的 **Subscriptions entering the Microsoft Entra tenant（进入 Microsoft Entra 租户的订阅）**策略必须允许该创建者。租户 B 可以采用以下任一配置：

- 设置为 **Allow all users**；或
- 保持 **Allow no users**，并将创建者加入 **Exempted users（豁免用户）**。

从 2026 年 5 月 1 日起，没有显式配置过该策略的租户默认使用 `Allow no users`。

### 4. 确认 Subscription Owner

创建页面的 **Advanced（高级）**选项卡可以选择 Subscription Owner。Owner 所属租户会影响后续流程：

| Owner 选择 | 后续行为 |
|---|---|
| 租户 B 的用户 | 创建 Subscription Creation Request，该用户需要在 7 天内接受请求 |
| 租户 A 的用户 | 无需等待租户 B 用户接受，订阅可以直接创建 |

无论选择哪条路径，都应在提交前确认 **Subscription directory** 是租户 B。最终订阅的目录归属由该字段决定，而不是由计费账户或 Owner 的来源租户决定。

---

## 四、配置租户 B

### 1. 邀请创建者成为 B2B Guest

由租户 B 的管理员执行：

1. 登录 [Azure 门户](https://portal.azure.com)，切换到租户 B。
2. 打开 **Microsoft Entra ID** → **Users（用户）**。
3. 选择 **New user（新建用户）** → **Invite external user（邀请外部用户）**。
4. 输入租户 A 中创建者的登录邮箱并发送邀请。
5. 让创建者使用租户 A 的原始工作账号接受邀请。
6. 返回用户列表，确认用户类型为 `Guest`。

如果同一个邮箱同时对应个人 Microsoft Account 和工作账号，接受邀请时必须选择拥有 MCA 计费权限的工作身份。


### 2. 配置订阅进入策略

由已经提升权限的租户 B Global Administrator 执行：

1. 在 Azure 门户顶部搜索并打开 **Subscriptions（订阅）**。
2. 在订阅页面顶部选择 **Manage Policies（管理策略）**。
3. 找到 **Subscriptions entering the Microsoft Entra tenant**。
4. 根据组织要求选择：
   - **Allow all users**；或
   - 保持 **Allow no users**，将创建者在租户 B 中的 Guest 对象加入 **Exempted users**。
5. 保存设置。

完成后，返回 **Microsoft Entra ID** → **Properties**，将 **Access management for Azure resources** 恢复为 **No**，移除临时提升的根作用域权限。

---

## 五、在 Azure 门户创建订阅

### 1. 保持在租户 A

1. 使用拥有 MCA 计费权限的账号登录 [Azure 门户](https://portal.azure.com)。
2. 确认当前目录是 MCA Billing Account 所属的租户 A。
3. 在门户顶部搜索并打开 **Subscriptions（订阅）**。
4. 选择 **+ Add（+ 添加）**。

### 2. 填写 Basics

在 **Create a subscription（创建订阅）**页面的 **Basics（基本信息）**选项卡中填写：

| 字段 | 填法 |
|---|---|
| **Subscription name** | 输入便于识别的名称，例如 `contoso-prod-app01` |
| **Billing account** | 选择租户 A 中的 MCA Billing Account |
| **Billing profile** | 选择生成发票和管理付款信息的 Billing Profile |
| **Invoice section** | 选择用于归集该订阅费用的 Invoice Section |
| **Plan** | 生产场景通常选择 `Microsoft Azure Plan`；符合条件的开发测试场景可选择 Dev/Test |

如果看不到 MCA Billing Account、Billing Profile 或 Invoice Section，检查当前登录身份是否具有对应 Billing Scope 上的计费角色。

### 3. 填写 Advanced

1. 打开 **Advanced（高级）**选项卡。
2. 在 **Subscription directory** 中选择租户 B。
3. 选择 **Subscription owner**。
4. 根据需要填写 Tags。
5. 打开 **Review + create（查看 + 创建）**。


如果选择租户 B 的用户作为 Owner，页面应提示订阅将在目标 Owner 接受请求后创建，并使用 **Request（请求）**提交。

如果选择租户 A 的用户作为 Owner，则无需目标租户用户接受，页面可以直接使用 **Create（创建）**完成订阅创建。
