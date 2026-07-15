/**
 * Prompt message entity types.
 * Mirrors Python graphon.model_runtime.entities.message_entities.
 */

// ── Enums ────────────────────────────────────────────────────────

/** Role of a prompt message participant. */
export const PromptMessageRole = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
} as const
export type PromptMessageRole = (typeof PromptMessageRole)[keyof typeof PromptMessageRole]

/** Content type for multi-modal prompt messages. */
export const PromptMessageContentType = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  DOCUMENT: 'document',
} as const
export type PromptMessageContentType = (typeof PromptMessageContentType)[keyof typeof PromptMessageContentType]

// ── Tool types ───────────────────────────────────────────────────

/** Tool definition passed to the model. */
export interface PromptMessageTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** Function wrapper for a tool. */
export interface PromptMessageFunction {
  type: string
  function: PromptMessageTool
}

// ── Content types ────────────────────────────────────────────────

/** Base content descriptor. */
export interface PromptMessageContentBase {
  type: PromptMessageContentType
}

/** Plain text content. */
export interface TextPromptMessageContent extends PromptMessageContentBase {
  type: typeof PromptMessageContentType.TEXT
  data: string
}

/** Base for multi-modal content (image, audio, video, document). */
export interface MultiModalPromptMessageContent extends PromptMessageContentBase {
  format: string
  base64_data?: string
  url?: string
  mime_type: string
  filename?: string
}

/** Image content with optional detail level. */
export interface ImagePromptMessageContent extends MultiModalPromptMessageContent {
  type: typeof PromptMessageContentType.IMAGE
  detail?: 'low' | 'high'
}

/** Audio content. */
export interface AudioPromptMessageContent extends MultiModalPromptMessageContent {
  type: typeof PromptMessageContentType.AUDIO
}

/** Video content. */
export interface VideoPromptMessageContent extends MultiModalPromptMessageContent {
  type: typeof PromptMessageContentType.VIDEO
}

/** Document content. */
export interface DocumentPromptMessageContent extends MultiModalPromptMessageContent {
  type: typeof PromptMessageContentType.DOCUMENT
}

/** Discriminated union of all content types. */
export type PromptMessageContentUnion =
  | TextPromptMessageContent
  | ImagePromptMessageContent
  | AudioPromptMessageContent
  | VideoPromptMessageContent
  | DocumentPromptMessageContent

// ── Tool call types ──────────────────────────────────────────────

/** Function descriptor within a tool call. */
export interface ToolCallFunction {
  name: string
  arguments: string
}

/** A tool call made by the assistant. */
export interface ToolCall {
  id: string
  type: string
  function: ToolCallFunction
}

// ── Prompt messages ──────────────────────────────────────────────

/**
 * Base prompt message.
 * `content` is either a plain string or a list of typed content blocks.
 */
export interface PromptMessage {
  role: PromptMessageRole
  content?: string | PromptMessageContentUnion[] | null
  name?: string | null
}

/** User prompt message. */
export interface UserPromptMessage extends PromptMessage {
  role: typeof PromptMessageRole.USER
}

/** System prompt message. */
export interface SystemPromptMessage extends PromptMessage {
  role: typeof PromptMessageRole.SYSTEM
}

/** Assistant prompt message (may include tool calls). */
export interface AssistantPromptMessage extends PromptMessage {
  role: typeof PromptMessageRole.ASSISTANT
  tool_calls?: ToolCall[]
}

/** Tool response message. */
export interface ToolPromptMessage extends PromptMessage {
  role: typeof PromptMessageRole.TOOL
  tool_call_id: string
}

/** Any prompt message variant. */
export type AnyPromptMessage =
  | UserPromptMessage
  | SystemPromptMessage
  | AssistantPromptMessage
  | ToolPromptMessage

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Extract text-only content from a prompt message.
 * Mirrors Python PromptMessage.get_text_content().
 */
export function getTextContent(message: PromptMessage): string {
  const { content } = message
  if (typeof content === 'string') return content
  if (!content) return ''
  return content
    .filter((c): c is TextPromptMessageContent => c.type === PromptMessageContentType.TEXT)
    .map(c => c.data)
    .join('')
}

/**
 * Check whether a prompt message has no content.
 * Mirrors Python PromptMessage.is_empty().
 */
export function isPromptMessageEmpty(message: PromptMessage): boolean {
  if (!message.content) return true
  if (typeof message.content === 'string') return message.content.length === 0
  return message.content.length === 0
}

/**
 * Check whether an assistant message is empty (no content and no tool calls).
 */
export function isAssistantMessageEmpty(message: AssistantPromptMessage): boolean {
  return isPromptMessageEmpty(message) && (!message.tool_calls || message.tool_calls.length === 0)
}

/**
 * Check whether a tool message is empty (no content and no tool_call_id).
 */
export function isToolMessageEmpty(message: ToolPromptMessage): boolean {
  return isPromptMessageEmpty(message) && !message.tool_call_id
}

/**
 * Resolve the data string for multi-modal content.
 * Returns url if set, otherwise a data: URI from base64_data.
 */
export function getMultiModalData(content: MultiModalPromptMessageContent): string {
  if (content.url) return content.url
  return `data:${content.mime_type};base64,${content.base64_data ?? ''}`
}
