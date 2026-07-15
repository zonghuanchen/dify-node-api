/**
 * Provider credential schema validator.
 * Mirrors Python graphon.model_runtime.schema_validators.provider_credential_schema_validator.
 */

import type { ProviderCredentialSchema } from '../entities/provider.js'
import { CommonValidator } from './common-validator.js'

export class ProviderCredentialSchemaValidator extends CommonValidator {
  private readonly schema: ProviderCredentialSchema

  constructor(schema: ProviderCredentialSchema) {
    super()
    this.schema = schema
  }

  /** Validate provider credentials and return the filtered credential map. */
  validateAndFilter(credentials: Record<string, unknown>): Record<string, string | boolean> {
    return this.validateAndFilterCredentialFormSchemas(
      this.schema.credential_form_schemas,
      credentials,
    )
  }
}
