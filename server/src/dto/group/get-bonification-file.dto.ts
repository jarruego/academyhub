import { ArrayMinSize, IsArray, IsNumber } from "class-validator";

export class GetBonificationFileDTO {
    @IsArray()
    @ArrayMinSize(1)
    @IsNumber({}, {each: true})
    userIds: number[];

    @IsNumber()
    groupId: number;
}