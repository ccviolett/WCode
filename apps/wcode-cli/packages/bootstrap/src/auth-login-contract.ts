import type {
  createCodingPlanApiKeyResolver,
  createCliOAuthClient,
  BrowserOpenResult,
  CliOAuthInitData,
  CliOAuthPollData,
  CliOAuthUser,
  SharedWCodeCredentialStore,
} from "@wcode/adapters";
import type { EnvRecord } from "@wcode/adapters/model";

export type CodingPlanProviderId = "bigmodel" | "zai";

export interface LoginWCodeCliOptions {
  providerId?: CodingPlanProviderId;
  abortSignal?: AbortSignal;
  apiKeyResolver?: ReturnType<typeof createCodingPlanApiKeyResolver>;
  baseUrl?: string;
  credentialStore?: SharedWCodeCredentialStore;
  env?: EnvRecord;
  httpClient?: Parameters<typeof createCliOAuthClient>[0]["httpClient"];
  noBrowser?: boolean;
  now?: () => number;
  onAuthorizeUrl?: (data: CliOAuthInitData) => void | Promise<void>;
  onBrowserOpen?: (result: BrowserOpenResult) => void | Promise<void>;
  onPollStatus?: (data: CliOAuthPollData) => void | Promise<void>;
  openBrowser?: (url: string) => Promise<BrowserOpenResult>;
  pollToken?: string;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  personalProviderConfigPath?: string;
}

export interface LoginWCodeCliResult {
  browser?: BrowserOpenResult;
  configPath: string;
  credentialsPath: string;
  model: string;
  providerId: CodingPlanProviderId;
  user: CliOAuthUser;
}

// BigModel 与 Z.ai 共用服务端轮询登录，只是 providerId 固定为 bigmodel。
export type LoginBigmodelCodingPlanOptions = Omit<LoginWCodeCliOptions, "providerId">;
export type LoginBigmodelCodingPlanResult = LoginWCodeCliResult & { providerId: "bigmodel" };

export interface ConfigureCodingPlanApiKeyOptions {
  apiKey: string;
  credentialStore?: SharedWCodeCredentialStore;
  env?: EnvRecord;
  personalProviderConfigPath?: string;
  providerId: CodingPlanProviderId;
}

export interface ConfigureCodingPlanApiKeyResult {
  configPath: string;
  model: string;
  providerId: CodingPlanProviderId;
}

export interface LogoutWCodeCliOptions {
  credentialStore?: SharedWCodeCredentialStore;
  env?: EnvRecord;
}

export interface LogoutWCodeCliResult {
  credentialsPath: string;
}

export class WCodeCliLoginError extends Error {
  readonly code:
    | "auth_failed"
    | "auth_timeout"
    | "config_update_failed"
    | "credential_write_failed";

  constructor(
    code: WCodeCliLoginError["code"],
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message, options);
    this.name = "WCodeCliLoginError";
    this.code = code;
  }
}
