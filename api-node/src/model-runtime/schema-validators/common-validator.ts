/**
 * Common credential form schema validator.
 * Mirrors Python graphon.model_runtime.schema_validators.common_validator.CommonValidator.
 */

import type { CredentialFormSchema } from '../entities/provider.js'
import { FormType } from '../entities/provider.js'

/**
 * Base validator implementing the shared credential validation logic.
 *
 * Validation flow:
 * 1. show_on filtering — skip fields whose conditions are not met
 * 2. Required check — throw if a required field is missing
 * 3. Default fallback — use default value when field is absent
 * 4. Type check — value must be a string
 * 5. Max length check — enforce max_length constraint
 * 6. Options check — SELECT/RADIO values must be in options list
 * 7. SWITCH normalization — convert "true"/"false" strings to booleans
 */
export abstract class CommonValidator {
  /**
   * Validate and filter credential form schemas against provided credentials.
   * Returns only the fields that passed validation.
   */
  protected validateAndFilterCredentialFormSchemas(
    credentialFormSchemas: CredentialFormSchema[],
    credentials: Record<string, unknown>,
  ): Record<string, string | boolean> {
    const needValidateMap = new Map<string, CredentialFormSchema>()

    for (const schema of credentialFormSchemas) {
      if (!schema.show_on?.length) {
        needValidateMap.set(schema.variable, schema)
        continue
      }

      // Check all show_on conditions
      let allMatch = true
      for (const showOn of schema.show_on) {
        if (!(showOn.variable in credentials) || credentials[showOn.variable] !== showOn.value) {
          allMatch = false
          break
        }
      }

      if (allMatch) {
        needValidateMap.set(schema.variable, schema)
      }
    }

    const validated: Record<string, string | boolean> = {}
    for (const schema of needValidateMap.values()) {
      const result = this.validateCredentialFormSchema(schema, credentials)
      if (result !== null && result !== undefined) {
        validated[schema.variable] = result
      }
    }

    return validated
  }

  /**
   * Validate a single credential form schema entry.
   * Returns the normalized value or null if the field should be skipped.
   */
  protected validateCredentialFormSchema(
    schema: CredentialFormSchema,
    credentials: Record<string, unknown>,
  ): string | boolean | null {
    const rawValue = credentials[schema.variable]

    // Missing or empty value
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (schema.required) {
        throw new Error(`Variable ${schema.variable} is required`)
      }
      if (schema.default) {
        return schema.default
      }
      return null
    }

    // Type check
    if (typeof rawValue !== 'string') {
      throw new TypeError(`Variable ${schema.variable} should be string`)
    }

    let value: string | boolean = rawValue

    // Max length check
    if (schema.max_length && schema.max_length > 0 && rawValue.length > schema.max_length) {
      throw new Error(
        `Variable ${schema.variable} length should not be greater than ${schema.max_length}`,
      )
    }

    // Options check for SELECT/RADIO
    if (
      (schema.type === FormType.SELECT || schema.type === FormType.RADIO)
      && schema.options?.length
    ) {
      const optionValues = schema.options.map(o => o.value)
      if (!optionValues.includes(rawValue)) {
        throw new Error(`Variable ${schema.variable} is not in options`)
      }
    }

    // SWITCH normalization
    if (schema.type === FormType.SWITCH) {
      const lower = rawValue.toLowerCase()
      if (lower !== 'true' && lower !== 'false') {
        throw new Error(`Variable ${schema.variable} should be true or false`)
      }
      value = lower === 'true'
    }

    return value
  }
}
