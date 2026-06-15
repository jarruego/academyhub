import { ImportService } from './import.service';
import { FUNDAE_DEFAULT_EDUCATION_LEVEL } from './education-level.util';
import { Gender } from '../../types/user/gender.enum';

// buildUserUpdates y findSimilarUsers son métodos puros (no tocan BD cuando el
// cache está poblado), así que instanciamos el servicio con un db ficticio y
// accedemos a los métodos privados vía cast.
const makeService = () => new ImportService({} as any);

describe('ImportService.buildUserUpdates (fill-gaps + overwrite)', () => {
  let svc: any;
  beforeEach(() => { svc = makeService(); });

  const build = (existing: any, data: any, options: any = {}) =>
    svc.buildUserUpdates(existing, data, options);

  it('rellena todos los campos vacíos desde el CSV', () => {
    const data = {
      salary_group: 5, gender: Gender.FEMALE, job_position: 'Dev',
      birth_date: new Date('1990-01-01'), nss: '123', email: 'a@b.c',
      education_level: '4', phone: '600',
    };
    const updates = build({}, data);
    expect(updates).toEqual({
      salary_group: 5, gender: Gender.FEMALE, job_position: 'Dev',
      birth_date: data.birth_date, nss: '123', email: 'a@b.c',
      education_level: '4', phone: '600',
    });
  });

  it('no sobreescribe campos ya presentes sin flags de overwrite', () => {
    const existing = {
      salary_group: 9, gender: Gender.MALE, job_position: 'Mgr',
      birth_date: new Date('1980-05-05'), nss: '999', email: 'x@y.z',
      education_level: '7', phone: '611',
    };
    const data = {
      salary_group: 5, gender: Gender.FEMALE, job_position: 'Dev',
      birth_date: new Date('1990-01-01'), nss: '123', email: 'a@b.c',
      education_level: '4', phone: '600',
    };
    expect(build(existing, data)).toEqual({});
  });

  it("trata gender 'Other' como desconocido y lo rellena", () => {
    // education_level en BD para aislar el caso (si no, el default '10' también se rellenaría)
    expect(build({ gender: Gender.OTHER, education_level: '7' }, { gender: Gender.MALE })).toEqual({ gender: Gender.MALE });
  });

  it('trata salary_group 0 como vacío y lo rellena', () => {
    expect(build({ salary_group: 0, education_level: '7' }, { salary_group: 3 })).toEqual({ salary_group: 3 });
  });

  it('rellena education_level con el default FUNDAE cuando no hay valor en CSV ni BD', () => {
    expect(build({}, {})).toEqual({ education_level: FUNDAE_DEFAULT_EDUCATION_LEVEL });
  });

  it('overwriteEducationLevel pisa un valor existente solo con un código real del CSV', () => {
    expect(build({ education_level: '7' }, { education_level: '4' }, { overwriteEducationLevel: true }))
      .toEqual({ education_level: '4' });
    // sin flag, no se toca
    expect(build({ education_level: '7' }, { education_level: '4' })).toEqual({});
    // el default nunca pisa, aunque el flag esté activo y no haya código en CSV
    expect(build({ education_level: '7' }, {}, { overwriteEducationLevel: true })).toEqual({});
  });

  it('los flags de overwrite fuerzan el valor del CSV', () => {
    const existing = { salary_group: 9, gender: Gender.MALE, birth_date: new Date('1980-05-05') };
    const data = { salary_group: 5, gender: Gender.FEMALE, birth_date: new Date('1990-01-01') };
    const updates = build(existing, data, {
      overwriteSalaryGroup: true, overwriteGender: true, overwriteBirthDate: true,
    });
    expect(updates.salary_group).toBe(5);
    expect(updates.gender).toBe(Gender.FEMALE);
    expect(updates.birth_date).toEqual(data.birth_date);
  });

  it('overwriteBirthDate no actualiza si es el mismo día', () => {
    const existing = { birth_date: new Date('1990-01-01T10:00:00') };
    const data = { birth_date: new Date('1990-01-01T23:00:00') };
    expect(build(existing, data, { overwriteBirthDate: true }).birth_date).toBeUndefined();
  });

  it('nunca actualiza nombre, apellidos ni DNI', () => {
    const updates = build({}, { name: 'X', first_surname: 'Y', second_surname: 'Z', dni: 'D' });
    expect(updates).not.toHaveProperty('name');
    expect(updates).not.toHaveProperty('first_surname');
    expect(updates).not.toHaveProperty('second_surname');
    expect(updates).not.toHaveProperty('dni');
  });
});

describe('ImportService.findSimilarUsers (similitud + filtro DNI/NSS)', () => {
  let svc: any;
  beforeEach(() => { svc = makeService(); });

  const seed = (users: any[]) => {
    svc.usersByIdCache = new Map(users.map((u) => [u.id_user, u]));
  };

  const U = (over: any) => ({ id_user: 1, name: 'Juan', first_surname: 'Perez', second_surname: 'Lopez', dni: '', nss: '', ...over });

  it('devuelve match con score ~1 para nombre idéntico', async () => {
    seed([U({ id_user: 1, dni: '11111111A', nss: '111' })]);
    const res = await svc.findSimilarUsers({ name: 'Juan', first_surname: 'Perez', second_surname: 'Lopez', dni: '11111111A', nss: '111' });
    expect(res).toHaveLength(1);
    expect(res[0].user_id).toBe(1);
    expect(res[0].similarity_score).toBeGreaterThanOrEqual(0.9);
  });

  it('no devuelve nada para un nombre claramente distinto', async () => {
    seed([U({})]);
    const res = await svc.findSimilarUsers({ name: 'Maria', first_surname: 'Gomez', second_surname: 'Ruiz', dni: '22222222B', nss: '222' });
    expect(res).toHaveLength(0);
  });

  it('descarta el match si DNI y NSS son ambos distintos (persona diferente)', async () => {
    seed([U({ dni: '99999999Z', nss: '999' })]);
    const res = await svc.findSimilarUsers({ name: 'Juan', first_surname: 'Perez', second_surname: 'Lopez', dni: '11111111A', nss: '111' });
    expect(res).toHaveLength(0);
  });

  it('NO descarta si solo difiere el DNI (el CSV no trae NSS)', async () => {
    seed([U({ dni: '99999999Z', nss: '999' })]);
    const res = await svc.findSimilarUsers({ name: 'Juan', first_surname: 'Perez', second_surname: 'Lopez', dni: '11111111A' });
    expect(res).toHaveLength(1);
  });

  it('ordena los resultados por similitud descendente', async () => {
    seed([
      U({ id_user: 1, name: 'Juan', first_surname: 'Perez', second_surname: 'Lopez' }),
      U({ id_user: 2, name: 'Juan', first_surname: 'Perez', second_surname: 'Lopezz' }),
    ]);
    const res = await svc.findSimilarUsers({ name: 'Juan', first_surname: 'Perez', second_surname: 'Lopez' });
    expect(res.length).toBeGreaterThanOrEqual(2);
    expect(res[0].user_id).toBe(1);
    expect(res[0].similarity_score).toBeGreaterThanOrEqual(res[1].similarity_score);
  });

  it('ignora usuarios con nombre más corto que MIN_NAME_LENGTH', async () => {
    seed([U({ id_user: 1, name: 'Jo', first_surname: '', second_surname: '' })]);
    const res = await svc.findSimilarUsers({ name: 'Jo', first_surname: '', second_surname: '' });
    expect(res).toHaveLength(0);
  });

  it('usa el nombre precalculado (__simName) si está presente y devuelve el mismo match', async () => {
    // Estado tras preload: objeto con __simName/__simLen ya calculados
    seed([{ id_user: 1, name: 'Juan', first_surname: 'Perez', second_surname: 'Lopez', dni: '', nss: '', __simName: 'juan perez lopez', __simLen: 16 }]);
    const res = await svc.findSimilarUsers({ name: 'Juan', first_surname: 'Perez', second_surname: 'Lopez' });
    expect(res).toHaveLength(1);
    expect(res[0].user_id).toBe(1);
  });

  it('no casa nombres con longitudes muy dispares (pre-filtro por longitud)', async () => {
    seed([U({ id_user: 1, name: 'Juanito', first_surname: 'Perez', second_surname: 'Lopezzzzzzzzz' })]);
    const res = await svc.findSimilarUsers({ name: 'Ana', first_surname: 'Gil', second_surname: '' });
    expect(res).toHaveLength(0);
  });
});
