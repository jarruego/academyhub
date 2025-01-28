import { Alert, Button, Input, Form, Typography } from "antd";
import { AuthContextInfo } from "../../providers/auth/auth.context";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { useLoginMutation } from "../../hooks/api/auth/use-login.mutation";

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

    return <div style={{ maxWidth: 400, margin: "auto", padding: "2rem", border: "1px solid #f0f0f0", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)" }}>
            <Typography.Title level={2} style={{ textAlign: "center" }}>Login</Typography.Title>
            <Form layout="vertical" onFinish={handleSubmit(submit)}>
                <Form.Item label="Username" name="username">
                    <Controller name="username" control={control} render={({field}) => <Input value={field.value} onChange={field.onChange}/>}/>
                </Form.Item>
                <Form.Item label="Password" name="password">
                    <Controller name="password" control={control} render={({field}) => <Input.Password value={field.value} onChange={field.onChange}/>}/>
                </Form.Item>
                <Form.Item>
                    <Button loading={isPending} type="primary" htmlType="submit" block>Submit</Button>
                </Form.Item>
            </Form>
            {error && <Alert type="error" showIcon message={error.status === 401 ? 'No autorizado' : 'Error desconocido'}/>}
        </div>;
}