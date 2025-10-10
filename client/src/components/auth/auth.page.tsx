import { Alert, Button, Input, Form } from "antd";
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

    const submit: SubmitHandler<FormType> = async (info) => {
        const response = await login(info);
        setInfo(response.data);
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
            <img src={logo} alt="Logo" style={{ width: 240, marginBottom: 24 }} />
            <div style={{ maxWidth: 400, width: '100%', background: '#fff', padding: '2rem', border: '1px solid #f0f0f0', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
                <Form layout="vertical">
                    <Form.Item label="Username" name="username">
                        <Controller name="username" control={control} render={({ field }) => <Input id="username" autoComplete="username" placeholder="Username" value={field.value} onChange={field.onChange} />} />
                    </Form.Item>
                    <Form.Item label="Password" name="password">
                        <Controller name="password" control={control} render={({ field }) => <Input.Password id="password" autoComplete="current-password" placeholder="Password" value={field.value} onChange={field.onChange} />} />
                    </Form.Item>
                    <Form.Item>
                        <Button onClick={handleSubmit(submit)} loading={isPending} type="primary" htmlType="submit" block>Submit</Button>
                    </Form.Item>
                </Form>
                {error && <Alert type="error" showIcon message={error.status === 401 ? 'No autorizado' : 'Error desconocido'} />}
            </div>
        </div>
    );
}