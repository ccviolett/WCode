import type { WCodeSessionFile, WCodeTaskMeta } from "@wcode/shared";
import { wcodeSessionFileSchema, wcodeTaskMetaSchema, wcodeTaskModeSchema } from "@wcode/shared";

export type LegacyTaskSessionFile = Omit<WCodeSessionFile, "meta"> & {
  meta: Omit<WCodeTaskMeta, "mode"> & { mode?: WCodeTaskMeta["mode"] };
};

const legacyTaskSessionFileSchema = wcodeSessionFileSchema.extend({
  // Claude 原生迁移会按清洗路径删除 meta.mode。
  // legacy snapshot 读取/写入仍要校验其它必需字段，但不能再强制把被过滤字段补回文件。
  meta: wcodeTaskMetaSchema.extend({
    mode: wcodeTaskModeSchema.optional(),
  }),
});

export function parseLegacyTaskSessionFile(input: unknown): LegacyTaskSessionFile {
  return legacyTaskSessionFileSchema.parse(input);
}

export function safeParseLegacyTaskSessionFile(input: unknown) {
  return legacyTaskSessionFileSchema.safeParse(input);
}
