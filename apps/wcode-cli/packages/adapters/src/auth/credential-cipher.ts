import {
  createLegacyCredentialCipher,
  type CredentialCipher,
} from "@wcode/shared/credential-security";
export type WCodeCredentialCipher = CredentialCipher;
export interface WCodeCredentialCipherOptions {
  env?: Record<string, string | undefined>;
}
/** 仅兼容旧格式；正式凭据仓库默认使用系统安全存储。 */
export function createWCodeCredentialCipher(options: WCodeCredentialCipherOptions = {}) {
  return createLegacyCredentialCipher(options.env);
}
export function isEncryptedWCodeCredentialValue(value: string): boolean {
  return value.startsWith("enc:");
}
