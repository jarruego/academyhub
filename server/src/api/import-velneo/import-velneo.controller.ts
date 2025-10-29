import { Controller, Post, UploadedFile, UseInterceptors, Body, Delete, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportVelneoService } from './import-velneo.service';

@Controller('api/import-velneo')
export class ImportVelneoController {
  constructor(private readonly importVelneoService: ImportVelneoService) {}

  @Post('upload-csv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSV(@UploadedFile() file: Express.Multer.File, @Body('phase') phase?: string) {
    console.log('[ImportVelneoController] uploadCSV recibido:', file);
    if (!file || !file.buffer) {
      console.error('[ImportVelneoController] ERROR: No se recibió el archivo correctamente. file:', file);
      throw new Error('No se recibió el archivo. Verifica el nombre del campo ("file") y el formato (multipart/form-data)');
    }
    // phase debe ser una de: 'users' | 'companies' | 'associate' | 'courses' | 'groups'
    const allowed = ['users', 'companies', 'associate', 'courses', 'groups'];
    if (!phase || !allowed.includes(phase)) {
      throw new BadRequestException('Fase no permitida. Selecciona una fase específica (users/companies/associate/courses/groups) antes de subir.');
    }
    return this.importVelneoService.processCSVAsync(file, phase as any);
  }

}
