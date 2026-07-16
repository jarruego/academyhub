import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { CentersTable } from "../../components/centers/centers-table";
import { PageHeader } from "../../components/common/PageHeader";

export default function CentersRoute() {
  const { data: centersData, isLoading: isCentersLoading } = useCentersQuery();

  // CentersTable se reutiliza embebida (detalle de empresa/centro), así que la
  // cabecera la pone la ruta, no la tabla.
  return (
    <>
      <PageHeader title="Centros" />
      <CentersTable centers={centersData} loading={isCentersLoading} />
    </>
  );
}
