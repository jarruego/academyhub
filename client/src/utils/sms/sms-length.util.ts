// Estimación de longitud/partes de un SMS en el editor de plantillas. Es una
// aproximación (no reproduce exactamente el cómputo GSM 03.38, donde los
// caracteres "extendidos" cuentan doble) — el recuento real (`parts_count`)
// solo lo devuelve Mailrelay tras el envío o al consultar el estado.
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
