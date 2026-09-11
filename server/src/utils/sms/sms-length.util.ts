// Estimación de longitud/partes de un SMS ya resuelto (variables sustituidas +
// pie de baja añadido). Duplicado deliberado de
// client/src/utils/sms/sms-length.util.ts (mismo criterio ya documentado para
// MailService.resolveToken: no hay helper compartido entre client/server).
// Es una aproximación (no reproduce exactamente el cómputo GSM 03.38, donde
// los caracteres "extendidos" cuentan doble).
const GSM_7BIT_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_7BIT_EXTENDED = "^{}\\[~]|€";

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM_7BIT_BASIC.includes(ch) && !GSM_7BIT_EXTENDED.includes(ch)) return false;
  }
  return true;
}

export interface SmsLengthInfo {
  length: number;
  parts: number;
  encoding: 'GSM-7' | 'UCS-2';
}

export function estimateSmsLength(text: string): SmsLengthInfo {
  const length = text.length;
  const encoding: SmsLengthInfo['encoding'] = isGsm7(text) ? 'GSM-7' : 'UCS-2';
  const [singleLimit, concatLimit] = encoding === 'GSM-7' ? [160, 153] : [70, 67];
  const parts = length === 0 ? 0 : length <= singleLimit ? 1 : Math.ceil(length / concatLimit);
  return { length, parts, encoding };
}
