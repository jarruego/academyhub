import { Gender } from "./gender.enum";
import { DocumentType } from "./document-type.enum";

export type User = {
    id_user: number;
    name: string;
    first_surname: string;
    second_surname: string;
    email: string;
    moodle_username: string;
    moodle_password: string;
    moodle_id?: number; 
    dni?: string;
    document_type?: DocumentType;
    phone: string;
    address?: string;
    professional_category?: string;
    disability?: boolean;
    terrorism_victim?: boolean;
    gender_violence_victim?: boolean;
    gender?: Gender;
    education_level?: string;
    postal_code?: string;
    city?: string;
    province?: string;
    country?: string;
    observations?: string;
    registration_date?: Date;
    nss?: string;
}