targetScope = 'subscription'

param targetResourceGroup string
param resourceGroupLocation string
param apimLocation string
param apimName string
param publisherEmail string
param publisherName string = 'Image API'
type imageBackend = {
  sourceResourceGroup: string
  foundryAccountName: string
  url: string
}

@description('Existing Foundry deployment URLs ending in /images. Each entry uses its account key1. A native APIM pool supports up to 30 backends.')
@minLength(1)
@maxLength(30)
param backends imageBackend[]
param imageApiVersion string = '2025-04-01-preview'
param exposeBackendPath bool = false

resource target 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: targetResourceGroup
  location: resourceGroupLocation
}

module gateway './modules/gateway.bicep' = {
  name: 'image-gateway'
  scope: target
  params: {
    location: apimLocation
    apimName: apimName
    publisherEmail: publisherEmail
    publisherName: publisherName
    backendUrls: [for backend in backends: backend.url]
    backendApiKeys: {
      // Direct resource IDs permit multiple deployments from the same existing account
      // without duplicate account declarations in the ARM template.
      values: [for backend in backends: listKeys(resourceId(subscription().subscriptionId, backend.sourceResourceGroup, 'Microsoft.CognitiveServices/accounts', backend.foundryAccountName), '2025-06-01').key1]
    }
    imageApiVersion: imageApiVersion
    exposeBackendPath: exposeBackendPath
  }
}

output gatewayUrl string = gateway.outputs.gatewayUrl
output generationUrl string = gateway.outputs.generationUrl
output editUrl string = gateway.outputs.editUrl
output apimName string = apimName
output backendUrls array = [for backend in backends: backend.url]
