import { z } from "zod";

/**
 * WCode agent 提供方的单一真源。
 *
 * 类型 WCodeProvider、运行时 schema wcodeProviderSchema 都从这里派生,
 * 避免各处内联 z.enum([...]) 副本随新增/删除 provider 漂移。
 * 本模块只依赖 zod(叶子),可被 validation / wcode-protocol 等无环引用。
 */
export const WCODE_PROVIDERS = ["glm"] as const;

export const wcodeProviderSchema = z.enum(WCODE_PROVIDERS);

export type WCodeProvider = (typeof WCODE_PROVIDERS)[number];
