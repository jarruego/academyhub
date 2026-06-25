import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from 'antd';
import ForumDuplicator from './ForumDuplicator';

vi.mock('../../hooks/api/courses/use-courses.query', () => ({
  useCoursesQuery: () => ({ data: [{ id_course: 1, course_name: 'Curso X', short_name: 'CX', moodle_id: 99 }], isLoading: false }),
}));
vi.mock('../../hooks/api/forum/use-course-forums.query', () => ({
  useCourseForumsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../hooks/api/forum/use-course-groups-with-tutors.query', () => ({
  useCourseGroupsWithTutorsQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../hooks/api/forum/use-forum-duplicate.mutation', () => ({
  useForumPreviewMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useForumExecuteMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('<ForumDuplicator/>', () => {
  it('muestra el paso de curso y oculta las acciones hasta elegir curso', async () => {
    cleanup();
    render(
      <App>
        <MemoryRouter>
          <ForumDuplicator />
        </MemoryRouter>
      </App>,
    );

    expect(await screen.findByText('Duplicado de Foros')).toBeDefined();
    expect(screen.getByText('1. Curso')).toBeDefined();
    // Sin curso seleccionado no se muestran los pasos siguientes ni el botón de previsualizar.
    expect(screen.queryByText('2. Foros a duplicar')).toBeNull();
    expect(screen.queryByText('Previsualizar')).toBeNull();
  });
});
