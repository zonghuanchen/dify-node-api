# Dify API 接口梳理

> 自动扫描时间：2026-07-08，共计 **823 个路由**
>
> **状态说明**：✅ = 已在 api-node 中实现

## 总览

| Blueprint | URL 前缀 | 路由数 | 用途 |
|---|---|---|---|
| Console API | `/console/api` | 636 | 控制台管理后台 |
| Service API | `/v1` | 68 | 第三方应用接入 API |
| Web API | `/api` | 40 | 前端 Web 应用 API |
| OpenAPI | `/openapi/v1` | 51 | 用户级开放 API（Bearer Auth）|
| Inner API | `/inner/api` | 23 | 内部服务间调用 |
| Files | `/` | 5 | 文件上传/预览 |
| MCP | `/` | 1 | MCP 协议 |
| Trigger | `/` | 3 | Webhook / 触发器 |

---

## Console API（636 路由）`/console/api`

### 账号 & 认证（~30 条）

| 方法 | 路径 | 类名 | 状态 |
|---|---|---|---|
| GET | `/account/profile` | `AccountProfileApi` |
| POST | `/account/name` | `AccountNameApi` |
| POST | `/account/password` | `AccountPasswordApi` |
| GET | `/account/avatar` | `AccountAvatarApi` |
| POST | `/account/timezone` | `AccountTimezoneApi` |
| POST | `/account/interface-language` | `AccountInterfaceLanguageApi` |
| POST | `/account/interface-theme` | `AccountInterfaceThemeApi` |
| GET | `/account/integrates` | `AccountIntegrateApi` |
| POST | `/account/init` | `AccountInitApi` |
| POST | `/account/delete` | `AccountDeleteApi` |
| GET | `/account/delete/verify` | `AccountDeleteVerifyApi` |
| POST | `/account/delete/feedback` | `AccountDeleteUpdateFeedbackApi` |
| POST | `/account/change-email` | `ChangeEmailSendEmailApi` |
| POST | `/account/change-email/validity` | `ChangeEmailCheckApi` |
| POST | `/account/change-email/check-email-unique` | `CheckEmailUnique` |
| POST | `/account/change-email/reset` | `ChangeEmailResetApi` |
| POST | `/account/education` | `EducationApi` |
| GET | `/account/education/autocomplete` | `EducationAutoCompleteApi` |
| GET | `/account/education/verify` | `EducationVerifyApi` |
| POST | `/login` | `LoginApi` | ✅ |
| POST | `/logout` | `LogoutApi` | ✅ |
| POST | `/refresh-token` | `RefreshTokenApi` | ✅ |
| POST | `/activate` | `ActivateApi` |
| GET | `/activate/check` | `ActivateCheckApi` |
| POST | `/email-code-login` | `EmailCodeLoginSendEmailApi` |
| POST | `/email-code-login/validity` | `EmailCodeLoginApi` |
| POST | `/email-register` | `EmailRegisterResetApi` | ✅ |
| POST | `/email-register/send-email` | `EmailRegisterSendEmailApi` | ✅ |
| POST | `/email-register/validity` | `EmailRegisterCheckApi` | ✅ |
| POST | `/forgot-password` | `ForgotPasswordSendEmailApi` |
| POST | `/forgot-password/validity` | `ForgotPasswordCheckApi` |
| POST | `/forgot-password/resets` | `ForgotPasswordResetApi` |

### OAuth（~15 条）

| 方法 | 路径 | 类名 | 状态 |
|---|---|---|---|
| GET | `/oauth/login/<provider>` | `OAuthLogin` |
| GET | `/oauth/authorize/<provider>` | `OAuthCallback` |
| GET | `/oauth/data-source/<provider>` | `OAuthDataSource` |
| GET | `/oauth/data-source/<provider>/<binding_id>/sync` | `OAuthDataSourceSync` |
| GET | `/oauth/data-source/binding/<provider>` | `OAuthDataSourceBinding` |
| GET | `/oauth/data-source/callback/<provider>` | `OAuthDataSourceCallback` |
| GET | `/oauth/plugin/<provider_id>/datasource/get-authorization-url` | `DatasourcePluginOAuthAuthorizationUrl` |
| GET | `/oauth/plugin/<provider_id>/datasource/callback` | `DatasourceOAuthCallback` |
| GET | `/oauth/plugin/<provider>/tool/authorization-url` | `ToolPluginOAuthApi` |
| GET | `/oauth/plugin/<provider>/tool/callback` | `ToolOAuthCallback` |
| GET | `/oauth/plugin/<provider>/trigger/callback` | `TriggerOAuthCallbackApi` |
| POST | `/oauth/provider` | `OAuthServerAppApi` |
| POST | `/oauth/provider/authorize` | `OAuthServerUserAuthorizeApi` |
| POST | `/oauth/provider/token` | `OAuthServerUserTokenApi` |
| POST | `/oauth/provider/account` | `OAuthServerUserAccountApi` |

### 应用管理（~80 条）

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/apps` | `AppListApi` |
| GET | `/apps/starred` | `StarredAppListApi` |
| POST | `/apps/imports` | `AppImportApi` |
| POST | `/apps/imports/<import_id>/confirm` | `AppImportConfirmApi` |
| GET | `/apps/imports/<app_id>/check-dependencies` | `AppImportCheckDependenciesApi` |
| POST | `/apps/workflows/online-users` | `WorkflowOnlineUsersApi` |
| GET | `/apps/<app_id>` | `AppApi` |
| POST | `/apps/<app_id>/copy` | `AppCopyApi` |
| GET | `/apps/<app_id>/export` | `AppExportApi` |
| POST | `/apps/<app_id>/name` | `AppNameApi` |
| POST | `/apps/<app_id>/icon` | `AppIconApi` |
| POST | `/apps/<app_id>/site` | `AppSite` |
| POST | `/apps/<app_id>/site-enable` | `AppSiteStatus` |
| POST | `/apps/<app_id>/site/access-token-reset` | `AppSiteAccessTokenReset` |
| POST | `/apps/<app_id>/api-enable` | `AppApiStatus` |
| POST | `/apps/<app_id>/star` | `AppStarApi` |
| POST | `/apps/<app_id>/publish-to-creators-platform` | `AppPublishToCreatorsPlatformApi` |
| GET | `/apps/<app_id>/trace` | `AppTraceApi` |
| GET | `/apps/<app_id>/trace-config` | `TraceAppConfigApi` |
| POST | `/apps/<app_id>/trigger-enable` | `AppTriggerEnableApi` |
| GET | `/apps/<app_id>/triggers` | `AppTriggersApi` |
| GET | `/apps/<app_id>/server` | `AppMCPServerController` |
| GET | `/apps/<app_id>/server/refresh` | `AppMCPServerRefreshController` |
| GET | `/apps/<app_id>/model-config` | `ModelConfigResource` |
| GET | `/apps/<app_id>/api-keys` | `AppApiKeyListResource` |
| DELETE | `/apps/<app_id>/api-keys/<api_key_id>` | `AppApiKeyResource` |
| GET | `/app-dsl-version` | `AppDslVersionApi` |
| GET | `/app/prompt-templates` | `AdvancedPromptTemplateList` |

### 应用 - 对话 & 消息

| 方法 | 路径 | 类名 |
|---|---|---|
| POST | `/apps/<app_id>/chat-messages` | `ChatMessageApi` |
| GET | `/apps/<app_id>/chat-messages` | `ChatMessageListApi` |
| POST | `/apps/<app_id>/chat-messages/<task_id>/stop` | `ChatMessageStopApi` |
| GET | `/apps/<app_id>/chat-conversations` | `ChatConversationApi` |
| GET | `/apps/<app_id>/chat-conversations/<conversation_id>` | `ChatConversationDetailApi` |
| POST | `/apps/<app_id>/completion-messages` | `CompletionMessageApi` |
| POST | `/apps/<app_id>/completion-messages/<task_id>/stop` | `CompletionMessageStopApi` |
| GET | `/apps/<app_id>/completion-conversations` | `CompletionConversationApi` |
| GET | `/apps/<app_id>/completion-conversations/<conversation_id>` | `CompletionConversationDetailApi` |
| GET | `/apps/<app_id>/messages/<message_id>` | `MessageApi` |
| POST | `/apps/<app_id>/feedbacks` | `MessageFeedbackApi` |
| GET | `/apps/<app_id>/feedbacks/export` | `MessageFeedbackExportApi` |
| POST | `/apps/<app_id>/audio-to-text` | `ChatMessageAudioApi` |
| POST | `/apps/<app_id>/text-to-audio` | `ChatMessageTextApi` |
| GET | `/apps/<app_id>/text-to-audio/voices` | `TextModesApi` |
| GET | `/apps/<app_id>/conversation-variables` | `ConversationVariablesApi` |

### 应用 - 标注（Annotations）

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/apps/<app_id>/annotations` | `AnnotationApi` |
| GET | `/apps/<app_id>/annotations/<annotation_id>` | `AnnotationUpdateDeleteApi` |
| GET | `/apps/<app_id>/annotations/<annotation_id>/hit-histories` | `AnnotationHitHistoryListApi` |
| GET | `/apps/<app_id>/annotations/batch-import-status/<job_id>` | `AnnotationBatchImportStatusApi` |
| GET | `/apps/<app_id>/annotations/count` | `MessageAnnotationCountApi` |
| GET | `/apps/<app_id>/annotations/export` | `AnnotationExportApi` |
| POST | `/apps/<app_id>/annotation-reply/<action>` | `AnnotationReplyActionApi` |
| GET | `/apps/<app_id>/annotation-reply/<action>/status/<job_id>` | `AnnotationReplyActionStatusApi` |
| GET | `/apps/<app_id>/annotation-setting` | `AppAnnotationSettingDetailApi` |
| POST | `/apps/<app_id>/annotation-settings/<annotation_setting_id>` | `AppAnnotationSettingUpdateApi` |

### 应用 - 统计

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/apps/<app_id>/statistics/average-response-time` | `AverageResponseTimeStatistic` |
| GET | `/apps/<app_id>/statistics/average-session-interactions` | `AverageSessionInteractionStatistic` |
| GET | `/apps/<app_id>/statistics/daily-conversations` | `DailyConversationStatistic` |
| GET | `/apps/<app_id>/statistics/daily-end-users` | `DailyTerminalsStatistic` |
| GET | `/apps/<app_id>/statistics/daily-messages` | `DailyMessageStatistic` |
| GET | `/apps/<app_id>/statistics/token-costs` | `DailyTokenCostStatistic` |
| GET | `/apps/<app_id>/statistics/tokens-per-second` | `TokensPerSecondStatistic` |
| GET | `/apps/<app_id>/statistics/user-satisfaction-rate` | `UserSatisfactionRateStatistic` |

### 应用 - Agent 技能 & 文件

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/apps/<app_id>/agent/config/skills` | `AgentConfigSkillsApi` |
| DELETE | `/apps/<app_id>/agent/config/skills/<name>` | `AgentConfigSkillApi` |
| GET | `/apps/<app_id>/agent/config/skills/<name>/download` | `AgentConfigSkillDownloadApi` |
| GET | `/apps/<app_id>/agent/config/skills/<name>/inspect` | `AgentConfigSkillInspectApi` |
| GET | `/apps/<app_id>/agent/config/skills/<name>/files/preview` | `AgentConfigSkillFilePreviewApi` |
| GET | `/apps/<app_id>/agent/config/skills/<name>/files/download` | `AgentConfigSkillFileDownloadApi` |
| GET | `/apps/<app_id>/agent/config/skills/<name>/files/content` | `AgentConfigSkillFileDownloadContentApi` |
| POST | `/apps/<app_id>/agent/config/skills/upload` | `AgentConfigSkillUploadApi` |
| GET | `/apps/<app_id>/agent/config/files` | `AgentConfigFilesApi` |
| DELETE | `/apps/<app_id>/agent/config/files/<name>` | `AgentConfigFileApi` |
| GET | `/apps/<app_id>/agent/config/files/<name>/download` | `AgentConfigFileDownloadApi` |
| GET | `/apps/<app_id>/agent/config/files/<name>/preview` | `AgentConfigFilePreviewApi` |
| GET | `/apps/<app_id>/agent/config/manifest` | `AgentConfigManifestApi` |
| GET | `/apps/<app_id>/agent/drive/files` | `AgentDriveListApi` |
| GET | `/apps/<app_id>/agent/drive/files/download` | `AgentDriveDownloadApi` |
| GET | `/apps/<app_id>/agent/drive/files/preview` | `AgentDrivePreviewApi` |
| GET | `/apps/<app_id>/agent/drive/skills` | `AgentDriveSkillListApi` |
| GET | `/apps/<app_id>/agent/drive/skills/<skill_path>/inspect` | `AgentDriveSkillInspectApi` |
| POST | `/apps/<app_id>/agent/files` | `AgentDriveFilesApi` |
| GET | `/apps/<app_id>/agent/logs` | `AgentLogApi` |
| DELETE | `/apps/<app_id>/agent/skills/<slug>` | `AgentSkillApi` |
| POST | `/apps/<app_id>/agent/skills/<slug>/infer-tools` | `AgentSkillInferToolsApi` |
| POST | `/apps/<app_id>/agent/skills/upload` | `AgentSkillUploadApi` |

### 应用 - 工作流（Workflow）

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/apps/<app_id>/workflows` | `PublishedAllWorkflowApi` |
| GET | `/apps/<app_id>/workflows/<workflow_id>` | `WorkflowByIdApi` |
| POST | `/apps/<app_id>/workflows/<workflow_id>/restore` | `DraftWorkflowRestoreApi` |
| GET | `/apps/<app_id>/workflows/default-workflow-block-configs` | `DefaultBlockConfigsApi` |
| GET | `/apps/<app_id>/workflows/publish` | `PublishedWorkflowApi` |
| GET | `/apps/<app_id>/workflows/draft` | `DraftWorkflowApi` |
| POST | `/apps/<app_id>/workflows/draft/run` | `DraftWorkflowRunApi` |
| POST | `/apps/<app_id>/workflows/draft/trigger/run` | `DraftWorkflowTriggerRunApi` |
| POST | `/apps/<app_id>/workflows/draft/trigger/run-all` | `DraftWorkflowTriggerRunAllApi` |
| GET | `/apps/<app_id>/workflows/draft/conversation-variables` | `ConversationVariableCollectionApi` |
| GET | `/apps/<app_id>/workflows/draft/environment-variables` | `EnvironmentVariableCollectionApi` |
| GET | `/apps/<app_id>/workflows/draft/system-variables` | `SystemVariableCollectionApi` |
| GET | `/apps/<app_id>/workflows/draft/variables` | `WorkflowVariableCollectionApi` |
| GET | `/apps/<app_id>/workflows/draft/variables/<variable_id>` | `VariableApi` |
| PUT | `/apps/<app_id>/workflows/draft/variables/<variable_id>/reset` | `VariableResetApi` |
| GET | `/apps/<app_id>/workflows/draft/features` | `WorkflowFeaturesApi` |
| GET | `/apps/<app_id>/workflows/draft/nodes/<node_id>/last-run` | `DraftWorkflowNodeLastRunApi` |
| POST | `/apps/<app_id>/workflows/draft/nodes/<node_id>/run` | `DraftWorkflowNodeRunApi` |
| GET | `/apps/<app_id>/workflows/draft/nodes/<node_id>/variables` | `NodeVariableCollectionApi` |
| POST | `/apps/<app_id>/workflows/draft/iteration/nodes/<node_id>/run` | `WorkflowDraftRunIterationNodeApi` |
| POST | `/apps/<app_id>/workflows/draft/loop/nodes/<node_id>/run` | `WorkflowDraftRunLoopNodeApi` |
| GET | `/apps/<app_id>/workflows/draft/runs/<run_id>/node-outputs` | `WorkflowDraftRunNodeOutputsApi` |
| GET | `/apps/<app_id>/workflows/triggers/webhook` | `WebhookTriggerApi` |
| GET | `/apps/<app_id>/workflow-runs` | `WorkflowRunListApi` |
| GET | `/apps/<app_id>/workflow-runs/<run_id>` | `WorkflowRunDetailApi` |
| GET | `/apps/<app_id>/workflow-runs/<run_id>/export` | `WorkflowRunExportApi` |
| GET | `/apps/<app_id>/workflow-runs/<run_id>/node-executions` | `WorkflowRunNodeExecutionListApi` |
| GET | `/apps/<app_id>/workflow-runs/count` | `WorkflowRunCountApi` |
| POST | `/apps/<app_id>/workflow-runs/tasks/<task_id>/stop` | `WorkflowTaskStopApi` |
| GET | `/apps/<app_id>/workflow-app-logs` | `WorkflowAppLogApi` |
| GET | `/apps/<app_id>/workflow-archived-logs` | `WorkflowArchivedLogApi` |

### 应用 - Workflow Agent Composer

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/apps/<app_id>/workflows/draft/nodes/<node_id>/agent-composer` | `WorkflowAgentComposerApi` |
| GET | `/apps/<app_id>/workflows/draft/nodes/<node_id>/agent-composer/candidates` | `WorkflowAgentComposerCandidatesApi` |
| POST | `/apps/<app_id>/workflows/draft/nodes/<node_id>/agent-composer/validate` | `WorkflowAgentComposerValidateApi` |
| POST | `/apps/<app_id>/workflows/draft/nodes/<node_id>/agent-composer/impact` | `WorkflowAgentComposerImpactApi` |
| POST | `/apps/<app_id>/workflows/draft/nodes/<node_id>/agent-composer/copy-from-roster` | `WorkflowAgentComposerCopyFromRosterApi` |
| POST | `/apps/<app_id>/workflows/draft/nodes/<node_id>/agent-composer/save-to-roster` | `WorkflowAgentComposerSaveToRosterApi` |

### 应用 - Workflow Comments

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/apps/<app_id>/workflow/comments` | `WorkflowCommentListApi` |
| GET | `/apps/<app_id>/workflow/comments/<comment_id>` | `WorkflowCommentDetailApi` |
| POST | `/apps/<app_id>/workflow/comments/<comment_id>/replies` | `WorkflowCommentReplyApi` |
| POST | `/apps/<app_id>/workflow/comments/<comment_id>/resolve` | `WorkflowCommentResolveApi` |
| GET | `/apps/<app_id>/workflow/comments/mention-users` | `WorkflowCommentMentionUsersApi` |

### 应用 - Workflow 统计

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/apps/<app_id>/workflow/statistics/daily-conversations` | `WorkflowDailyRunsStatistic` |
| GET | `/apps/<app_id>/workflow/statistics/daily-terminals` | `WorkflowDailyTerminalsStatistic` |
| GET | `/apps/<app_id>/workflow/statistics/token-costs` | `WorkflowDailyTokenCostStatistic` |
| GET | `/apps/<app_id>/workflow/statistics/average-app-interactions` | `WorkflowAverageAppInteractionStatistic` |

### 应用 - Human Input

| 方法 | 路径 | 类名 |
|---|---|---|
| POST | `/apps/<app_id>/workflows/draft/human-input/nodes/<node_id>/form/preview` | `WorkflowDraftHumanInputFormPreviewApi` |
| POST | `/apps/<app_id>/workflows/draft/human-input/nodes/<node_id>/form/run` | `WorkflowDraftHumanInputFormRunApi` |
| POST | `/apps/<app_id>/workflows/draft/human-input/nodes/<node_id>/delivery-test` | `WorkflowDraftHumanInputDeliveryTestApi` |
| GET | `/form/human_input/<form_token>` | `ConsoleHumanInputFormApi` |

### Agent 专属模块（~70 条）`/agent/<agent_id>/...`

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/agent` | `AgentAppListApi` |
| GET | `/agent/invite-options` | `AgentInviteOptionsApi` |
| GET | `/agent/<agent_id>` | `AgentAppApi` |
| POST | `/agent/<agent_id>/copy` | `AgentAppCopyApi` |
| POST | `/agent/<agent_id>/publish` | `AgentPublishApi` |
| GET | `/agent/<agent_id>/api-access` | `AgentApiAccessApi` |
| POST | `/agent/<agent_id>/api-enable` | `AgentApiStatusApi` |
| GET | `/agent/<agent_id>/api-keys` | `AgentApiKeyListApi` |
| DELETE | `/agent/<agent_id>/api-keys/<api_key_id>` | `AgentApiKeyApi` |
| GET | `/agent/<agent_id>/features` | `AgentAppFeatureConfigResource` |
| GET | `/agent/<agent_id>/referencing-workflows` | `AgentAppReferencingWorkflowsResource` |
| GET | `/agent/<agent_id>/statistics/summary` | `AgentStatisticsSummaryApi` |
| GET | `/agent/<agent_id>/log-sources` | `AgentLogSourcesApi` |
| GET | `/agent/<agent_id>/logs` | `AgentLogsApi` |
| GET | `/agent/<agent_id>/logs/<conversation_id>/messages` | `AgentLogMessagesApi` |
| GET | `/agent/<agent_id>/messages/<message_id>` | `AgentMessageApi` |
| POST | `/agent/<agent_id>/feedbacks` | `AgentMessageFeedbackApi` |
| POST | `/agent/<agent_id>/chat-messages` | `AgentChatMessageApi` |
| GET | `/agent/<agent_id>/chat-messages` | `AgentChatMessageListApi` |
| POST | `/agent/<agent_id>/chat-messages/<task_id>/stop` | `AgentChatMessageStopApi` |
| GET | `/agent/<agent_id>/versions` | `AgentRosterVersionsApi` |
| GET | `/agent/<agent_id>/versions/<version_id>` | `AgentRosterVersionDetailApi` |
| POST | `/agent/<agent_id>/versions/<version_id>/restore` | `AgentRosterVersionRestoreApi` |
| GET | `/agent/<agent_id>/composer` | `AgentComposerApi` |
| GET | `/agent/<agent_id>/composer/candidates` | `AgentComposerCandidatesApi` |
| POST | `/agent/<agent_id>/composer/validate` | `AgentComposerValidateApi` |
| GET | `/agent/<agent_id>/build-draft` | `AgentBuildDraftApi` |
| POST | `/agent/<agent_id>/build-draft/apply` | `AgentBuildDraftApplyApi` |
| POST | `/agent/<agent_id>/build-draft/checkout` | `AgentBuildDraftCheckoutApi` |
| POST | `/agent/<agent_id>/build-chat/finalize` | `AgentBuildChatFinalizeApi` |
| POST | `/agent/<agent_id>/debug-conversation/refresh` | `AgentDebugConversationRefreshApi` |
| GET | `/agent/<agent_id>/sandbox` | `AgentAppSandboxInfoResource` |
| GET | `/agent/<agent_id>/sandbox/files` | `AgentAppSandboxListResource` |
| GET | `/agent/<agent_id>/sandbox/files/read` | `AgentAppSandboxReadResource` |
| POST | `/agent/<agent_id>/sandbox/files/upload` | `AgentAppSandboxUploadResource` |
| GET | `/agent/<agent_id>/config/skills` | `AgentConfigSkillsByAgentApi` |
| GET | `/agent/<agent_id>/config/files` | `AgentConfigFilesByAgentApi` |
| GET | `/agent/<agent_id>/config/manifest` | `AgentConfigManifestByAgentApi` |
| GET | `/agent/<agent_id>/drive/files` | `AgentDriveListByAgentApi` |
| GET | `/agent/<agent_id>/drive/skills` | `AgentDriveSkillListByAgentApi` |
| POST | `/agent/<agent_id>/files` | `AgentDriveFilesByAgentApi` |
| DELETE | `/agent/<agent_id>/skills/<slug>` | `AgentSkillByAgentApi` |
| POST | `/agent/<agent_id>/skills/<slug>/infer-tools` | `AgentSkillInferToolsByAgentApi` |
| POST | `/agent/<agent_id>/skills/upload` | `AgentSkillUploadByAgentApi` |

### 数据集 / 知识库（~100 条）

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/datasets` | `DatasetListApi` |
| POST | `/datasets/init` | `DatasetInitApi` |
| GET | `/datasets/api-base-info` | `DatasetApiBaseUrlApi` |
| GET | `/datasets/api-keys` | `DatasetApiKeyApi` |
| DELETE | `/datasets/api-keys/<api_key_id>` | `DatasetApiDeleteApi` |
| GET | `/datasets/process-rule` | `GetProcessRuleApi` |
| GET | `/datasets/retrieval-setting` | `DatasetRetrievalSettingApi` |
| GET | `/datasets/retrieval-setting/<vector_type>` | `DatasetRetrievalSettingMockApi` |
| POST | `/datasets/indexing-estimate` | `DatasetIndexingEstimateApi` |
| POST | `/datasets/notion-indexing-estimate` | `DataSourceNotionIndexingEstimateApi` |
| POST | `/datasets/external` | `ExternalDatasetCreateApi` |
| GET | `/datasets/external-knowledge-api` | `ExternalApiTemplateListApi` |
| GET | `/datasets/external-knowledge-api/<id>` | `ExternalApiTemplateApi` |
| GET | `/datasets/metadata/built-in` | `DatasetMetadataBuiltInFieldApi` |
| GET | `/datasets/<dataset_id>` | `DatasetApi` |
| GET | `/datasets/<dataset_id>/documents` | `DatasetDocumentListApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>` | `DocumentApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/download` | `DocumentDownloadApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/indexing-status` | `DocumentIndexingStatusApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/indexing-estimate` | `DocumentIndexingEstimateApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/notion/sync` | `DataSourceNotionDocumentSyncApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/website-sync` | `WebsiteDocumentSyncApi` |
| POST | `/datasets/<dataset_id>/documents/<document_id>/rename` | `DocumentRenameApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/pipeline-execution-log` | `DocumentPipelineExecutionLogApi` |
| PATCH | `/datasets/<dataset_id>/documents/<document_id>/processing/pause` | `DocumentPauseApi` |
| PATCH | `/datasets/<dataset_id>/documents/<document_id>/processing/resume` | `DocumentRecoverApi` |
| POST | `/datasets/<dataset_id>/documents/<document_id>/segment` | `DatasetDocumentSegmentAddApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/segments` | `DatasetDocumentSegmentListApi` |
| POST | `/datasets/<dataset_id>/documents/<document_id>/segments/batch_import` | `DatasetDocumentSegmentBatchImportApi` |
| GET | `/datasets/<dataset_id>/documents/download-zip` | `DocumentBatchDownloadZipApi` |
| POST | `/datasets/<dataset_id>/documents/metadata` | `DocumentMetadataEditApi` |
| POST | `/datasets/<dataset_id>/documents/status/<action>/batch` | `DocumentStatusApi` |
| GET | `/datasets/<dataset_id>/batch/<batch>/indexing-status` | `DocumentBatchIndexingStatusApi` |
| GET | `/datasets/<dataset_id>/batch/<batch>/indexing-estimate` | `DocumentBatchIndexingEstimateApi` |
| GET | `/datasets/<dataset_id>/indexing-status` | `DatasetIndexingStatusApi` |
| GET | `/datasets/<dataset_id>/error-docs` | `DatasetErrorDocs` |
| GET | `/datasets/<dataset_id>/queries` | `DatasetQueryApi` |
| GET | `/datasets/<dataset_id>/related-apps` | `DatasetRelatedAppListApi` |
| GET | `/datasets/<dataset_id>/permission-part-users` | `DatasetPermissionUserListApi` |
| GET | `/datasets/<dataset_id>/use-check` | `DatasetUseCheckApi` |
| POST | `/datasets/<dataset_id>/retry` | `DocumentRetryApi` |
| GET | `/datasets/<dataset_id>/auto-disable-logs` | `DatasetAutoDisableLogApi` |
| POST | `/datasets/<dataset_id>/api-keys/<status>` | `DatasetEnableApiApi` |
| GET | `/datasets/<dataset_id>/api-keys` | `DatasetApiKeyListResource` |
| POST | `/datasets/<dataset_id>/hit-testing` | `HitTestingApi` |
| POST | `/datasets/<dataset_id>/external-hit-testing` | `ExternalKnowledgeHitTestingApi` |
| POST | `/datasets/<dataset_id>/metadata` | `DatasetMetadataCreateApi` |
| PATCH | `/datasets/<dataset_id>/metadata/<metadata_id>` | `DatasetMetadataApi` |
| POST | `/datasets/<dataset_id>/metadata/built-in/<action>` | `DatasetMetadataBuiltInFieldActionApi` |
| GET | `/datasets/<dataset_id>/notion/sync` | `DataSourceNotionDatasetSyncApi` |

### RAG Pipeline（新版知识库工作流）（~50 条）

| 方法 | 路径 | 类名 |
|---|---|---|
| POST | `/rag/pipeline/dataset` | `CreateRagPipelineDatasetApi` |
| POST | `/rag/pipeline/empty-dataset` | `CreateEmptyRagPipelineDatasetApi` |
| GET | `/rag/pipeline/templates` | `PipelineTemplateListApi` |
| GET | `/rag/pipeline/templates/<template_id>` | `PipelineTemplateDetailApi` |
| PATCH | `/rag/pipeline/customized/templates/<template_id>` | `CustomizedPipelineTemplateApi` |
| POST | `/rag/pipelines/<pipeline_id>/customized/publish` | `PublishCustomizedPipelineTemplateApi` |
| GET | `/rag/pipelines/<pipeline_id>/exports` | `RagPipelineExportApi` |
| GET | `/rag/pipelines/<pipeline_id>/workflows` | `PublishedAllRagPipelineApi` |
| PATCH | `/rag/pipelines/<pipeline_id>/workflows/<workflow_id>` | `RagPipelineByIdApi` |
| POST | `/rag/pipelines/<pipeline_id>/workflows/<workflow_id>/restore` | `RagPipelineDraftWorkflowRestoreApi` |
| GET | `/rag/pipelines/<pipeline_id>/workflow-runs` | `RagPipelineWorkflowRunListApi` |
| GET | `/rag/pipelines/<pipeline_id>/workflow-runs/<run_id>` | `RagPipelineWorkflowRunDetailApi` |
| POST | `/rag/pipelines/<pipeline_id>/workflow-runs/tasks/<task_id>/stop` | `RagPipelineTaskStopApi` |

### 工作空间 & 权限（~80 条）

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/workspaces` | `WorkspaceListApi` |
| GET | `/all-workspaces` | `WorkspaceListApi` |
| GET | `/workspaces/current` | `WorkspaceCurrentApi` |
| GET | `/workspaces/info` | `WorkspaceInfoApi` |
| POST | `/workspaces/switch` | `WorkspaceSwitchApi` |
| GET | `/workspaces/custom-config` | `WorkspaceCustomConfigApi` |
| GET | `/workspaces/current/permission` | `WorkspacePermissionApi` |
| POST | `/info` | `TenantApi` |

#### 成员管理

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/workspaces/current/members` | `MemberListApi` |
| （含邀请、删除、角色变更等约 20 条） | | |

#### 模型提供商

| 方法 | 路径 | 类名 |
|---|---|---|
| GET/POST | `/workspaces/current/model-providers` | `ModelProviderApi` |
| GET/POST | `/workspaces/current/models` | `ModelApi` |
| POST | `/workspaces/current/load-balancing-config` | `LoadBalancingConfigApi` |

#### 工具提供商

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/workspaces/current/tool-providers` | `ToolProviderListApi` |
| GET | `/workspaces/current/tool-provider/builtin/<provider>/tools` | `BuiltinToolProviderToolsApi` |
| GET | `/workspaces/current/tool-provider/builtin/<provider>/info` | `BuiltinToolProviderInfoApi` |
| POST | `/workspaces/current/tool-provider/builtin/<provider>/add` | `BuiltinToolProviderAddApi` |
| POST | `/workspaces/current/tool-provider/builtin/<provider>/update` | `BuiltinToolProviderUpdateApi` |
| POST | `/workspaces/current/tool-provider/api/add` | `ApiToolProviderAddApi` |
| （含 MCP 工具、自定义工具等约 30 条） | | |

#### 插件

| 方法 | 路径 | 类名 |
|---|---|---|
| GET/POST/DELETE | `/workspaces/current/plugins` | `PluginApi` |
| （含安装、卸载、更新等约 20 条） | | |

#### 自定义代码片段

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/workspaces/current/customized-snippets` | `SnippetListApi` |
| GET | `/workspaces/current/customized-snippets/<snippet_id>` | `SnippetDetailApi` |
| POST | `/workspaces/current/customized-snippets/imports` | `SnippetImportApi` |
| GET | `/workspaces/current/customized-snippets/<snippet_id>/export` | `SnippetExportApi` |

### 探索 / 应用商店（~30 条）

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/explore/apps` | `RecommendedAppListApi` |
| GET | `/explore/apps/<app_id>` | `RecommendedAppApi` |
| GET | `/explore/apps/learn-dify` | `LearnDifyAppListApi` |
| GET | `/installed-apps` | `InstalledAppsListApi` |
| DELETE | `/installed-apps/<installed_app_id>` | `InstalledAppApi` |
| POST | `/installed-apps/<id>/chat-messages` | `ChatApi` |
| POST | `/installed-apps/<id>/completion-messages` | `CompletionApi` |
| GET | `/installed-apps/<id>/conversations` | `ConversationListApi` |
| GET | `/installed-apps/<id>/messages` | `MessageListApi` |
| POST | `/installed-apps/<id>/workflows/run` | `InstalledAppWorkflowRunApi` |

### 其他

| 方法 | 路径 | 类名 | 状态 |
|---|---|---|---|
| GET | `/features` | `FeatureApi` |
| GET | `/features/vector-space` | `FeatureVectorSpaceApi` |
| GET | `/files/upload` | `FileApi` |
| GET | `/files/<file_id>/preview` | `FilePreviewApi` |
| GET | `/files/support-type` | `FileSupportTypeApi` |
| GET | `/ping` | `PingApi` | ✅ |
| GET | `/version` | `VersionApi` | ✅ |
| POST | `/setup` | `SetupApi` |
| GET | `/notification` | `NotificationApi` |
| POST | `/notification/dismiss` | `NotificationDismissApi` |
| GET | `/billing/subscription` | `Subscription` |
| GET | `/billing/invoices` | `Invoices` |
| GET | `/compliance/download` | `ComplianceApi` |
| POST | `/instruction-generate` | `InstructionGenerateApi` |
| POST | `/instruction-generate/template` | `InstructionGenerationTemplateApi` |
| GET | `/api-based-extension` | `APIBasedExtensionAPI` |
| GET | `/code-based-extension` | `CodeBasedExtensionAPI` |
| GET | `/data-source/integrates` | `DataSourceApi` |
| GET | `/tags` | `TagListApi` |
| GET | `/mcp/oauth/callback` | `ToolMCPCallbackApi` |
| GET | `/spec` | `SpecApi` |

---

## Service API（68 路由）`/v1`

第三方集成使用 API Key 认证。

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/` | `IndexApi` |
| GET | `/info` | `AppInfoApi` |
| GET | `/meta` | `AppMetaApi` |
| GET | `/parameters` | `AppParameterApi` |
| GET | `/site` | `AppSiteApi` |
| POST | `/chat-messages` | `ChatApi` |
| POST | `/chat-messages/<task_id>/stop` | `ChatStopApi` |
| POST | `/completion-messages` | `CompletionApi` |
| POST | `/completion-messages/<task_id>/stop` | `CompletionStopApi` |
| GET | `/conversations` | `ConversationApi` |
| GET | `/conversations/<c_id>` | `ConversationDetailApi` |
| POST | `/conversations/<c_id>/name` | `ConversationRenameApi` |
| GET | `/conversations/<c_id>/variables` | `ConversationVariablesApi` |
| GET | `/messages` | `MessageListApi` |
| POST | `/messages/<message_id>/feedbacks` | `MessageFeedbackApi` |
| GET | `/messages/<message_id>/suggested` | `MessageSuggestedApi` |
| GET | `/app/feedbacks` | `AppGetFeedbacksApi` |
| POST | `/workflows/run` | `WorkflowRunApi` |
| POST | `/workflows/<workflow_id>/run` | `WorkflowRunByIdApi` |
| GET | `/workflows/run/<workflow_run_id>` | `WorkflowRunDetailApi` |
| GET | `/workflows/logs` | `WorkflowAppLogApi` |
| POST | `/workflows/tasks/<task_id>/stop` | `WorkflowTaskStopApi` |
| GET | `/workflow/<task_id>/events` | `WorkflowEventsApi` |
| POST | `/files/upload` | `FileApi` |
| GET | `/files/<file_id>/preview` | `FilePreviewApi` |
| POST | `/audio-to-text` | `AudioApi` |
| POST | `/text-to-audio` | `TextApi` |
| GET | `/datasets` | `DatasetListApi` |
| GET | `/datasets/<dataset_id>` | `DatasetApi` |
| GET | `/datasets/<dataset_id>/documents` | `DocumentListApi` |
| POST | `/datasets/<dataset_id>/document/create-by-text` | `DocumentAddByTextApi` |
| POST | `/datasets/<dataset_id>/document/create-by-file` | `DocumentAddByFileApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>` | `DocumentApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/download` | `DocumentDownloadApi` |
| GET | `/datasets/<dataset_id>/documents/<batch>/indexing-status` | `DocumentIndexingStatusApi` |
| POST | `/datasets/<dataset_id>/documents/<document_id>/update-by-text` | `DocumentUpdateByTextApi` |
| GET | `/datasets/<dataset_id>/documents/<document_id>/segments` | `SegmentApi` |
| DELETE | `/datasets/<dataset_id>/documents/<document_id>/segments/<segment_id>` | `DatasetSegmentApi` |
| GET | `/datasets/<dataset_id>/documents/download-zip` | `DocumentBatchDownloadZipApi` |
| GET | `/datasets/<dataset_id>/documents/metadata` | `DocumentMetadataEditServiceApi` |
| POST | `/datasets/<dataset_id>/documents/status/<action>` | `DocumentStatusApi` |
| POST | `/datasets/<dataset_id>/hit-testing` | `HitTestingApi` |
| POST | `/datasets/<dataset_id>/metadata` | `DatasetMetadataCreateServiceApi` |
| GET | `/datasets/<dataset_id>/metadata/<metadata_id>` | `DatasetMetadataServiceApi` |
| GET | `/datasets/<dataset_id>/metadata/built-in` | `DatasetMetadataBuiltInFieldServiceApi` |
| POST | `/datasets/<dataset_id>/metadata/built-in/<action>` | `DatasetMetadataBuiltInFieldActionServiceApi` |
| POST | `/datasets/<dataset_id>/pipeline/datasource-plugins` | `DatasourcePluginsApi` |
| POST | `/datasets/<dataset_id>/pipeline/datasource/nodes/<node_id>/run` | `DatasourceNodeRunApi` |
| POST | `/datasets/<dataset_id>/pipeline/run` | `PipelineRunApi` |
| POST | `/datasets/pipeline/file-upload` | `KnowledgebasePipelineFileUploadApi` |
| GET | `/datasets/tags` | `DatasetTagsApi` |
| POST | `/datasets/tags/binding` | `DatasetTagBindingApi` |
| POST | `/datasets/tags/unbinding` | `DatasetTagUnbindingApi` |
| GET | `/end-users/<end_user_id>` | `EndUserApi` |
| POST | `/apps/annotations` | `AnnotationListApi` |
| POST | `/apps/annotation-reply/<action>` | `AnnotationReplyActionApi` |
| GET | `/form/human_input/<form_token>` | `WorkflowHumanInputFormApi` |
| GET | `/workspaces/current/models/model-types/<model_type>` | `ModelProviderAvailableModelApi` |

---

## Web API（40 路由）`/api`

面向 Web 前端用户。

| 方法 | 路径 | 类名 |
|---|---|---|
| POST | `/login` | `LoginApi` |
| GET | `/login/status` | `LoginStatusApi` |
| POST | `/logout` | `LogoutApi` |
| POST | `/email-code-login` | `EmailCodeLoginSendEmailApi` |
| POST | `/email-code-login/validity` | `EmailCodeLoginApi` |
| POST | `/forgot-password` | `ForgotPasswordSendEmailApi` |
| POST | `/forgot-password/validity` | `ForgotPasswordCheckApi` |
| POST | `/forgot-password/resets` | `ForgotPasswordResetApi` |
| GET | `/passport` | `PassportResource` |
| GET | `/site` | `AppSiteApi` |
| GET | `/parameters` | `AppParameterApi` |
| GET | `/meta` | `AppMeta` |
| GET | `/system-features` | `SystemFeatureApi` |
| GET | `/webapp/access-mode` | `AppAccessMode` |
| GET | `/webapp/permission` | `AppWebAuthPermission` |
| POST | `/chat-messages` | `ChatApi` |
| POST | `/chat-messages/<task_id>/stop` | `ChatStopApi` |
| POST | `/completion-messages` | `CompletionApi` |
| POST | `/completion-messages/<task_id>/stop` | `CompletionStopApi` |
| GET | `/conversations` | `ConversationListApi` |
| DELETE | `/conversations/<c_id>` | `ConversationApi` |
| POST | `/conversations/<c_id>/name` | `ConversationRenameApi` |
| PATCH | `/conversations/<c_id>/pin` | `ConversationPinApi` |
| PATCH | `/conversations/<c_id>/unpin` | `ConversationUnPinApi` |
| GET | `/messages` | `MessageListApi` |
| POST | `/messages/<message_id>/feedbacks` | `MessageFeedbackApi` |
| GET | `/messages/<message_id>/more-like-this` | `MessageMoreLikeThisApi` |
| GET | `/messages/<message_id>/suggested-questions` | `MessageSuggestedQuestionApi` |
| GET | `/saved-messages` | `SavedMessageListApi` |
| DELETE | `/saved-messages/<message_id>` | `SavedMessageApi` |
| POST | `/workflows/run` | `WorkflowRunApi` |
| POST | `/workflows/tasks/<task_id>/stop` | `WorkflowTaskStopApi` |
| POST | `/files/upload` | `FileApi` |
| GET | `/remote-files/<url>` | `RemoteFileInfoApi` |
| POST | `/remote-files/upload` | `RemoteFileUploadApi` |
| POST | `/audio-to-text` | `AudioApi` |
| POST | `/text-to-audio` | `TextApi` |
| GET | `/form/human_input/<form_token>` | `HumanInputFormApi` |
| POST | `/form/human_input/<form_token>/upload-token` | `HumanInputFormUploadTokenApi` |
| POST | `/human-input-forms/files` | `HumanInputFileUploadApi` |

---

## OpenAPI（51 路由）`/openapi/v1`

用户级 OAuth 开放 API（Bearer Auth）。

| 方法 | 路径 | 类名 |
|---|---|---|
| GET | `/account` | `AccountApi` |
| GET | `/apps` | `AppListApi` |
| GET | `/apps/<app_id>/describe` | `AppDescribeApi` |
| POST | `/apps/<app_id>/run` | `AppRunApi` |
| GET | `/permitted-external-apps` | `PermittedExternalAppsListApi` |
| GET | `/permitted-external-apps/<app_id>/describe` | `PermittedExternalAppDescribeApi` |
| GET | `/workspaces` | `WorkspacesApi` |
| GET | `/workspaces/<workspace_id>` | `WorkspaceByIdApi` |
| POST | `/workspaces/<workspace_id>/switch` | `WorkspaceSwitchApi` |
| GET | `/workspaces/<workspace_id>/members` | `WorkspaceMembersApi` |
| DELETE | `/workspaces/<workspace_id>/members/<member_id>` | `WorkspaceMemberApi` |
| PUT | `/workspaces/<workspace_id>/members/<member_id>/role` | `WorkspaceMemberRoleApi` |
| POST | `/workspaces/<workspace_id>/apps/imports` | `AppDslImportApi` |
| POST | `/oauth/device/code` | `OAuthDeviceCodeApi` |
| POST | `/oauth/device/token` | `OAuthDeviceTokenApi` |
| GET | `/oauth/device/lookup` | `OAuthDeviceLookupApi` |
| POST | `/oauth/device/sso-initiate` | `sso_initiate` |
| POST | `/oauth/device/sso-complete` | `sso_complete` |
| POST | `/files/upload` | `FileUploadApi` |
| GET | `/form/human_input/<form_token>` | `HumanInputFormApi` |
| GET | `/health` | `HealthApi` |
| GET | `/version` | `ServerVersionApi` |

---

## Inner API（23 路由）`/inner/api`

内部服务间调用（无用户认证，内网）。

| 方法 | 路径 | 类名 |
|---|---|---|
| GET/POST | `/plugin/<provider_id>/config` | `PluginConfigApi` |
| GET | `/plugin/<provider_id>/agent-config` | `AgentConfigApi` |
| GET | `/plugin/<provider_id>/agent-drive` | `AgentDriveApi` |
| GET/POST | `/plugin/...` | `PluginApi`（插件 CRUD） |
| POST | `/knowledge/retrieval` | `KnowledgeRetrievalApi` |
| GET/POST | `/app/dsl` | `AppDslApi` |
| GET | `/agent/tools` | `AgentToolsApi` |
| POST | `/mail/send` | `MailSendApi` |
| GET/POST | `/runtime-credentials` | `RuntimeCredentialsApi` |
| GET | `/workspace` | `WorkspaceInnerApi` |

---

## Files（5 路由）

| 方法 | 路径 | 类名 |
|---|---|---|
| POST | `/files/upload` | `FileUploadApi` |
| GET | `/files/image-preview` | `ImagePreviewApi` |
| GET | `/tool-files/<file_id>` | `ToolFileApi` |
| GET | `/agent-drive/archive` | `AgentDriveArchiveApi` |

---

## MCP（1 路由）

| 方法 | 路径 | 类名 |
|---|---|---|
| * | `/mcp` | `MCPApi` |

---

## Trigger（3 路由）

| 方法 | 路径 | 类名 |
|---|---|---|
| POST | `/plugin/<endpoint_id>` | `trigger_endpoint` |
| POST | `/webhook/<webhook_id>` | `handle_webhook` |
| POST | `/webhook-debug/<webhook_id>` | `handle_webhook_debug` |

---

## 迁移优先级建议

基于接口独立性和复用性，推荐以下迁移顺序：

1. **Service API** `/v1` — 最独立、对外暴露、接口契约清晰
2. **Web API** `/api` — 前端依赖、与 Service API 有大量重叠
3. **OpenAPI** `/openapi/v1` — 用户级开放 API，接口较少
4. **Inner API** `/inner/api` — 内部调用，可单独迁移
5. **Files / MCP / Trigger** — 辅助模块
6. **Console API** `/console/api` — 最复杂，按子模块分批迁移：
   - 认证 → 应用管理 → 数据集 → 工作流 → 工作空间 → Agent

---

## 已实现进度

| 模块 | 已实现路由 | 说明 |
|---|---|---|
| Console API | `GET /ping`, `GET /version` | 系统健康检查、版本信息 |
| Console API - 认证 | `POST /login`, `POST /logout`, `POST /refresh-token` | 邮箱密码登录、登出、Token 刷新 |
| Console API - 认证 | `POST /email-register`, `/send-email`, `/validity` | 邮箱注册三步流程 |
| Dev-only | `GET /ping-db` | 数据库连通性测试（仅开发环境） |

**总计：8 个路由已实现**
