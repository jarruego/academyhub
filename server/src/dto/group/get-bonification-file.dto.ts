import { ArrayMinSize, IsArray, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class GetBonificationFileDTO {
    @ApiProperty({ type: [Number], description: 'IDs de los usuarios para el archivo de bonificación', minItems: 1 })
    @IsArray()
    @ArrayMinSize(1)
    @IsNumber({}, {each: true})
    userIds: number[];

    @ApiProperty({ type: Number, description: 'ID del grupo' })
    @IsNumber()
    groupId: number;
}