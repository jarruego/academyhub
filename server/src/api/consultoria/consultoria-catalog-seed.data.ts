// TEMPORAL — pensado para borrarse en cuanto deje de hacer falta (pedido
// explícito del usuario, 2026-09-16): rellenar los catálogos de
// competencias/puestos sin escribirlos a mano y automapear los puestos de
// trabajo reales contra ese catálogo, tanto en desarrollo como en
// producción. Usado por `ConsultingCatalogSeedService`
// (`api/consultoria/catalog-seed/*`, ADMIN-only) y por el script standalone
// `server/seed-consulting-job-catalog.ts` — mismo origen de datos para los
// dos, así no se desincronizan. Cuando el usuario avise, se puede borrar
// este fichero junto con el controlador/servicio, sus endpoints, el botón
// del frontend y el script.
//
// ✅ COMPETENCIES, JOB_POSITIONS y POSITION_COMPETENCY_TEMPLATE — listado y
// plantilla REALES, sacados del "cuadro competencias.xlsx" que dio el
// usuario 2026-09-16 (ya no son un borrador). El Excel marca, por cada
// puesto (fila) y competencia (columna), si esa competencia **aplica** a
// ese puesto (celda = 1) — no indica un juicio de valor (bien/mal). Al
// importarlo, "aplica" se traduce como `default_value: true` ("no necesita
// mejorar" de partida) en `consulting_position_competency_templates` — es
// una convención mía razonable (empezar en positivo, el evaluador corrige
// a la baja si hace falta), no algo que diga el Excel explícitamente.
// `JOB_POSITION_MAPPING_RULES` sigue siendo mío, sin verificar — solo
// intenta adivinar a qué puesto real corresponde cada valor abreviado de
// `user.job_position`.

export const DRAFT_COMPETENCIES: string[] = [
  "Liderar equipos de trabajo",
  "Conocer todos los servicios del centro",
  "Conocer funciones por puesto de trabajo",
  "Liderar el mantenimiento del SGI en el centro",
  "Conocer requisitos legales sector",
  "Ofimática",
  "Conocer riesgos de mi trabajo y P. Autoprotec.",
  "Capacidad de gestión documental",
  "Manipulador de alimentos e Higiene alimentaria",
  "Conocer función personal cocina y lavandería",
  "Orientación al público y Habilidades sociales",
  "Formación de Legionella",
  "Conocer instalaciones centro y manto. Reque.",
  "Manejo de equipos e instalaciones de cocina",
  "Manipulador de alimentos alto riesgo y alérgenos",
  "Carnet de conducir B",
  "Capacidad de motivar a grupos de usuarios",
  "Trato profesional, entrañable y afectuoso",
  "Conocer el proceso de quejas en lo que le afecte",
  "Conocer la parte del SGI que le afecta y acceder",
  "Saber Requisitos Legales que le afectan",
  "Capaz de segregar residuos correctamente",
  "Conocer aspectos MA significativos",
  "Realizar movilizaciones sin dañarse",
  "Formación de Delegado Prevención",
];

export const DRAFT_JOB_POSITIONS: { name: string; group_label: string }[] = [
  { name: "Dirección Centro", group_label: "Dirección" },
  { name: "Subdirección Centro", group_label: "Dirección" },
  { name: "Trabajo Social", group_label: "Asistencial / Terapias" },
  { name: "Médico/a", group_label: "Asistencial / Terapias" },
  { name: "Psiquiatra", group_label: "Asistencial / Terapias" },
  { name: "Psicólogo/a", group_label: "Asistencial / Terapias" },
  { name: "Fisioterapeuta", group_label: "Asistencial / Terapias" },
  { name: "Rble. Terapia Ocupacional", group_label: "Asistencial / Terapias" },
  { name: "Terapeuta Ocupacional", group_label: "Asistencial / Terapias" },
  { name: "Monitores/as (TASOC/E.Social)", group_label: "Asistencial / Terapias" },
  { name: "Rble. de Enfermería", group_label: "Asistencial / Terapias" },
  { name: "Enfermero/a", group_label: "Asistencial / Terapias" },
  { name: "Supervisor/a - Coordinador/a", group_label: "Cuidados" },
  { name: "Superiores de Auxiliares", group_label: "Cuidados" },
  { name: "Gerocultor/a", group_label: "Cuidados" },
  { name: "Cuidador/a", group_label: "Cuidados" },
  { name: "Personal de Limpieza", group_label: "Cuidados" },
  { name: "Recepcionista", group_label: "Servicios" },
  { name: "Peluquero/a", group_label: "Servicios" },
  { name: "Podólogo/a", group_label: "Servicios" },
  { name: "Rble. de Mantenimiento", group_label: "Servicios" },
  { name: "Rble. de Cocina", group_label: "Servicios" },
  { name: "Cocinero/a", group_label: "Servicios" },
  { name: "Pinche de Cocina", group_label: "Servicios" },
  { name: "Administración", group_label: "Administración y otros" },
  { name: "Auxiliar de Farmacia", group_label: "Administración y otros" },
  { name: "Delegado/a de Prevención", group_label: "Administración y otros" },
  { name: "Conductor/a", group_label: "Administración y otros" },
];

// Plantilla real: qué competencias aplican a cada puesto (celda = 1 en el
// Excel). `fillCatalog` inserta estos pares con `default_value: true`, sin
// tocar los que ya tengan un valor guardado (no pisa ediciones manuales).
export const POSITION_COMPETENCY_TEMPLATE: { jobPosition: string; competencies: string[] }[] = [
  { jobPosition: "Dirección Centro", competencies: ["Liderar equipos de trabajo", "Conocer todos los servicios del centro", "Conocer funciones por puesto de trabajo", "Liderar el mantenimiento del SGI en el centro", "Conocer requisitos legales sector", "Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Orientación al público y Habilidades sociales", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Conocer aspectos MA significativos", "Formación de Delegado Prevención"] },
  { jobPosition: "Subdirección Centro", competencies: ["Liderar equipos de trabajo", "Conocer todos los servicios del centro", "Conocer funciones por puesto de trabajo", "Liderar el mantenimiento del SGI en el centro", "Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Orientación al público y Habilidades sociales", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Conocer aspectos MA significativos", "Formación de Delegado Prevención"] },
  { jobPosition: "Trabajo Social", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Capacidad de gestión documental", "Orientación al público y Habilidades sociales", "Capacidad de motivar a grupos de usuarios", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Médico/a", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Psiquiatra", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Psicólogo/a", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Capacidad de motivar a grupos de usuarios", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Fisioterapeuta", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Capacidad de motivar a grupos de usuarios", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Realizar movilizaciones sin dañarse"] },
  { jobPosition: "Rble. Terapia Ocupacional", competencies: ["Liderar equipos de trabajo", "Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Capacidad de motivar a grupos de usuarios", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Terapeuta Ocupacional", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Capacidad de motivar a grupos de usuarios", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Monitores/as (TASOC/E.Social)", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Capacidad de motivar a grupos de usuarios", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Rble. de Enfermería", competencies: ["Liderar equipos de trabajo", "Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Realizar movilizaciones sin dañarse"] },
  { jobPosition: "Enfermero/a", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Realizar movilizaciones sin dañarse"] },
  { jobPosition: "Supervisor/a - Coordinador/a", competencies: ["Liderar equipos de trabajo", "Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Manipulador de alimentos e Higiene alimentaria", "Conocer función personal cocina y lavandería", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Conocer aspectos MA significativos", "Realizar movilizaciones sin dañarse"] },
  { jobPosition: "Superiores de Auxiliares", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Manipulador de alimentos e Higiene alimentaria", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Realizar movilizaciones sin dañarse"] },
  { jobPosition: "Gerocultor/a", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Manipulador de alimentos e Higiene alimentaria", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Realizar movilizaciones sin dañarse"] },
  { jobPosition: "Cuidador/a", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Manipulador de alimentos e Higiene alimentaria", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Realizar movilizaciones sin dañarse"] },
  { jobPosition: "Personal de Limpieza", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Conocer aspectos MA significativos"] },
  { jobPosition: "Recepcionista", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Orientación al público y Habilidades sociales", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Peluquero/a", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Podólogo/a", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Rble. de Mantenimiento", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Manipulador de alimentos e Higiene alimentaria", "Formación de Legionella", "Conocer instalaciones centro y manto. Reque.", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Conocer aspectos MA significativos"] },
  { jobPosition: "Rble. de Cocina", competencies: ["Liderar equipos de trabajo", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Manejo de equipos e instalaciones de cocina", "Manipulador de alimentos alto riesgo y alérgenos", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Conocer aspectos MA significativos"] },
  { jobPosition: "Cocinero/a", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Manejo de equipos e instalaciones de cocina", "Manipulador de alimentos alto riesgo y alérgenos", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Pinche de Cocina", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Manejo de equipos e instalaciones de cocina", "Manipulador de alimentos alto riesgo y alérgenos", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Administración", competencies: ["Ofimática", "Conocer riesgos de mi trabajo y P. Autoprotec.", "Capacidad de gestión documental", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Auxiliar de Farmacia", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
  { jobPosition: "Delegado/a de Prevención", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente", "Formación de Delegado Prevención"] },
  { jobPosition: "Conductor/a", competencies: ["Conocer riesgos de mi trabajo y P. Autoprotec.", "Orientación al público y Habilidades sociales", "Carnet de conducir B", "Trato profesional, entrañable y afectuoso", "Conocer el proceso de quejas en lo que le afecte", "Conocer la parte del SGI que le afecta y acceder", "Saber Requisitos Legales que le afectan", "Capaz de segregar residuos correctamente"] },
];

// Primer fragmento (sobre el valor normalizado: mayúsculas, sin acentos, sin
// puntuación) que aparece en el job_position real decide el mapeo —
// evaluadas EN ESTE ORDEN, la primera que encaja gana (importa: los puestos
// "responsable de X" van antes que "X" a secas, para no atropellarlos).
// Deliberadamente conservador: lo que no encaja con nada se deja SIN mapear
// (mejor eso que un mapeo inventado) — queda en /consultoria/job-position-aliases.
// Los puestos de la lista heurística anterior que no existen en el Excel
// real (Portero/a, Jardinero/a, Gobernanta, Vigilante, Ayudante de oficios
// varios, Operario/a especializado/a...) ya no tienen regla — esos valores
// se quedan sin mapear a propósito, no hay puesto real al que asignarlos.
export const JOB_POSITION_MAPPING_RULES: { jobPosition: string; fragments: string[] }[] = [
  { jobPosition: "Subdirección Centro", fragments: ["SUBDIRE"] },
  { jobPosition: "Dirección Centro", fragments: ["DIRECTOR", "GERENTE", "DIRECCION", "A DIRECT", "A2 DIRECTO", "ADTO DIR", "AYUD DIREC", "DIREC ADJ"] },
  { jobPosition: "Psiquiatra", fragments: ["PSIQUIATR"] },
  { jobPosition: "Médico/a", fragments: ["MEDICO", "TIT MED"] },
  { jobPosition: "Rble. de Enfermería", fragments: ["RESP ENFER", "RBLE ENFER", "COORD ENFER", "SUPERV ENFER"] },
  // "Personal no cualificado"/auxiliar de clínica/celador — base de cuidados,
  // más cerca de Gerocultor/a que de ningún otro puesto de la lista real.
  // "Ayudante de oficios varios" — corregido 2026-09-16 (el usuario había
  // corregido antes a Administración, y volvió a corregir: en esta empresa
  // los ayudantes de oficios varios se vinculan con Gerocultor/a). Regla del
  // usuario para desambiguar de "Ayudante de Oficina": si no lleva "ADM" en
  // ningún sitio, es de oficios varios → aquí. Fragmentos elegidos para NO
  // coincidir con un futuro valor que sí llevase "ADM" justo después de
  // "AY(TE/D)" (cada uno exige la letra siguiente concreta que "ADM" no tiene).
  { jobPosition: "Gerocultor/a", fragments: ["GEROC", "GERO", "AUXILIAR C", "AUX CLIN", "PERS N CUA", "AUX ENFER", "NO CUALIF", "PERSONAL N", "PERS NO", "PER NO", "CELADO", "AY OFICIOS", "AYD OF", "AY OF V", "AYTE O", "AYT OF", "AY OFS", "AYUDANTE A", "AYUDANTE O"] },
  { jobPosition: "Cuidador/a", fragments: ["CUIDADOR"] },
  { jobPosition: "Enfermero/a", fragments: ["D U E", "DUE", "ATS", "ENFERMER"] },
  { jobPosition: "Rble. Terapia Ocupacional", fragments: ["RESP OCUP", "RBLE OCUP", "COORD OCUP"] },
  // "TERAP" a secas se evita a propósito: colisiona con "FISOTERAPE"
  // (Fisioterapeuta) — se usan formas más específicas.
  { jobPosition: "Terapeuta Ocupacional", fragments: ["OCUP", "TERAPEUT", "TERAPUT", "TERAP O"] },
  { jobPosition: "Fisioterapeuta", fragments: ["FISIOTER", "FISIOTE", "FISOTERAPE"] },
  // El propio Excel agrupa TASOC y Educador/a Social en el mismo puesto.
  { jobPosition: "Monitores/as (TASOC/E.Social)", fragments: ["TASOC", "MONITOR", "ANIM SOCIAL", "ANIMADOR", "ANIM SOCI", "MONIT EDUC", "EDUCAD"] },
  { jobPosition: "Trabajo Social", fragments: ["TRAB SOCIAL", "TRABAJO SOC", "TRABAJADOR SOCIAL", "TRABAJADOR", "TRAB SOC", "TRA SOCI", "AS SOCIAL", "T SOCIAL"] },
  { jobPosition: "Psicólogo/a", fragments: ["PSICOLOG", "PSIC TERAP"] },
  { jobPosition: "Superiores de Auxiliares", fragments: ["SUP AUX", "SUPERIOR AUX"] },
  // Gobernanta = supervisión de limpieza/servicios — más cerca de este
  // puesto que de "Personal de Limpieza" a secas.
  { jobPosition: "Supervisor/a - Coordinador/a", fragments: ["SUPERVIS", "COORDINAD", "RES EQUIPO", "GOBERNA"] },
  { jobPosition: "Rble. de Cocina", fragments: ["JEFE COCIN", "JEFECOCINA", "RESP COCINA", "RBLE COCINA"] },
  { jobPosition: "Cocinero/a", fragments: ["COCINERO", "COCINERA", "COCIN", "AUX COLECT"] },
  { jobPosition: "Pinche de Cocina", fragments: ["PINCHE"] },
  { jobPosition: "Rble. de Mantenimiento", fragments: ["MANT", "SV GR", "SERV GEN", "ING TECNIC", "OFICIAL", "MMTO", "PINTOR", "AUX MAN", "AUXILIAR M", "OFIC MAN"] },
  { jobPosition: "Personal de Limpieza", fragments: ["LIMPIAD", "LIMP", "LAVANDERA", "LAVAN", "PERSONAL L", "LIM PLAN", "SERV L"] },
  // "Portero/Recepción" — el propio valor indica el combo; se resuelve al
  // lado de recepción, no queda puesto "Portero" suelto en la lista real.
  { jobPosition: "Recepcionista", fragments: ["RECEPCION", "PORTERO RE"] },
  { jobPosition: "Peluquero/a", fragments: ["PELUQUER"] },
  { jobPosition: "Podólogo/a", fragments: ["PODOLOG"] },
  { jobPosition: "Administración", fragments: ["ADM", "ADVO"] },
  { jobPosition: "Auxiliar de Farmacia", fragments: ["FARMA", "TEC FAR"] },
  { jobPosition: "Delegado/a de Prevención", fragments: ["DELEGADO PREVEN", "DELEG PREVEN", "DELEGADO DE PREVENCION"] },
  { jobPosition: "Conductor/a", fragments: ["CONDUCTO"] },
];

export const normalizeJobPositionText = (s: string) => s
  .toUpperCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

// Valores tipo "9901082501" que aparecen en job_position por error de origen,
// no son un puesto — se dejan aparte en vez de intentar mapearlos.
export const looksLikeGarbageJobPosition = (raw: string) => /^\d+$/.test(raw.trim());
