import { Button } from "antd";
import { useReimportMoodleMutation } from "../hooks/api/moodle/use-reimport-moodle.mutation";

const ToolList = () => {
  const { mutateAsync: reimport, isPending: isReimporting } = useReimportMoodleMutation();
  return <div>
    <Button onClick={() => reimport()} loading={isReimporting}>Reimportar Datos de la Moodle</Button>
  </div>;
};

export default ToolList;
