import { InferSelectModel } from "drizzle-orm";
import { pgTable, serial, text, integer, boolean, date, pgEnum } from "drizzle-orm/pg-core";
import { Gender } from "src/types/user/gender.enum";
import { DocumentType } from "src/types/user/document-type.enum";

export const gender = pgEnum('gender', Object.values(Gender) as [string, ...string[]]);
export const documentType = pgEnum('document_type', Object.values(DocumentType) as [string, ...string[]]);


export const userTable = pgTable("users", {
    id_user: serial("id_user").primaryKey(),
    name: text("name").notNull(),
    surname: text("surname").notNull(),
    dni: text("dni").notNull().unique(),
    document_type: documentType(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    moodle_username: text("moodle_username"),
    moodle_password: text("moodle_password"),
    moodle_id: integer("moodle_id").unique(),
    registration_date: date({mode: 'date'}).notNull(),
    nss: text("nss").notNull(),
    gender: gender(),
    professional_category: text("professional_category").notNull(),
    disability: boolean("disability").notNull(),
    terrorism_victim: boolean("terrorism_victim").notNull(),
    gender_violence_victim: boolean("gender_violence_victim").notNull(),
    education_level: text("education_level").notNull(),
    address: text("address").notNull(),
    postal_code: text("postal_code").notNull(),
    city: text("city").notNull(),
    province: text("province").notNull(),
    country: text("country").notNull(),
    observations: text("observations").notNull(),
});

export type UserSelectModel = InferSelectModel<typeof userTable>;