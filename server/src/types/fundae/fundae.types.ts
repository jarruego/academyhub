export type FundaePeriodo = {
  mes: number;
  importe: number;
}

export type FundaeCost = {
  cifagrupada: string;
  directos: number;
  indirectos: number;
  organizacion: number;
  salariales: number;
  periodos?: { periodo: FundaePeriodo[] };
}

export type FundaeParticipant = {
  nif: string;
  // N_TIPO_DOCUMENTO must be numeric in the FUNDAE XML: 10 for DNI, 60 for NIE
  N_TIPO_DOCUMENTO?: number;
  ERTE_RD_ley?: boolean;
  email?: string;
  telefono?: string;
  discapacidad?: boolean;
  afectadosTerrorismo?: boolean;
  afectadosViolenciaGenero?: boolean;
  categoriaprofesional?: string | number;
  nivelestudios?: string | number;
  DiplomaAcreditativo?: string;
  fijoDiscontinuo?: boolean;
}

export type FundaeGroup = {
  idAccion: string;
  idGrupo: string;
  participantes: { participante: FundaeParticipant[] };
  costes?: { coste: FundaeCost[] };
}

export type FundaeRoot = { grupos: { grupo: FundaeGroup } };
