param location string
param apimName string
param publisherEmail string
param publisherName string
@minLength(1)
@maxLength(30)
param backendUrls array
@secure()
param backendApiKeys object
param imageApiVersion string
param exposeBackendPath bool

resource apim 'Microsoft.ApiManagement/service@2024-05-01' = {
  name: apimName
  location: location
  sku: {
    name: 'Consumption'
    capacity: 0
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
}

resource keys 'Microsoft.ApiManagement/service/namedValues@2024-05-01' = [for (url, i) in backendUrls: {
  parent: apim
  name: 'foundry-image-key-${i + 1}'
  properties: {
    displayName: 'foundry-image-key-${i + 1}'
    secret: true
    value: backendApiKeys.values[i]
  }
}]

resource backends 'Microsoft.ApiManagement/service/backends@2024-05-01' = [for (url, i) in backendUrls: {
  parent: apim
  name: 'image-${i + 1}'
  properties: {
    type: 'Single'
    protocol: 'http'
    url: url
    description: 'GPT Image 2 deployment ${i + 1}; HTTPS and API key authentication'
    credentials: {
      header: {
        'api-key': [
          '{{foundry-image-key-${i + 1}}}'
        ]
      }
    }
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
  dependsOn: [keys]
}]

resource pool 'Microsoft.ApiManagement/service/backends@2024-05-01' = {
  parent: apim
  name: 'image-pool'
  properties: {
    type: 'Pool'
    description: 'Equal-weight native pool; Consumption does not support circuit breakers'
    pool: {
      services: [for (url, i) in backendUrls: {
        id: backends[i].id
        priority: 1
        weight: 1
      }]
    }
  }
}

resource api 'Microsoft.ApiManagement/service/apis@2024-05-01' = {
  parent: apim
  name: 'image-api'
  properties: {
    displayName: 'GPT Image 2'
    description: 'URL/key-based load balancing over existing Foundry image deployments'
    apiRevision: '1'
    path: 'images'
    protocols: ['https']
    subscriptionRequired: true
    subscriptionKeyParameterNames: {
      header: 'api-key'
      query: 'subscription-key'
    }
  }
}

resource operations 'Microsoft.ApiManagement/service/apis/operations@2024-05-01' = [for operation in ['generations', 'edits']: {
  parent: api
  name: operation
  properties: {
    displayName: operation
    method: 'POST'
    urlTemplate: '/${operation}'
    templateParameters: []
    responses: []
  }
}]

resource policy 'Microsoft.ApiManagement/service/apis/policies@2024-05-01' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: replace(replace(loadTextContent('../policies/image-api.xml'), '__API_VERSION__', imageApiVersion), '__EXPOSE_BACKEND__', exposeBackendPath ? 'true' : 'false')
  }
  dependsOn: [pool, operations]
}

resource clientSubscription 'Microsoft.ApiManagement/service/subscriptions@2024-05-01' = {
  parent: apim
  name: 'image-client'
  properties: {
    displayName: 'Image API client'
    scope: api.id
    state: 'active'
    allowTracing: false
  }
}

output gatewayUrl string = apim.properties.gatewayUrl
output generationUrl string = '${apim.properties.gatewayUrl}/images/generations'
output editUrl string = '${apim.properties.gatewayUrl}/images/edits'
