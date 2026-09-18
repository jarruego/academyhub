import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

// Mapea (o remapea) el puesto de un trabajador de este centro al catálogo,
// desde la propia evaluación de competencias (acceso externo por token).
// OJO: el mapeo es global (mismo texto de puesto puede venir de otros
// centros) — invalida el roster de competencias de ESTE centro, que es lo
// único que la vista puede ver, pero el cambio en sí afecta a todos.
export const useUpsertConsultingCentroJobPositionAliasMutation = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ job_position, id_job_position }: { job_position: string; id_job_position: number }) => (await request({
            method: 'PUT',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/job-position-aliases`,
            data: { job_position, id_job_position },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-centro-competencies', id_annual_engagement] });
        },
    });
};
