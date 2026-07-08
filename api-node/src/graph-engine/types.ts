/**
 * GraphEngine type definitions.
 * Ported from graphon Python enums.
 */

// ── Node / Edge state ──────────────────────────────────────────────────────

export enum NodeState {
  UNKNOWN = 'unknown',
  TAKEN = 'taken',
  SKIPPED = 'skipped',
}

// ── Execution type ─────────────────────────────────────────────────────────

export enum NodeExecutionType {
  ROOT = 'root',
  BRANCH = 'branch',
  RESPONSE = 'response',
  NORMAL = 'normal',
}

// ── Node types (matches Dify workflow node types) ──────────────────────────

export type NodeType =
  | 'start'
  | 'end'
  | 'llm'
  | 'code'
  | 'if-else'
  | 'iteration'
  | 'loop'
  | 'template-transform'
  | 'question-classifier'
  | 'http-request'
  | 'tool'
  | 'variable-assigner'
  | 'variable-aggregator'
  | 'answer'
  | 'assigner'
  | 'parameter-extractor'
  | 'knowledge-retrieval'
  | 'list-operator'
  | 'iteration-start'
  | 'loop-start'
  | 'loop-end'
  | 'agent'

// ── Error strategy ─────────────────────────────────────────────────────────

export enum ErrorStrategy {
  FAIL_BRANCH = 'fail-branch',
  DEFAULT_VALUE = 'default-value',
}

// ── Node execution status ──────────────────────────────────────────────────

export enum WorkflowNodeExecutionStatus {
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  EXCEPTION = 'exception',
}

// ── Workflow start reason ──────────────────────────────────────────────────

export enum WorkflowStartReason {
  INITIAL = 'initial',
  RESUMPTION = 'resumption',
}
