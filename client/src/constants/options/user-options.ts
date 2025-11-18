export const SALARY_GROUP_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1 - Ingenieros y Licenciados' },
  { value: 2, label: '2 - Ingenieros técnicos, Peritos y Ayudantes titulados' },
  { value: 3, label: '3 - Jefes administrativos y de taller' },
  { value: 4, label: '4 - Ayudantes no titulados' },
  { value: 5, label: '5 - Oficiales administrativos' },
  { value: 6, label: '6 - Subalternos' },
  { value: 7, label: '7 - Auxiliares administrativos' },
  { value: 8, label: '8 - Oficiales de primera y segunda' },
  { value: 9, label: '9 - Oficiales de tercera y especialistas' },
  { value: 10, label: '10 - Trabajadores mayores de 18 años no cualificados' },
  { value: 11, label: '11 - Trabajadores menores de dieciocho años' },
];

export const EDUCATION_LEVEL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1 - Menos que primaria' },
  { value: 2, label: '2 - Educación primaria' },
  { value: 3, label: '3 - Primera etapa de educación secundaria' },
  { value: 4, label: '4 - Segunda etapa de educación secundaria' },
  { value: 5, label: '5 - Educación postsecundaria no superior' },
  { value: 6, label: '6 - Técnico Superior/FP grado superior y equivalentes' },
  { value: 7, label: '7 - E. universitarios 1º ciclo (Diplomatura-Grados)' },
  { value: 8, label: '8 - E. universitarios 2º ciclo (Licenciatura-Máster)' },
  { value: 9, label: '9 - E. universitarios 3º ciclo (Doctorado)' },
  { value: 10, label: '10 - Otras titulaciones' },
];

export default {
  SALARY_GROUP_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
};
