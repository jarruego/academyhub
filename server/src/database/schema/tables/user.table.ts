import { InferSelectModel } from "drizzle-orm";
import { pgTable, serial, text, integer, boolean, date, pgEnum } from "drizzle-orm/pg-core";
//import { Gender } from "src/types/user/gender.enum";
//import { DocumentType } from "src/types/user/document-type.enum";

//export const gender = pgEnum('gender', Object.values(Gender) as [string, ...string[]]);
//export const documentType = pgEnum('document_type', Object.values(DocumentType) as [string, ...string[]]);


export const userTable = pgTable("users", {
    id_user: serial("id_user").primaryKey(),
    name: text("name").notNull(),
    first_surname: text("first_surname"),
    second_surname: text("second_surname"),
    email: text("email"),
    moodle_username: text("moodle_username").unique(),
    moodle_password: text("moodle_password"),
    moodle_id: integer("moodle_id").unique(),
    //registration_date: date({mode: 'date'}),
    dni: text("dni").unique(),
    phone: text("phone"),
    //document_type: documentType(),
    //nss: text("nss").unique(),
    //gender: gender(),
    //professional_category: text("professional_category"),
    //disability: boolean("disability"),
    //terrorism_victim: boolean("terrorism_victim"),
    //gender_violence_victim: boolean("gender_violence_victim"),
    //education_level: text("education_level"),
    //address: text("address"),
    //postal_code: text("postal_code"),
    //city: text("city"),
    //province: text("province"),
    //country: text("country"),
    //observations: text("observations"),
});

export type UserSelectModel = InferSelectModel<typeof userTable>;
export type UserInsertModel = Omit<UserSelectModel, 'id_user'>;
export type UserUpdateModel = Partial<UserInsertModel>;
