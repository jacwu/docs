# Azure Tenant Root Group、Management Group 和订阅的关系

当一个 Azure 租户中只有一两个订阅时，可以逐个订阅配置权限；但订阅数量增加后，逐个维护 RBAC 角色不仅重复，还容易漏配。Azure Management Group（管理组）提供了订阅之上的统一治理层级，可以让权限和策略自动向下继承。

本文介绍 Microsoft Entra tenant、Tenant Root Group、Management Group 和订阅之间的关系，并以“在 Tenant Root Group 统一配置 Owner”为例，说明如何减少多订阅环境的权限管理工作。


---

## 目录

- [一、完整的 Azure 管理层级](#一完整的-azure-管理层级)
- [二、Tenant Root Group 是什么](#二tenant-root-group-是什么)
- [三、Management Group 是什么](#三management-group-是什么)
- [四、订阅在层级中的位置](#四订阅在层级中的位置)
- [五、权限如何向下继承](#五权限如何向下继承)
- [六、示例：在 Tenant Root Group 配置 Owner](#六示例在-tenant-root-group-配置-owner)
- [七、如何验证继承结果](#七如何验证继承结果)

---

## 一、完整的 Azure 管理层级

一个 Microsoft Entra tenant（租户）只有一棵 Management Group 层级树。Tenant Root Group 位于最上方，下面可以放普通 Management Group 和订阅：

```text
Microsoft Entra tenant（身份与目录边界）
└── Tenant Root Group（根管理组）
    ├── Platform（管理组）
    │   ├── Connectivity（管理组）
    │   │   └── 网络中心订阅
    │   └── Management（管理组）
    │       └── 日志与监控订阅
    ├── Landing Zones（管理组）
    │   ├── Production（管理组）
    │   │   ├── 生产订阅 A
    │   │   └── 生产订阅 B
    │   └── Non-Production（管理组）
    │       └── 测试订阅
    └── Sandbox 订阅
```

在每个订阅内部，还有资源组和资源：

```text
订阅
└── Resource Group（资源组）
    └── Resource（虚拟机、存储账户、数据库等）
```

因此，从 Azure 资源治理角度看，完整的作用域关系是：

```text
Tenant Root Group
→ Management Group
→ Subscription
→ Resource Group
→ Resource
```

父级作用域配置的 Azure RBAC 角色和 Azure Policy，通常会由其所有后代作用域继承。

---

## 二、Tenant Root Group 是什么

**Tenant Root Group（租户根组）是一个 Microsoft Entra tenant 中最高层的 Management Group。** 它由 Azure 自动提供，默认显示名称为 `Tenant root group`，ID 与 Microsoft Entra tenant ID 相同。

它有几个重要特点：

- 每个 tenant 只有一个 Tenant Root Group。
- 不能删除，也不能移动到其他 Management Group 下。
- tenant 内所有 Management Group 和订阅最终都归属于它。
- 新订阅默认进入 Tenant Root Group，之后可以移动到其他 Management Group。
- 在这里配置的 RBAC 角色和 Policy 会影响下面的整个 Azure 资源层级。

Tenant Root Group 适合放置真正需要覆盖整个 tenant 的配置，例如：

- 平台管理团队的统一访问权限。
- 全局安全与合规策略。
- 禁止创建某些高风险资源的 Policy。
- 要求所有资源使用指定标签的治理规则。

不应因为配置方便，就把只适用于部分业务的权限或策略放在 Tenant Root Group。

---

## 三、Management Group 是什么

**Management Group 是位于 Tenant Root Group 与订阅之间的治理容器。** 它本身不承载虚拟机、数据库等业务资源，主要用于组织订阅并统一应用权限和策略。

Management Group 可以包含：

- 其他 Management Group。
- 一个或多个订阅。
- 同时包含 Management Group 和订阅。

每个 Management Group 和订阅只能有一个直接父级，因此整个 tenant 始终是一棵树，而不是多个相互交叉的层级。

常见的划分方法包括：

| 划分方式 | Management Group 示例 | 适用场景 |
|---|---|---|
| 按环境 | Production、Non-Production | 生产和测试使用不同策略与权限 |
| 按部门 | Finance、Retail、R&D | 各部门独立管理自己的订阅 |
| 按工作负载 | SAP、Data、Web | 同类系统共享治理基线 |
| 按平台职责 | Connectivity、Identity、Management | 平台团队集中管理共享服务 |

例如，只给 `Production` Management Group 配置更严格的安全 Policy，就不会影响 `Non-Production` 下的测试订阅。

---

## 四、订阅在层级中的位置

**Subscription（订阅）是资源管理、配额和计费的重要边界。** 虚拟机、存储账户等资源最终都创建在某个订阅内。

订阅与 tenant、Management Group 的关系如下：

- 一个订阅在同一时间只关联一个 Microsoft Entra tenant。
- 一个订阅在 Management Group 层级中只能有一个父级。
- 一个 Management Group 可以包含多个订阅。
- 订阅可以在有权限的情况下移动到另一个 Management Group。
- 移动订阅不会移动其中的资源，但其继承的 RBAC 和 Policy 可能发生变化。

需要特别区分两套概念：

| 概念 | 解决什么问题 |
|---|---|
| Microsoft Entra tenant | 用户、组、应用和身份验证的目录边界 |
| Management Group | 多订阅的 Azure RBAC 与 Policy 治理层级 |
| Subscription | 资源、配额、计费和管理边界 |

Microsoft Entra Global Administrator 也不会天然拥有 Azure 订阅中的资源权限，因为 Entra 目录角色与 Azure RBAC 是两套独立的权限系统。

---

## 五、权限如何向下继承

Azure RBAC 角色分配包含三个要素：

```text
安全主体（用户、组、服务主体或托管身份）
+ 角色（Owner、Contributor、Reader 等）
+ 作用域（Management Group、订阅、资源组或资源）
```

角色分配会从父级作用域向后代作用域继承。例如：

```text
Tenant Root Group：Cloud Platform Admins = Owner
└── Production Management Group：继承 Owner
    └── 生产订阅 A：继承 Owner
        └── 生产资源组：继承 Owner
            └── 虚拟机：继承 Owner
```

这意味着：

- 已经存在于该 tenant 层级中的订阅会继承权限。
- 以后新建并加入该 tenant 层级的订阅也会继承权限。
- 订阅管理员不需要在每个订阅中重复添加同一角色。
- 在订阅的 IAM 页面中，这条角色分配会显示为从上级作用域继承。

继承不会在每个订阅中复制一条独立角色分配。真正的角色分配仍位于 Tenant Root Group；删除根级分配后，下面所有作用域的继承权限也会消失。

> Azure RBAC 没有普通的“拒绝继承”开关。订阅 Owner 不能在订阅层删除从 Tenant Root Group 继承的角色分配，只能由有权管理上级作用域的管理员修改根级分配。

---

## 六、示例：在 Tenant Root Group 配置 Owner

假设 Contoso 有 20 个 Azure 订阅，由 3 名平台管理员统一负责。传统做法是在每个订阅中分别给 3 名管理员配置 Owner：

```text
20 个订阅 × 3 名管理员 = 60 条需要分别维护的角色分配
```

更集中的做法是：

1. 在 Microsoft Entra ID 中创建安全组 `Cloud Platform Admins`。
2. 把 3 名平台管理员加入该组。
3. 在 Tenant Root Group 上只给这个组分配一次 Owner。
4. 让下面的所有订阅继承该角色。

这样，Azure 侧只需维护一条根级角色分配。以后人员变动时，调整安全组成员即可；以后新增订阅时，也不需要再次添加平台管理员。

### 前置条件

默认情况下，没有人自动拥有 Tenant Root Group 的管理权限。如果当前没有可在根管理组分配角色的账号，需要由 Microsoft Entra **Global Administrator** 临时提升访问权限：

1. 登录 [Azure 门户](https://portal.azure.com)。
2. 打开 **Microsoft Entra ID** → **Properties（属性）**。
3. 将 **Access management for Azure resources（Azure 资源的访问管理）**设置为 **Yes** 并保存。
4. 退出后重新登录，使权限生效。

该操作会把当前 Global Administrator 临时授予根作用域 `/` 的 **User Access Administrator**，从而可以在 Tenant Root Group 分配 Azure RBAC 角色。它不会自动把所有 Global Administrator 变成订阅 Owner。

### 在 Tenant Root Group 分配 Owner

1. 在 Azure 门户顶部搜索 **Management groups（管理组）**。
2. 打开 **Tenant root group**。
3. 选择 **Access control (IAM)（访问控制）**。
4. 点击 **+ Add（添加）** → **Add role assignment（添加角色分配）**。
5. 在角色列表中选择 **Owner（所有者）**。
6. 在成员类型中选择 **User, group, or service principal（用户、组或服务主体）**。
7. 选择安全组 `Cloud Platform Admins`。
8. 检查作用域确实是 Tenant Root Group，然后完成分配。

角色分配完成后，等待权限传播。Management Group 层级信息可能存在缓存，门户不一定立即显示最新结果。

---

## 七、如何验证继承结果

建议同时从根管理组和订阅两个方向检查。

### 在 Tenant Root Group 检查

1. 打开 **Management groups** → **Tenant root group**。
2. 进入 **Access control (IAM)** → **Role assignments（角色分配）**。
3. 确认 `Cloud Platform Admins` 的角色为 Owner，作用域为当前根管理组。

### 在订阅中检查

1. 打开任意一个目标订阅。
2. 进入 **Access control (IAM)** → **Role assignments**。
3. 搜索 `Cloud Platform Admins`。
4. 确认角色为 Owner，并显示为继承自 Tenant Root Group 或上级 Management Group。

再选择一个新建订阅进行相同检查。如果新订阅属于同一个 tenant 的 Management Group 层级，它也应继承该 Owner 权限。

---
