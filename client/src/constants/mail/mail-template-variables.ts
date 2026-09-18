// Variables disponibles para plantillas de correo
// Se puede importar en los formularios de creación y edición

export const MAIL_TEMPLATE_VARIABLES = [
  { key: '{NOMBRE_CURSO}', label: 'Nombre del curso' },
  { key: '{FECHA_INICIO}', label: 'Fecha de inicio' },
  { key: '{FECHA_FIN}', label: 'Fecha de fin' },
  { key: '{USUARIO_MOODLE}', label: 'Usuario de Moodle' },
  { key: '{CLAVE_MOODLE}', label: 'Clave de Moodle' },
];

// Variables adicionales solo disponibles en el envío de informes (Dedicación/
// Certificado) al centro: el destinatario es el centro, no un alumno, así que
// {USUARIO_MOODLE}/{CLAVE_MOODLE} no aplican ahí (se resuelven a vacío).
export const REPORT_MAIL_TEMPLATE_VARIABLES = [
  { key: '{NOMBRE_CENTRO}', label: 'Nombre del centro' },
  { key: '{NOMBRE_CURSO}', label: 'Nombre del curso' },
  { key: '{FECHA_INICIO}', label: 'Fecha de inicio' },
  { key: '{FECHA_FIN}', label: 'Fecha de fin' },
];

// Variables disponibles solo en plantillas de SMS (no en correo): el nombre
// corto del curso de catálogo, útil ahí porque cada carácter cuenta para el
// límite de 1 SMS — ver SmsService.buildTemplateVariables.
export const SMS_TEMPLATE_VARIABLES = [
  ...MAIL_TEMPLATE_VARIABLES,
  { key: '{NOMBRE_CURSO_CORTO}', label: 'Nombre corto del curso' },
];
