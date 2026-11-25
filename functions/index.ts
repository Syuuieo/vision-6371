import { createDatabaseClient, createSiteContext, errorResponse, BackendError } from './_qoder/backend.mjs'
import { application } from './routes.mjs'

const env = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env
const adminToken = (env?.get?.('ADMIN_TOKEN') ?? '').trim()
const handle = application({ db: createDatabaseClient(), BackendError, adminToken })

Deno.serve(async (request) => {
  let context
  try {
    context = createSiteContext(request)
    return await handle(context)
  } catch (error) {
    return errorResponse(error, context?.requestId)
  }
})