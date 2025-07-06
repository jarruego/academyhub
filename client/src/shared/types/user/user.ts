import { Gender } from "./gender.enum";
import { DocumentType } from "./document-type.enum";

export type User = {
    id_user: number;
    name: string;
    first_surname: string;
    second_surname?: string | null;
    email: string;
    moodle_username?: string | null;
    moodle_password?: string | null;
    moodle_id?: number; 
    dni?: string | null;
    document_type?: DocumentType | null;
    phone?: string | null;
    address?: string | null;
    professional_category?: string | null;
    disability?: boolean | null;
    terrorism_victim?: boolean | null;
    gender_violence_victim?: boolean | null;
    gender?: Gender | null;
    education_level?: string | null;
    postal_code?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    observations?: string | null;
    registration_date?: Date | null;
    nss?: string | null;
    seasonalWorker?: boolean | null;
    erteLaw?: boolean | null;
    accreditationDiploma?: string | null;
    completion_percentage?: number | null;
    time_spent?: number | null;
    centers?: Array<{
        id_center: number;
        center_name: string;
        id_company: number;
        company_name: string;
        is_main_center?: boolean;
        start_date?: string | Date | null;
        end_date?: string | Date | null;
    }>;
}