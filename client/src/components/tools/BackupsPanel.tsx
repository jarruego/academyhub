import { Alert, App, Button, Card, Collapse, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloudDownloadOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { AuthzHide } from '../permissions/authz-hide';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { STATUS_COLORS } from '../../theme/semantic-colors';
import { formatDateTime } from '../../utils/format';
import {
  useBackupListQuery,
  useBackupStatusQuery,
  type BackupFile,
  type BackupRun,
} from '../../hooks/api/backups/use-backups.query';
import { useDownloadBackupMutation, useRunBackupMutation } from '../../hooks/api/backups/use-backups.mutation';

export function runStatusTag(run: BackupRun) {
  if (run.status !== 'completed') return <Tag color={STATUS_COLORS.processing}>En curso</Tag>;
  if (run.conclusion === 'success') return <Tag color={STATUS_COLORS.active}>Correcta</Tag>;
  if (run.conclusion === 'cancelled') return <Tag color={STATUS_COLORS.warning}>Cancelada</Tag>;
  return <Tag color={STATUS_COLORS.inactive}>Fallida</Tag>;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

const EVENT_LABELS: Record<string, string> = {
  schedule: 'Nocturna',
  workflow_dispatch: 'Manual',
};

export default function BackupsPanel() {
  const { message } = App.useApp();
  const status = useBackupStatusQuery();
  const list = useBackupListQuery();
  const runBackup = useRunBackupMutation();
  const downloadBackup = useDownloadBackupMutation();

  const runs = status.data?.runs ?? [];
  const hasRunInProgress = runs.some((r) => r.status !== 'completed');

  const handleRunNow = () => {
    runBackup.mutate(undefined, {
      onSuccess: () => message.success('Copia lanzada. Tardará unos minutos; el estado se actualiza solo.'),
      onError: () => message.error('No se pudo lanzar la copia. Revisa la configuración del token de GitHub.'),
    });
  };

  const handleDownload = (file: BackupFile) => {
    downloadBackup.mutate(file.key, {
      onSuccess: ({ url }) => {
        // URL prefirmada de B2 con content-disposition: attachment → el navegador descarga sin salir de la página
        window.location.assign(url);
        message.success(`Descargando ${file.name} (cifrado; necesitarás tu frase para abrirlo).`);
      },
      onError: () => message.error('No se pudo generar el enlace de descarga.'),
    });
  };

  const runColumns: ColumnsType<BackupRun> = [
    { title: 'Fecha', dataIndex: 'created_at', key: 'created_at', width: 150, render: (v: string) => formatDateTime(v, '—') },
    { title: 'Resultado', key: 'result', width: 110, render: (_, run) => runStatusTag(run) },
    { title: 'Origen', dataIndex: 'event', key: 'event', width: 100, render: (v: string) => EVENT_LABELS[v] ?? v },
    { title: 'Duración', dataIndex: 'duration_seconds', key: 'duration', width: 110, render: (v: number | null) => formatDuration(v) },
    {
      title: '',
      key: 'link',
      width: 120,
      render: (_, run) => (
        <Typography.Link href={run.html_url} target="_blank" rel="noopener noreferrer">
          Ver en GitHub
        </Typography.Link>
      ),
    },
  ];

  const fileColumns: ColumnsType<BackupFile> = [
    { title: 'Fichero', dataIndex: 'name', key: 'name' },
    {
      title: 'Tipo',
      dataIndex: 'kind',
      key: 'kind',
      width: 90,
      render: (kind: BackupFile['kind']) =>
        kind === 'monthly' ? <Tag color="geekblue">Mensual</Tag> : <Tag color={STATUS_COLORS.neutral}>Diaria</Tag>,
    },
    { title: 'Fecha', dataIndex: 'last_modified', key: 'last_modified', width: 150, render: (v: string | null) => formatDateTime(v, '—') },
    { title: 'Tamaño', dataIndex: 'size', key: 'size', width: 100, render: (v: number) => formatSize(v) },
    {
      title: 'Acciones',
      key: 'actions',
      width: 130,
      render: (_, file) => (
        <Button
          size="small"
          icon={<CloudDownloadOutlined />}
          loading={downloadBackup.isPending && downloadBackup.variables === file.key}
          onClick={() => handleDownload(file)}
        >
          Descargar
        </Button>
      ),
    },
  ];

  return (
    <AuthzHide roles={[Role.ADMIN]}>
      <Card
        title="Copias de seguridad"
        bordered
        style={{ margin: '0 auto' }}
        extra={
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                status.refetch();
                list.refetch();
              }}
            >
              Actualizar
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={runBackup.isPending}
              disabled={hasRunInProgress || status.data?.github_configured === false}
              onClick={handleRunNow}
            >
              Hacer copia ahora
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {status.data?.github_configured === false && (
            <Alert
              type="warning"
              showIcon
              message="Estado del workflow no disponible"
              description="Falta configurar GITHUB_BACKUP_TOKEN (y opcionalmente GITHUB_BACKUP_REPO) en las variables de entorno del servidor."
            />
          )}
          {(status.data?.s3_configured === false || list.data?.s3_configured === false) && (
            <Alert
              type="warning"
              showIcon
              message="Listado de copias no disponible"
              description="Faltan las variables BACKUP_S3_* (endpoint, credenciales de solo lectura y bucket) en el servidor."
            />
          )}
          {runs.length > 0 && runs[0].status === 'completed' && runs[0].conclusion !== 'success' && (
            <Alert
              type="error"
              showIcon
              message="La última copia falló"
              description="Revisa el detalle en GitHub (enlace en la tabla). Mientras tanto sigue disponible la última copia correcta."
            />
          )}

          <div>
            <Typography.Title level={5}>Últimas ejecuciones</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              La copia nocturna se lanza automáticamente cada madrugada. Aquí se ven las últimas ejecuciones del
              workflow (nocturnas y manuales).
            </Typography.Paragraph>
            <Table<BackupRun>
              rowKey="id"
              size="small"
              columns={runColumns}
              dataSource={runs}
              loading={status.isLoading || status.isFetching}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </div>

          <div>
            <Typography.Title level={5}>Copias disponibles</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              Ficheros de base de datos guardados en el almacén externo: las diarias se conservan 30 días y la del
              día 1 de cada mes, 12 meses. Se descargan cifrados: para restaurarlos hace falta la frase de cifrado,
              que no está en esta aplicación.
            </Typography.Paragraph>
            <Table<BackupFile>
              rowKey="key"
              size="small"
              columns={fileColumns}
              dataSource={list.data?.backups ?? []}
              loading={list.isLoading || list.isFetching}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              scroll={{ x: 'max-content' }}
            />
          </div>
          <Collapse
            items={[
              {
                key: 'que-es',
                label: '¿Qué es esta copia de seguridad?',
                children: (
                  <Typography>
                    <Typography.Paragraph>
                      Cada fichero <Typography.Text code>db-AAAA-MM-DD.dump.gpg</Typography.Text> es un volcado{' '}
                      <strong>completo</strong> de la base de datos (usuarios, cursos, grupos, empresas, centros,
                      configuración…) tal y como estaba esa madrugada. Se genera automáticamente cada noche mediante
                      GitHub Actions y se guarda en un almacén externo (Backblaze), independiente de los servidores de
                      la aplicación: aunque la aplicación o su base de datos desaparecieran, estas copias sobreviven.
                    </Typography.Paragraph>
                    <ul>
                      <li>
                        Retención "abuelo-padre-hijo": las copias <strong>diarias</strong> se conservan{' '}
                        <strong>30 días</strong>, y la del día 1 de cada mes se guarda como <strong>mensual</strong>{' '}
                        durante <strong>12 meses</strong>. Las más antiguas se borran solas.
                      </li>
                      <li>
                        Los ficheros (logos, firmas, imágenes de plantillas de correo) se copian aparte, en la carpeta{' '}
                        <Typography.Text code>storage/</Typography.Text> del mismo almacén.
                      </li>
                      <li>
                        Las copias viajan <strong>cifradas</strong>: sin la frase de cifrado son ilegibles. Esa frase{' '}
                        <strong>no está en esta aplicación</strong> — guárdala en un gestor de contraseñas; si se
                        pierde, las copias no se pueden abrir.
                      </li>
                    </ul>
                  </Typography>
                ),
              },
              {
                key: 'restaurar',
                label: 'Cómo restaurar una copia manualmente',
                children: (
                  <Typography>
                    <Typography.Paragraph>
                      La restauración es <strong>siempre manual y a propósito</strong> (no existe un botón de
                      restaurar: sería demasiado peligroso). Hazla con calma y, salvo emergencia real, primero sobre
                      una base de datos de prueba — nunca directamente sobre producción.
                    </Typography.Paragraph>
                    <ol>
                      <li>
                        <strong>Descarga</strong> la copia con el botón de la tabla superior.
                      </li>
                      <li>
                        <strong>Descífrala</strong> en tu ordenador (te pedirá la frase de cifrado):
                        <pre style={{ margin: '8px 0' }}>gpg -o db-restore.dump -d db-AAAA-MM-DD.dump.gpg</pre>
                      </li>
                      <li>
                        <strong>Restáurala en una base de datos vacía</strong> (PostgreSQL 17 o superior):
                        <pre style={{ margin: '8px 0' }}>
                          pg_restore --no-owner --no-privileges -d "URL_DE_LA_BD_DESTINO" db-restore.dump
                        </pre>
                      </li>
                      <li>
                        <strong>Verifica</strong> que los datos son correctos (usuarios, cursos…) y solo entonces
                        decide los pasos siguientes.
                      </li>
                    </ol>
                    <Typography.Paragraph>
                      <strong>Los ficheros de Storage se restauran aparte</strong>: esta restauración solo cubre la
                      base de datos. Los ficheros (logos, firmas, imágenes de correo) están en la carpeta{' '}
                      <Typography.Text code>storage/</Typography.Text> del almacén externo y se recuperan copiándolos
                      de vuelta al bucket de Supabase (con <Typography.Text code>rclone</Typography.Text> o
                      descargándolos desde la web de Backblaze y subiéndolos a mano).
                    </Typography.Paragraph>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      El procedimiento detallado (incluida la copia local de desarrollo con Docker) está en{' '}
                      <Typography.Text code>docs/backups.md</Typography.Text> del repositorio. Al terminar, borra el
                      fichero descifrado: contiene datos personales sin proteger.
                    </Typography.Paragraph>
                  </Typography>
                ),
              },
            ]}
          />
        </Space>
      </Card>
    </AuthzHide>
  );
}
