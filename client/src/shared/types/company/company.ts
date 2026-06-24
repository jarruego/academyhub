export type Company = {
    id_company: number;
    company_name: string;
    corporate_name: string;
    cif: string;
    center_count?: number;
    user_count?: number;
    main_user_count?: number;
    active_count?: number;
    inactive_count?: number;
    created_at?: Date;
    updated_at?: Date;
};
