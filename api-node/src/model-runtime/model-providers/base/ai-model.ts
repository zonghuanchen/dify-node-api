/**
 * AIModel abstract base class.
 * Mirrors Python graphon.model_runtime.model_providers.base.ai_model.AIModel.
 */

import type { I18nObject } from '../../entities/common.js'
import { PARAMETER_RULE_TEMPLATE } from '../../entities/defaults.js'
import type {
  AIModelEntity,
  ModelType,
  ParameterRule,
  PriceConfig,
  PriceInfo,
  PriceType,
} from '../../entities/model.js'
import { DefaultParameterName, PriceType as PriceTypeConst } from '../../entities/model.js'
import type { ProviderEntity } from '../../entities/provider.js'
import {
  InvokeAuthorizationError,
  InvokeConnectionError,
  InvokeError,
  InvokeRateLimitError,
  InvokeServerUnavailableError,
} from '../../errors/invoke.js'
import type { ModelProviderRuntime } from '../../protocols/provider-runtime.js'

/**
 * Runtime-facing base class for all model providers.
 * Generic over the runtime type R that must implement ModelProviderRuntime.
 */
export abstract class AIModel<R extends ModelProviderRuntime = ModelProviderRuntime> {
  abstract readonly modelType: ModelType
  readonly providerSchema: ProviderEntity
  readonly modelRuntime: R
  startedAt: number

  constructor(providerSchema: ProviderEntity, modelRuntime: R, startedAt = 0) {
    this.providerSchema = providerSchema
    this.modelRuntime = modelRuntime
    this.startedAt = startedAt
  }

  get provider(): string {
    return this.providerSchema.provider
  }

  get providerDisplayName(): string {
    return this.providerSchema.label.en_US
  }

  /**
   * Map model invoke errors to unified error types.
   * Key = error type to throw, value = runtime exception types to normalize.
   */
  protected get invokeErrorMapping(): Record<string, (new (description?: string) => Error)[]> {
    return {
      InvokeConnectionError: [InvokeConnectionError],
      InvokeServerUnavailableError: [InvokeServerUnavailableError],
      InvokeRateLimitError: [InvokeRateLimitError],
      InvokeAuthorizationError: [InvokeAuthorizationError],
    }
  }

  /** Normalize provider/runtime exceptions into unified invoke errors. */
  protected transformInvokeError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new InvokeError(`[${this.providerDisplayName}] Error: ${String(error)}`)
    }

    for (const [errorName, modelErrors] of Object.entries(this.invokeErrorMapping)) {
      if (modelErrors.some(ErrorClass => error instanceof ErrorClass)) {
        if (errorName === 'InvokeAuthorizationError') {
          return new InvokeAuthorizationError(
            `[${this.providerDisplayName}] Incorrect model credentials provided, please check and try again.`,
          )
        }
        if (error instanceof InvokeError) {
          return new InvokeError(
            `[${this.providerDisplayName}] ${(error as InvokeError).description}, ${error.message}`,
          )
        }
        return error
      }
    }

    return new InvokeError(`[${this.providerDisplayName}] Error: ${error.message}`)
  }

  /** Calculate pricing metadata for a token count on a given model. */
  getPrice(
    model: string,
    credentials: Record<string, unknown>,
    priceType: PriceType,
    tokens: number,
  ): PriceInfo {
    const modelSchema = this.getModelSchema(model, credentials)
    const priceConfig: PriceConfig | undefined | null = modelSchema?.pricing

    let unitPrice: number | undefined
    if (priceConfig) {
      if (priceType === PriceTypeConst.INPUT) {
        unitPrice = priceConfig.input
      }
      else if (priceType === PriceTypeConst.OUTPUT && priceConfig.output != null) {
        unitPrice = priceConfig.output
      }
    }

    if (unitPrice === undefined) {
      return {
        unit_price: 0,
        unit: 0,
        total_amount: 0,
        currency: 'USD',
      }
    }

    if (!priceConfig) {
      throw new Error(`Price config not found for model ${model}`)
    }

    const totalAmount = tokens * unitPrice * priceConfig.unit
    const roundedTotal = Math.round(totalAmount * 1e7) / 1e7

    return {
      unit_price: unitPrice,
      unit: priceConfig.unit,
      total_amount: roundedTotal,
      currency: priceConfig.currency,
    }
  }

  /** Fetch the resolved model schema for a model and credential set. */
  getModelSchema(model: string, credentials?: Record<string, unknown>): AIModelEntity | null {
    // Synchronous lookup — the caller should handle async if needed
    const result = this.modelRuntime.getModelSchema({
      provider: this.provider,
      model_type: this.modelType,
      model,
      credentials: credentials ?? {},
    })

    // If the runtime returns a promise, we cannot await here synchronously.
    // Callers requiring async should use modelRuntime.getModelSchema directly.
    if (result && typeof result === 'object' && 'then' in result) {
      return null // Caller must use async variant
    }
    return result as AIModelEntity | null
  }

  /** Resolve and hydrate a customizable model schema from credentials. */
  getCustomizableModelSchemaFromCredentials(
    model: string,
    credentials: Record<string, unknown>,
  ): AIModelEntity | null {
    const schema = this.getCustomizableModelSchema(model, credentials)
    if (!schema) return null

    schema.parameter_rules = (schema.parameter_rules ?? []).map((rule: ParameterRule) =>
      this.applyParameterRuleTemplate(rule),
    )

    return schema
  }

  /** Return the provider-specific customizable model schema, if supported. */
  getCustomizableModelSchema(
    _model: string,
    _credentials: Record<string, unknown>,
  ): AIModelEntity | null {
    return null
  }

  // ── Private helpers ─────────────────────────────────────────────

  private applyParameterRuleTemplate(rule: ParameterRule): ParameterRule {
    if (!rule.use_template) return rule

    const templateName = rule.use_template
    if (!(templateName in DefaultParameterName)) return rule

    const defaultRule = PARAMETER_RULE_TEMPLATE[templateName] as Record<string, unknown> | undefined
    if (!defaultRule) return rule

    this.hydrateParameterRuleDefaults(rule, defaultRule)
    this.hydrateParameterRuleHelp(rule, defaultRule)
    return rule
  }

  private hydrateParameterRuleDefaults(
    rule: ParameterRule,
    defaultRule: Record<string, unknown>,
  ): void {
    for (const field of ['max', 'min', 'default', 'precision', 'required'] as const) {
      if (rule[field] || !(field in defaultRule)) continue
      ;(rule as unknown as Record<string, unknown>)[field] = defaultRule[field]
    }
  }

  private hydrateParameterRuleHelp(
    rule: ParameterRule,
    defaultRule: Record<string, unknown>,
  ): void {
    const defaultHelp = defaultRule.help as I18nObject | undefined
    if (!defaultHelp?.en_US) return

    if (!rule.help) {
      rule.help = { en_US: defaultHelp.en_US, zh_Hans: defaultHelp.zh_Hans }
      return
    }

    if (!rule.help.en_US) rule.help.en_US = defaultHelp.en_US
    if (!rule.help.zh_Hans) rule.help.zh_Hans = defaultHelp.zh_Hans ?? defaultHelp.en_US
  }
}
