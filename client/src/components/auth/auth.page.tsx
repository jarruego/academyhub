import { Alert, Button, Input, Form, theme } from "antd";
import { LoginOutlined } from "@ant-design/icons";
import { AuthContextInfo } from "../../providers/auth/auth.context";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { useLoginMutation } from "../../hooks/api/auth/use-login.mutation";
import logo from '../../assets/logo.png';

type FormType = {
    username: string;
    password: string;
}

type Props = {
    setInfo: (authInfo: AuthContextInfo) => void;
}

export default function AuthPage({ setInfo }: Readonly<Props>) {

    const { handleSubmit, control } = useForm<FormType>();
    const { mutateAsync: login, isPending, error } = useLoginMutation();
    const { token } = theme.useToken();

    const submit: SubmitHandler<FormType> = async (info) => {
        const response = await login(info);
        setInfo(response.data);
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: token.colorBgLayout }}>
            <img src={logo} alt="Logo" style={{ width: 240, marginBottom: 24 }} />
            <div style={{ maxWidth: 400, width: '100%', background: token.colorBgContainer, padding: '2rem', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowTertiary }}>
                <Form layout="vertical">
                    <Form.Item label="Usuario" name="username">
                        <Controller name="username" control={control} render={({ field }) => <Input id="username" autoComplete="username" placeholder="Usuario" value={field.value} onChange={field.onChange} />} />
                    </Form.Item>
                    <Form.Item label="Contraseña" name="password">
                        <Controller name="password" control={control} render={({ field }) => <Input.Password id="password" autoComplete="current-password" placeholder="Contraseña" value={field.value} onChange={field.onChange} />} />
                    </Form.Item>
                    <Form.Item>
                        {/* `primary` = verde de marca: el color de "entrar", opuesto al rojo de cerrar sesión. */}
                        <Button onClick={handleSubmit(submit)} loading={isPending} type="primary" htmlType="submit" icon={<LoginOutlined />} block>
                            Iniciar sesión
                        </Button>
                    </Form.Item>
                </Form>
                {error && <Alert type="error" showIcon message={error.status === 401 ? 'No autorizado' : 'Error desconocido'} />}
            </div>
        </div>
    );
}