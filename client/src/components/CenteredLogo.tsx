import logo from '../assets/logo.png';

export default function CenteredLogo({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '90vh',
      background: `#fff url(${logo}) no-repeat center center`,
      backgroundSize: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {children}
    </div>
  );
}
