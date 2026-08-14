# 如何在 Azure 中跨租户创建 EA 订阅

在 Enterprise Agreement（EA）环境中，订阅的**计费归属**和 **Microsoft Entra 租户归属**可以不同。例如，使用租户 A 关联的 EA Enrollment Account 付费，同时把新订阅创建到租户 B，使租户 B 中的用户、管理组、Azure RBAC 和 Azure Policy 管理该订阅。

本文介绍如何使用租户 A 的 EA 身份，在租户 B 中创建一个由租户 A 的 EA Enrollment Account 计费的新订阅。

## 目录

- [一、跨租户创建后的关系](#一跨租户创建后的关系)
- [二、前置条件](#二前置条件)
- [三、确认租户 B 中的 B2B Guest 身份](#三确认租户-b-中的-b2b-guest-身份)
- [四、配置租户 B 的订阅进入策略](#四配置租户-b-的订阅进入策略)
- [五、在 Azure 门户创建订阅](#五在-azure-门户创建订阅)
- [六、创建后验证](#六创建后验证)

---

## 一、跨租户创建后的关系

假设：

- EA 注册和 Enrollment Account 由租户 A 的账号管理。
- 新订阅需要使用租户 B 作为 Microsoft Entra 目录。

创建完成后的关系如下：

```text
租户 A 的 EA 注册
└── Enrollment Account
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
| 租户 A 的 EA Enrollment Account | 决定订阅由哪个 EA Account 付费，并负责计费归集 |
| 租户 B | 保存用户、组和应用身份，并承载订阅的管理组、Azure RBAC 和 Azure Policy |

因此，**EA 计费权限不等于租户 B 中的资源权限**。能够选择 Enrollment Account，只说明账号有权使用该计费账户创建订阅；订阅进入租户 B 后，资源访问仍由租户 B 的 Azure RBAC 决定。

---

## 二、前置条件

除正常创建 EA 订阅所需的计费权限外，跨租户创建还需要满足两个条件。

### 1. 创建者是租户 B 的 B2B Guest

使用租户 A 身份创建订阅的账号，需要先被邀请到租户 B，并在租户 B 中显示为 **Guest（来宾用户）**。完成邀请后，该账号才能在 Azure 门户切换到租户 B，并以租户 B 中的外部身份执行操作。

Guest 身份本身不代表拥有租户 B 的 Global Administrator、管理组或订阅权限。它只表示租户 B 中存在一个可识别的外部身份对象。

### 2. 租户 B 的订阅进入策略允许

租户 B 的 **Subscriptions entering the Microsoft Entra tenant（进入 Microsoft Entra 租户的订阅）**策略必须允许该账号把新订阅放入租户 B。可以采用以下任一配置：

- 允许所有用户将订阅带入租户 B。
- 仅允许指定的豁免用户，并把当前创建者加入豁免列表。

修改这项策略需要租户 B 的管理员操作。创建订阅的 Guest 用户不需要因此获得 Global Administrator。

### EA 计费权限

创建者还必须拥有正常创建 EA 订阅所需的计费角色，例如：

- EA Enterprise Administrator；或
- 目标 Enrollment Account 的 Account Owner。

这项权限决定创建页面中能否看到并选择 EA Billing Account 和 Enrollment Account，与租户 B 的 Guest 身份和 Azure RBAC 相互独立。

---

## 三、确认租户 B 中的 B2B Guest 身份

由租户 B 的管理员执行以下操作：

1. 登录 [Azure 门户](https://portal.azure.com)，切换到租户 B。
2. 打开 **Microsoft Entra ID** → **Users（用户）**。
3. 搜索租户 A 中用于创建订阅的账号。
4. 确认该用户的 **User type（用户类型）**为 `Guest`。

如果用户不存在：

1. 选择 **New user（新建用户）** → **Invite external user（邀请外部用户）**。
2. 输入租户 A 用户的登录邮箱并发送邀请。
3. 让该用户使用租户 A 的原始身份接受邀请。
4. 返回租户 B 的用户列表，确认用户状态和 `Guest` 类型。

> 如果同一个邮箱同时对应个人 Microsoft Account 和工作账号，接受邀请及登录时必须选择被授予 EA 计费角色的工作身份。否则即使能够进入租户 B，也可能看不到 EA Billing Account。

---

## 四、配置租户 B 的订阅进入策略

这一步由租户 B 中有权修改订阅策略的管理员完成。

1. 登录 [Azure 门户](https://portal.azure.com)，确认当前目录为租户 B。
2. 搜索并打开 **Subscriptions（订阅）**。
3. 选择 **Manage policies（管理策略）**。
4. 找到 **Subscriptions entering the Microsoft Entra tenant** 设置。
5. 根据组织要求选择：
   - 允许所有用户；或
   - 保持限制，并把创建者加入 **Exempted users（豁免用户）**。
6. 保存设置，并等待配置生效。

修改策略和使用策略是两件事：租户 B 的管理员负责配置允许范围；实际创建者只需要落在被允许的范围内，不需要拥有修改策略的权限。

---

## 五、在 Azure 门户创建订阅

### 1. 切换到租户 B

1. 使用拥有 EA 计费权限的租户 A 账号登录 [Azure 门户](https://portal.azure.com)。
2. 点击门户右上角的账号或目录入口。
3. 在 **Directories + subscriptions（目录和订阅）**中切换到租户 B。
4. 确认门户右上角显示的当前目录是租户 B。

切换目录后，当前身份仍然是原来的租户 A 账号，但 Azure 门户使用的是该账号在租户 B 中的 B2B Guest 身份。

### 2. 填写订阅信息

1. 在门户顶部搜索 **Subscriptions（订阅）**。
2. 进入订阅页面，选择 **+ Add（+ 添加）**。
3. 在 **Create a subscription（创建订阅）**页面填写基本信息：

   | 字段 | 填法 |
   |---|---|
   | **Billing account** | 选择租户 A 对应的 EA Billing Account |
   | **Enrollment account** | 选择用于承担费用的 EA Enrollment Account |
   | **Offer / Plan** | 通常选择 `Microsoft Azure Enterprise`；开发测试场景按 EA 配置选择 Dev/Test |
   | **Subscription name** | 填写便于识别的名称，例如 `contoso-prod-app01` |

4. 打开 **Advanced（高级）**选项卡，确认 **Directory（目录）**为租户 B。
5. 如果页面允许选择 **Management group（管理组）**，按组织治理要求选择目标管理组；没有相应管理组权限时，可以先使用默认位置。
6. 如果页面要求指定 **Subscription owner（订阅所有者）**，选择租户 B 中受支持的 Member 用户或 Service Principal。B2B Guest 可能无法作为初始 Subscription Owner 被选择。
7. 选择 **Review + create（查看 + 创建）**，检查计费账户、Enrollment Account 和 Directory。
8. 选择 **Create（创建）**。

检查时最重要的是不要混淆下面两个字段：

```text
Billing / Enrollment Account → 租户 A 的 EA
Directory                    → 租户 B
```

---

## 六、创建后验证

创建完成后，从目录归属、计费归属和权限三个方向检查。

### 验证目录归属

1. 切换到租户 B。
2. 打开 **Subscriptions**，进入新订阅。
3. 在订阅属性中确认 **Directory ID / Tenant ID** 是租户 B 的 Tenant ID。

也可以使用 Azure CLI：

```azurecli
az account show \
  --subscription <新订阅名称或 ID> \
  --query "{Subscription:name, SubscriptionId:id, TenantId:tenantId}" \
  -o table
```

### 验证计费归属

在 Azure 门户中打开 **Cost Management + Billing**，确认新订阅位于预期的 EA Enrollment Account 下。计费数据同步可能晚于订阅创建。

### 验证 Azure RBAC

1. 打开新订阅 → **Access control (IAM)**。
2. 查看 **Role assignments（角色分配）**。
3. 确认负责管理该订阅的租户 B 用户或安全组具有预期角色。

如果订阅位于某个 Management Group 下，还应检查从上级管理组继承的 Owner、Contributor、Reader 和 Azure Policy 是否符合预期。
