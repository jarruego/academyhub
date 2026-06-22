import { ForumService } from './forum.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Mocks finos: ForumService solo orquesta MoodleService + repositorios.
const makeService = (overrides: {
  moodle?: Partial<Record<string, jest.Mock>>;
  course?: Partial<Record<string, jest.Mock>>;
  group?: Partial<Record<string, jest.Mock>>;
  userGroup?: Partial<Record<string, jest.Mock>>;
  moodleUser?: Partial<Record<string, jest.Mock>>;
  authUser?: Partial<Record<string, jest.Mock>>;
} = {}) => {
  const moodle = { getCourseForums: jest.fn(), getForumDiscussions: jest.fn(), getDiscussionPosts: jest.fn(), addForumDiscussion: jest.fn(), resolveMoodleToken: jest.fn().mockResolvedValue('ORGTOK'), downloadFile: jest.fn(), uploadToDraftArea: jest.fn(), ...overrides.moodle } as any;
  const course = { findById: jest.fn(), ...overrides.course } as any;
  const group = { findGroupsByCourseId: jest.fn(), ...overrides.group } as any;
  const userGroup = { findGroupTutors: jest.fn(), ...overrides.userGroup } as any;
  const moodleUser = { findByUserId: jest.fn(), ...overrides.moodleUser } as any;
  const authUser = { findTopMoodleLinkByMoodleUserId: jest.fn(), ...overrides.authUser } as any;
  return { svc: new ForumService(moodle, course, group, userGroup, moodleUser, authUser), moodle, course, group, userGroup, moodleUser, authUser };
};

describe('ForumService', () => {
  describe('getCourseForums', () => {
    it('lanza NotFound si el curso local no existe', async () => {
      const { svc, course } = makeService({ course: { findById: jest.fn().mockResolvedValue(null) } });
      await expect(svc.getCourseForums(1)).rejects.toBeInstanceOf(NotFoundException);
      expect(course.findById).toHaveBeenCalledWith(1);
    });

    it('lanza BadRequest si el curso no tiene moodle_id', async () => {
      const { svc } = makeService({ course: { findById: jest.fn().mockResolvedValue({ course_name: 'X', moodle_id: null }) } });
      await expect(svc.getCourseForums(1)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resuelve moodle_id y mapea los foros', async () => {
      const { svc, moodle } = makeService({
        course: { findById: jest.fn().mockResolvedValue({ course_name: 'X', moodle_id: 99 }) },
        moodle: { getCourseForums: jest.fn().mockResolvedValue([{ id: 5, name: 'Foro 1', type: 'qanda', intro: '<p>hola</p>', numdiscussions: 3 }]) },
      });
      const res = await svc.getCourseForums(1);
      expect(moodle.getCourseForums).toHaveBeenCalledWith(99);
      expect(res).toEqual([{ id: 5, name: 'Foro 1', type: 'qanda', intro: '<p>hola</p>', numDiscussions: 3 }]);
    });

    it('numDiscussions = null cuando Moodle no lo informa', async () => {
      const { svc } = makeService({
        course: { findById: jest.fn().mockResolvedValue({ course_name: 'X', moodle_id: 99 }) },
        moodle: { getCourseForums: jest.fn().mockResolvedValue([{ id: 5, name: 'F', type: 'general', intro: '' }]) },
      });
      const res = await svc.getCourseForums(1);
      expect(res[0].numDiscussions).toBeNull();
    });
  });

  describe('getForumDiscussions', () => {
    it('usa `discussion` como discussionId y cae a `id` si falta', async () => {
      const { svc } = makeService({
        moodle: { getForumDiscussions: jest.fn().mockResolvedValue([
          { id: 10, discussion: 42, name: 'Tema A', subject: 'Asunto A', groupid: 7, userfullname: 'Tutor 1', timemodified: 100, numreplies: 2 },
          { id: 11, name: 'Tema B', groupid: -1 },
        ]) },
      });
      const res = await svc.getForumDiscussions(5);
      expect(res[0]).toEqual({ id: 10, discussionId: 42, subject: 'Asunto A', groupid: 7, authorName: 'Tutor 1', timemodified: 100, numreplies: 2 });
      expect(res[1]).toEqual({ id: 11, discussionId: 11, subject: 'Tema B', groupid: -1, authorName: null, timemodified: null, numreplies: null });
    });
  });

  describe('getCourseGroupsWithTutors', () => {
    it('lanza NotFound si el curso no existe', async () => {
      const { svc } = makeService({ course: { findById: jest.fn().mockResolvedValue(null) } });
      await expect(svc.getCourseGroupsWithTutors(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('compone grupos con sus tutores', async () => {
      const tutors = [{ id_user: 3, full_name: 'Ana Pérez', moodle_id: 50, has_token: true }];
      const { svc, userGroup } = makeService({
        course: { findById: jest.fn().mockResolvedValue({ moodle_id: 99 }) },
        group: { findGroupsByCourseId: jest.fn().mockResolvedValue([{ id_group: 1, group_name: 'G1', moodle_id: 200 }]) },
        userGroup: { findGroupTutors: jest.fn().mockResolvedValue(tutors) },
      });
      const res = await svc.getCourseGroupsWithTutors(1);
      expect(userGroup.findGroupTutors).toHaveBeenCalledWith(1);
      expect(res).toEqual([{ id_group: 1, group_name: 'G1', moodle_id: 200, tutors }]);
    });
  });

  describe('previewDuplication', () => {
    // Helper que cablea previewDuplication espiando los métodos del propio
    // servicio (getCourseGroupsWithTutors / getCourseForums / getForumDiscussions).
    const setup = (opts: {
      groups: any[];
      forums?: any[];
      discussionsByForum: Record<number, any[]>;
    }) => {
      const { svc } = makeService({ course: { findById: jest.fn().mockResolvedValue({ moodle_id: 99 }) } });
      jest.spyOn(svc, 'getCourseGroupsWithTutors').mockResolvedValue(opts.groups);
      jest.spyOn(svc, 'getCourseForums').mockResolvedValue(opts.forums ?? []);
      jest.spyOn(svc, 'getForumDiscussions').mockImplementation(async (forumId: number) => opts.discussionsByForum[forumId] ?? []);
      return svc;
    };

    const tutorOk = { id_user: 7, full_name: 'Maria', moodle_id: 871, has_token: true };
    const tutorNoToken = { id_user: 8, full_name: 'Pepe', moodle_id: 900, has_token: false };

    it('crea en grupos sin tema y omite los que ya lo tienen (idempotencia por groupid+asunto)', async () => {
      const svc = setup({
        groups: [
          { id_group: 641, group_name: 'G19', moodle_id: 1069, tutors: [tutorOk] }, // ya tiene el tema
          { id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorOk] }, // no lo tiene
        ],
        forums: [{ id: 2135, name: 'Debate 03.1', type: 'qanda' }],
        discussionsByForum: { 2135: [{ id: 1, discussionId: 5498, subject: 'Debate 03.1', groupid: 1069, authorName: 'Maria', timemodified: 1, numreplies: 37 }] },
      });

      const res = await svc.previewDuplication({ courseId: 739, forumIds: [2135], groupIds: [641, 824] } as any);

      const forum = res.forums[0];
      expect(forum.forumName).toBe('Debate 03.1');
      expect(forum.model).toEqual({ discussionId: 5498, subject: 'Debate 03.1' });
      expect(forum.cells.find((c) => c.id_group === 641)!.status).toBe('skip_exists');
      expect(forum.cells.find((c) => c.id_group === 824)!.status).toBe('create');
      expect(res.summary).toEqual({ toCreate: 1, toSkip: 1, blocked: 0 });
    });

    it('bloquea el grupo cuyo tutor no tiene token', async () => {
      const svc = setup({
        groups: [{ id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorNoToken] }],
        forums: [{ id: 2135, name: 'Debate', type: 'qanda' }],
        discussionsByForum: { 2135: [{ id: 1, discussionId: 5498, subject: 'Debate', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 }] },
      });
      const res = await svc.previewDuplication({ courseId: 739, forumIds: [2135], groupIds: [824] } as any);
      expect(res.forums[0].cells[0].status).toBe('blocked_no_token');
      expect(res.summary.blocked).toBe(1);
    });

    it('bloquea por grupo sin moodle_id', async () => {
      const svc = setup({
        groups: [{ id_group: 824, group_name: 'G20', moodle_id: null, tutors: [tutorOk] }],
        forums: [{ id: 2135, name: 'Debate', type: 'qanda' }],
        discussionsByForum: { 2135: [{ id: 1, discussionId: 5498, subject: 'Debate', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 }] },
      });
      const res = await svc.previewDuplication({ courseId: 739, forumIds: [2135], groupIds: [824] } as any);
      expect(res.forums[0].cells[0].status).toBe('blocked_no_group_moodle_id');
    });

    it('si el foro tiene varios temas exige elegir modelo (blocked_no_model) salvo override', async () => {
      const groups = [{ id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorOk] }];
      const discussions = [
        { id: 1, discussionId: 10, subject: 'Tema A', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 },
        { id: 2, discussionId: 11, subject: 'Tema B', groupid: 1080, authorName: 'y', timemodified: 1, numreplies: 0 },
      ];
      const svc = setup({ groups, forums: [{ id: 2135, name: 'F', type: 'qanda' }], discussionsByForum: { 2135: discussions } });

      const noModel = await svc.previewDuplication({ courseId: 739, forumIds: [2135], groupIds: [824] } as any);
      expect(noModel.forums[0].modelNeedsSelection).toBe(true);
      expect(noModel.forums[0].model).toBeNull();
      expect(noModel.forums[0].cells[0].status).toBe('blocked_no_model');
      expect(noModel.forums[0].availableModels).toHaveLength(2);

      const withModel = await svc.previewDuplication({ courseId: 739, forumIds: [2135], groupIds: [824], models: [{ forumId: 2135, discussionId: 11 }] } as any);
      expect(withModel.forums[0].model).toEqual({ discussionId: 11, subject: 'Tema B' });
      expect(withModel.forums[0].cells[0].status).toBe('create');
    });

    it('respeta el tutor elegido por grupo (override) en grupos multi-tutor', async () => {
      const svc = setup({
        groups: [{ id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorNoToken, tutorOk] }],
        forums: [{ id: 2135, name: 'F', type: 'qanda' }],
        discussionsByForum: { 2135: [{ id: 1, discussionId: 5498, subject: 'X', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 }] },
      });
      // Override al tutor SIN token -> bloqueado, demostrando que respeta la elección.
      const res = await svc.previewDuplication({ courseId: 739, forumIds: [2135], groupIds: [824], tutorByGroup: [{ id_group: 824, id_user: 8 }] } as any);
      expect(res.groups[0].tutorAmbiguous).toBe(true);
      expect(res.groups[0].selectedTutor!.id_user).toBe(8);
      expect(res.forums[0].cells[0].status).toBe('blocked_no_token');
    });
  });

  describe('executeDuplication', () => {
    const tutorOk = { id_user: 7, full_name: 'Maria', moodle_id: 871, has_token: true };

    const setupExec = (opts: {
      groups: any[];
      discussions: any[];
      posts?: any[];
      addResult?: any;
      moodleUser?: any;
      authUser?: any;
    }) => {
      const ctx = makeService({
        course: { findById: jest.fn().mockResolvedValue({ moodle_id: 99 }) },
        moodle: {
          getDiscussionPosts: jest.fn().mockResolvedValue(opts.posts ?? [{ parentid: 0, parent: 0, subject: 'X', message: '<p>cuerpo</p>', messageinlinefiles: [], attachments: [] }]),
          addForumDiscussion: jest.fn().mockResolvedValue(opts.addResult ?? { discussionid: 9999 }),
        },
        moodleUser: { findByUserId: jest.fn().mockResolvedValue(opts.moodleUser === undefined ? [{ id_moodle_user: 5, is_main_user: true }] : opts.moodleUser) },
        authUser: { findTopMoodleLinkByMoodleUserId: jest.fn().mockResolvedValue(opts.authUser === undefined ? { moodle_token: 'TOK' } : opts.authUser) },
      });
      jest.spyOn(ctx.svc, 'getCourseGroupsWithTutors').mockResolvedValue(opts.groups);
      jest.spyOn(ctx.svc, 'getCourseForums').mockResolvedValue([{ id: 2135, name: 'Debate', type: 'qanda' } as any]);
      jest.spyOn(ctx.svc, 'getForumDiscussions').mockResolvedValue(opts.discussions as any);
      return ctx;
    };

    it('crea solo en los grupos `create`, firma con el token del tutor y omite los existentes', async () => {
      const ctx = setupExec({
        groups: [
          { id_group: 641, group_name: 'G19', moodle_id: 1069, tutors: [tutorOk] }, // ya existe
          { id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorOk] }, // crear
        ],
        discussions: [{ id: 1, discussionId: 5498, subject: 'Debate', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 }],
      });

      const res = await ctx.svc.executeDuplication({ courseId: 739, forumIds: [2135], groupIds: [641, 824] } as any);

      // Solo una creación, en el grupo 824 (moodle_id 1090) con el token del tutor.
      expect(ctx.moodle.addForumDiscussion).toHaveBeenCalledTimes(1);
      expect(ctx.moodle.addForumDiscussion).toHaveBeenCalledWith(2135, 'Debate', '<p>cuerpo</p>', 1090, 'TOK');
      expect(res.summary).toEqual({ created: 1, failed: 0, skipped: 1, blocked: 0 });
      expect(res.results[0]).toMatchObject({ status: 'created', discussionId: 9999, id_group: 824 });
      expect(res.results[0].mediaWarning).toBeUndefined();
    });

    it('copia la imagen embebida: descarga, sube al draft del tutor y reescribe a @@PLUGINFILE@@', async () => {
      const imgUrl = 'https://h/webservice/pluginfile.php/58636/mod_forum/post/9/foto.jpg';
      const ctx = setupExec({
        groups: [{ id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorOk] }],
        discussions: [{ id: 1, discussionId: 5498, subject: 'Debate', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 }],
        posts: [{ parentid: 0, parent: 0, subject: 'X', message: `<p><img src="${imgUrl}" /></p>`, messageinlinefiles: [], attachments: [] }],
      });
      ctx.moodle.downloadFile.mockResolvedValue(Buffer.from('IMG'));
      ctx.moodle.uploadToDraftArea.mockResolvedValue({ itemid: 555, filename: 'foto.jpg' });

      const res = await ctx.svc.executeDuplication({ courseId: 739, forumIds: [2135], groupIds: [824] } as any);

      // Descarga con el token de la org; sube al draft con el token del tutor.
      expect(ctx.moodle.downloadFile).toHaveBeenCalledWith(imgUrl, 'ORGTOK');
      expect(ctx.moodle.uploadToDraftArea).toHaveBeenCalledWith(expect.any(Buffer), 'foto.jpg', 'TOK', undefined);
      // El tema se crea con el mensaje reescrito y el inlineattachmentsid del draft.
      expect(ctx.moodle.addForumDiscussion).toHaveBeenCalledWith(
        2135, 'Debate', '<p><img src="@@PLUGINFILE@@/foto.jpg" /></p>', 1090, 'TOK',
        [{ name: 'inlineattachmentsid', value: 555 }],
      );
      expect(res.results[0].status).toBe('created');
      expect(res.results[0].mediaWarning).toBeUndefined();
    });

    it('si falla la descarga de una imagen, crea el tema igualmente y avisa (mediaWarning)', async () => {
      const imgUrl = 'https://h/webservice/pluginfile.php/1/mod_forum/post/9/foto.jpg';
      const ctx = setupExec({
        groups: [{ id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorOk] }],
        discussions: [{ id: 1, discussionId: 5498, subject: 'Debate', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 }],
        posts: [{ parentid: 0, parent: 0, subject: 'X', message: `<p><img src="${imgUrl}" /></p>`, messageinlinefiles: [], attachments: [] }],
      });
      ctx.moodle.downloadFile.mockRejectedValue(new Error('403'));

      const res = await ctx.svc.executeDuplication({ courseId: 739, forumIds: [2135], groupIds: [824] } as any);

      expect(ctx.moodle.uploadToDraftArea).not.toHaveBeenCalled();
      // Se crea sin options (5 args) porque no hubo draft.
      expect(ctx.moodle.addForumDiscussion).toHaveBeenCalledWith(2135, 'Debate', `<p><img src="${imgUrl}" /></p>`, 1090, 'TOK');
      expect(res.results[0].status).toBe('created');
      expect(res.results[0].mediaWarning).toContain('No se pudieron copiar 1');
    });

    it('reporta error sin token y no llama a add_discussion', async () => {
      const ctx = setupExec({
        groups: [{ id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorOk] }],
        discussions: [{ id: 1, discussionId: 5498, subject: 'Debate', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 }],
        authUser: null, // no hay enlace -> sin token
      });
      const res = await ctx.svc.executeDuplication({ courseId: 739, forumIds: [2135], groupIds: [824] } as any);
      expect(ctx.moodle.addForumDiscussion).not.toHaveBeenCalled();
      expect(res.results[0].status).toBe('error');
      expect(res.summary).toMatchObject({ created: 0, failed: 1 });
    });

    it('aísla el error de una celda y continúa con las demás', async () => {
      const ctx = setupExec({
        groups: [
          { id_group: 824, group_name: 'G20', moodle_id: 1090, tutors: [tutorOk] },
          { id_group: 825, group_name: 'G21', moodle_id: 1091, tutors: [tutorOk] },
        ],
        discussions: [{ id: 1, discussionId: 5498, subject: 'Debate', groupid: 1069, authorName: 'x', timemodified: 1, numreplies: 0 }],
      });
      ctx.moodle.addForumDiscussion
        .mockRejectedValueOnce(new Error('Moodle 500'))
        .mockResolvedValueOnce({ discussionid: 1234 });

      const res = await ctx.svc.executeDuplication({ courseId: 739, forumIds: [2135], groupIds: [824, 825] } as any);
      expect(res.summary).toMatchObject({ created: 1, failed: 1 });
      expect(res.results.find((r) => r.id_group === 824)!.status).toBe('error');
      expect(res.results.find((r) => r.id_group === 825)!.status).toBe('created');
    });
  });
});
