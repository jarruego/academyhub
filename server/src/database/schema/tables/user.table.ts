import { InferSelectModel } from "drizzle-orm";
import { pgTable, serial, text, integer, boolean, date, pgEnum } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { Gender } from "../../../types/user/gender.enum";
import { DocumentType } from "../../../types/user/document-type.enum";

export const gender = pgEnum('gender', Object.values(Gender) as [string, ...string[]]);
export const documentType = pgEnum('document_type', Object.values(DocumentType) as [string, ...string[]]);

export const userTable = pgTable("users", {
    id_user: serial("id_user").primaryKey(),
    name: text("name").notNull(),
    first_surname: text("first_surname"),
    second_surname: text("second_surname"),
    email: text("email"),
    registration_date: date("registration_date", { mode: 'date' }),
    dni: text("dni").unique(), // TODO: DNI is not mandatory, but if provided, it must be unique
    phone: text("phone"),
    nss: text("nss").unique(),
    document_type: documentType("document_type").default(DocumentType.DNI),
    gender: gender("gender").default('Other'), 
    professional_category: text("professional_category"),
    disability: boolean("disability"),
    terrorism_victim: boolean("terrorism_victim"),
    gender_violence_victim: boolean("gender_violence_victim"),
    education_level: text("education_level"),
    address: text("address"),
    postal_code: text("postal_code"),
    city: text("city"),
    province: text("province"),
    country: text("country"),
    observations: text("observations"),
    seasonalWorker: boolean("seasonalWorker").default(false),
    erteLaw: boolean("erteLaw").default(false),
    accreditationDiploma: text("accreditationDiploma").default("N"),
    ...TIMESTAMPS
});

// Modelos generados por Drizzle
export type UserSelectModel = Partial<InferSelectModel<typeof userTable>>; 
export type UserInsertModel = Omit<InferSelectModel<typeof userTable>, 'id_user' | 'createdAt' | 'updatedAt'>;
export type UserUpdateModel = Partial<InferSelectModel<typeof userTable>>;
