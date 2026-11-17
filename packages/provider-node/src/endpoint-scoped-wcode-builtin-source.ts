import type { ProviderConfigLayerSnapshot, ProviderSource } from "@wcode/provider";
import {
  normalizeWCodeBuiltinEndpointOrigin,
  resolveWCodeBuiltinCachePaths,
} from "./wcode-builtin-cache-paths.js";
import { NodeWCodeBuiltinProviderConfigSource } from "./wcode-builtin-provider-config-source.js";
import {
  WCodeBuiltinRemoteSynchronizer,
  type WCodeBuiltinRefreshResult,
  type WCodeBuiltinRemoteSynchronizerOptions,
} from "./wcode-builtin-remote-synchronizer.js";

export interface EndpointScopedWCodeBuiltinSourceOptions {
  readonly bundledFilePath: string;
  readonly environmentConfigRoot: string;
  readonly platform: string;
  readonly appVersion: string;
  readonly resolveEndpointOrigin: () => string | Promise<string>;
  readonly fetchRelease: WCodeBuiltinRemoteSynchronizerOptions["fetchRelease"];
  readonly onRefreshResult?: WCodeBuiltinRemoteSynchronizerOptions["onRefreshResult"];
  readonly watch?: boolean;
}

/**
 * 让 Environment 的 WCode 控制面 Endpoint 同时决定 Active/LKG 与刷新控制路径。
 * Endpoint 切换只替换当前 Source，不读取上一 Endpoint 的缓存。
 */
export class EndpointScopedWCodeBuiltinSource implements ProviderSource<ProviderConfigLayerSnapshot> {
  readonly #options: EndpointScopedWCodeBuiltinSourceOptions;
  readonly #listeners = new Set<(reason: string) => void>();
  #current: CurrentEndpointSource | null = null;
  #ensureInFlight: Promise<CurrentEndpointSource> | null = null;
  #disposed = false;

  constructor(options: EndpointScopedWCodeBuiltinSourceOptions) {
    this.#options = options;
  }

  async read(): Promise<ProviderConfigLayerSnapshot> {
    return (await this.#ensureCurrent()).source.read();
  }

  onDidChange(listener: (reason: string) => void): () => void {
    this.#assertNotDisposed();
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async refresh(options?: { readonly force?: boolean }): Promise<WCodeBuiltinRefreshResult> {
    return (await this.#ensureCurrent()).synchronizer.refresh(options);
  }

  /** 返回当前 Environment Endpoint 对应、已完成物化的 Active Config 路径。 */
  async resolveActiveFilePath(): Promise<string> {
    return (await this.#ensureCurrent()).activeFilePath;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#current?.dispose();
    this.#current = null;
    this.#listeners.clear();
  }

  async #ensureCurrent(): Promise<CurrentEndpointSource> {
    this.#assertNotDisposed();
    if (this.#ensureInFlight) return this.#ensureInFlight;
    const ensure = this.#resolveCurrent().finally(() => {
      if (this.#ensureInFlight === ensure) this.#ensureInFlight = null;
    });
    this.#ensureInFlight = ensure;
    return ensure;
  }

  async #resolveCurrent(): Promise<CurrentEndpointSource> {
    const endpointOrigin = normalizeWCodeBuiltinEndpointOrigin(
      await this.#options.resolveEndpointOrigin(),
    );
    const paths = resolveWCodeBuiltinCachePaths({
      environmentConfigRoot: this.#options.environmentConfigRoot,
      platform: this.#options.platform,
      appVersion: this.#options.appVersion,
      wcodeEndpointOrigin: endpointOrigin,
    });
    if (this.#current?.activeFilePath === paths.activeFilePath) return this.#current;

    const source = new NodeWCodeBuiltinProviderConfigSource({
      bundledFilePath: this.#options.bundledFilePath,
      activeFilePath: paths.activeFilePath,
      watch: this.#options.watch,
    });
    const sourceDispose = source.onDidChange((reason) => this.#emit(reason));
    const synchronizer = new WCodeBuiltinRemoteSynchronizer({
      source,
      controlFilePath: paths.controlFilePath,
      resolveEndpointKey: async () =>
        normalizeWCodeBuiltinEndpointOrigin(await this.#options.resolveEndpointOrigin()),
      fetchRelease: this.#options.fetchRelease,
      onRefreshResult: this.#options.onRefreshResult,
    });
    try {
      await source.read();
      this.#assertNotDisposed();
    } catch (error) {
      sourceDispose();
      synchronizer.dispose();
      source.dispose();
      throw error;
    }

    const previous = this.#current;
    const current = new CurrentEndpointSource(
      paths.activeFilePath,
      source,
      synchronizer,
      sourceDispose,
    );
    this.#current = current;
    previous?.dispose();
    if (previous) this.#emit("endpoint-changed");
    return current;
  }

  #emit(reason: string): void {
    if (this.#disposed) return;
    for (const listener of this.#listeners) listener(reason);
  }

  #assertNotDisposed(): void {
    if (this.#disposed) throw new Error("EndpointScopedWCodeBuiltinSource 已 dispose");
  }
}

class CurrentEndpointSource {
  constructor(
    readonly activeFilePath: string,
    readonly source: NodeWCodeBuiltinProviderConfigSource,
    readonly synchronizer: WCodeBuiltinRemoteSynchronizer,
    readonly sourceDispose: () => void,
  ) {}

  dispose(): void {
    this.sourceDispose();
    this.synchronizer.dispose();
    this.source.dispose();
  }
}
