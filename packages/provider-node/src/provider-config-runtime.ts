import {
  ProviderConfigService,
  type ProviderConfigLayerSnapshot,
  type ProviderConfigLayerUpdate,
} from "@wcode/provider";
import { NodeWCodeBuiltinProviderConfigSource } from "./wcode-builtin-provider-config-source.js";
import {
  EndpointScopedWCodeBuiltinSource,
  type EndpointScopedWCodeBuiltinSourceOptions,
} from "./endpoint-scoped-wcode-builtin-source.js";
import {
  WCodeBuiltinRemoteSynchronizer,
  type WCodeBuiltinRemoteSynchronizerOptions,
  type WCodeBuiltinRefreshResult,
} from "./wcode-builtin-remote-synchronizer.js";
import {
  NodePersonalProviderConfigRepository,
  type PersonalProviderConfigRecoveryEvent,
} from "./personal-provider-config-repository.js";

export interface NodeProviderConfigRuntimeOptions {
  readonly wcodeBuiltinFilePath: string;
  readonly wcodeBuiltinActiveFilePath?: string;
  readonly wcodeBuiltinRemote?: Omit<WCodeBuiltinRemoteSynchronizerOptions, "source">;
  readonly wcodeBuiltinEnvironment?: Omit<
    EndpointScopedWCodeBuiltinSourceOptions,
    "bundledFilePath"
  >;
  readonly onWCodeBuiltinRefreshError?: (error: unknown) => void;
  readonly onPersonalConfigRecovery?: (event: PersonalProviderConfigRecoveryEvent) => void;
  readonly onPersonalConfigPollingError?: (error: unknown) => void;
  readonly personalFilePath: string;
  readonly personalPollingIntervalMs?: number | false;
  readonly importLegacy?: (
    wcodeBuiltin: ProviderConfigLayerSnapshot,
  ) => Promise<ProviderConfigLayerUpdate | null>;
  readonly watch?: boolean;
}

/** 组装一个 Node.js 进程内共享的 WCode Built-in/Personal Config 运行边界。 */
export class NodeProviderConfigRuntime {
  readonly configService: ProviderConfigService;
  readonly #wcodeBuiltinSource:
    | NodeWCodeBuiltinProviderConfigSource
    | EndpointScopedWCodeBuiltinSource;
  readonly #personalRepository: NodePersonalProviderConfigRepository;
  readonly #remoteSynchronizer?: WCodeBuiltinRemoteSynchronizer;
  readonly #onRemoteRefreshError?: (error: unknown) => void;
  #startPromise: Promise<void> | null = null;
  #disposed = false;
  readonly #checkListeners = new Set<() => Promise<void>>();
  #checkTimer: ReturnType<typeof setInterval> | null = null;
  #checkInFlight: Promise<void> | null = null;

  constructor(options: NodeProviderConfigRuntimeOptions) {
    this.#wcodeBuiltinSource = options.wcodeBuiltinEnvironment
      ? new EndpointScopedWCodeBuiltinSource({
          bundledFilePath: options.wcodeBuiltinFilePath,
          ...options.wcodeBuiltinEnvironment,
        })
      : new NodeWCodeBuiltinProviderConfigSource({
          bundledFilePath: options.wcodeBuiltinFilePath,
          activeFilePath: options.wcodeBuiltinActiveFilePath,
          watch: options.watch,
        });
    this.#remoteSynchronizer =
      options.wcodeBuiltinRemote &&
      this.#wcodeBuiltinSource instanceof NodeWCodeBuiltinProviderConfigSource
        ? new WCodeBuiltinRemoteSynchronizer({
            source: this.#wcodeBuiltinSource,
            ...options.wcodeBuiltinRemote,
          })
        : undefined;
    this.#onRemoteRefreshError = options.onWCodeBuiltinRefreshError;
    this.#personalRepository = new NodePersonalProviderConfigRepository({
      filePath: options.personalFilePath,
      onRecovery: options.onPersonalConfigRecovery,
      onPollingError: options.onPersonalConfigPollingError,
      pollingIntervalMs: options.personalPollingIntervalMs,
      ...(options.importLegacy
        ? {
            importLegacy: async () => options.importLegacy!(await this.#wcodeBuiltinSource.read()),
          }
        : {}),
    });
    this.configService = new ProviderConfigService({
      wcodeBuiltinSource: this.#wcodeBuiltinSource,
      personalRepository: this.#personalRepository,
    });
  }

  resolveWCodeBuiltinActiveFilePath(): Promise<string> {
    return this.#wcodeBuiltinSource instanceof NodeWCodeBuiltinProviderConfigSource
      ? Promise.resolve(this.#wcodeBuiltinSource.activeFilePath)
      : this.#wcodeBuiltinSource.resolveActiveFilePath();
  }

  get personalRepository(): import("@wcode/provider").PersonalProviderConfigRepository {
    return this.#personalRepository;
  }

  /** Environment 同一周期检查中恢复未对齐依赖，不被下载 TTL 或失败挡住。 */
  onDidCheckWCodeBuiltin(listener: () => Promise<void>): () => void {
    this.#checkListeners.add(listener);
    return () => this.#checkListeners.delete(listener);
  }

  start(): Promise<void> {
    if (this.#disposed) throw new Error("NodeProviderConfigRuntime 已 dispose");
    if (this.#startPromise) return this.#startPromise;
    const startPromise = this.configService.read().then(() => {
      if (this.#disposed) return;
      void this.#checkBackground();
      // Managed Worker 无下载配置也无恢复 owner，不建立周期任务。
      if (
        this.#remoteSynchronizer ||
        this.#wcodeBuiltinSource instanceof EndpointScopedWCodeBuiltinSource ||
        this.#checkListeners.size > 0
      ) {
        this.#checkTimer = setInterval(() => {
          void this.#checkBackground();
        }, 60_000);
        this.#checkTimer.unref?.();
      }
    });
    this.#startPromise = startPromise;
    void startPromise.catch(() => {
      if (this.#startPromise === startPromise) this.#startPromise = null;
    });
    return startPromise;
  }

  refreshWCodeBuiltin(options?: { readonly force?: boolean }): Promise<WCodeBuiltinRefreshResult> {
    if (this.#disposed) return Promise.resolve("disposed");
    if (this.#wcodeBuiltinSource instanceof EndpointScopedWCodeBuiltinSource) {
      return this.#wcodeBuiltinSource.refresh(options);
    }
    return this.#remoteSynchronizer?.refresh(options) ?? Promise.resolve("skipped");
  }

  #checkBackground(): Promise<void> {
    if (this.#disposed) return Promise.resolve();
    if (this.#checkInFlight) return this.#checkInFlight;
    const check = Promise.allSettled([
      this.refreshWCodeBuiltin(),
      ...[...this.#checkListeners].map((listener) => Promise.resolve().then(listener)),
    ])
      .then((results) => {
        if (this.#disposed) return;
        for (const result of results)
          if (result.status === "rejected") this.#onRemoteRefreshError?.(result.reason);
      })
      .finally(() => {
        if (this.#checkInFlight === check) this.#checkInFlight = null;
      });
    this.#checkInFlight = check;
    return check;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#checkTimer) clearInterval(this.#checkTimer);
    this.#checkTimer = null;
    this.#checkListeners.clear();
    this.#remoteSynchronizer?.dispose();
    this.configService.dispose();
    this.#personalRepository.dispose();
    this.#wcodeBuiltinSource.dispose();
  }
}

export function createNodeProviderConfigRuntime(
  options: NodeProviderConfigRuntimeOptions,
): NodeProviderConfigRuntime {
  return new NodeProviderConfigRuntime(options);
}
