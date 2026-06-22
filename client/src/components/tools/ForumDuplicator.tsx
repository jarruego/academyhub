import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Divider, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AxiosError } from 'axios';
import { useCoursesQuery } from '../../hooks/api/courses/use-courses.query';
import { useCourseForumsQuery } from '../../hooks/api/forum/use-course-forums.query';
import { useCourseGroupsWithTutorsQuery } from '../../hooks/api/forum/use-course-groups-with-tutors.query';
import { useForumPreviewMutation, useForumExecuteMutation } from '../../hooks/api/forum/use-forum-duplicate.mutation';
import {
  CELL_STATUS_META,
  DuplicateForumRequest,
  ExecuteCellResult,
  ForumSummary,
  GroupWithTutors,
  PreviewDuplicationResult,
} from '../../shared/types/forum/forum';

const { Title, Text, Paragraph } = Typography;

interface ApiError { message?: string | string[]; }
const errMsg = (e: unknown): string => {
  const ax = e as AxiosError<ApiError>;
  const m = ax?.response?.data?.message;
  if (Array.isArray(m)) return m.join(', ');
  return m || ax?.message || 'Error inesperado';
};

export default function ForumDuplicator() {
  // Si se llega desde la ficha de curso (?courseId=N), el curso viene fijado y
  // el selector queda deshabilitado.
  const [searchParams] = useSearchParams();
  const lockedCourseId = useMemo(() => {
    const raw = searchParams.get('courseId');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : undefined;
  }, [searchParams]);

  const [courseId, setCourseId] = useState<number | undefined>(lockedCourseId);
  const [forumIds, setForumIds] = useState<number[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [modelByForum, setModelByForum] = useState<Record<number, number>>({});
  const [tutorByGroup, setTutorByGroup] = useState<Record<number, number>>({});
  const [preview, setPreview] = useState<PreviewDuplicationResult | null>(null);
  const [results, setResults] = useState<ExecuteCellResult[] | null>(null);

  const coursesQuery = useCoursesQuery();
  const forumsQuery = useCourseForumsQuery(courseId);
  const groupsQuery = useCourseGroupsWithTutorsQuery(courseId);
  const previewMutation = useForumPreviewMutation();
  const executeMutation = useForumExecuteMutation();

  // Sólo cursos enlazados con Moodle (los foros viven en Moodle).
  const courseOptions = useMemo(
    () => (coursesQuery.data ?? [])
      .filter((c) => c.moodle_id != null)
      .map((c) => ({ value: c.id_course, label: `${c.course_name} (${c.short_name})` })),
    [coursesQuery.data],
  );

  const resetDownstream = () => {
    setForumIds([]); setGroupIds([]); setModelByForum({}); setTutorByGroup({});
    setPreview(null); setResults(null);
  };

  // Sincroniza el curso fijado por URL (al entrar o al cambiar de curso).
  useEffect(() => {
    if (lockedCourseId != null) {
      setCourseId(lockedCourseId);
      resetDownstream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedCourseId]);

  const buildRequest = (): DuplicateForumRequest => ({
    courseId: courseId!,
    forumIds,
    groupIds,
    models: Object.entries(modelByForum).map(([f, d]) => ({ forumId: Number(f), discussionId: d })),
    tutorByGroup: Object.entries(tutorByGroup).map(([g, u]) => ({ id_group: Number(g), id_user: u })),
  });

  const runPreview = () => {
    setResults(null);
    previewMutation.mutate(buildRequest(), {
      onSuccess: setPreview,
      onError: (e) => message.error(errMsg(e)),
    });
  };

  const runExecute = () => {
    const toCreate = preview?.summary.toCreate ?? 0;
    if (toCreate === 0) return;
    if (!window.confirm(`Se crearán ${toCreate} tema(s) en Moodle. ¿Continuar?`)) return;
    executeMutation.mutate(buildRequest(), {
      onSuccess: (res) => {
        setPreview(res.preview);
        setResults(res.results);
        const ok = res.summary.created;
        const ko = res.summary.failed;
        if (ko === 0) message.success(`${ok} tema(s) creado(s) correctamente`);
        else message.warning(`${ok} creado(s), ${ko} con error`);
      },
      onError: (e) => message.error(errMsg(e)),
    });
  };

  // ----- Tabla de foros -----
  const forumColumns: ColumnsType<ForumSummary> = [
    { title: 'Foro', dataIndex: 'name', key: 'name' },
    { title: 'Tipo', dataIndex: 'type', key: 'type', width: 130, render: (t: string) => <Tag color={t === 'qanda' ? 'blue' : 'default'}>{t}</Tag> },
    { title: 'Temas', dataIndex: 'numDiscussions', key: 'numDiscussions', width: 80, render: (n: number | null) => n ?? '—' },
  ];

  // ----- Tabla de grupos -----
  const groupColumns: ColumnsType<GroupWithTutors> = [
    { title: 'Grupo', dataIndex: 'group_name', key: 'group_name' },
    {
      title: 'Tutor(es)',
      key: 'tutors',
      render: (_, g) => {
        if (g.tutors.length === 0) return <Tag color="red">Sin tutor</Tag>;
        if (g.tutors.length === 1) {
          const t = g.tutors[0];
          return <Space size={4}>{t.full_name}{!t.has_token && <Tag color="red">sin token</Tag>}</Space>;
        }
        // Multi-tutor: permitir elegir cuál firma (sólo si el grupo está seleccionado).
        const selected = groupIds.includes(g.id_group);
        return (
          <Select
            size="small"
            style={{ minWidth: 220 }}
            disabled={!selected}
            placeholder="Elige tutor"
            value={tutorByGroup[g.id_group]}
            onChange={(v) => setTutorByGroup((prev) => ({ ...prev, [g.id_group]: v }))}
            options={g.tutors.map((t) => ({ value: t.id_user, label: `${t.full_name}${t.has_token ? '' : ' (sin token)'}` }))}
          />
        );
      },
    },
    { title: 'Moodle', dataIndex: 'moodle_id', key: 'moodle_id', width: 110, render: (m: number | null) => (m == null ? <Tag color="red">no sinc.</Tag> : m) },
  ];

  // ----- Selección de tema modelo (cuando un foro tiene varios temas) -----
  const forumsNeedingModel = (preview?.forums ?? []).filter((f) => f.modelNeedsSelection);

  // moodle_id de grupo -> nombre, para mostrar nombres (no ids) en los modelos.
  const groupNameByMoodleId = useMemo(() => {
    const map = new Map<number, string>();
    for (const g of groupsQuery.data ?? []) if (g.moodle_id != null) map.set(g.moodle_id, g.group_name);
    return map;
  }, [groupsQuery.data]);
  const modelGroupLabel = (groupid: number) => groupNameByMoodleId.get(groupid) ?? `grupo ${groupid}`;

  // ----- Matriz de preview (aplanada) -----
  const previewRows = useMemo(() => {
    if (!preview) return [];
    return preview.forums.flatMap((f) =>
      f.cells.map((c) => ({
        key: `${f.forumId}-${c.id_group}`,
        forumName: f.forumName || String(f.forumId),
        group_name: c.group_name,
        tutor: c.tutor?.full_name ?? '—',
        status: c.status,
        reason: c.reason ?? '',
      })),
    );
  }, [preview]);

  const previewColumns: ColumnsType<(typeof previewRows)[number]> = [
    { title: 'Foro', dataIndex: 'forumName', key: 'forumName' },
    { title: 'Grupo', dataIndex: 'group_name', key: 'group_name' },
    { title: 'Tutor (autor)', dataIndex: 'tutor', key: 'tutor' },
    { title: 'Estado', dataIndex: 'status', key: 'status', width: 150, render: (s: keyof typeof CELL_STATUS_META) => <Tag color={CELL_STATUS_META[s].color}>{CELL_STATUS_META[s].label}</Tag> },
    { title: 'Motivo', dataIndex: 'reason', key: 'reason' },
  ];

  // ----- Tabla de resultados -----
  const resultColumns: ColumnsType<ExecuteCellResult> = [
    { title: 'Foro', dataIndex: 'forumName', key: 'forumName' },
    { title: 'Grupo', dataIndex: 'group_name', key: 'group_name' },
    { title: 'Tutor (autor)', dataIndex: 'tutorName', key: 'tutorName' },
    { title: 'Estado', dataIndex: 'status', key: 'status', width: 120, render: (s: string) => <Tag color={s === 'created' ? 'green' : 'red'}>{s === 'created' ? 'Creado' : 'Error'}</Tag> },
    {
      title: 'Detalle', key: 'detail',
      render: (_, r) => r.status === 'created'
        ? <span>Tema #{r.discussionId}{r.mediaWarning ? <Text type="warning"> · {r.mediaWarning}</Text> : null}</span>
        : <Text type="danger">{r.error}</Text>,
    },
  ];

  const canPreview = courseId != null && forumIds.length > 0 && groupIds.length > 0;

  return (
    <Card title="Duplicado de Foros" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Paragraph type="secondary">
        Replica el tema de los foros seleccionados a todos los grupos elegidos (un tema por grupo),
        en nombre del tutor de cada grupo. Conserva texto, enlaces, vídeos embebidos e imágenes.
      </Paragraph>

      {/* 1. Curso */}
      <Title level={5}>1. Curso</Title>
      <Select
        showSearch
        style={{ width: '100%', maxWidth: 560 }}
        placeholder="Selecciona un curso (sólo cursos enlazados con Moodle)"
        loading={coursesQuery.isLoading}
        value={courseId}
        disabled={lockedCourseId != null}
        optionFilterProp="label"
        options={courseOptions}
        onChange={(v) => { setCourseId(v); resetDownstream(); }}
      />
      {lockedCourseId != null && (
        <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
          Curso fijado desde su ficha.
        </Text>
      )}

      {courseId != null && (
        <>
          {/* 2. Foros */}
          <Divider />
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Title level={5} style={{ margin: 0 }}>2. Foros a duplicar</Title>
            <Button
              size="small"
              onClick={() => setForumIds((forumsQuery.data ?? []).filter((f) => f.type === 'qanda').map((f) => f.id))}
              disabled={!forumsQuery.data?.length}
            >
              Seleccionar sólo pregunta-respuesta
            </Button>
          </Space>
          <Table<ForumSummary>
            rowKey="id"
            size="small"
            style={{ marginTop: 12 }}
            loading={forumsQuery.isLoading}
            columns={forumColumns}
            dataSource={forumsQuery.data ?? []}
            pagination={false}
            scroll={{ y: 280 }}
            rowSelection={{
              selectedRowKeys: forumIds,
              onChange: (keys) => { setForumIds(keys as number[]); setPreview(null); setResults(null); },
            }}
          />

          {/* 3. Grupos y tutores */}
          <Divider />
          <Title level={5}>3. Grupos destino</Title>
          <Table<GroupWithTutors>
            rowKey="id_group"
            size="small"
            loading={groupsQuery.isLoading}
            columns={groupColumns}
            dataSource={groupsQuery.data ?? []}
            pagination={false}
            scroll={{ y: 280 }}
            rowSelection={{
              selectedRowKeys: groupIds,
              onChange: (keys) => { setGroupIds(keys as number[]); setPreview(null); setResults(null); },
            }}
          />

          {/* 4. Previsualizar */}
          <Divider />
          <Space wrap>
            <Button type="default" onClick={runPreview} loading={previewMutation.isPending} disabled={!canPreview}>
              Previsualizar
            </Button>
            {preview && (
              <Button type="primary" danger onClick={runExecute} loading={executeMutation.isPending} disabled={preview.summary.toCreate === 0}>
                Ejecutar ({preview.summary.toCreate} a crear)
              </Button>
            )}
          </Space>

          {/* Selección de modelo cuando un foro tiene varios temas */}
          {forumsNeedingModel.length > 0 && (
            <Alert
              style={{ marginTop: 16 }}
              type="warning"
              showIcon
              message="Algunos foros tienen varios temas: elige el modelo y vuelve a previsualizar"
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  {forumsNeedingModel.map((f) => (
                    <Space key={f.forumId} wrap>
                      <Text>{f.forumName || f.forumId}:</Text>
                      <Select
                        style={{ minWidth: 320 }}
                        placeholder="Elige el tema modelo"
                        value={modelByForum[f.forumId]}
                        onChange={(v) => setModelByForum((prev) => ({ ...prev, [f.forumId]: v }))}
                        options={f.availableModels.map((m) => ({ value: m.discussionId, label: `${m.subject} (${modelGroupLabel(m.groupid)})` }))}
                      />
                    </Space>
                  ))}
                </Space>
              }
            />
          )}

          {/* Resumen + matriz de preview */}
          {preview && (
            <>
              <Alert
                style={{ marginTop: 16 }}
                type={preview.summary.toCreate > 0 ? 'info' : 'warning'}
                showIcon
                message={`Se crearán ${preview.summary.toCreate} · se omiten ${preview.summary.toSkip} (ya existen) · bloqueados ${preview.summary.blocked}`}
              />
              <Table
                rowKey="key"
                size="small"
                style={{ marginTop: 12 }}
                columns={previewColumns}
                dataSource={previewRows}
                pagination={false}
                scroll={{ y: 360 }}
              />
            </>
          )}

          {/* Resultados de ejecución */}
          {results && (
            <>
              <Divider />
              <Title level={5}>Resultado</Title>
              <Table<ExecuteCellResult>
                rowKey={(r) => `${r.forumId}-${r.id_group}`}
                size="small"
                columns={resultColumns}
                dataSource={results}
                pagination={false}
                scroll={{ y: 360 }}
              />
            </>
          )}
        </>
      )}
    </Card>
  );
}
