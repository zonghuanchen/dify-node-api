/**
 * TextEmbeddingModel base class.
 * Mirrors Python graphon.model_runtime.model_providers.base.text_embedding_model.
 */

import type { EmbeddingResult } from '../../entities/embedding.js'
import { EmbeddingInputType } from '../../entities/embedding.js'
import type { ModelType } from '../../entities/model.js'
import { ModelPropertyKey, ModelType as ModelTypeConst } from '../../entities/model.js'
import type { TextEmbeddingModelRuntime } from '../../protocols/embedding-runtime.js'
import { AIModel } from './ai-model.js'

/** Model class for text embedding model. */
export class TextEmbeddingModel extends AIModel<TextEmbeddingModelRuntime> {
  readonly modelType: ModelType = ModelTypeConst.TEXT_EMBEDDING

  /** Invoke text or multimodal embedding generation for the provided inputs. */
  async invoke(params: {
    model: string
    credentials: Record<string, unknown>
    texts?: string[] | null
    multimodelDocuments?: Record<string, unknown>[] | null
    inputType?: EmbeddingInputType
    requestMetadata?: Record<string, unknown> | null
  }): Promise<EmbeddingResult> {
    const {
      model,
      credentials,
      texts,
      multimodelDocuments,
      inputType = EmbeddingInputType.DOCUMENT,
      requestMetadata,
    } = params

    if ((!texts || texts.length === 0) && (!multimodelDocuments || multimodelDocuments.length === 0)) {
      throw new Error('No texts or files provided')
    }

    if (texts && texts.length > 0) {
      try {
        return await this.modelRuntime.invokeTextEmbedding({
          provider: this.provider,
          model,
          credentials,
          texts,
          input_type: inputType,
          request_metadata: requestMetadata,
        })
      }
      catch (error) {
        throw this.transformInvokeError(error)
      }
    }

    if (!multimodelDocuments) {
      throw new Error('No multimodal documents provided')
    }

    try {
      return await this.modelRuntime.invokeMultimodalEmbedding({
        provider: this.provider,
        model,
        credentials,
        documents: multimodelDocuments,
        input_type: inputType,
        request_metadata: requestMetadata,
      })
    }
    catch (error) {
      throw this.transformInvokeError(error)
    }
  }

  /** Count tokens for each text input sent to the embedding model. */
  async getNumTokens(
    model: string,
    credentials: Record<string, unknown>,
    texts: string[],
  ): Promise<number[]> {
    return this.modelRuntime.getTextEmbeddingNumTokens({
      provider: this.provider,
      model,
      credentials,
      texts,
    })
  }

  /** Get the embedding model context size, falling back to the default. */
  protected getContextSize(model: string, credentials: Record<string, unknown>): number {
    const modelSchema = this.getModelSchema(model, credentials)
    const contextSize = modelSchema?.model_properties[ModelPropertyKey.CONTEXT_SIZE]
    if (typeof contextSize === 'number') {
      return contextSize
    }
    return 1000
  }

  /** Get the maximum chunk count supported by the embedding model. */
  protected getMaxChunks(model: string, credentials: Record<string, unknown>): number {
    const modelSchema = this.getModelSchema(model, credentials)
    const maxChunks = modelSchema?.model_properties[ModelPropertyKey.MAX_CHUNKS]
    if (typeof maxChunks === 'number') {
      return maxChunks
    }
    return 1
  }
}
