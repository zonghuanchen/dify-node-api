/**
 * Model credential schema validator.
 * Mirrors Python graphon.model_runtime.schema_validators.model_credential_schema_validator.
 */

import type { ModelType } from '../entities/model.js'
import type { ModelCredentialSchema } from '../entities/provider.js'
import { CommonValidator } from './common-validator.js'

export class ModelCredentialSchemaValidator extends CommonValidator {
  private readonly modelType: ModelType
  private readonly schema: ModelCredentialSchema

  constructor(modelType: ModelType, schema: ModelCredentialSchema) {
    super()
    this.modelType = modelType
    this.schema = schema
  }

  /** Validate model credentials and return the filtered credential map. */
  validateAndFilter(credentials: Record<string, unknown>): Record<string, string | boolean> {
    // Inject __model_type into credentials for downstream validators
    const enriched: Record<string, unknown> = {
      ...credentials,
      __model_type: this.modelType,
    }

    return this.validateAndFilterCredentialFormSchemas(
      this.schema.credential_form_schemas,
      enriched,
    )
  }
}
