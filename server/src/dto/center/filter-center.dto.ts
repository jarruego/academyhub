import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";
import { CenterSelectModel } from "src/database/schema/tables/center.table";

export class FilterCenterDTO implements Partial<CenterSelectModel> {
    @IsString()
    @IsOptional()
    @MaxLength(128)
    center_name: string;

    @IsString()
    @IsOptional()
    @MaxLength(128)
    employer_number: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    id_company: number;

    @IsString()
    @IsOptional()
    @MaxLength(128)
    contact_person: string;

    @IsString()
    @IsOptional()
    @MaxLength(128)
    contact_phone: string;

    @IsString()
    @IsOptional()
    @MaxLength(128)
    contact_email: string;
}