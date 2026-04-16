import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PdfService } from 'src/common/pdf/pdf.service';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { ReportRenderer } from '../reports/report-renderer.service';
import { UserService } from './user.service';

type UserCourseRow = {
  course?: {
    course_name?: string | null;
    modality?: string | null;
  };
  completion_percentage?: string | null;
};

@Injectable()
export class UserCoursesCertificateService {
  constructor(
    private readonly userService: UserService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly reportRenderer: ReportRenderer,
    private readonly pdfService: PdfService,
  ) {}

  private sanitizeFilenamePart(value: string): string {
    return String(value ?? 'Usuario')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Usuario';
  }

  private async loadAssetBuffer(assetPath: string): Promise<Buffer | undefined> {
    try {
      if (/^https?:\/\//i.test(assetPath)) {
        const response = await fetch(assetPath);
        if (!response.ok) return undefined;
        const arr = await response.arrayBuffer();
        return Buffer.from(arr);
      }

      if (assetPath.startsWith('/api/files/organization/')) {
        const relPath = assetPath.replace(/^\/api\/files\//, '');
        const filePath = path.join(process.cwd(), 'public', relPath);
        return await fs.readFile(filePath);
      }

      const rel = assetPath.replace(/^\/+/, '');
      const fsPath = path.join(process.cwd(), 'public', rel);
      return await fs.readFile(fsPath);
    } catch {
      return undefined;
    }
  }

  async streamByUserId(userId: number, res: Response): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const courses = (await this.userService.findCoursesByUserId(userId)) as UserCourseRow[];
    const completed = (courses ?? []).filter((row) => Number(row?.completion_percentage ?? 0) >= 75);

    if (completed.length === 0) {
      throw new BadRequestException('El usuario no tiene cursos finalizados para certificar');
    }

    let issuerName = '';
    let companyCity = '';
    let logoBuffer: Buffer | undefined;
    let signatureBuffer: Buffer | undefined;

    const orgRow = await this.organizationRepository.findFirst();
    if (orgRow) {
      const settings = (orgRow.settings ?? {}) as Record<string, unknown>;
      const company = (settings['company'] as Record<string, unknown> | undefined) ?? undefined;
      if (company) {
        const responsable = (company.responsable_nombre as string | undefined) ?? '';
        const razon = (company.razon_social as string | undefined) ?? '';
        const cif = (company.cif as string | undefined) ?? '';
        const direccion = (company.direccion as string | undefined) ?? '';
        const ciudad = (company.ciudad as string | undefined) ?? '';

        companyCity = ciudad;
        issuerName = `${responsable ? `D. ${responsable}, ` : ''}${razon ? `administrador de ${razon}` : ''}${cif ? `, con CIF ${cif}` : ''}${direccion ? ` y domicilio en ${direccion}` : ''}.`;
      }

      if (orgRow.logo_path) {
        logoBuffer = await this.loadAssetBuffer(String(orgRow.logo_path));
      }
      if (orgRow.signature_path) {
        signatureBuffer = await this.loadAssetBuffer(String(orgRow.signature_path));
      }
    }

    const fullName = [user.name, user.first_surname, user.second_surname]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim();

    const coursesRows = completed.map((row) => ({
      course_name: row.course?.course_name ?? '-',
      modality: row.course?.modality ?? '-',
      completion: `${Number(row.completion_percentage ?? 0).toFixed(1)}%`,
    }));

    const issueDate = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const ctx: Record<string, unknown> = {
      issuer: issuerName,
      logo: logoBuffer,
      signature: signatureBuffer,
      student_name: fullName || 'Usuario',
      student_dni: user.dni ?? '-',
      rows: coursesRows,
      company_city: companyCity || '---',
      issue_date: issueDate,
    };

    const safeName = this.sanitizeFilenamePart(fullName || `Usuario ${userId}`);
    const fileName = `${safeName} - Certificado Cursos.pdf`;
    const doc = this.pdfService.createDocument({ size: 'A4', margin: 40 });
    this.pdfService.streamDocumentToResponse(doc, res, fileName);
    await this.reportRenderer.renderTemplateIntoDocument(doc, 'user-courses-certificate-v1', ctx);
    this.pdfService.endDocument(doc);
  }
}
