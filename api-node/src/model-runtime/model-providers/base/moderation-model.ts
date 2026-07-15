/**
 * ModerationModel base class.
 * Mirrors Python graphon.model_runtime.model_providers.base.moderation_model.
 */

import type { ModelType } from '../../entities/model.js'
import { ModelType as ModelTypeConst } from '../../entities/model.js'
import type { ModerationModelRuntime } from '../../protocols/moderation-runtime.js'
import { AIModel } from './ai-model.js'

/** Model class for moderation model. */
export class ModerationModel extends AIModel<ModerationModelRuntime> {
  readonly modelType: ModelType = ModelTypeConst.MODERATION

  /** Invoke the moderation model and return whether the text is unsafe. */
  async invoke(params: {
    model: string
    credentials: Record<string, unknown>
    text: string
    requestMetadata?: Record<string, unknown> | null
  }): Promise<boolean> {
    const { model, credentials, text, requestMetadata } = params
    this.startedAt = performance.now() / 1000

    try {
      return await this.modelRuntime.invokeModeration({
        provider: this.provider,
        model,
        credentials,
        text,
        request_metadata: requestMetadata,
      })
    }
    catch (error) {
      throw this.transformInvokeError(error)
    }
  }
}
