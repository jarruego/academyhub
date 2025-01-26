import { Alert, Button, Input } from "antd";
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

    return <div>
            <form onSubmit={handleSubmit(submit)}>
                <Controller name="username" control={control} render={({field}) => <Input value={field.value} onChange={field.onChange}/>}/>
                <Controller name="password" control={control} render={({field}) => <Input.Password value={field.value} onChange={field.onChange}/>}/>
                <Button loading={isPending} type="primary" htmlType="submit">Submit</Button>
            </form>
            {error && <Alert type="error" showIcon message={error.status === 401 ? 'No autorizado' : 'Error desconocido'}/>}
        </div>;
}