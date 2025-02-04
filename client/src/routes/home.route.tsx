import { Button } from "antd";
import { useReimportMoodleMutation } from "../hooks/api/moodle/use-reimport-moodle.mutation";
import { useEffect } from "react";

export default function HomeRoute() {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <ToolList/>
    </div>
  )
}

const ToolList = () => {
  const { mutateAsync: reimport, isPending: isReimporting } = useReimportMoodleMutation();
  return <div>
    <Button onClick={() => reimport()} loading={isReimporting}>Reimportar Datos de la Moodle</Button>
  </div>
}