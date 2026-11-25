# Running 时的 Goal Command（当前事实）

`/goal` 使用 V4 `sendGoalCommand`、`pauseGoal`、`resumeGoal`。它既保留用户可见的原始命令文本，也在 CLI 内更新 goal 状态；UI 不再绕过输入 admission 直接调用旧 `session/goal`。

## 裁决与唯一所有者

- **状态与可用性唯一所有者**：CLI runtime + `session_target` 持久化表 + `ProductProjection` / `computeAvailability`（`apps/wcode-cli/packages/bootstrap/src/wcode-protocol-v4/projection-state.ts`）。UI 只消费 `snapshot.goal` 与 `snapshot.availability`，不自行推测 ready 或复制目标状态。
- **执行与排队**：
  - session ready 时，`sendGoalCommand` 可以立即执行。
  - active turn / goal verifier 存在时，命令以独立的 `sendGoalCommand` 身份进入 CLI runtime queue，不拒绝、不插队、不打断当前 turn。
  - held queue 时遵循 `inputRouting.mode = choice`，由用户明确选择保留或清空既有队列后发送。
  - 命令只有在 CLI 判定可消费时才执行；UI 不根据 assistant 行结束、verification marker 或本地 timer 推测 ready。
- **可见斜杠命令与错误反馈（UI 发送边界）**：
  - 支持 `/goal <objective>`、`/target <objective>`、`/goal replace <objective>`、`/goal resume`、`/goal pause`。
  - 以下情况必须在发送边界返回 `"blocked"` 并弹出本地化 toast 提示，**保留用户输入与附件、不清空 Composer、不静默降级为普通 `sendText`、也不晋升空草稿会话**：
    - 裸 `/goal` 或 `/goal replace` 缺少目标文本（`emptyGoal`）；
    - 未接入 V4 协议的子命令如 `/goal clear`、`/goal show`（`unsupportedGoal`）；
    - 携带附件或结构化上下文（`attachments.length > 0 || contextAttachmentCount > 0`）提交 `/goal` / `/target`；
    - 草稿态（尚未创建会话）下执行 `/goal pause` 或 `/goal resume`；
    - CLI 返回非 `accepted` ACK（`rejected` / `stale` / `failed`）或无目标 `noop`。
- **CAS 与 Registry 刷新边界**：
  - `pauseGoal` 触发于运行期高频 revision 递增窗口，且 CLI handler 在会话 FIFO 门内幂等校验 `target.status === "active"`，**不列入 `COMMANDS_REQUIRING_BASE_REVISION`**（仍保留可选 `baseRevision` 以兼容旧 CLI）。
  - `resumeGoal` 会校验当前 Worker Provider Registry 并在放行后立刻触发目标续跑，因此在 Host 侧（`packages/services/src/wcode-agent/wcodeAgentService.ts`）纳入 `requiresProviderRegistryRefresh`，与 `sendGoalCommand` / `sendText` 保持一致。
- **校验失败（`failed_closed`）后的可恢复性**：
  - 当完成度校验失败进入 `failed_closed` 时，底层 `session_target` 仍为 `active`，投影 `goal.status` 为 `failed`。
  - `computeAvailability` 在 `goal.status === "failed"` 时同时允许 `pauseGoal`（收口为 `paused`）与 `resumeGoal`（通过 `TargetChanged` 将投影迁回 `active` 并重新触发续跑），状态胶囊相应展示恢复与暂停操作，避免进入无法操作的死状态。
- **双链路交付与投影自愈**：
  - `desktop-continuous` 与 Web `web-remote-replayable` 共用同一 CLI admission 与投影序列。
  - `sendGoalCommand` 纳入 UI `ACCEPTED_INPUT_COMMAND_TYPES`，收到 `accepted` ACK 后进入与 `sendText` 一致的 `inputPending` 与 2s `acceptedInputSilent` 自动重订阅自愈边界。

```text
/goal / /target / /goal pause / /goal resume
  -> UI slash parser + attachment/draft guards
       ├─ invalid / attachment / plan mode -> toast + blocked (keep draft, no promote)
       └─ valid -> Host (provider registry refresh for sendGoalCommand & resumeGoal)
                    -> CLI CommandInbox (pauseGoal免CAS, per-session FIFO)
                         ├─ sendGoalCommand (idle -> setTarget+continue; busy -> typed queue)
                         ├─ pauseGoal (active -> paused)
                         └─ resumeGoal (paused/failed -> active+continue)
                              -> authoritative snapshot/delta (desktop-continuous & web-remote-replayable)
```

## 验收场景

1. CLI 单测：`pauseGoal` 不带或带旧 `baseRevision` 时不会被 `proto.staleRevision` 拒绝；`failed_closed` 投影下 `availability.pauseGoal.allowed` 与 `availability.resumeGoal.allowed` 均为 `true`；`failed` 后触发 `resumeGoal` 与 `pauseGoal` 均能正常收敛。
2. Web 端运行时验证：新草稿发空 `/goal`、`/goal clear`、`/goal resume`、或携带附件发 `/goal ...` 时弹出 toast、保留输入且不晋升空会话；正常 `/goal <目标>` 能创建目标并显示 Goal 胶囊；运行中点「暂停」或输入 `/goal pause` 可稳定暂停；暂停或失败后点「继续」或输入 `/goal resume` 可正常恢复续跑。

当前实现入口：

- `packages/shared/src/wcode-protocol-v4/command.ts`
- `packages/services/src/wcode-agent/wcodeAgentService.ts`
- `apps/wcode-cli/packages/bootstrap/src/wcode-protocol-v4/projection-state.ts`
- `apps/wcode-cli/packages/bootstrap/src/wcode-protocol-v4/commands/handlers/goal-compact.ts`
- `packages/ui/src/v4/slashCommands.ts`、`packages/ui/src/v4/SessionPane.tsx`、`packages/ui/src/v4/ConversationStatusPanel.tsx`、`packages/ui/src/v4/conversationProjectionStore.ts`
