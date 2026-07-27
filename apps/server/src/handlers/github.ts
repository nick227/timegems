import { requireTenantId } from '../lib/tenant'
import { GithubService } from '../services/GithubService'

const githubService = new GithubService()

export async function listGithubInstallations(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const installations = await githubService.listInstallations(tenantId)
  return reply.send({ data: installations })
}

export async function registerGithubInstallation(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const { installationId } = request.body
  const installation = await githubService.registerInstallation(tenantId, installationId)
  return reply.status(201).send({ data: installation })
}

export async function disconnectGithubInstallation(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const { installationId } = request.params
  await githubService.disconnectInstallation(tenantId, installationId)
  return reply.status(204).send()
}

export async function listGithubInstallationRepositories(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const { installationId } = request.params
  const repositories = await githubService.listRepositories(tenantId, installationId)
  return reply.send({ data: repositories })
}

export async function listProjectGithubBindings(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const { projectId } = request.params
  const bindings = await githubService.listProjectBindings(tenantId, projectId)
  return reply.send({ data: bindings })
}

export async function bindProjectGithubRepository(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const { projectId } = request.params
  const binding = await githubService.bindRepository(tenantId, projectId, request.body)
  return reply.status(201).send({ data: binding })
}

export async function unbindProjectGithubRepository(request: any, reply: any) {
  const tenantId = requireTenantId(request)
  const { projectId, bindingId } = request.params
  await githubService.unbindRepository(tenantId, projectId, bindingId)
  return reply.status(204).send()
}

export async function handleGithubWebhook(request: any, reply: any) {
  const githubDeliveryId = request.headers['x-github-delivery']
  const event = request.headers['x-github-event']
  const signatureHeader = request.headers['x-hub-signature-256']
  const rawBody = request.rawBody || ''
  
  const result = await githubService.handleWebhook(
    githubDeliveryId,
    event,
    signatureHeader,
    rawBody,
    request.body,
  )
  return reply.send(result)
}
