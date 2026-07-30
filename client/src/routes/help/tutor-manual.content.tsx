import imgHome from "../../assets/help/tutor/01-home.jpg";
import imgUsuarios from "../../assets/help/tutor/02-usuarios.jpg";
import imgUsuarioDatos from "../../assets/help/tutor/12-usuario-detalle-datos.jpg";
import imgUsuarioCentros from "../../assets/help/tutor/13-usuario-detalle-centros.jpg";
import imgUsuarioCursos from "../../assets/help/tutor/14-usuario-detalle-cursos.jpg";
import imgUsuarioMoodle from "../../assets/help/tutor/15-usuario-detalle-moodle.jpg";
import imgGrupos from "../../assets/help/tutor/03-grupos.jpg";
import imgCursos from "../../assets/help/tutor/04-cursos.jpg";
import imgCursoDetalle from "../../assets/help/tutor/16-curso-detalle-grupos-alumnos.jpg";
import imgCursoOnline from "../../assets/help/tutor/17-curso-online-grupo-progreso.jpg";
import imgEmpresas from "../../assets/help/tutor/05-empresas.jpg";
import imgCentros from "../../assets/help/tutor/06-centros.jpg";
import imgPeticiones from "../../assets/help/tutor/07-peticiones.jpg";
import imgInformes from "../../assets/help/tutor/08-informes.jpg";
import imgInformesFiltroCurso from "../../assets/help/tutor/18-informes-filtro-curso.jpg";
import imgInformesFiltroGrupo from "../../assets/help/tutor/19-informes-filtro-grupo.jpg";
import imgInformesResultado from "../../assets/help/tutor/20-informes-resultado-exportar.jpg";
import imgInformesExport from "../../assets/help/tutor/09-informes-export-sin-passwords.jpg";
import imgGrupoDetalle from "../../assets/help/tutor/10-grupo-detalle-correo.jpg";
import imgEnviarCorreo from "../../assets/help/tutor/11-enviar-correo-modal.jpg";

export type ManualImage = {
  src: string;
  alt: string;
};

export type ManualSection = {
  key: string;
  title: string;
  images?: ManualImage[];
  paragraphs: string[];
  bullets?: string[];
};

/**
 * Contenido del manual para los roles TUTOR y VIEWER, que hoy tienen
 * exactamente los mismos permisos (ver docs/security.md). Las capturas están
 * desenfocadas donde aparecen datos reales de alumnos (son de la copia local
 * de la base de datos, no datos de ejemplo).
 */
export const tutorManualSections: ManualSection[] = [
  {
    key: "intro",
    title: "Qué puedes hacer con tu perfil",
    images: [{ src: imgHome, alt: "Pantalla de inicio de AcademyHub" }],
    paragraphs: [
      "Con tu perfil (Tutor o Consulta) puedes consultar toda la información de usuarios, grupos, cursos, empresas y centros, así como generar informes y enviar correos a los alumnos de un grupo.",
      "No puedes crear, editar ni eliminar usuarios, cursos, grupos, empresas o centros: esas acciones están reservadas a Administración. Si necesitas un cambio, contacta con un administrador.",
    ],
  },
  {
    key: "usuarios",
    title: "Usuarios: buscar y filtrar",
    images: [{ src: imgUsuarios, alt: "Listado de usuarios" }],
    paragraphs: [
      "En \"Usuarios\" puedes buscar por nombre, apellidos, email, DNI, centro o empresa escribiendo en el cuadro de búsqueda de arriba.",
      "Los desplegables \"Filtrar por empresa\" y \"Filtrar por centro\" acotan el listado; \"Tipo de formación\" filtra según la modalidad del curso en el que está matriculado el alumno (FUNDAE, pública, INAEM, privada).",
      "La casilla \"Mostrar dados de baja\" (activada por defecto) incluye en el listado a los alumnos cuyo centro principal tiene fecha de baja; una etiqueta roja \"B\" junto al nombre señala a estos usuarios. Desmárcala para ver solo los alumnos activos.",
      "Un clic en cualquier fila abre la ficha completa del usuario en una pestaña nueva.",
    ],
  },
  {
    key: "usuario-detalle",
    title: "Ficha de un usuario",
    images: [{ src: imgUsuarioDatos, alt: "Pestaña Datos Usuario de la ficha de un usuario" }],
    paragraphs: [
      "La ficha de usuario tiene cuatro pestañas: Datos Usuario, Empresa/Centros, Moodle y Cursos.",
      "\"Datos Usuario\" muestra sus datos personales, de contacto y laborales (DNI, NSS, dirección, nivel educativo, indicadores de discapacidad/ERTE/víctima de violencia de género, etc.) y su usuario/contraseña de Moodle. Los campos se ven como un formulario, pero con tu perfil no puedes guardar cambios.",
    ],
  },
  {
    key: "usuario-detalle-centros",
    title: "Ficha de usuario: Empresa/Centros",
    images: [{ src: imgUsuarioCentros, alt: "Pestaña Empresa/Centros de la ficha de un usuario" }],
    paragraphs: [
      "\"Empresa/Centros\" lista los centros de trabajo a los que ha pertenecido el usuario, con su empresa, número patronal y fechas de alta/baja. El centro con fecha de baja es el que dispara la etiqueta \"B\" en los listados.",
    ],
  },
  {
    key: "usuario-detalle-cursos",
    title: "Ficha de usuario: Cursos",
    images: [{ src: imgUsuarioCursos, alt: "Pestaña Cursos de la ficha de un usuario, con botones de certificado" }],
    paragraphs: [
      "\"Cursos\" lista todos los cursos en los que está o ha estado matriculado el usuario, con su grupo, modalidad, progreso y estado.",
      "Un clic en el nombre del grupo abre el detalle de ese curso con el grupo y el propio usuario ya preseleccionados — es la forma más rápida de saltar de un alumno al curso que está haciendo.",
      "\"Exportar a Excel\" descarga este listado de cursos del usuario. \"Certificado Cursos\" genera el PDF de certificación de asistencia del usuario para sus cursos presenciales. \"Abrir certificados Moodle\" abre los certificados generados por la propia plataforma Moodle (cursos online).",
    ],
  },
  {
    key: "usuario-detalle-moodle",
    title: "Ficha de usuario: Moodle",
    images: [{ src: imgUsuarioMoodle, alt: "Pestaña Moodle de la ficha de un usuario, con sus usuarios Moodle asociados" }],
    paragraphs: [
      "\"Moodle\" muestra los usuarios de Moodle asociados a esta persona (puede haber más de uno si el alumno tiene cuentas en varias instancias/organizaciones), su estado de sincronización, los cursos vinculados y el nombre de usuario en Moodle.",
    ],
  },
  {
    key: "grupos",
    title: "Grupos",
    images: [{ src: imgGrupos, alt: "Listado de grupos" }],
    paragraphs: [
      "\"Grupos\" lista todos los grupos de formación, con su curso, fechas de inicio/fin, si están bonificados (FUNDAE) y su estado (activo/inactivo, calculado a partir de las fechas del grupo).",
      "Al abrir un grupo (pestaña \"Usuarios del Grupo\") verás la lista de alumnos matriculados, su rol y si han finalizado; la pestaña \"Datos del Grupo\" muestra sus fechas y configuración.",
    ],
  },
  {
    key: "cursos",
    title: "Cursos",
    images: [{ src: imgCursos, alt: "Listado de cursos" }],
    paragraphs: [
      "\"Cursos\" muestra el catálogo completo, con pestañas para filtrar por tipo de financiación (Todos, Pública, FUNDAE, Privada, Sin clasificar).",
      "La columna \"Cliente\" (INAEM, VITALIA, OTRO) tiene su propio filtro de tabla (icono de embudo en la cabecera), así que puedes combinar pestaña + filtro de cliente para llegar a combinaciones concretas.",
      "Un clic en un curso abre su ficha en una pestaña nueva.",
    ],
  },
  {
    key: "curso-detalle",
    title: "Ficha de un curso: sus grupos y alumnos",
    images: [
      { src: imgCursoDetalle, alt: "Ficha de un curso presencial con sus grupos y la lista de alumnos de un grupo" },
      { src: imgCursoOnline, alt: "Ficha de un curso online con columnas de progreso, tiempo usado y sincronización Moodle" },
    ],
    paragraphs: [
      "La pestaña \"Ficha\" del curso muestra sus datos generales (nombre, cliente, financiación, modalidad, fechas, horas) y, debajo, dos tablas enlazadas: a la izquierda \"Grupos del Curso\" y a la derecha los alumnos del grupo que tengas seleccionado en esa tabla.",
      "En cursos presenciales la tabla de alumnos muestra una columna \"Finalizado\" (verde/rojo) en vez de progreso, ya que no hay seguimiento de Moodle. En cursos online o mixtos verás además el icono de sincronización con Moodle, una barra de \"Porcentaje\" de progreso y el \"Tiempo usado\"; el pie de la tabla resume el nº de estudiantes, cuántos superan el 75% y cuántos están bonificados.",
      "El botón \"Correo\" de esta tabla envía un mensaje a los alumnos seleccionados del grupo, igual que desde la ficha de grupo (ver más abajo).",
      "La pestaña \"Contenidos\" del curso lista el material asociado cuando existe.",
    ],
  },
  {
    key: "empresas",
    title: "Empresas",
    images: [{ src: imgEmpresas, alt: "Listado de empresas" }],
    paragraphs: ["\"Empresas\" lista las empresas dadas de alta, con su razón social. Desde la ficha de una empresa puedes ver sus centros."],
  },
  {
    key: "centros",
    title: "Centros",
    images: [{ src: imgCentros, alt: "Listado de centros" }],
    paragraphs: ["\"Centros\" lista los centros de trabajo, con su empresa y datos de contacto. Desde la ficha de un centro puedes ver sus alumnos."],
  },
  {
    key: "peticiones",
    title: "Peticiones de centros",
    images: [{ src: imgPeticiones, alt: "Listado de peticiones de centros" }],
    paragraphs: [
      "\"Peticiones\" muestra las solicitudes de formación abiertas o cerradas por centro y curso, con el número de alumnos solicitados. La vista \"Por curso\" resume peticiones y alumnos por empresa; debajo tienes el listado detallado de peticiones individuales.",
      "Puedes consultarlas, filtrar por empresa/curso/centro/grupo y generar el informe de peticiones (pestaña \"Informes\" de esta misma sección), pero no crear, cerrar, duplicar ni marcar como urgente una petición — eso corresponde a Administración/Gestión.",
    ],
  },
  {
    key: "informes",
    title: "Informes (SEPE / FUNDAE): filtros",
    images: [{ src: imgInformes, alt: "Pantalla de informes con filtros y tabla" }],
    paragraphs: [
      "\"Informes\" cruza toda la información de matriculación y progreso. En la parte superior tienes un buscador libre (nombre, apellidos, email, DNI, NSS o teléfono) y filtros por Curso, Modalidad, Cliente, Financiación, Grupo, Empresa, Centro, Rol, rango de fechas del grupo y % completado.",
      "Los filtros son interdependientes: por ejemplo el desplegable \"Grupo\" solo se activa cuando has elegido un \"Curso\", y solo lista los grupos de ese curso.",
    ],
  },
  {
    key: "informes-filtro-curso",
    title: "Informes: elegir un curso",
    images: [{ src: imgInformesFiltroCurso, alt: "Autocompletado del filtro de curso en Informes" }],
    paragraphs: [
      "Escribe parte del nombre del curso en el campo \"Curso\" y elige una opción del desplegable. La tabla de abajo se actualiza al momento con los registros de ese curso (aparece el nº total de registros junto a la paginación).",
    ],
  },
  {
    key: "informes-filtro-grupo",
    title: "Informes: acotar por grupo",
    images: [{ src: imgInformesFiltroGrupo, alt: "Desplegable de grupo ya habilitado tras elegir un curso" }],
    paragraphs: [
      "Con el curso ya elegido, el desplegable \"Grupo\" se activa y muestra solo los grupos de ese curso. Puedes seleccionar varios grupos a la vez.",
    ],
  },
  {
    key: "informes-resultado-exportar",
    title: "Informes: generar el PDF o Excel",
    images: [{ src: imgInformesResultado, alt: "Tabla filtrada por grupo con el desplegable de tipo de exportación" }],
    paragraphs: [
      "Con el filtro aplicado (en el ejemplo, 81 alumnos de un grupo concreto), elige el tipo de exportación junto al botón \"Generar\":",
    ],
    bullets: [
      "PDF Dedicación: detalle por alumno (nombre, progreso, tiempo usado…).",
      "PDF Certificado: certificado agrupado por Centro → Curso → Grupo, con las fechas del grupo.",
      "PDF Bonificada: totales por Grupo → Empresa → Centro, sin detalle de alumnos.",
      "Exportar a Excel: descarga el listado filtrado tal cual se ve en la tabla.",
    ],
  },
  {
    key: "informes-passwords",
    title: "Contraseñas en el informe de dedicación",
    images: [{ src: imgInformesExport, alt: "Modal de exportación sin la opción de incluir contraseñas" }],
    paragraphs: [
      "Al generar el PDF de dedicación no verás la opción de incluir contraseñas: es una acción sensible reservada a Administración/Gestión, tanto en la pantalla como en el propio servidor.",
    ],
  },
  {
    key: "correo",
    title: "Enviar correo a un grupo",
    images: [{ src: imgGrupoDetalle, alt: "Ficha de un grupo con el botón Correo" }],
    paragraphs: [
      "Desde la ficha de un grupo (o desde la tabla de alumnos en la ficha de un curso), selecciona uno o varios alumnos con la casilla de la izquierda y pulsa \"Correo\" para enviarles un mensaje.",
    ],
  },
  {
    key: "correo-modal",
    title: "Componer el correo",
    images: [{ src: imgEnviarCorreo, alt: "Modal de envío de correo con plantilla y remitente" }],
    paragraphs: [
      "Elige una plantilla ya creada o un correo personalizado, revisa el remitente (por defecto, el genérico de la organización; también puedes usar tu propio email o el de un tutor asignado si lo hay) y usa \"Enviar prueba\" para comprobar el resultado antes de enviarlo a todos los destinatarios.",
      "No puedes crear ni editar plantillas de correo ni la configuración SMTP: solo usarlas.",
    ],
  },
];
