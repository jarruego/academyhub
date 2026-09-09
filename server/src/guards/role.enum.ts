export enum Role {
    ADMIN = 'admin',
    MANAGER = 'manager',
    VIEWER = 'viewer',
    TUTOR = 'tutor',
    // De momento con los mismos privilegios que VIEWER (etiqueta propia para
    // diferenciarlo más adelante) — ver docs/security.md.
    CONSULTOR = 'consultor'
}
