# 如何将 Azure VM 移动到另一个订阅

本文介绍如何在**同一个 Microsoft Entra 租户**内，将 Azure 虚拟机（VM）及其依赖资源移动到另一个订阅。移动操作不会更改 VM 所在区域，也不会复制 VM；它只会更改资源所属的订阅、资源组和资源 ID。

> 如果两个订阅属于不同的 Microsoft Entra 租户，不能使用本文的资源移动方法。请改用磁盘复制、Azure Resource Mover 或重新部署等迁移方案。

## 目录

- [一、移动前提](#一移动前提)
- [二、移动前处理两个常见问题](#二移动前处理两个常见问题)
- [三、执行移动](#三执行移动)
- [四、移动后检查](#四移动后检查)

## 一、移动前提

开始前，请确认以下条件：

1. **源订阅和目标订阅均处于活动状态。**
2. **两个订阅属于同一个 Microsoft Entra 租户。** 可使用 Azure CLI 检查：

   ```azurecli
   az account show --subscription <源订阅名称或 ID> --query tenantId -o tsv
   az account show --subscription <目标订阅名称或 ID> --query tenantId -o tsv
   ```

   两条命令必须返回相同的租户 ID。

3. **具有足够权限。** 执行移动的账号至少需要：
   - 源资源组上的 `Microsoft.Resources/subscriptions/resourceGroups/moveResources/action` 权限。
   - 目标资源组上的 `Microsoft.Resources/subscriptions/resourceGroups/write` 权限。
   - 实际操作中，通常可在源和目标范围授予 **Contributor**，或使用包含上述操作的自定义角色。
4. **目标订阅已注册所需的资源提供程序。** VM 通常至少涉及：
   - `Microsoft.Compute`
   - `Microsoft.Network`
   - `Microsoft.Storage`（如果使用存储账户）

   ```azurecli
   az account set --subscription <目标订阅名称或 ID>
   az provider register --namespace Microsoft.Compute
   az provider register --namespace Microsoft.Network
   az provider register --namespace Microsoft.Storage
   ```

5. **目标订阅有足够的配额。** 检查目标区域的 vCPU、托管磁盘、公网 IP 等配额，并确认 Azure Policy 不会阻止创建这些资源。
6. **VM 和所有依赖资源位于同一个源资源组中，并在一次请求中一起移动。** 常见依赖资源包括：
   - VM
   - OS 磁盘和数据磁盘
   - 网络接口（NIC）
   - 网络安全组（NSG）
   - 虚拟网络和子网（移动验证要求一起移动时）
   - 负载均衡器、可用性集等其他关联资源
7. **源资源组、目标资源组和相关资源上没有只读锁。**
8. **确认 VM 不属于不支持直接跨订阅移动的场景。** 例如，带 Azure Marketplace 计划的 VM、使用计划修补的 VM，以及某些虚拟机规模集配置需要采用单独的迁移方案。使用 Azure Disk Encryption 的 VM 跨订阅移动前需要禁用加密。

> 跨订阅移动会更改资源 ID。移动后需要更新脚本、模板、监控、告警、仪表板和其他保存了旧资源 ID 的配置。资源上的 Azure RBAC 角色分配不会随资源正常迁移，应在目标范围重新创建。

## 二、移动前处理两个常见问题

### 问题 1：VM 启用了 Azure VM Backup

如果移动验证返回 `DiskHasRestorePoints` 或提示磁盘是 Azure 备份作业的一部分，必须先删除 Azure Backup 创建的**还原点集合（Restore Point Collection）**。

删除还原点集合只会删除即时恢复快照，不会删除已经复制到 Recovery Services 保管库中的备份数据。

#### 使用 Azure 门户处理

1. 打开 VM 的 **备份** 页面，选择**停止备份**，然后选择**保留备份数据**。
2. 找到保存即时恢复点的资源组：
   - 默认名称通常为 `AzureBackupRG_<VM 所在区域>_1`，例如 `AzureBackupRG_westus2_1`。
   - 如果配置备份时指定了自定义资源组，请打开该资源组。
   - 如果不确定资源组，在 Azure 门户顶部搜索 **还原点集合（Restore Point Collections）**。
3. 找到类型为 **还原点集合**、名称类似 `AzureBackup_<VM 名称>_###########` 的资源。
4. 删除该还原点集合，并等待删除完成。

#### 使用 Azure CLI 处理

查找该 VM 的还原点集合：

```azurecli
az account set --subscription <源订阅名称或 ID>

az resource list \
  --resource-type Microsoft.Compute/restorePointCollections \
  --query "[?starts_with(name, 'AzureBackup_<VM 名称>')].{Name:name, ResourceGroup:resourceGroup, Id:id}" \
  -o table
```

确认结果属于待迁移 VM 后删除：

```azurecli
RESTORE_POINT_COLLECTION_ID=$(az resource list \
  --resource-type Microsoft.Compute/restorePointCollections \
  --query "[?starts_with(name, 'AzureBackup_<VM 名称>')].id | [0]" \
  -o tsv)

az resource delete --ids "$RESTORE_POINT_COLLECTION_ID"
```

> 如果 VM 启用了 Azure Backup **软删除**，保留软删除恢复点时仍无法移动 VM。按照组织的数据保护要求禁用软删除，或者在删除恢复点后等待 14 天，再重新验证移动。移动完成后需要在目标订阅中重新配置备份。

### 问题 2：VM 关联了公网 IP

如果验证返回 `MoveNotSupported`，并指出移动请求包含 `Microsoft.Network/publicIPAddresses`，请先将公网 IP 与 VM 的网络接口取消关联。取消关联会中断该 VM 通过公网 IP 提供的入站和出站访问，请提前安排维护窗口或准备其他管理通道。

#### 使用 Azure 门户处理

1. 打开待迁移的 VM。
2. 在 VM 的**概述**页面选择公网 IP 地址。
3. 在公网 IP 地址的**概述**页面选择**取消关联**。
4. 在确认窗口中选择**是**。

公网 IP 与 NIC 的 IP 配置取消关联后，不要把该公网 IP 资源加入跨订阅移动请求。VM 移动完成后，在目标订阅创建新的公网 IP，并将其关联到 NIC 的 IP 配置。

#### 使用 Azure CLI 处理

先查看 VM 的 NIC 和 IP 配置名称：

```azurecli
az vm nic list \
  --resource-group <源资源组> \
  --vm-name <VM 名称> \
  --query "[].{Name:name, Id:id}" \
  -o table

az network nic ip-config list \
  --resource-group <源资源组> \
  --nic-name <NIC 名称> \
  -o table
```

解除公网 IP 关联：

```azurecli
az network nic ip-config update \
  --resource-group <源资源组> \
  --nic-name <NIC 名称> \
  --name <IP 配置名称> \
  --public-ip-address null
```

> 新建公网 IP 后，公网 IP 地址通常会变化。请同步更新 DNS、防火墙白名单和客户端配置。

## 三、执行移动

### 方法一：使用 Azure 门户

1. 登录 [Azure 门户](https://portal.azure.com)，打开 VM 所在的源资源组。
2. 选择 VM 以及需要一起移动的依赖资源，例如 OS 磁盘、数据磁盘和 NIC。
3. 选择页面顶部的**移动** > **移动到另一个订阅**。
4. 选择目标订阅和目标资源组。
5. 等待 Azure 完成移动验证。
6. 如果验证失败，根据错误详情补充缺少的依赖资源，或按照上一节处理 Azure Backup 和公网 IP 问题，然后重新验证。
7. 验证成功后，确认资源 ID 将发生变化，并选择**移动**。
8. 等待 Azure 门户通知移动完成。

> 移动期间，源资源组和目标资源组会被锁定，不能在其中创建、删除或更新资源，但运行中的 VM 通常会继续运行。锁最长可能持续四小时。

### 方法二：使用 Azure CLI

下面的示例移动 VM、OS 磁盘、数据磁盘和 NIC。请根据实际依赖关系调整资源列表。

```azurecli
az account set --subscription <源订阅名称或 ID>

VM_ID=$(az vm show -g <源资源组> -n <VM 名称> --query id -o tsv)
NIC_IDS=$(az vm nic list -g <源资源组> --vm-name <VM 名称> --query "[].id" -o tsv)
DISK_IDS=$(az vm show -g <源资源组> -n <VM 名称> \
  --query "[storageProfile.osDisk.managedDisk.id, storageProfile.dataDisks[].managedDisk.id][]" \
  -o tsv)

az resource move \
  --destination-subscription-id <目标订阅 ID> \
  --destination-group <目标资源组> \
  --ids "$VM_ID" $NIC_IDS $DISK_IDS
```

生产环境建议先在 Azure 门户执行移动验证，或调用 `validateMoveResources` API 对完整资源列表进行预验证，再执行 `az resource move`。

## 四、移动后检查

1. 在目标订阅和目标资源组中确认 VM、磁盘和 NIC 均已出现，且预配状态为 `Succeeded`。
2. 检查 VM 电源状态、系统启动、数据盘挂载、私网连接和应用健康状态。
3. 如果迁移前取消了公网 IP，创建并关联新的公网 IP，然后验证网络安全组和外部访问。
4. 在目标订阅中重新配置 Azure VM Backup，并执行一次测试备份。
5. 重新创建 Azure RBAC 角色分配、资源锁、告警和诊断设置。
6. 更新所有引用旧资源 ID 或旧公网 IP 的自动化脚本、IaC 模板、DNS 和监控配置。
