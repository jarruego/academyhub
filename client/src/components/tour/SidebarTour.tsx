import { useEffect, useState } from "react";
import { useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { Joyride, STATUS, ACTIONS, EVENTS, Step, EventData } from "react-joyride";
import { useTour } from "../../providers/tour/tour.context";
import { useIsMobile } from "../../hooks/use-is-mobile";

type TourStep = Step & {
  /** Navigate here before showing the step, when different from the current route. */
  route?: string;
  /**
   * Runs synchronously right before the step is shown (after any `route`
   * navigation is triggered). Used to demonstrate flows the tour can't reach
   * by simply pointing at a link — e.g. opening a record's detail page or
   * selecting a table row — without requiring the user to click through by
   * hand. See `openFirstRowInSameTab`/`clickFirstRow`/`clickTabByLabel` below.
   */
  beforeShow?: (navigate: NavigateFunction) => void;
};

/**
 * List rows navigate via `openDetail()` → `window.open(url, "_blank")` (the
 * app-wide "single click opens a new tab" convention — see docs/client.md).
 * A single-tab Joyride tour can't follow into a new tab, so for the duration
 * of one click we swap `window.open` for a same-tab `navigate()` call. This
 * only affects the very next `window.open` invocation (restored inside the
 * wrapper, before the app's own listener even runs), and only ever runs while
 * the tour is driving the click itself.
 */
function openFirstRowInSameTab(navigate: NavigateFunction, tableSelector = ".ant-table-tbody tr[data-row-key]") {
  const row = document.querySelector<HTMLElement>(tableSelector);
  if (!row) return;
  const originalOpen = window.open;
  window.open = ((url?: string | URL) => {
    window.open = originalOpen;
    if (url) {
      const target = typeof url === "string" ? url : url.toString();
      const path = target.startsWith(window.location.origin) ? target.slice(window.location.origin.length) : target;
      navigate(path);
    }
    return null;
  }) as typeof window.open;
  row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

/** Selects the first row of an in-page table (no navigation involved). */
function clickFirstRow(tableSelector: string) {
  document.querySelector<HTMLElement>(`${tableSelector} .ant-table-tbody tr[data-row-key]`)?.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}

/** Switches to an antd Tabs pane by matching its (visible) label text. */
function clickTabByLabel(labelSubstring: string) {
  const tab = Array.from(document.querySelectorAll<HTMLElement>(".ant-tabs-tab")).find((el) =>
    el.textContent?.includes(labelSubstring),
  );
  tab?.querySelector<HTMLElement>(".ant-tabs-tab-btn")?.click();
}

/**
 * `route` marks steps whose target only exists on a specific page — the tour
 * navigates there before showing them. Steps without `route` target the
 * sidebar, which is mounted on every route, so no navigation is needed.
 */
const rawSteps: TourStep[] = [
  {
    target: "body",
    placement: "center",
    title: "Bienvenido a AcademyHub",
    content: "Este recorrido te muestra cómo consultar usuarios, grupos, cursos e informes. Puedes cerrarlo en cualquier momento y repetirlo desde Ayuda.",
  },
  {
    target: 'a[href="/"]',
    content: "Home: la pantalla de inicio de la aplicación.",
  },
  {
    target: 'a[href="/users"]',
    content: "Usuarios: busca y consulta la ficha de cualquier alumno. Vamos a verlo.",
  },
  {
    route: "/users",
    target: "#users-search",
    content: "Busca por nombre, apellido, email, DNI, centro o empresa. Los desplegables de al lado filtran por empresa, centro y tipo de formación.",
  },
  {
    route: "/users",
    target: ".ant-table-thead",
    content: "Un clic en cualquier fila abre la ficha completa del usuario en una pestaña nueva. En este tour la abrimos aquí mismo para que la veas.",
  },
  {
    route: "/users",
    beforeShow: (navigate) => openFirstRowInSameTab(navigate),
    target: "#user-detail-tabs",
    content: "Esta es la ficha del usuario: Datos, Empresa/Centros, Moodle y Cursos (con certificados de asistencia). Cámbiate de pestaña para ver cada bloque.",
  },
  {
    target: 'a[href="/groups"]',
    content: "Grupos: consulta los grupos de formación y sus alumnos matriculados.",
  },
  {
    route: "/groups",
    target: "#groups-search",
    content: "Busca un grupo por nombre. Al abrir uno verás sus alumnos y podrás enviarles un correo seleccionándolos y pulsando \"Correo\".",
  },
  {
    target: 'a[href="/courses"]',
    content: "Cursos: consulta el catálogo de cursos y sus grupos.",
  },
  {
    route: "/courses",
    target: "#courses-type-segmented",
    content: "Filtra el catálogo por tipo de financiación: Pública, FUNDAE, Privada o Sin clasificar.",
  },
  {
    route: "/courses",
    target: "#courses-search",
    content: "Vamos a abrir un curso para ver su ficha, sus grupos y los alumnos de un grupo.",
  },
  {
    route: "/courses",
    beforeShow: (navigate) => openFirstRowInSameTab(navigate),
    target: "#groups-table .ant-table-thead",
    content: "Esta es la ficha del curso. A la izquierda están sus grupos, con fechas de inicio y fin.",
  },
  {
    beforeShow: () => clickFirstRow("#groups-table"),
    target: "#group-users-table .ant-table-thead",
    content: "Y a la derecha, los alumnos del grupo que selecciones: progreso, tiempo usado y estado (o \"Finalizado\" en cursos presenciales). El botón \"Correo\" de arriba envía un mensaje a los que selecciones.",
  },
  {
    target: 'a[href="/companies"]',
    content: "Empresas: consulta las empresas y sus centros asociados.",
  },
  {
    target: 'a[href="/centers"]',
    content: "Centros: consulta los centros de trabajo y sus alumnos.",
  },
  {
    target: 'a[href="/course-requests"]',
    content: "Peticiones: consulta las peticiones de formación por centro. Vamos a abrir una.",
  },
  {
    route: "/course-requests",
    target: '[data-tour="course-requests-status"]',
    content: "Filtra las peticiones por Abiertas, Cerradas o Todas.",
  },
  {
    route: "/course-requests",
    beforeShow: (navigate) => openFirstRowInSameTab(navigate, "#course-requests-table .ant-table-tbody tr[data-row-key]"),
    target: "#course-request-detail-tabs",
    content: "Esta es la ficha de una petición: sus datos (centro, curso, contacto) y la lista de alumnos solicitados.",
  },
  {
    beforeShow: () => clickTabByLabel("Alumnos"),
    target: "#course-request-students-table .ant-table-thead",
    content: "Aquí están los alumnos de la petición, con sus datos y el grupo al que se les ha asignado (si ya se les asignó alguno).",
  },
  {
    target: 'a[href="/reports"]',
    content: "Informes: genera y exporta los informes SEPE/FUNDAE. Vamos a ver cómo se filtran.",
  },
  {
    route: "/reports",
    target: "#reports-search",
    content: "Busca por nombre, apellidos, email, DNI, NSS o teléfono.",
  },
  {
    route: "/reports",
    target: '[data-tour="reports-curso"]',
    content: "Elige un curso para acotar el informe.",
  },
  {
    route: "/reports",
    target: '[data-tour="reports-grupo"]',
    content: "El filtro de Grupo se activa en cuanto eliges un curso, y solo lista los grupos de ese curso.",
  },
  {
    route: "/reports",
    target: '[data-tour="reports-rol"]',
    content: "Por defecto se filtra por el rol \"student\" (alumnos), pero puedes cambiarlo.",
  },
  {
    route: "/reports",
    target: '[data-tour="reports-exportar"]',
    content: "Con el filtro aplicado, elige el tipo de PDF (Dedicación, Certificado o Bonificada) o exporta a Excel, y pulsa \"Generar\".",
  },
  {
    target: 'a[href="/help"]',
    content: "Ayuda: aquí puedes volver a leer el manual completo con capturas, y repetir este tour cuando quieras.",
  },
];

/**
 * Default every step to `placement: "auto"` (floating-ui picks whichever side
 * fits, flipping away from the viewport edge) unless a step already sets its
 * own — e.g. the welcome step's `"center"`. Several targets sit near the
 * bottom of the page (table rows, the export button), and a fixed "bottom"
 * placement pushed their tooltip past the viewport edge, unreachable/unreadable.
 */
const steps: TourStep[] = rawSteps.map((step) => ({ placement: "auto", ...step }));

export default function SidebarTour() {
  const { isTourOpen, stopTour } = useTour();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (isTourOpen) setStepIndex(0);
  }, [isTourOpen]);

  if (isMobile) return null;

  const goToIndex = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= steps.length) {
      stopTour();
      setStepIndex(0);
      return;
    }
    const nextStep = steps[nextIndex];
    if (nextStep.route && nextStep.route !== location.pathname) {
      navigate(nextStep.route);
    }
    nextStep.beforeShow?.(navigate);
    setStepIndex(nextIndex);
  };

  const handleEvent = (data: EventData) => {
    const { status, action, index, type } = data;
    if (status === STATUS.SKIPPED || status === STATUS.FINISHED) {
      stopTour();
      setStepIndex(0);
      return;
    }
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      goToIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }
  };

  return (
    <Joyride
      run={isTourOpen}
      steps={steps}
      stepIndex={stepIndex}
      onEvent={handleEvent}
      continuous
      scrollToFirstStep
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "Finalizar",
        next: "Siguiente",
        nextWithProgress: "Siguiente ({current} de {total})",
        skip: "Saltar",
      }}
      options={{
        showProgress: true,
        primaryColor: "#1677ff",
        zIndex: 10000,
        buttons: ["back", "close", "skip", "primary"],
        targetWaitTimeout: 5000,
        skipBeacon: true,
      }}
    />
  );
}
