import { useState } from "react";
import { Input, Modal, Typography } from "antd";

/**
 * Reautenticación puntual del usuario ya conectado, para confirmar una acción
 * sensible (POST /auth/verify-password) sin volver a iniciar sesión. Genérica
 * a propósito para poder reutilizarse en cualquier acción que lo necesite.
 */
export function ConfirmPasswordModal({ open, title, description, confirmLoading, error, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLoading?: boolean;
  error?: string | null;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");

  const handleCancel = () => {
    setPassword("");
    onCancel();
  };
  const handleOk = () => {
    if (!password) return;
    onConfirm(password);
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="Confirmar"
      okButtonProps={{ danger: true, disabled: !password, loading: confirmLoading }}
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>{description}</div>
      <Input.Password
        autoFocus
        placeholder="Tu contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onPressEnter={handleOk}
      />
      {error && <Typography.Text type="danger" style={{ display: "block", marginTop: 8 }}>{error}</Typography.Text>}
    </Modal>
  );
}
