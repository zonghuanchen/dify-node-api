/**
 * TTSModel base class.
 * Mirrors Python graphon.model_runtime.model_providers.base.tts_model.
 */

import type { ModelType } from '../../entities/model.js'
import { ModelType as ModelTypeConst } from '../../entities/model.js'
import type { TTSModelRuntime } from '../../protocols/tts-runtime.js'
import { AIModel } from './ai-model.js'

/** Model class for TTS model. */
export class TTSModel extends AIModel<TTSModelRuntime> {
  readonly modelType: ModelType = ModelTypeConst.TTS

  /** Invoke the TTS model and return an audio byte stream. */
  async invoke(params: {
    model: string
    credentials: Record<string, unknown>
    contentText: string
    voice: string
    requestMetadata?: Record<string, unknown> | null
  }): Promise<AsyncGenerator<Buffer>> {
    const { model, credentials, contentText, voice, requestMetadata } = params
    try {
      return await this.modelRuntime.invokeTts({
        provider: this.provider,
        model,
        credentials,
        content_text: contentText,
        voice,
        request_metadata: requestMetadata,
      })
    }
    catch (error) {
      throw this.transformInvokeError(error)
    }
  }

  /** Retrieve the voices supported by a text-to-speech model. */
  async getTtsModelVoices(
    model: string,
    credentials: Record<string, unknown>,
    language?: string | null,
  ): Promise<unknown> {
    return this.modelRuntime.getTtsModelVoices({
      provider: this.provider,
      model,
      credentials,
      language,
    })
  }
}
