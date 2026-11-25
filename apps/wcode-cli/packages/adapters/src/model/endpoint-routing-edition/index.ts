import type { ProviderEndpointRoutingPort } from "@wcode/contracts";
import type { ProviderEndpointRoutingFactoryOptions } from "../provider-endpoint-routing-options.js";
import { createStaticProviderEndpointRoutingPort } from "../official-coding-plan-gateway.js";

export function createProviderEndpointRoutingPort(
  options: ProviderEndpointRoutingFactoryOptions,
): ProviderEndpointRoutingPort {
  return createStaticProviderEndpointRoutingPort(options.endpointOrigin);
}
