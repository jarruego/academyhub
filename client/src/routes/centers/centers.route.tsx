import { useEffect } from "react";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { CentersTable } from "../../components/centers/centers-table";

export default function CentersRoute() {
  const { data: centersData, isLoading: isCentersLoading } = useCentersQuery();

  useEffect(() => {
    document.title = "Centros";
  }, []);

  return (
    <CentersTable
      centers={centersData}
      loading={isCentersLoading}
      navigateState={{ from: '/centers' }}
    />
  );
}
