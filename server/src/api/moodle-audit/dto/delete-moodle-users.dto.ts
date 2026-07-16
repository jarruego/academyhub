import { ArrayNotEmpty, IsArray, IsInt } from "class-validator";

export class DeleteMoodleUsersDto {
  /** moodle_id (IDs de Moodle, no id_moodle_user) de los usuarios a borrar. */
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  moodleIds: number[];
}
