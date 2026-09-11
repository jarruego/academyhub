import { Role } from '../../hooks/api/auth/use-login.mutation';

// Registro de permisos por rol, mostrado en Gestión de usuarios → "Ver matriz de
// permisos por rol" (solo ADMIN). Es la versión resumida y en español de la
// auditoría técnica completa en docs/permissions-matrix.md — ambas deben
// actualizarse juntas cada vez que se añada, borre o cambie un RoleGuard, un
// AuthzHide, un check de rol inline, o un flag puntual (auth_users.<flag>).
// No lo dejes desactualizado: si tocas permisos y no sabes qué fila cambiar,
// mira antes docs/permissions-matrix.md (mismo orden de áreas).

export type PermissionMatrixAccess = 'yes' | 'no' | 'flag';

export interface PermissionMatrixRow {
  label: string;
  access: Record<Role, PermissionMatrixAccess>;
  note?: string;
}

export interface PermissionMatrixSection {
  key: string;
  title: string;
  rows: PermissionMatrixRow[];
}

const { ADMIN, MANAGER, VIEWER, TUTOR, CONSULTOR } = Role;

// Atajos para construir `access` sin repetir las 5 claves en cada fila.
const all = (v: PermissionMatrixAccess): Record<Role, PermissionMatrixAccess> =>
  ({ [ADMIN]: v, [MANAGER]: v, [VIEWER]: v, [TUTOR]: v, [CONSULTOR]: v } as Record<Role, PermissionMatrixAccess>);

const adminManager = (rest: PermissionMatrixAccess = 'no'): Record<Role, PermissionMatrixAccess> =>
  ({ ...all(rest), [ADMIN]: 'yes', [MANAGER]: 'yes' });

const adminOnly = (rest: PermissionMatrixAccess = 'no'): Record<Role, PermissionMatrixAccess> =>
  ({ ...all(rest), [ADMIN]: 'yes' });

// Split 1/2/3 (docs/security.md): ADMIN/MANAGER/TUTOR sí, VIEWER/CONSULTOR no.
const split = (): Record<Role, PermissionMatrixAccess> =>
  ({ [ADMIN]: 'yes', [MANAGER]: 'yes', [TUTOR]: 'yes', [VIEWER]: 'no', [CONSULTOR]: 'no' });

// can_manage_candidates: ADMIN/MANAGER acceso pleno; VIEWER/TUTOR/CONSULTOR solo con el flag.
const candidatesFlag = (): Record<Role, PermissionMatrixAccess> =>
  ({ [ADMIN]: 'yes', [MANAGER]: 'yes', [VIEWER]: 'flag', [TUTOR]: 'flag', [CONSULTOR]: 'flag' });

// Importación INAEM (desde 2026-09-09): solo ADMIN tiene acceso pleno; el resto,
// incluido MANAGER, solo entra con el flag can_manage_candidates.
const adminFullRestFlag = (): Record<Role, PermissionMatrixAccess> =>
  ({ [ADMIN]: 'yes', [MANAGER]: 'flag', [VIEWER]: 'flag', [TUTOR]: 'flag', [CONSULTOR]: 'flag' });

export const PERMISSIONS_MATRIX_UPDATED_AT = '2026-09-09';

export const PERMISSIONS_MATRIX_SECTIONS: PermissionMatrixSection[] = [
  {
    key: 'auth',
    title: 'Autenticación y gestión de usuarios',
    rows: [
      { label: 'Login / logout', access: all('yes') },
      { label: 'Gestión de usuarios (auth_users), registro de auditoría, registro de correos, copias de seguridad', access: adminOnly() },
    ],
  },
  {
    key: 'organization',
    title: 'Organización, SMTP y plantillas de correo',
    rows: [
      { label: 'Ver ajustes de organización / SMTP / plantillas (lectura, API)', access: all('yes') },
      { label: 'Guardar ajustes de organización, SMTP o plantillas', access: adminOnly() },
      { label: 'Pantallas "SMTP" y "Plantillas de correo" (Administración → Correo)', access: adminOnly() },
    ],
  },
  {
    key: 'import-sage',
    title: 'Importación SAGE',
    rows: [
      { label: 'Todo (subir CSV/FTP, decisiones, jobs, usuarios fallidos, pantalla)', access: adminOnly(), note: 'Solo ADMIN — es una tarea automática (cron) o de administración' },
    ],
  },
  {
    key: 'import-inaem',
    title: 'Importación INAEM',
    rows: [
      { label: 'Importar Acciones / Alumnos, Preinscripciones sin restricción, borrar/resolver conflictos', access: adminOnly() },
      { label: 'Importar Preinscritos INAEM acotado a una edición', access: adminFullRestFlag(), note: 'MANAGER también necesita el flag desde 2026-09-09' },
      { label: 'Pantalla "Importación INAEM"', access: adminOnly() },
    ],
  },
  {
    key: 'mail-moodle',
    title: 'Correo y sincronización con Moodle',
    rows: [
      { label: 'Enviar correo (a alumno, petición…)', access: split(), note: 'Split 1/2' },
      { label: 'Sincronizar miembros de grupo, subir grupo a Moodle, añadir/dar de baja usuario en Moodle', access: adminManager() },
      { label: 'Borrar grupo en Moodle, importación masiva desde Moodle', access: adminOnly(), note: 'Acciones destructivas o masivas' },
      { label: 'Comparación BD↔Moodle, gestión de cuentas Moodle', access: adminOnly() },
    ],
  },
  {
    key: 'sms',
    title: 'SMS (Mailrelay)',
    rows: [
      { label: 'Ver ajustes y plantillas SMS (lectura, API)', access: adminManager(), note: 'A diferencia del correo, TUTOR no tiene ningún acceso a SMS' },
      { label: 'Guardar ajustes SMS y probar conexión con Mailrelay', access: adminOnly() },
      { label: 'Pantalla "Configuración SMS" (Administración → SMS)', access: adminOnly() },
      { label: 'Enviar SMS (prueba, grupo)', access: adminManager(), note: 'Sin TUTOR, a diferencia del correo' },
      { label: 'Registro de envíos de SMS y "Actualizar estado"', access: adminOnly() },
    ],
  },
  {
    key: 'forum-duplicator',
    title: 'Duplicador de foros',
    rows: [{ label: 'Listar y duplicar temas de foro', access: adminManager() }],
  },
  {
    key: 'candidates-interests',
    title: 'Candidatos, catálogo e interesados',
    rows: [
      { label: 'Ver candidatos / interesados / catálogo', access: all('yes') },
      { label: 'Crear/borrar/editar candidatos e interesados', access: candidatesFlag(), note: 'Split 3 — TUTOR tiene acceso pleno sin necesitar el flag (confirmado intencional)' },
      { label: 'Crear, editar o fusionar un curso de catálogo', access: adminOnly() },
      { label: 'Editar contenidos del curso de catálogo', access: adminManager() },
    ],
  },
  {
    key: 'course-requests',
    title: 'Peticiones de centros',
    rows: [
      { label: 'Ver peticiones, informe, PDF', access: all('yes') },
      { label: 'Crear/editar/cerrar/borrar petición, matricular desde petición', access: adminManager(), note: 'A diferencia de Candidatos/Interesados, aquí TUTOR no escribe (confirmado intencional)' },
    ],
  },
  {
    key: 'courses',
    title: 'Cursos / ediciones',
    rows: [
      { label: 'Ver curso, listar, grupos del curso', access: all('yes') },
      { label: 'Crear curso, matricular/borrar usuario, eliminar curso', access: adminOnly() },
      { label: 'Editar ficha completa del curso', access: adminManager() },
      { label: 'Editar solo Planificación y selección', access: candidatesFlag() },
    ],
  },
  {
    key: 'groups',
    title: 'Grupos',
    rows: [
      { label: 'Ver grupo, listar, alumnos del grupo', access: all('yes') },
      { label: 'Crear/borrar grupo, matricular 1 a 1', access: adminOnly() },
      { label: 'Editar grupo, matricular en bloque, Moodle, Exportar, Bonificar', access: adminManager() },
      { label: 'Correo, Enviar informe, Selección rápida', access: split(), note: 'Split 1/2' },
    ],
  },
  {
    key: 'companies-centers',
    title: 'Empresas y centros',
    rows: [
      { label: 'Ver empresa/centro, listar, usuarios del centro', access: all('yes') },
      { label: 'Crear/editar/borrar empresa o centro, gestionar usuarios del centro', access: adminOnly() },
      { label: 'Actualizar centro principal en bloque', access: adminManager() },
      { label: '"Formación en el centro" (pestaña)', access: split(), note: 'Split 1' },
    ],
  },
  {
    key: 'users',
    title: 'Usuarios (personas)',
    rows: [
      { label: 'Ver/listar usuarios, centros/cursos de un usuario, certificado', access: all('yes') },
      { label: 'Borrar usuario', access: adminOnly() },
      { label: 'Crear usuario (formulario dedicado)', access: adminOnly(), note: 'Botón y página /create-user, ambos ADMIN desde 2026-09-09' },
      { label: 'Importar de Moodle, alta/edición en bloque', access: adminManager() },
      { label: 'Editar ficha completa de usuario', access: { ...adminManager(), [TUTOR]: 'yes' } },
      { label: 'Editar solo datos de identidad (alta rápida / posible duplicado)', access: candidatesFlag() },
      { label: 'Enviar correo a un usuario', access: split(), note: 'Split 2' },
    ],
  },
  {
    key: 'reports',
    title: 'Informes',
    rows: [
      { label: 'Listar informes, exportar PDF/Excel', access: all('yes') },
      { label: 'Exportar/enviar informe con contraseñas', access: { ...adminManager(), [TUTOR]: 'yes' }, note: 'Ampliado a TUTOR el 2026-09-09 — ya ve la clave de Moodle en la ficha del alumno' },
      { label: 'Enviar informe a centros', access: split(), note: 'Split 1' },
    ],
  },
  {
    key: 'merge-sanitization',
    title: 'Fusión de duplicados y sanitización',
    rows: [{ label: 'Fusionar usuarios duplicados, sanitizar datos', access: adminOnly() }],
  },
];
