import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsPositive, ValidateNested } from "class-validator";

export class UpdateUsersMainCenterDTO {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UserUpdateDTO)
    @ArrayMinSize(1)
    users: UserUpdateDTO[];
}

class UserUpdateDTO {
    @IsNumber()
    @IsPositive()
    userId: number;

    @IsNumber()
    @IsPositive()
    centerId: number;
}