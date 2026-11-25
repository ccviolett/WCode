import {
  wcodeMcpUiSamplingParamsSchema,
  wcodeMcpUiCancelSamplingParamsSchema,
} from "@wcode/shared";
import { mcpAppsSamplingResultSchema } from "@wcode/shared/mcp-apps";
import {
  parseParams,
  requireSession,
  type WCodeProtocolAgentServerContext,
} from "../server-types.js";
import { mcpUiInstances } from "./instances.js";
import { McpUiSamplingCalls } from "./samplingCalls.js";

const calls = new McpUiSamplingCalls();
export async function sampleMcpUi(context: WCodeProtocolAgentServerContext, raw: unknown) {
  const params = parseParams(wcodeMcpUiSamplingParamsSchema, raw);
  const record = requireSession(context, params.sessionId, { operation: "mcp/uiSampling" });
  const validate = () =>
    mcpUiInstances.validate(
      params.instance,
      params,
      record.app.getMcpAppConnectionSnapshot(params.serverName),
    );
  const active = validate();
  return calls.execute(
    { token: params.instance.token, sessionId: params.sessionId, signal: active.cancel.signal },
    params.operationId,
    async (signal) => {
      const pin = mcpUiInstances.retain(params.instance.token, params.operationId);
      const release = () => pin.release();
      signal.addEventListener("abort", release, { once: true });
      try {
        signal.throwIfAborted();
        validate();
        const result = await record.app.sampleModel(
          {
            request: params.request,
            source: {
              pluginId: params.pluginId,
              serverName: params.serverName,
              appIdentity: params.instance.appIdentity,
            },
          },
          { abortSignal: signal, traceContext: record.traceContext },
        );
        signal.throwIfAborted();
        validate();
        return mcpAppsSamplingResultSchema.parse(result);
      } finally {
        signal.removeEventListener("abort", release);
        release();
      }
    },
  );
}
export function cancelMcpUiSampling(context: WCodeProtocolAgentServerContext, raw: unknown) {
  const params = parseParams(wcodeMcpUiCancelSamplingParamsSchema, raw);
  const record = requireSession(context, params.sessionId, { operation: "mcp/uiCancelSampling" });
  const active = mcpUiInstances.validate(
    params.instance,
    params,
    record.app.getMcpAppConnectionSnapshot(params.serverName),
  );
  return calls.cancel(
    { token: params.instance.token, sessionId: params.sessionId, signal: active.cancel.signal },
    params.operationId,
  );
}
