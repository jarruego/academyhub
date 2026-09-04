export enum CandidateSource {
  MANUAL = "MANUAL",
  OPERATIONAL_EXCEL = "EXCEL_OPERATIVO",
  COURSE_INTEREST = "INTERES_CURSO",
  INAEM_IMPORT = "IMPORTACION_INAEM",
}

export enum CandidateProcessStatus {
  PENDING = "PENDIENTE",
  SELECTED = "SELECCIONADA",
  RESERVE = "RESERVA",
  WITHDRAWN = "BAJA",
  // Antes "NO_SELECCIONADA" — mismo estado, renombrado.
  NOT_SELECTED = "DESCARTADA",
}

export enum CandidateEmploymentStatus {
  UNEMPLOYED = "DESEMPLEO",
  EMPLOYED = "OCUPADO",
  OTHER = "OTRO",
}

export enum CandidateAttendanceStatus {
  PENDING = "PENDIENTE",
  CONFIRMED = "SI",
  DECLINED = "NO",
}
