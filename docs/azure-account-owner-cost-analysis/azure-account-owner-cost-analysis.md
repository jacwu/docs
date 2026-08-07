# Azure Account Owner 如何查看相关订阅用量并导出 CSV

Azure Enterprise Agreement（EA）中的 Account Owner 可以在 Azure 门户的**成本管理 + 计费**中查看自己 Account 下相关订阅的成本用量。本指南介绍如何进入正确的成本范围、切换成表格、按订阅筛选，并下载 CSV 找出消耗明显的订阅。

> **前提**：EA Administrator 必须开启 Account Owner 查看费用的权限（`AO view charges`）。如果该开关未开启，Account Owner 即使可以管理 Account 下的订阅，也可能看不到成本数据。

---

## 目录

- [一、能看到哪些成本](#一能看到哪些成本)
- [二、进入成本分析](#二进入成本分析)
- [三、选择时间和成本视图](#三选择时间和成本视图)
- [四、切换成表格并按订阅显示](#四切换成表格并按订阅显示)
- [五、按订阅筛选](#五按订阅筛选)
- [六、下载 CSV](#六下载-csv)
- [七、理解 CSV 中的关键字段](#七理解-csv-中的关键字段)
- [八、从 CSV 找出消耗明显的订阅](#八从-csv-找出消耗明显的订阅)
- [九、常见问题](#九常见问题)

---

## 一、能看到哪些成本

EA 的计费层级如下：

```text
EA 注册（Enrollment）
└── 部门（Department）
    └── Account / Enrollment Account
        └── 订阅（Subscription）
```

Account Owner 的成本查看范围由其 Account 归属和 EA 费用查看策略决定。进入成本分析后，要先检查页面顶部的**范围**：

- 范围是 Account 时，可以查看该 Account 下相关订阅的成本。
- 范围是部门时，可以查看该部门中有权限访问的成本。
- 页面中没有目标订阅时，先确认订阅是否归属于当前 Account，以及 `AO view charges` 是否已开启。

这里的“用量”指已经进入 Cost Management 的**计费使用量和成本**，不是虚拟机 CPU、内存或网络等实时监控指标。

---

## 二、进入成本分析

按照 Azure 门户中的计费入口进入：

```text
Azure 门户
└── 成本管理 + 计费
    └── 成本管理
        └── 选择计费范围
            └── 部门或 Account
                └── 成本管理
                    └── 成本分析
```

具体步骤：

1. 登录 [Azure 门户](https://portal.azure.com)。
2. 在顶部搜索框输入 **成本管理 + 计费**，打开该服务。
3. 进入 **成本管理**，选择所属的 EA 计费范围。
4. 根据组织的计费结构，进入对应的**部门**或 **Account**。
5. 在左侧展开 **成本管理**，选择 **成本分析**。

参考截图，进入部门后，页面标题类似：

```text
huayu (216137) | 成本分析
```

面包屑中会同时显示计费账户、部门等层级。开始分析前，确认页面顶部的**范围**是你要分析的部门或 Account，避免把其他范围的成本混进来。

---

## 三、选择时间和成本视图

成本分析页面顶部有视图和日期选项。建议按下面方式设置：

1. 在 **视图**中选择 **AccumulatedCosts（累计成本）**，查看所选周期累计产生的成本。
2. 在日期选择器中选择要分析的月份，例如截图中的 **Aug 2026**。
3. 确认页面显示的是**实际成本**及正确币种，例如 `CN¥`。
4. 如果要比较月度趋势，可以扩大日期范围并把**粒度**设为“每月”。

常见成本口径：

| 口径 | 含义 | 适合场景 |
|---|---|---|
| 实际成本 | 已经产生并计入账单的成本 | 查当月实际花费、找异常增长 |
| 摊销成本 | 将预留实例、节省计划等购买费用分摊到使用周期 | 分析资源的真实周期成本 |
| 预测成本 | Azure 根据当前趋势估算周期结束时的成本 | 提前判断月底是否可能超支 |

如果目标是找“本月哪些订阅花费明显”，优先使用**实际成本**。

> Cost Management 数据通常不是实时的，可能存在 8 到 24 小时延迟。

---

## 四、切换成表格并按订阅显示

图表适合看趋势，表格更适合比较各订阅的具体金额。按截图中的方式设置：

1. 在结果区域右上角打开图表类型菜单。
2. 选择 **表**，把成本分析切换为表格。
3. 将 **分组依据**设置为 **Subscription**。
4. 按需要把**粒度**设置为“每月”。
5. 点击 **Cost** 列标题，按成本降序排序。

设置完成后，表格通常包含：

| 列 | 说明 |
|---|---|
| `Date` | 成本所属月份 |
| `Subscription name` | 订阅名称，可能同时显示订阅 ID |
| `Enrollment account name` | 订阅所属的 Account |
| `Cost` | 该订阅在当前时间和筛选条件下的成本 |

截图中的表格按 `Subscription` 分组后，可以直接看出两个订阅的成本差异：一个约为 `CN¥164,488.03`，另一个约为 `CN¥1,738.15`。按 Cost 降序后，消耗明显的订阅会排在最上方。

> “分组依据”决定结果如何汇总；要比较订阅，必须选择 `Subscription`，不要选 Resource、Service name 或 Resource group。

---

## 五、按订阅筛选

如果只想分析一个或几个订阅，可以使用页面顶部的 **+ 添加筛选器**：

1. 点击 **+ 添加筛选器**。
2. 筛选维度选择 **Subscription（订阅）**。
3. 在值列表中勾选目标订阅。
4. 点击应用，确认页面顶部出现订阅筛选条件。
5. 保持**分组依据：Subscription**，可以同时看到所选订阅之间的成本对比。

两种常用方式：

| 目标 | 设置方式 |
|---|---|
| 查看所有相关订阅并找出最高消耗 | 不添加订阅筛选器；分组依据选 `Subscription`；按 Cost 降序 |
| 深入分析指定订阅 | 添加 `Subscription` 筛选器；再按 Service name、Resource group 或 Resource 分组 |

定位到高消耗订阅后，可以继续改变**分组依据**：

- `Service name`：判断是虚拟机、存储、数据库还是其他服务花费最高。
- `Resource group`：定位到具体项目或环境。
- `Resource`：定位到具体资源实例。
- `Meter`：分析具体计费项。

分析时一次只改变一个分组维度，更容易确认成本从哪一层开始明显增长。

---

## 六、下载 CSV

成本分析用于确定哪个订阅消耗明显；确定目标月份后，应按截图从 **使用情况 + 费用**页面下载 CSV：

```text
当前部门或 Account
└── 计费
    └── 使用情况 + 费用
```

具体步骤：

1. 保持在需要导出数据的部门或 Account 范围内。
2. 在左侧展开 **计费**，选择 **使用情况 + 费用**。
3. 在 **时间跨度**中选择查询范围，例如“过去 12 个月”。
4. 在右侧 **视图**中选择“列表”。
5. 在月份列表中找到目标月份。
6. 点击该月份最右侧 **下载**列中的向下箭头，下载该月的使用情况 CSV。
7. 如果需要导出当前列表本身，可以点击页面顶部的 **导出 CSV**；分析具体订阅消耗时，应优先使用月份行右侧的下载箭头获取该月数据。
8. 下载完成后，用 Excel 打开 CSV。

页面按月显示以下汇总金额：

| 列 | 含义 |
|---|---|
| **Azure 费用** | Azure 服务产生的费用 |
| **单独计费** | 单独列出的计费项目 |
| **Azure 市场** | Azure Marketplace 产生的费用 |
| **总费用** | 该月上述费用的合计 |
| **下载** | 下载该月使用情况 CSV |

截图顶部提示“总费用未进行四舍五入调整”，因此页面显示金额与 CSV 明细汇总值之间可能出现很小的舍入差异。

下载前建议记录以下条件，便于复核：

```text
范围：部门或 Account 名称
日期：例如 2026-08
下载入口：计费 → 使用情况 + 费用
币种：例如 CNY
```

如果下载后的 CSV 与页面金额明显不同，先确认下载的是正确月份和计费范围，再检查 CSV 中是否包含全部费用类型。

---

## 七、理解 CSV 中的关键字段

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

## 八、从 CSV 找出消耗明显的订阅

### 方法一：已有订阅汇总列时直接排序

如果下载的 CSV 已经按 Subscription 汇总：

1. 在 Excel 中选中数据区域任意单元格。
2. 选择 **数据 → 排序**。
3. 排序列选择 `Cost`。
4. 排序方式选择“从大到小”。

排在最上面的订阅就是当前范围和周期内成本最高的订阅。

### 方法二：用数据透视表汇总明细 CSV（推荐）

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

---

## 九、常见问题

| 现象 | 常见原因 | 处理 |
|---|---|---|
| 进入成本分析后没有数据 | `AO view charges` 未开启，或 Cost Management 数据尚未更新 | 联系 EA Administrator 检查费用查看策略，并等待数据刷新 |
| 看不到某个订阅 | 订阅不属于当前 Account，或选错计费范围 | 检查页面顶部范围和订阅的 Enrollment Account 归属 |
| 表格没有按订阅汇总 | 分组依据不是 Subscription | 将“分组依据”改为 `Subscription` |
| 表格中订阅太多 | 没有添加订阅筛选器 | 选择“添加筛选器” → `Subscription` → 勾选目标订阅 |
| 页面金额与 CSV 不一致 | 日期、范围、成本口径或筛选条件不同 | 使用完全相同的条件重新导出 |
| Excel 中 Cost 不能求和 | Cost 被识别成文本，通常包含币种符号或分隔符 | 用 Power Query 设置为货币/小数类型，或清理符号后转为数值 |
| Quantity 很大但 Cost 很低或为 0 | 度量单位不是单个单位，或包含免费/权益覆盖用量 | 同时检查 UnitOfMeasure、EffectivePrice 和 PricingModel |
| UnitPrice 乘 Quantity 与 Cost 不一致 | UnitPrice 不是该行最终实际费率 | 改用 EffectivePrice；以 Cost 作为实际费用字段 |
| 某些行没有资源名称或资源组 | 可能是购买、Marketplace 或舍入调整记录 | 查看 ChargeType、Product 和 PublisherType，不要直接删除 |
| CSV 无法保存数据透视表 | CSV 只支持单个纯文本数据表 | 另存为 `.xlsx` |

---

## 官方参考

- [开始在成本分析中分析成本](https://learn.microsoft.com/zh-cn/azure/cost-management-billing/costs/quick-acm-cost-analysis)
- [了解和使用 Cost Management 范围](https://learn.microsoft.com/zh-cn/azure/cost-management-billing/costs/understand-work-scopes)
- [下载或查看 Azure 计费发票和每日使用情况数据](https://learn.microsoft.com/zh-cn/azure/cost-management-billing/manage/download-azure-invoice-daily-usage-date)
- [了解成本详细信息字段](https://learn.microsoft.com/azure/cost-management-billing/automate/understand-usage-details-fields)
