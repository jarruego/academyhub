import { mapSageEducationLevel } from './education-level.util';

describe('mapSageEducationLevel', () => {
    describe('por Código nivel (tabla SEPE)', () => {
        it.each([
            ['80', '1'],
            ['12', '2'],
            ['21', '3'],
            ['22', '3'],
            ['23', '3'],
            ['31', '3'],
            ['32', '4'],
            ['33', '4'],
            ['34', '4'],
            ['41', '4'],
            ['56', '5'],
            ['51', '6'],
            ['53', '6'],
            ['54', '7'],
            ['59', '7'],
            ['52', '10'],
        ])('código %s -> FUNDAE %s', (code, expected) => {
            expect(mapSageEducationLevel(code, '')).toBe(expected);
        });

        it('código 0 (no informado) cae al texto libre', () => {
            expect(mapSageEducationLevel('0', 'F.P.GRADO MEDIO')).toBe('4');
        });

        it('código desconocido cae al texto libre', () => {
            expect(mapSageEducationLevel('99', 'LICENCIADA EN MEDICINA')).toBe('8');
        });

        it('el código tiene prioridad sobre el texto', () => {
            expect(mapSageEducationLevel('80', 'LICENCIADO')).toBe('1');
        });
    });

    describe('por texto libre (variantes reales del CSV)', () => {
        it.each([
            // FP grado medio y equivalentes -> 4
            ['F.P.GRADO MEDIO', '4'],
            ['FP GRADO MEDIO', '4'],
            ['GRADO MEDIO', '4'],
            ['FORMACION PROFESIONAL GRADO MEDIO', '4'],
            ['FROMACION PROFESIONAL GRADO MEDIO', '4'], // errata real
            ['ESTUDIOS DE GRADO MEDIO DE FORMACION PORFESIONAL', '4'], // errata real
            ['BACHILLER', '4'],
            ['BACHILLERATO', '4'],
            ['ATENCION SOCIOSANITARIA', '4'],
            ['ATENCION SOCIO SANITARIA', '4'],
            ['INTEGRACION SOCIAL', '4'],
            // Auxiliares: ENFERMERIA no debe arrastrarlos a 7
            ['TECNICO AUXILIAR ENFERMERIA', '4'],
            ['Técnico en Cuidados Auxiliares de Enfermería', '4'],
            ['AUXILIAR DE CLINICA', '4'],
            // Certificados de profesionalidad -> 5
            ['CERTIFICADO PROFESIONALIDAD', '5'],
            ['CERTIFICADO DE PROFESIONALIDAD', '5'],
            ['ESTUDIOS OFICIALES DE ESPECIALIZACIÓN PROFESIONAL', '5'],
            // FP grado superior -> 6
            ['F.P.GRADO SUPERIOR', '6'],
            ['ENSEÑANZAS DE GRADO SUPERIOR DE FORMACIÓ', '6'],
            ['ENS.SUP.FP EQUI.ARTES PLASTICAS Y DISEñO', '6'],
            ['TEC SUPERIOR INTEGRADOR SOCIAL', '6'],
            // Universitarios 1º ciclo -> 7
            ['DIPLOMADA EN ENFERMERIA', '7'],
            ['DIPLOMADO EN FISIOTERAPIA', '7'],
            ['ENSEÑANZAS UNIVERSITARIAS DE PRIMER CICL', '7'],
            ['ENSEÑANZAS UNIVERSITARIAS DE GRADO', '7'],
            ['GRADO EN EDUCACION SOCIAL', '7'],
            ['GRADO EN DERECHO', '7'],
            ['DIPLOMADOS O 3 CURSOS UNIVERSITARIOS', '7'],
            // Universitarios 2º ciclo -> 8
            ['LICENCIADA EN MEDICINA', '8'],
            ['LICENCIADOS O EQUIVALENTES ( 2º CICLO)', '8'],
            ['ENSEÑANZAS UNIVERSITARIAS DE SEGUNDO CIC', '8'],
            // Secundaria 1ª etapa -> 3
            ['GRADUADO ESCOLAR', '3'],
            ['1ª ETAPA ESO CON TIT.GRADUADO O EQUIVAL', '3'],
            ['PRIMERA ETAPA DE EDUCACIÓN SECUNDARIA CO', '3'],
            // Primaria -> 2
            ['ESTUDIOS PRIMARIOS COMPLETOS', '2'],
            ['ESTUDIOS PRIMARIOS', '2'],
            ['CERTIFICADO ESCOLAR', '2'],
            // Sin estudios -> 1
            ['SIN ESTUDIOS', '1'],
        ])('"%s" -> FUNDAE %s', (text, expected) => {
            expect(mapSageEducationLevel('0', text)).toBe(expected);
        });
    });

    describe('sin clasificar', () => {
        it.each([
            [''],
            ['ATS/DUE'],          // es un puesto, no un nivel
            ['TRABAJADORA SOCIAL'],
            ['GRUPO C'],
            ['SUPERIORES'],
            ['ESTUDIOS BASICOS'],
        ])('"%s" -> undefined', (text) => {
            expect(mapSageEducationLevel('0', text)).toBeUndefined();
        });

        it('sin código ni texto -> undefined', () => {
            expect(mapSageEducationLevel(undefined, undefined)).toBeUndefined();
        });
    });
});
