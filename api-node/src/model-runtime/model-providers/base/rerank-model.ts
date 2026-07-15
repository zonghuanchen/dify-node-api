/**
 * RerankModel base class.
 * Mirrors Python graphon.model_runtime.model_providers.base.rerank_model.
 */

import type { ModelType } from '../../entities/model.js'
import { ModelType as ModelTypeConst } from '../../entities/model.js'
import type { MultimodalRerankInput, RerankResult } from '../../entities/rerank.js'
import type { RerankModelRuntime } from '../../protocols/rerank-runtime.js'
import { AIModel } from './ai-model.js'

/** Base model class for rerank model. */
export class RerankModel extends AIModel<RerankModelRuntime> {
  readonly modelType: ModelType = ModelTypeConst.RERANK

  /** Invoke the rerank model for text inputs. */
  async invoke(params: {
    model: string
    credentials: Record<string, unknown>
    query: string
    docs: string[]
    scoreThreshold?: number | null
    topN?: number | null
    requestMetadata?: Record<string, unknown> | null
  }): Promise<RerankResult> {
    const { model, credentials, query, docs, scoreThreshold, topN, requestMetadata } = params
    try {
      return await this.modelRuntime.invokeRerank({
        provider: this.provider,
        model,
        credentials,
        query,
        docs,
        score_threshold: scoreThreshold,
        top_n: topN,
        request_metadata: requestMetadata,
      })
    }
    catch (error) {
      throw this.transformInvokeError(error)
    }
  }

  /** Invoke the rerank model for multimodal inputs. */
  async invokeMultimodalRerank(params: {
    model: string
    credentials: Record<string, unknown>
    query: MultimodalRerankInput
    docs: MultimodalRerankInput[]
    scoreThreshold?: number | null
    topN?: number | null
    requestMetadata?: Record<string, unknown> | null
  }): Promise<RerankResult> {
    const { model, credentials, query, docs, scoreThreshold, topN, requestMetadata } = params
    try {
      return await this.modelRuntime.invokeMultimodalRerank({
        provider: this.provider,
        model,
        credentials,
        query,
        docs,
        score_threshold: scoreThreshold,
        top_n: topN,
        request_metadata: requestMetadata,
      })
    }
    catch (error) {
      throw this.transformInvokeError(error)
    }
  }
}
