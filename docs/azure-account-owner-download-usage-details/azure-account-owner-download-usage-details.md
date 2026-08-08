# Azure Account Owner 如何下载并查询 Azure 用量明细

Azure Enterprise Agreement（EA）的 Account Owner 可以从自己的 Enrollment Account 计费范围进入 **Usage + charges（使用情况 + 费用）**，按月份下载 Azure 用量明细。本指南介绍从 Azure 门户找到该下载入口的完整路径。

> **前提**：EA Administrator 必须为 Account Owner 开启费用查看权限（`AO view charges`）。如果未开启，Account Owner 可能看不到费用或下载入口。

---

## 目录

- [一、进入 Account 计费范围](#一进入-account-计费范围)
- [二、找到 Usage + charges 页面](#二找到-usage--charges-页面)
- [三、下载指定月份的用量明细](#三下载指定月份的用量明细)
- [四、理解 CSV 中的关键字段](#四理解-csv-中的关键字段)
- [五、从 CSV 找出消耗明显的订阅](#五从-csv-找出消耗明显的订阅)

---

## 一、进入 Account 计费范围

1. 使用 Account Owner 账号登录 [Azure 门户](https://portal.azure.com)。
2. 在顶部搜索框中搜索并打开 **Cost Management + Billing（成本管理 + 计费）**。
3. 在左侧选择 **Billing scopes（计费范围）**。
4. 在计费范围列表中找到满足以下条件的记录：
   - **Billing scope type（计费范围类型）**为 `Account`；
   - **Billing account type（计费账户类型）**为 `Enterprise Agreement`；
   - **My Role（我的角色）**为 `Account owner`。
5. 点击该 Account 的名称，进入 Enrollment Account 页面。

门户路径如下：

```text
Azure 门户
└── Cost Management + Billing（成本管理 + 计费）
    └── Billing scopes（计费范围）
        └── 选择 My Role 为 Account owner 的 EA Account
```

如果列表中有多个计费范围，不要选择 `Microsoft Customer Agreement` 或 `Microsoft Online Services Program` 类型的 Billing account；本指南对应的是 `Enterprise Agreement` 下的 `Account` 范围。

## 二、找到 Usage + charges 页面

进入 Account 后，确认页面标题显示正确的 Account 名称和编号，然后按照以下路径操作：

1. 在左侧导航中展开 **Billing（计费）**。
2. 选择 **Usage + charges（使用情况 + 费用）**。
3. 在页面的 **Timespan（时间跨度）**中选择查询范围，例如 **Last 12 months（过去 12 个月）**。
4. 将右侧 **View（视图）**保持为 **List（列表）**。

完整路径如下：

```text
Cost Management + Billing
└── Billing scopes
    └── EA Account（My Role: Account owner）
        └── Billing
            └── Usage + charges
```

## 三、下载指定月份的用量明细

Usage + charges 页面会按月显示费用。找到目标月份后：

1. 核对月份和币种，例如 `Aug 2026`、`CNY`。
2. 点击该月份最右侧 **Download（下载）**列中的向下箭头。
3. 等待 Azure 生成并下载该月的用量明细文件。

---

## 四、理解 CSV 中的关键字段

下载的文件是 EA 计费范围内的**月度成本明细**。一行通常代表某个订阅、资源或计量项在某一天产生的一笔用量或费用记录；同一个资源一天出现多行并不一定是重复收费，它可能使用了多个 Meter，或由服务提供方拆分上报。

### Cost 是什么

`成本 (Cost)` 是分析和汇总费用时最重要的字段。对 EA 数据，它表示该行在 `BillingCurrency` 中的费用，**未扣除 Azure 额度，也不包含税费**。

对于普通用量记录，计算关系为：

$$
\mathrm{Cost}=\mathrm{Quantity}\times\mathrm{EffectivePrice}
$$

例如样例中的 App Service B1：

```text
Quantity       = 24
EffectivePrice = 0.549859746 CNY / 小时
Cost           = 24 × 0.549859746 = 13.196633904 CNY
```

使用 Cost 时注意：

- **按 Cost 求和**可以得到订阅、资源组、资源或服务的总成本。
- 不要先把每一行 Cost 四舍五入到两位再求和；应先按原始精度求和，最后再显示两位小数。
- Cost 可以为 `0`：例如免费额度、包含用量，或已被预留实例/节省计划覆盖的实际成本记录。
- Cost 可以为负数：常见于舍入调整等冲销记录，不应简单删除。
- 月末发票生成后可能出现 `ChargeType = RoundingAdjustment` 的行，用于让明细汇总与发票总额一致。

### 与 Cost 直接相关的字段

| CSV 字段 | 含义 | 使用建议 |
|---|---|---|
| `计费货币 (BillingCurrency)` | Cost 使用的币种；样例中为 `CNY` | 汇总前确认所有行币种一致，不要直接汇总不同币种 |
| `数量 (Quantity)` | 当天消费的计费单位数量 | 必须结合 `UnitOfMeasure` 解读；不同单位的 Quantity 不能直接相加 |
| `度量单位 (UnitOfMeasure)` | Quantity 和价格对应的单位，例如 `1 Hour`、`1/Day`、`10K` | 用于解释数量和单价的尺度 |
| `有效价格 (EffectivePrice)` | 实际用于计算该行 Cost 的单位费率 | 对账时使用 `Quantity × EffectivePrice` |
| `单位价格 (UnitPrice)` | 合同协商后的单位价格，不考虑该行最终应用的权益 | 用于查看合同价；不要用它代替 EffectivePrice 计算 Cost |
| `PayGPrice` | 产品或服务的市场零售价/目录价 | 可与 EffectivePrice 比较权益效果；不是实际账单金额 |
| `费用类型 (ChargeType)` | 记录类型，如 `Usage`、`Purchase`、`RoundingAdjustment` | 汇总时保留全部类型；排查时分开查看用量、购买和调整 |
| `频率 (Frequency)` | `UsageBased`、`Recurring` 或 `OneTime` 等收费频率 | 区分按量、周期性和一次性费用 |
| `PricingModel` | `OnDemand`、`Reservation`、`Spot` 或 `SavingsPlan` | 判断成本采用按需、预留、Spot 或节省计划定价 |

`UnitPrice` 与 `EffectivePrice` 在普通按需记录中可能相同，但在阶梯定价、预留实例、节省计划或成本分配场景中可能不同。**实际费用始终以 Cost 为准。**

### 确定费用归属的字段

| CSV 字段 | 含义 | 适合回答的问题 |
|---|---|---|
| `帐户名 (AccountName)` / `帐户所有者ID (AccountOwnerId)` | EA Enrollment Account 及其负责人 | 这笔费用属于哪个 Account |
| `订阅名称 (SubscriptionName)` | 订阅显示名称 | 哪个订阅花费最高 |
| `订阅ID (SubscriptionId)` | 订阅唯一 ID | 订阅重名或改名时准确识别订阅 |
| `发票科目 (InvoiceSection)` | EA 部门/发票分区名称 | 费用归属于哪个部门或发票分区 |
| `成本中心 (CostCenter)` | 为订阅维护的成本中心 | 按内部财务成本中心归集费用 |
| `标记 (Tags)` | 直接分配给资源的标签 | 按项目、环境、负责人等标签分摊；不包含资源组标签 |

按订阅汇总时，建议同时把 `SubscriptionName` 和 `SubscriptionId` 放到数据透视表的“行”区域。只用名称可能把同名订阅合并，也无法应对订阅改名。

### 定位高消耗服务和资源的字段

| CSV 字段 | 含义 | 下钻顺序 |
|---|---|---|
| `计量类别 (MeterCategory)` | 服务的主要计费分类，如 Storage、Bandwidth、Azure App Service | 先判断是哪类服务产生费用 |
| `计量子类别 (MeterSubCategory)` | 更细的服务层级或规格 | 确认具体层级、套餐或资源类型 |
| `计量名称 (MeterName)` | 实际计费 Meter 名称 | 判断具体按什么用量计费 |
| `产品 (Product)` / `计划名称 (PlanName)` | 产品、规格或 Marketplace 计划 | 识别购买的产品和计划 |
| `已使用的服务 (ConsumedService)` | 上报费用的 Azure 资源提供程序 | 识别实际使用的 Azure 服务 |
| `资源组 (ResourceGroup)` | 资源所属资源组 | 定位项目或环境 |
| `资源名称 (ResourceName)` | 资源显示名称 | 找到具体高消耗资源 |
| `资源ID (ResourceId)` | 完整 Azure Resource Manager ID | 资源重名时精确定位；也可从中识别订阅、资源组和资源类型 |
| `资源位置 (ResourceLocation)` | 资源部署区域 | 判断费用是否集中在某个区域 |
| `日期 (Date)` | 用量或购买发生日期 | 分析每日成本突增发生在何时 |

部分购买、Marketplace 和舍入调整记录没有具体 ResourceId、ResourceName 或 ResourceGroup，这是正常情况，不能仅因资源字段为空就删除。

### 预留实例和节省计划字段

| CSV 字段 | 含义 |
|---|---|
| `预留ID (ReservationId)` / `预留名称 (ReservationName)` | 标识应用于记录的预留实例 |
| `产品订单ID (ProductOrderId)` / `产品订单名称 (ProductOrderName)` | 关联预留等产品的购买订单 |
| `benefitId` / `benefitName` | 标识应用于记录的节省计划等权益 |

这些字段通常只在权益相关记录中有值。分析预留实例或节省计划时，要同时查看 `PricingModel`、`ChargeType`、`EffectivePrice` 和 Cost；字段为空不代表普通按需记录有问题。

---

## 五、从 CSV 找出消耗明显的订阅

“使用情况 + 费用”下载的 CSV 通常包含多行使用量明细，建议用数据透视表按订阅汇总：

1. 在 Excel 中点击数据区域任意单元格。
2. 选择 **插入 → 数据透视表**。
3. 确认表/区域覆盖全部 CSV 数据，选择“新工作表”，点击“确定”。
4. 将 `Subscription name` 拖到**行**区域。
5. 将 `Cost` 拖到**值**区域。
6. 如果值显示为“计数项”，打开**值字段设置**并改为“求和”。
7. 对“求和项: Cost”执行从大到小排序。

建议把 `SubscriptionName` 和 `SubscriptionId` 都放入**行**区域，避免同名订阅被合并。还可以将 `Date` 拖到**列**区域分析每日变化，将 `AccountName` 拖到**筛选器**区域只分析指定 Account。

不要把 Quantity 单独汇总成“总用量”。例如小时、GB、请求次数和 `10K` 操作数不是同一种单位。只有在同时限定相同的 Meter 和 UnitOfMeasure 后，Quantity 求和才有意义。

完成后使用 **文件 → 另存为 → Excel 工作簿（`.xlsx`）**。CSV 本身不能保存数据透视表和多个工作表。

### 怎么判断“消耗明显”

“明显”应该结合组织规模定义。常见判断方式包括：

- 成本排名前 5 的订阅。
- 单个订阅占 Account 总成本超过 20%。
- 本月成本比上月增长超过 30%。
- 实际成本明显高于该订阅预算或历史平均值。

先按订阅找到高消耗对象，再回到成本分析中按 Service name、Resource group 和 Resource 逐层下钻，比直接在 CSV 明细中逐行查找更高效。



