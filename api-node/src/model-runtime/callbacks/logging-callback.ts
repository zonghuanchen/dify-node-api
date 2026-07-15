/**
 * LoggingCallback prints invocation lifecycle details to stdout.
 * Mirrors Python graphon.model_runtime.callbacks.logging_callback.LoggingCallback.
 */

import type {
  AfterInvokeContext,
  CallbackContext,
  InvokeErrorContext,
  NewChunkContext,
} from './base-callback.js'
import { Callback } from './base-callback.js'

/** Console logging callback for LLM invocations. */
export class LoggingCallback extends Callback {
  onBeforeInvoke(context: CallbackContext): void {
    const { model, modelParameters, stop, tools, stream, user, requestMetadata, promptMessages }
      = context

    this.printText('\n[on_llm_before_invoke]\n', 'blue')
    this.printText(`Model: ${model}\n`, 'blue')
    this.printText('Parameters:\n', 'blue')
    for (const [key, value] of Object.entries(modelParameters)) {
      this.printText(`\t${key}: ${String(value)}\n`, 'blue')
    }

    if (stop && stop.length > 0) {
      this.printText(`\tstop: ${JSON.stringify(stop)}\n`, 'blue')
    }

    if (tools && tools.length > 0) {
      this.printText('\tTools:\n', 'blue')
      for (const tool of tools) {
        this.printText(`\t\t${tool.name}\n`, 'blue')
      }
    }

    this.printText(`Stream: ${String(stream ?? true)}\n`, 'blue')
    if (user) {
      this.printText(`User: ${user}\n`, 'blue')
    }

    if (requestMetadata) {
      this.printText(`Request metadata: ${JSON.stringify(requestMetadata)}\n`, 'blue')
    }

    this.printText('Prompt messages:\n', 'blue')
    for (const promptMessage of promptMessages) {
      if (promptMessage.name) {
        this.printText(`\tname: ${promptMessage.name}\n`, 'blue')
      }
      this.printText(`\trole: ${promptMessage.role}\n`, 'blue')
      this.printText(`\tcontent: ${JSON.stringify(promptMessage.content)}\n`, 'blue')
    }

    if (stream ?? true) {
      this.printText('\n[on_llm_new_chunk]')
    }
  }

  onNewChunk(context: NewChunkContext): void {
    const content = context.chunk.delta.message.content
    if (typeof content === 'string') {
      process.stdout.write(content)
    }
  }

  onAfterInvoke(context: AfterInvokeContext): void {
    const { result } = context
    this.printText('\n[on_llm_after_invoke]\n', 'yellow')
    this.printText(`Content: ${JSON.stringify(result.message.content)}\n`, 'yellow')

    if (result.message.tool_calls && result.message.tool_calls.length > 0) {
      this.printText('Tool calls:\n', 'yellow')
      for (const toolCall of result.message.tool_calls) {
        this.printText(`\t${toolCall.id}\n`, 'yellow')
        this.printText(`\t${toolCall.function.name}\n`, 'yellow')
        this.printText(`\t${JSON.stringify(toolCall.function.arguments)}\n`, 'yellow')
      }
    }

    this.printText(`Model: ${result.model}\n`, 'yellow')
    this.printText(`Usage: ${JSON.stringify(result.usage)}\n`, 'yellow')
    this.printText(`System Fingerprint: ${String(result.system_fingerprint)}\n`, 'yellow')
  }

  onInvokeError(context: InvokeErrorContext): void {
    this.printText('\n[on_llm_invoke_error]\n', 'red')
    console.error('LLM invoke failed:', context.ex)
  }
}
