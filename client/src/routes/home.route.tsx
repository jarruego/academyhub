import { useEffect } from "react";
import CenteredLogo from '../components/CenteredLogo';

export default function HomeRoute() {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  return (
    <CenteredLogo />
  );
}