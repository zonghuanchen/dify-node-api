/**
 * Speech2TextModel base class.
 * Mirrors Python graphon.model_runtime.model_providers.base.speech2text_model.
 */

import type { ModelType } from '../../entities/model.js'
import { ModelType as ModelTypeConst } from '../../entities/model.js'
import type { SpeechToTextModelRuntime } from '../../protocols/speech-to-text-runtime.js'
import { AIModel } from './ai-model.js'

/** Model class for speech2text model. */
export class Speech2TextModel extends AIModel<SpeechToTextModelRuntime> {
  readonly modelType: ModelType = ModelTypeConst.SPEECH2TEXT

  /** Invoke the speech-to-text model and return the transcribed text. */
  async invoke(params: {
    model: string
    credentials: Record<string, unknown>
    file: Buffer | NodeJS.ReadableStream
    requestMetadata?: Record<string, unknown> | null
  }): Promise<string> {
    const { model, credentials, file, requestMetadata } = params
    try {
      return await this.modelRuntime.invokeSpeechToText({
        provider: this.provider,
        model,
        credentials,
        file,
        request_metadata: requestMetadata,
      })
    }
    catch (error) {
      throw this.transformInvokeError(error)
    }
  }
}
