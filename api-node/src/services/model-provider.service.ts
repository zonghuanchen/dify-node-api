/**
 * Model provider service — credential-aware model metadata.
 * Mirrors Python api/services/model_provider_service.py (ModelProviderService)
 * plus the minimal ProviderConfiguration.get_current_credentials path from
 * api/core/entities/provider_configuration.py and api/core/provider_manager.py.
 *
 * Scope: CUSTOM (self-hosted, tenant-configured) providers only. SYSTEM/hosting
 * quota credentials are out of scope and treated as absent.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import {
  providerCredentials,
  providerModelCredentials,
  providerModels,
  providerModelSettings,
  providers,
} from '../db/schema.js'
import { BadRequestError, NotFoundError } from '../lib/errors.js'
import { decryptSecretFields } from '../lib/rsa.js'
import type { ParameterRule } from '../model-runtime/entities/model.js'
import { ModelType } from '../model-runtime/entities/model.js'
import type { CredentialFormSchema, ProviderEntity } from '../model-runtime/entities/provider.js'
import { FormType } from '../model-runtime/entities/provider.js'
import { getModelProviderFactory } from '../model-runtime/runtime-instance.js'

interface GetModelParameterRulesParams {
  db: Database
  tenantId: string
  provider: string
  model: string
}

/**
 * Get model parameter rules for a specific LLM model.
 * Mirrors ModelProviderService.get_model_parameter_rules (LLM only).
 */
export async function getModelParameterRules(
  params: GetModelParameterRulesParams,
): Promise<ParameterRule[]> {
  const { db, tenantId, provider, model } = params

  // Resolve the provider schema (throws for unknown providers) — mirrors ProviderNotFoundError.
  let providerEntity: ProviderEntity
  try {
    providerEntity = await getModelProviderFactory().getModelProvider(provider)
  }
  catch {
    throw new NotFoundError(`Provider ${provider} does not exist.`)
  }

  const providerNameCandidates = getProviderNameCandidates(provider, providerEntity)

  // Reject disabled models — mirrors the ValueError raised in get_current_credentials.
  await assertModelEnabled(db, tenantId, providerNameCandidates, model)

  const credentials = await resolveCurrentCredentials(
    db,
    tenantId,
    providerEntity,
    providerNameCandidates,
    model,
  )

  // Mirrors Python `if not credentials: return []` (empty dict is falsy).
  if (!credentials || Object.keys(credentials).length === 0) {
    return []
  }

  const modelSchema = await getModelProviderFactory().getModelSchema({
    provider: providerEntity.provider,
    modelType: ModelType.LLM,
    model,
    credentials,
  })

  return modelSchema?.parameter_rules ?? []
}

/**
 * Candidate provider names to match DB rows, mirroring ProviderManager._get_provider_names
 * / ModelProviderID aliasing (full plugin id and short provider name).
 */
function getProviderNameCandidates(provider: string, providerEntity: ProviderEntity): string[] {
  const names = new Set<string>([provider, providerEntity.provider])
  if (providerEntity.provider_name) {
    names.add(providerEntity.provider_name)
  }
  const lastSegment = providerEntity.provider.split('/').pop()
  if (lastSegment) {
    names.add(lastSegment)
  }
  return [...names]
}

/** Throw if an admin has disabled this model — mirrors get_current_credentials model_settings check. */
async function assertModelEnabled(
  db: Database,
  tenantId: string,
  providerNameCandidates: string[],
  model: string,
): Promise<void> {
  const settings = await db
    .select({ enabled: providerModelSettings.enabled })
    .from(providerModelSettings)
    .where(
      and(
        eq(providerModelSettings.tenantId, tenantId),
        inArray(providerModelSettings.providerName, providerNameCandidates),
        eq(providerModelSettings.modelName, model),
        eq(providerModelSettings.modelType, ModelType.LLM),
      ),
    )
    .limit(1)

  if (settings[0] && settings[0].enabled === false) {
    throw new BadRequestError(`Model ${model} is disabled.`)
  }
}

/**
 * Resolve current credentials for the model, preferring model-level over provider-level.
 * Mirrors ProviderConfiguration.get_current_credentials for the CUSTOM path.
 */
async function resolveCurrentCredentials(
  db: Database,
  tenantId: string,
  providerEntity: ProviderEntity,
  providerNameCandidates: string[],
  model: string,
): Promise<Record<string, unknown> | null> {
  const modelCredentials = await resolveModelCredentials(
    db,
    tenantId,
    providerEntity,
    providerNameCandidates,
    model,
  )
  if (modelCredentials && Object.keys(modelCredentials).length > 0) {
    return modelCredentials
  }

  return resolveProviderCredentials(db, tenantId, providerEntity, providerNameCandidates)
}

/** Load and decrypt model-level credentials, if a matching provider_models record exists. */
async function resolveModelCredentials(
  db: Database,
  tenantId: string,
  providerEntity: ProviderEntity,
  providerNameCandidates: string[],
  model: string,
): Promise<Record<string, unknown> | null> {
  const [modelRecord] = await db
    .select({ credentialId: providerModels.credentialId })
    .from(providerModels)
    .where(
      and(
        eq(providerModels.tenantId, tenantId),
        inArray(providerModels.providerName, providerNameCandidates),
        eq(providerModels.modelName, model),
        eq(providerModels.modelType, ModelType.LLM),
      ),
    )
    .limit(1)

  if (!modelRecord?.credentialId) {
    return null
  }

  const [credentialRecord] = await db
    .select({ encryptedConfig: providerModelCredentials.encryptedConfig })
    .from(providerModelCredentials)
    .where(
      and(
        eq(providerModelCredentials.id, modelRecord.credentialId),
        eq(providerModelCredentials.tenantId, tenantId),
      ),
    )
    .limit(1)

  if (!credentialRecord?.encryptedConfig) {
    return null
  }

  const secretVariables = extractSecretVariables(
    providerEntity.model_credential_schema?.credential_form_schemas ?? [],
  )
  return decryptEncryptedConfig(tenantId, credentialRecord.encryptedConfig, secretVariables, false)
}

/** Load and decrypt provider-level credentials from the custom (non-system) provider record. */
async function resolveProviderCredentials(
  db: Database,
  tenantId: string,
  providerEntity: ProviderEntity,
  providerNameCandidates: string[],
): Promise<Record<string, unknown> | null> {
  const providerRows = await db
    .select({
      providerType: providers.providerType,
      credentialId: providers.credentialId,
    })
    .from(providers)
    .where(
      and(
        eq(providers.tenantId, tenantId),
        inArray(providers.providerName, providerNameCandidates),
      ),
    )

  const customRecord = providerRows.find(row => row.providerType !== 'system')
  if (!customRecord?.credentialId) {
    return null
  }

  const [credentialRecord] = await db
    .select({ encryptedConfig: providerCredentials.encryptedConfig })
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.id, customRecord.credentialId),
        eq(providerCredentials.tenantId, tenantId),
      ),
    )
    .limit(1)

  if (!credentialRecord?.encryptedConfig) {
    return null
  }

  const secretVariables = extractSecretVariables(
    providerEntity.provider_credential_schema?.credential_form_schemas ?? [],
  )
  return decryptEncryptedConfig(tenantId, credentialRecord.encryptedConfig, secretVariables, true)
}

/**
 * Parse a stored encrypted_config blob and decrypt its secret fields.
 * Mirrors ProviderManager._get_and_decrypt_credentials (custom path).
 */
async function decryptEncryptedConfig(
  tenantId: string,
  encryptedConfig: string,
  secretVariables: string[],
  isProvider: boolean,
): Promise<Record<string, unknown>> {
  // Legacy provider format: a bare token stored as the OpenAI api key.
  if (isProvider && !encryptedConfig.startsWith('{')) {
    return { openai_api_key: encryptedConfig }
  }

  let credentials: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(encryptedConfig)
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    credentials = parsed as Record<string, unknown>
  }
  catch {
    return {}
  }

  return decryptSecretFields(tenantId, credentials, secretVariables)
}

/** Extract secret-input form variable names — mirrors ProviderConfiguration.extract_secret_variables. */
function extractSecretVariables(credentialFormSchemas: CredentialFormSchema[]): string[] {
  return credentialFormSchemas
    .filter(schema => schema.type === FormType.SECRET_INPUT)
    .map(schema => schema.variable)
}
