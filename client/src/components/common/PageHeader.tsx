import { Typography } from "antd";
import { useEffect, type ReactNode } from "react";

interface PageHeaderProps {
  /** Título de la pantalla. */
  title: ReactNode;
  /** Texto de apoyo opcional bajo el título. */
  subtitle?: ReactNode;
  /** Acciones alineadas a la derecha (botones, enlaces…). */
  extra?: ReactNode;
  /**
   * Título de la pestaña del navegador. Solo hace falta cuando difiere del
   * visible (p. ej. el detalle de curso muestra el nombre largo y en la pestaña
   * pone el `short_name`) o cuando `title` no es texto plano.
   */
  documentTitle?: string;
}

/**
 * Cabecera común de las pantallas: título + acciones, y `document.title` en un
 * único sitio.
 *
 * Unifica las cuatro convenciones visuales que convivían antes (`<h1>` en
 * Informes, `<h2 style={{margin:16}}>` en Organización, `<Card title>` o
 * `<Title level={2}>` en las herramientas, y nada en los listados) y absorbe el
 * `useEffect` de `document.title` que cada ruta repetía (y que las herramientas
 * no tenían, dejando la pestaña con el título anterior).
 *
 * El nivel 3 (24 px) es deliberado: es la altura que ya tenían los `<h2>` y no
 * roba espacio vertical en una app densa de gestión. En móvil las acciones se
 * apilan bajo el título (ver `.page-header` en index.css).
 */
export function PageHeader({ title, subtitle, extra, documentTitle }: PageHeaderProps) {
  const tabTitle = documentTitle ?? (typeof title === "string" ? title : undefined);

  useEffect(() => {
    if (!tabTitle) return;
    const previous = document.title;
    document.title = tabTitle;
    // Se restaura al desmontar para que una pantalla sin cabecera no herede el
    // título de la anterior.
    return () => {
      document.title = previous;
    };
  }, [tabTitle]);

  return (
    <div className="page-header">
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      {extra && <div className="page-header__extra">{extra}</div>}
    </div>
  );
}
