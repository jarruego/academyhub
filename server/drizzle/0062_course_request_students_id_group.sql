-- Custom SQL migration file, put your code below! --
-- Grupo al que se matriculó un alumno concreto de una petición (null = aún
-- sin matricular). Permite repartir los alumnos de una misma petición entre
-- varios grupos: los ya asignados no se vuelven a seleccionar en el modal de
-- importación, y la petición se cierra sola cuando ya no le queda ninguno
-- por asignar.

ALTER TABLE "academyhub"."course_request_students" ADD COLUMN "id_group" integer;
--> statement-breakpoint
ALTER TABLE "academyhub"."course_request_students" ADD CONSTRAINT "course_request_students_id_group_groups_id_group_fk" FOREIGN KEY ("id_group") REFERENCES "academyhub"."groups"("id_group") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_course_request_students_id_group" ON "academyhub"."course_request_students" USING btree ("id_group");
