// Cliente/comitente de un curso. Debe coincidir con el enum del servidor
// (server/src/types/course/course-client.enum.ts). El ámbito público/privado NO
// se almacena aquí: se deriva de la financiación (course-funding.enum.ts).
export enum CourseClient {
    INAEM = 'INAEM',
    VITALIA = 'VITALIA',
    OTRO = 'OTRO',
}
